import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { publishQuizzes } from '../scripts/publish-quizzes.js';

const fixturePath = 'quizzes/java/read-write-lock-downgrade.md';
const fixture = (await readFile(new URL(`../${fixturePath}`, import.meta.url), 'utf8'))
  .replace(/^status: published$/m, 'status: draft');
const explanationPath = fixturePath.replace(/\.md$/, '-explain.md');
const explanationFixture = await readFile(new URL(`../${explanationPath}`, import.meta.url), 'utf8');
const illustratedFixture = fixture.replace(
  '\n\n## Answers',
  '\n\n```plantuml\n@startuml\nAlice -> Bob: hello\n@enduml\n```\n\n## Answers',
);

async function createFixtureDirectory(source = fixture) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'publish-quiz-'));
  await mkdir(path.join(root, 'quizzes', 'java'), { recursive: true });
  await writeFile(path.join(root, fixturePath), source);
  await writeFile(path.join(root, explanationPath), explanationFixture);
  return root;
}

function telegramSuccess(messageId) {
  return { ok: true, json: async () => ({ ok: true, result: { message_id: messageId } }) };
}

const logger = { info() {} };

test('pushes the consumed marker before sending context and poll', async () => {
  const root = await createFixtureDirectory();
  const events = [];

  try {
    const results = await publishQuizzes({
      rootDirectory: root,
      token: 'secret-test-token',
      chatId: '@mockingbird',
      siteBaseUrl: 'https://example.test/mock-interview-club-public',
      threadId: '42',
      logger,
      git(args) {
        events.push(`git:${args[0]}`);
      },
      async fetchImplementation(url, request) {
        const status = await readFile(path.join(root, fixturePath), 'utf8');
        assert.match(status, /^status: published$/m);
        events.push(`telegram:${url.split('/').at(-1)}`);
        assert.equal(JSON.parse(request.body).message_thread_id, 42);

        if (url.endsWith('/sendPoll')) {
          const payload = JSON.parse(request.body);
          assert.deepEqual(payload.correct_option_ids, [2]);
          assert.match(
            payload.explanation,
            /More: https:\/\/example\.test\/mock-interview-club-public\/quizzes\/java\/read-write-lock-downgrade-explain\//,
          );
          assert.ok([...payload.explanation].length <= 200);
        }

        return telegramSuccess(42);
      },
    });

    assert.deepEqual(events, ['git:add', 'git:commit', 'git:push', 'telegram:sendMessage', 'telegram:sendPoll']);
    assert.deepEqual(results, [{ id: 'java-read-write-lock-downgrade', messageId: 42 }]);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('rejects an invalid forum topic before consuming a publication attempt', async () => {
  const root = await createFixtureDirectory();

  try {
    await assert.rejects(
      () => publishQuizzes({
        rootDirectory: root,
        token: 'secret-test-token',
        chatId: '-1001234567890',
      siteBaseUrl: 'https://example.test/mock-interview-club-public',
        threadId: 'not-a-topic',
        logger,
      }),
      /must be a positive integer/,
    );

    assert.match(await readFile(path.join(root, fixturePath), 'utf8'), /^status: draft$/m);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('sends a PlantUML image before supporting context and poll', async () => {
  const root = await createFixtureDirectory(illustratedFixture);
  const events = [];

  try {
    await publishQuizzes({
      rootDirectory: root,
      token: 'secret-test-token',
      chatId: '-1001234567890',
      siteBaseUrl: 'https://example.test/mock-interview-club-public',
      threadId: '42',
      logger,
      git(args) {
        events.push(`git:${args[0]}`);
      },
      async fetchImplementation(url, request) {
        const payload = JSON.parse(request.body);
        events.push(`telegram:${url.split('/').at(-1)}`);
        assert.equal(payload.message_thread_id, 42);

        if (url.endsWith('/sendPhoto')) {
          assert.match(payload.photo, /^https:\/\/www\.plantuml\.com\/plantuml\/png\//);
        }

        return telegramSuccess(43);
      },
    });

    assert.deepEqual(events, [
      'git:add',
      'git:commit',
      'git:push',
      'telegram:sendPhoto',
      'telegram:sendMessage',
      'telegram:sendPoll',
    ]);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('does not call Telegram when pushing the publication marker fails', async () => {
  const root = await createFixtureDirectory();
  let telegramCalled = false;

  try {
    await assert.rejects(
      () => publishQuizzes({
        rootDirectory: root,
        token: 'secret-test-token',
        chatId: '@mockingbird',
      siteBaseUrl: 'https://example.test/mock-interview-club-public',
        logger,
        git(args) {
          if (args[0] === 'push') {
            throw new Error('push rejected');
          }
        },
        async fetchImplementation() {
          telegramCalled = true;
        },
      }),
      /push rejected/,
    );

    assert.equal(telegramCalled, false);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('never retries a published quiz after Telegram delivery fails', async () => {
  const root = await createFixtureDirectory();
  let calls = 0;

  try {
    await assert.rejects(
      () => publishQuizzes({
        rootDirectory: root,
        token: 'secret-test-token',
        chatId: '@mockingbird',
      siteBaseUrl: 'https://example.test/mock-interview-club-public',
        logger,
        git() {},
        async fetchImplementation() {
          calls += 1;
          return { ok: false, status: 400, json: async () => ({ ok: false, description: 'invalid chat' }) };
        },
      }),
      /invalid chat/,
    );

    const results = await publishQuizzes({
      rootDirectory: root,
      token: 'secret-test-token',
      chatId: '@mockingbird',
      siteBaseUrl: 'https://example.test/mock-interview-club-public',
      logger,
      git() {},
      async fetchImplementation() {
        calls += 1;
      },
    });

    assert.equal(calls, 1);
    assert.deepEqual(results, []);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('fails before consuming a quiz when Telegram secrets are absent', async () => {
  const root = await createFixtureDirectory();

  try {
    await assert.rejects(
      () => publishQuizzes({ rootDirectory: root, token: '', chatId: '', siteBaseUrl: '', logger }),
      /must all be configured/,
    );

    assert.match(await readFile(path.join(root, fixturePath), 'utf8'), /^status: draft$/m);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('refuses to publish from branches other than main', async () => {
  await assert.rejects(
    () => publishQuizzes({ token: 'token', chatId: '@mockingbird', siteBaseUrl: 'https://example.test', branch: 'feature', logger }),
    /only from the main branch/,
  );
});

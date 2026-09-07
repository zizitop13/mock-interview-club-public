import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { publishQuizLinks } from '../scripts/publish-quiz-links.js';

const fixturePath = 'quizzes/java/read-write-lock-downgrade.md';
const fixture = (await readFile(new URL(`../${fixturePath}`, import.meta.url), 'utf8'))
  .replace(/^status: published$/m, 'status: draft');
const explanationPath = fixturePath.replace(/\.md$/, '-explain.md');
const explanationFixture = await readFile(new URL(`../${explanationPath}`, import.meta.url), 'utf8');
const logger = { info() {} };

async function createFixtureDirectory() {
  const root = await mkdtemp(path.join(os.tmpdir(), 'publish-quiz-link-'));
  await mkdir(path.join(root, 'quizzes', 'java'), { recursive: true });
  await writeFile(path.join(root, fixturePath), fixture);
  await writeFile(path.join(root, explanationPath), explanationFixture);
  return root;
}

test('reserves the quiz before sending only its question and site link', async () => {
  const root = await createFixtureDirectory();
  const events = [];

  try {
    const results = await publishQuizLinks({
      rootDirectory: root,
      token: 'secret-test-token',
      chatId: '@mockingbird',
      threadId: '42',
      siteBaseUrl: 'https://example.test/mock-interview-club-public',
      branch: 'main',
      logger,
      git(args) { events.push(`git:${args[0]}`); },
      async fetchImplementation(url, request) {
        assert.match(await readFile(path.join(root, fixturePath), 'utf8'), /^status: published$/m);
        assert.match(url, /\/sendMessage$/);
        const payload = JSON.parse(request.body);
        assert.equal(payload.message_thread_id, 42);
        assert.equal(payload.parse_mode, 'HTML');
        assert.match(payload.text, /What can happen/);
        assert.match(payload.text, /quizzes\/java\/read-write-lock-downgrade\//);
        assert.doesNotMatch(payload.text, /read-write-lock-downgrade-explain/);
        assert.equal(payload.poll, undefined);
        events.push('telegram:sendMessage');
        return { ok: true, json: async () => ({ ok: true, result: { message_id: 77 } }) };
      },
    });

    assert.deepEqual(events, ['git:add', 'git:commit', 'git:push', 'telegram:sendMessage']);
    assert.deepEqual(results, [{ id: 'java-read-write-lock-downgrade', messageId: 77 }]);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('does not call Telegram when reservation push fails', async () => {
  const root = await createFixtureDirectory();
  let called = false;

  try {
    await assert.rejects(() => publishQuizLinks({
      rootDirectory: root,
      token: 'token',
      chatId: '@mockingbird',
      siteBaseUrl: 'https://example.test',
      branch: 'main',
      logger,
      git(args) {
        if (args[0] === 'push') throw new Error('push rejected');
      },
      async fetchImplementation() { called = true; },
    }), /push rejected/);
    assert.equal(called, false);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('rejects invalid configuration before consuming a draft', async () => {
  const root = await createFixtureDirectory();
  try {
    await assert.rejects(
      () => publishQuizLinks({ rootDirectory: root, token: '', chatId: '', siteBaseUrl: '', branch: 'main', logger }),
      /must all be configured/,
    );
    assert.match(await readFile(path.join(root, fixturePath), 'utf8'), /^status: draft$/m);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

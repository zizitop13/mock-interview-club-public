import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  createContextMessage,
  createDiagramPayload,
  createPollPayload,
  encodePlantUml,
  loadQuizzes,
  markPublished,
  parseQuiz,
} from '../scripts/quiz.js';

const fixturePath = 'quizzes/java/read-write-lock-downgrade.md';
const fixture = (await readFile(new URL(`../${fixturePath}`, import.meta.url), 'utf8'))
  .replace(/^status: published$/m, 'status: draft');
const plantUmlBlock = `\n\n\`\`\`plantuml
@startuml
Alice -> Bob: hello
@enduml
\`\`\``;
const illustratedFixture = fixture.replace('\n\n## Answers', `${plantUmlBlock}\n\n## Answers`);

test('parses the strict Markdown quiz and its hidden correct answer', () => {
  const quiz = parseQuiz(fixture, fixturePath);

  assert.equal(quiz.id, 'java-read-write-lock-downgrade');
  assert.equal(quiz.status, 'draft');
  assert.equal(quiz.question, 'What is wrong with this code?');
  assert.equal(quiz.answers.length, 4);
  assert.equal(quiz.correctAnswer, 'c');
  assert.equal(quiz.correctOptionIndex, 2);
  assert.match(quiz.explanation, /Downgrade safely/);
});

test('rejects paths nested more than one level beneath quizzes', () => {
  assert.throws(
    () => parseQuiz(fixture, 'quizzes/java/concurrency/example.md'),
    /quiz path must match/,
  );
});

test('rejects nonconsecutive answer labels', () => {
  assert.throws(
    () => parseQuiz(fixture.replace('b. Calling', 'e. Calling'), fixturePath),
    /answer 2 must start with b/,
  );
});

test('rejects missing, duplicate, and nonexistent correct answers', () => {
  assert.throws(
    () => parseQuiz(fixture.replace('<!-- correct-answer: c -->', ''), fixturePath),
    /exactly one hidden/,
  );

  assert.throws(
    () => parseQuiz(fixture.replace('<!-- correct-answer: c -->', '<!-- correct-answer: c -->\n<!-- correct-answer: a -->'), fixturePath),
    /exactly one hidden/,
  );

  assert.throws(
    () => parseQuiz(fixture.replace('correct-answer: c', 'correct-answer: z'), fixturePath),
    /correct answer z does not exist/,
  );
});

test('rejects invalid frontmatter, excessively long questions, and long options', () => {
  assert.throws(
    () => parseQuiz(fixture.replace('status: draft', 'status: pending'), fixturePath),
    /status must be draft or published/,
  );

  assert.throws(
    () => parseQuiz(fixture.replace('What is wrong with this code?', 'x'.repeat(301)), fixturePath),
    /first question paragraph/,
  );

  assert.throws(
    () => parseQuiz(fixture.replace('a. Acquiring a read lock after a write lock causes a deadlock.', `a. ${'x'.repeat(101)}`), fixturePath),
    /answer a exceeds 100 characters/,
  );
});

test('creates an anonymous, ordered, non-revotable Telegram quiz payload', () => {
  const quiz = parseQuiz(fixture, fixturePath);
  const payload = createPollPayload(quiz, '@mockingbird');

  assert.deepEqual(payload.correct_option_ids, [2]);
  assert.equal(payload.chat_id, '@mockingbird');
  assert.equal(payload.type, 'quiz');
  assert.equal(payload.is_anonymous, true);
  assert.equal(payload.allows_multiple_answers, false);
  assert.equal(payload.allows_revoting, false);
  assert.equal(payload.shuffle_options, false);
  assert.deepEqual(payload.options, quiz.answers.map(({ text }) => ({ text })));
  assert.equal(Object.hasOwn(payload, 'message_thread_id'), false);
});

test('routes the Telegram quiz to the requested forum topic', () => {
  const quiz = parseQuiz(fixture, fixturePath);
  const payload = createPollPayload(quiz, '-1004403419105', 60);

  assert.equal(payload.chat_id, '-1004403419105');
  assert.equal(payload.message_thread_id, 60);
});

test('formats code as a separate Telegram HTML message', () => {
  const quiz = parseQuiz(fixture, fixturePath);
  const message = createContextMessage(quiz, '@mockingbird');

  assert.equal(message.parse_mode, 'HTML');
  assert.match(message.text, /<pre><code class="language-java">/);
  assert.match(message.text, /cache\.containsKey/);
  assert.equal(Object.hasOwn(message, 'message_thread_id'), false);
});

test('routes the supporting code message to the same forum topic', () => {
  const quiz = parseQuiz(fixture, fixturePath);
  const message = createContextMessage(quiz, '-1004403419105', 60);

  assert.equal(message.chat_id, '-1004403419105');
  assert.equal(message.message_thread_id, 60);
});

test('extracts one PlantUML diagram and removes it from the context message', () => {
  const quiz = parseQuiz(illustratedFixture, fixturePath);
  const diagram = createDiagramPayload(quiz, '-1004403419105', 60);
  const context = createContextMessage(quiz, '-1004403419105', 60);

  assert.equal(quiz.diagramSource, '@startuml\nAlice -> Bob: hello\n@enduml');
  assert.match(diagram.photo, /^https:\/\/www\.plantuml\.com\/plantuml\/png\/[0-9A-Za-z_-]+$/);
  assert.equal(diagram.message_thread_id, 60);
  assert.doesNotMatch(context.text, /plantuml|@startuml/);
  assert.match(context.text, /language-java/);
});

test('uses the PlantUML deflate encoding expected by the public server', () => {
  assert.equal(
    encodePlantUml('@startuml\nAlice -> Bob: hello\n@enduml'),
    'SoWkIImgAStDuNBCoKnELT2rKt3AJx9Io4ZDoSddSaZDIodDpG40',
  );
});

test('rejects multiple or malformed PlantUML diagrams', () => {
  assert.throws(
    () => parseQuiz(illustratedFixture.replace('\n\n## Answers', `${plantUmlBlock}\n\n## Answers`), fixturePath),
    /at most one PlantUML diagram/,
  );
  assert.throws(
    () => parseQuiz(illustratedFixture.replace('@enduml', 'missing-end'), fixturePath),
    /must start with @startuml and end with @enduml/,
  );
});

test('does not create a context message for a plain question', () => {
  const source = fixture.replace(/\n```java\n[\s\S]*?```\n/, '\n');
  const quiz = parseQuiz(source, fixturePath);

  assert.equal(createContextMessage(quiz, '@mockingbird'), null);
});

test('marks a draft as published exactly once', () => {
  const published = markPublished(fixture, fixturePath);

  assert.match(published, /^status: published$/m);
  assert.throws(() => markPublished(published, fixturePath), /only a draft/);
});

test('rejects nested directories while discovering quizzes', async () => {
  const temporaryRoot = await mkdtemp(path.join(os.tmpdir(), 'mock-quiz-'));

  try {
    await mkdir(path.join(temporaryRoot, 'quizzes', 'java', 'nested'), { recursive: true });
    await assert.rejects(() => loadQuizzes(temporaryRoot), /nested directory/);
  } finally {
    await rm(temporaryRoot, { recursive: true, force: true });
  }
});

test('rejects duplicate quiz identifiers', async () => {
  const temporaryRoot = await mkdtemp(path.join(os.tmpdir(), 'mock-quiz-'));

  try {
    const directory = path.join(temporaryRoot, 'quizzes', 'java');
    await mkdir(directory, { recursive: true });
    await writeFile(path.join(directory, 'first.md'), fixture);
    await writeFile(path.join(directory, 'second.md'), fixture);
    await assert.rejects(() => loadQuizzes(temporaryRoot), /duplicate quiz id/);
  } finally {
    await rm(temporaryRoot, { recursive: true, force: true });
  }
});

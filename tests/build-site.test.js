import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { buildSite } from '../scripts/build-site.js';

const rootDirectory = path.resolve(new URL('..', import.meta.url).pathname);

test('generates topic navigation, stable pages, and rendered PlantUML diagrams', async () => {
  const outputDirectory = await mkdtemp(path.join(os.tmpdir(), 'quiz-site-'));

  try {
    const result = await buildSite({ rootDirectory, outputDirectory });
    const navigation = JSON.parse(await readFile(path.join(outputDirectory, '_data', 'navigation.json'), 'utf8'));
    const explanation = await readFile(
      path.join(outputDirectory, 'quizzes', 'kafka', 'partition-count-key-ordering-explain.md'),
      'utf8',
    );
    const quiz = await readFile(
      path.join(outputDirectory, 'quizzes', 'java', 'read-write-lock-downgrade.md'),
      'utf8',
    );

    const navigationQuizCount = navigation.topics
      .reduce((total, topic) => total + topic.quizzes.length, 0);

    assert.equal(result.quizzes, navigationQuizCount);
    assert.ok(result.quizzes >= 3);
    assert.equal(result.topics, navigation.topics.length);
    const topicTitles = navigation.topics.map(({ title }) => title);
    assert.ok(['Java', 'Kafka'].every((title) => topicTitles.includes(title)));
    assert.match(explanation, /permalink: "\/quizzes\/kafka\/partition-count-key-ordering-explain\/"/);
    assert.match(explanation, /https:\/\/www\.plantuml\.com\/plantuml\/svg\//);
    assert.doesNotMatch(explanation, /```plantuml/);
    assert.equal((quiz.match(/<input type="checkbox" data-quiz-answer>/g) ?? []).length, 4);
    assert.equal((quiz.match(/<div class="quiz-answer-row" data-correct="(?:true|false)">/g) ?? []).length, 4);
    assert.match(quiz, /<label class="quiz-answer">[\s\S]*?<strong>a\.<\/strong>/);
    assert.equal((quiz.match(/data-correct="true"/g) ?? []).length, 1);
    assert.equal((quiz.match(/data-correct="false"/g) ?? []).length, 3);
    assert.match(quiz, /data-answer-result hidden/);
    assert.match(quiz, /Another writer can modify or remove the entry/);
    assert.match(quiz, /Read the full explanation/);
    assert.doesNotMatch(quiz, /<details>/);
    assert.doesNotMatch(quiz, /^a\. /m);
    assert.match(explanation, /data-copy-diagram/);
    assert.match(explanation, /<template class="diagram-source">@startuml/);
    assert.match(explanation, /<img[^>]+>[\s\S]*?<button[^>]+data-copy-diagram>/);
  } finally {
    await rm(outputDirectory, { recursive: true, force: true });
  }
});

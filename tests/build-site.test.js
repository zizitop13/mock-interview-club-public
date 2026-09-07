import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { buildSite } from '../scripts/build-site.js';

const rootDirectory = path.resolve(new URL('..', import.meta.url).pathname);

test('generates topic navigation, stable pages, and rendered Mermaid diagrams', async () => {
  const outputDirectory = await mkdtemp(path.join(os.tmpdir(), 'quiz-site-'));

  try {
    const result = await buildSite({ rootDirectory, outputDirectory });
    const navigation = JSON.parse(await readFile(path.join(outputDirectory, '_data', 'navigation.json'), 'utf8'));
    const layout = await readFile(path.join(outputDirectory, '_layouts', 'default.html'), 'utf8');
    const authScript = await readFile(path.join(outputDirectory, 'assets', 'auth.js'), 'utf8');
    const siteScript = await readFile(path.join(outputDirectory, 'assets', 'site.js'), 'utf8');
    const style = await readFile(path.join(outputDirectory, 'assets', 'style.css'), 'utf8');
    const explanation = await readFile(
      path.join(outputDirectory, 'quizzes', 'kafka', 'partition-count-key-ordering-explain.md'),
      'utf8',
    );
    const quiz = await readFile(
      path.join(outputDirectory, 'quizzes', 'java', 'read-write-lock-downgrade.md'),
      'utf8',
    );

    const licenseServerLab = await readFile(
      path.join(outputDirectory, 'labs', 'coding', 'floating-license-server.md'),
      'utf8',
    );
    const licenseServerSolution = await readFile(
      path.join(outputDirectory, 'labs', 'coding', 'floating-license-server-solution.md'),
      'utf8',
    );
    const designLab = await readFile(
      path.join(outputDirectory, 'labs', 'design', 'template-lab.md'),
      'utf8',
    );

    const navigationQuizCount = navigation.topics
      .reduce((total, topic) => total + topic.quizzes.length, 0);
    const navigationLabCount = navigation.lab_tracks
      .reduce((total, track) => total + track.labs.length, 0);

    assert.match(layout, /type="module" src="{{ '\/assets\/auth\.js' \| relative_url }}"/);
    assert.equal((layout.match(/data-auth-provider=/g) ?? []).length, 2);
    assert.match(layout, /data-auth-provider="google"/);
    assert.match(layout, /data-auth-provider="github"/);
    assert.match(layout, /GitHub Pages logs visitors' IP addresses for security purposes/);
    assert.match(authScript, /new GoogleAuthProvider\(\)/);
    assert.match(authScript, /new GithubAuthProvider\(\)/);
    assert.match(authScript, /signInWithPopup\(auth, provider\)/);
    assert.match(authScript, /onAuthStateChanged\(auth/);
    assert.match(authScript, /getFirestore\(app\)/);
    assert.match(authScript, /'users', currentUser\.uid, 'quizAnswers', quizId/);
    assert.match(authScript, /serverTimestamp\(\)/);
    assert.doesNotMatch(authScript, /console\.(info|error)|LOG_PREFIX|logInfo|logError/);
    assert.match(authScript, /error\?\.code/);
    assert.match(authScript, /quiz-answer-save-failed/);
    assert.match(authScript, /Your choice is now locked/);
    assert.match(siteScript, /setQuizAnswerLocked/);
    assert.match(siteScript, /checkbox\.disabled = locked/);
    assert.match(siteScript, /quiz-answer-save-failed/);
    assert.doesNotMatch(authScript, /EmailAuthProvider|signInAnonymously|createUserWithEmailAndPassword/);
    assert.match(style, /\.auth-panel \{/);
    assert.equal(result.quizzes, navigationQuizCount);
    assert.ok(result.quizzes >= 3);
    assert.equal(result.topics, navigation.topics.length);
    assert.equal(result.labs, navigationLabCount);
    assert.equal(result.labTracks, 2);
    assert.deepEqual(navigation.lab_tracks.map(({ slug }) => slug), ['coding', 'design']);
    assert.match(licenseServerLab, /permalink: "\/labs\/coding\/floating-license-server\/"/);
    assert.match(licenseServerLab, /paired_url: "\/labs\/coding\/floating-license-server-solution\/"/);
    assert.match(licenseServerLab, /class="stage-navigation"/);
    assert.match(licenseServerLab, /href="#stage-2-design-shared-storage"/);
    assert.match(licenseServerSolution, /permalink: "\/labs\/coding\/floating-license-server-solution\/"/);
    assert.match(licenseServerSolution, /kind: "Lab solution"/);
    assert.match(licenseServerSolution, /paired_url: "\/labs\/coding\/floating-license-server\/"/);
    assert.equal(navigation.lab_tracks.find(({ slug }) => slug === 'coding').labs.length, 1);
    assert.match(designLab, /https:\/\/mermaid\.ink\/svg\/pako:/);
    assert.match(designLab, /data-copy-diagram/);
    const topicTitles = navigation.topics.map(({ title }) => title);
    assert.ok(['Java', 'Kafka'].every((title) => topicTitles.includes(title)));
    assert.match(explanation, /permalink: "\/quizzes\/kafka\/partition-count-key-ordering-explain\/"/);
    assert.match(explanation, /https:\/\/mermaid\.ink\/svg\/pako:/);
    assert.doesNotMatch(explanation, /```mermaid/);
    assert.equal((quiz.match(/<input type="checkbox" data-quiz-answer value="[a-d]">/g) ?? []).length, 4);
    assert.equal((quiz.match(/<div class="quiz-answer-row" data-correct="(?:true|false)">/g) ?? []).length, 4);
    assert.match(quiz, /<div class="quiz-answers" data-quiz-id="java--read-write-lock-downgrade">/);
    assert.match(quiz, /data-quiz-save-status/);
    assert.match(quiz, /<label class="quiz-answer">[\s\S]*?<strong>a\.<\/strong>/);
    assert.equal((quiz.match(/data-correct="true"/g) ?? []).length, 1);
    assert.equal((quiz.match(/data-correct="false"/g) ?? []).length, 3);
    assert.match(quiz, /data-answer-result hidden/);
    assert.match(quiz, /Another writer can modify or remove the entry/);
    assert.match(quiz, /Read the full explanation/);
    assert.doesNotMatch(quiz, /<details>/);
    assert.doesNotMatch(quiz, /^a\. /m);
    assert.match(explanation, /data-copy-diagram/);
    assert.match(explanation, /<template class="diagram-source">sequenceDiagram/);
    assert.match(explanation, /<img[^>]+>[\s\S]*?<button[^>]+data-copy-diagram>/);
  } finally {
    await rm(outputDirectory, { recursive: true, force: true });
  }
});

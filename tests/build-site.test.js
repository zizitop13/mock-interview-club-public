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
    const index = await readFile(path.join(outputDirectory, 'index.md'), 'utf8');
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
      path.join(outputDirectory, 'labs', 'design', 'shopify-inventory-reservations.md'),
      'utf8',
    );

    const navigationQuizCount = navigation.topics
      .reduce((total, topic) => total + topic.quizzes.length, 0);
    const navigationLabCount = navigation.lab_tracks
      .reduce((total, track) => total + track.labs.length, 0);

    assert.match(layout, /type="module" src="{{ '\/assets\/auth\.js' \| relative_url }}\?v={{ site\.github\.build_revision/);
    assert.equal((layout.match(/data-auth-provider=/g) ?? []).length, 4);
    assert.match(layout, /data-auth-provider="google"/);
    assert.match(layout, /data-auth-provider="github"/);
    assert.match(layout, /id="auth-sign-in-dialog"[\s\S]*?data-auth-provider="google"[\s\S]*?data-auth-provider="github"/);
    assert.match(layout, /GitHub Pages logs visitors' IP addresses for security purposes/);
    assert.match(layout, /written feedback you submit/);
    assert.match(authScript, /new GoogleAuthProvider\(\)/);
    assert.match(authScript, /new GithubAuthProvider\(\)/);
    assert.match(authScript, /signInWithPopup\(auth, provider\)/);
    assert.match(authScript, /showSignInPrompt/);
    assert.match(authScript, /popovertarget.*auth-sign-in-dialog/);
    assert.match(authScript, /loginDialog\?\.hidePopover\?\.\(\)/);
    assert.match(authScript, /onAuthStateChanged\(auth/);
    assert.match(authScript, /getFirestore\(app\)/);
    assert.match(authScript, /runTransaction\(database/);
    assert.match(authScript, /'quizStats', quizId, 'options', answer/);
    assert.match(authScript, /'statistics', 'counted'/);
    assert.match(authScript, /getDocs\(collection\(database, 'quizStats'/);
    assert.match(authScript, /getDocs\(collection\(database, 'users', user\.uid, 'quizAnswers'/);
    assert.match(authScript, /sessionStorage\.setItem\(quizAnswerCacheKey\(user\)/);
    assert.match(authScript, /renderQuizAnswerIndicators\(answers\)/);
    assert.match(authScript, /Answered correctly/);
    assert.match(authScript, /Answered incorrectly/);
    assert.match(authScript, /'users', user\.uid, 'quizAnswers', quizId/);
    assert.match(authScript, /'quizFeedback', feedback\.dataset\.quizId, 'votes', user\.uid/);
    assert.match(authScript, /showExplanationLink\(true\)/);
    assert.match(authScript, /data-feedback-submit/);
    assert.match(authScript, /data-feedback-comment/);
    assert.match(authScript, /updateFeedbackSubmit/);
    assert.match(authScript, /feedbackMatchesSaved/);
    assert.match(authScript, /rating\.addEventListener\('change'/);
    assert.match(authScript, /feedbackComment\?\.addEventListener\('input'/);
    assert.match(authScript, /setSavedFeedback\(currentFeedback\)/);
    assert.match(authScript, /currentUser\?\.uid !== user\.uid/);
    assert.match(authScript, /comment,/);
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
    assert.match(style, /\.inline-sign-in-link \{/);
    assert.match(style, /\.quiz-statistics \{/);
    assert.match(style, /\.quiz-statistics-track \{/);
    assert.match(style, /\.quiz-answer-indicator\.is-correct \{/);
    assert.match(style, /\.quiz-answer-indicator\.is-incorrect \{/);
    assert.match(style, /\.latest-quiz \{/);
    assert.match(style, /@media \(max-width: 860px\)[\s\S]*?\.sidebar \{[\s\S]*?padding-top: 76px;/);
    assert.match(style, /\.quiz-progress-item \.quiz-link \{[\s\S]*?grid-column: 2;/);
    assert.equal(result.quizzes, navigationQuizCount);
    assert.ok(result.quizzes >= 3);
    assert.equal(result.topics, navigation.topics.length);
    assert.equal(result.labs, navigationLabCount);
    assert.equal(result.labTracks, 2);
    assert.deepEqual(navigation.lab_tracks.map(({ slug }) => slug), ['coding', 'design']);
    assert.ok(navigation.topics.every((topic) => topic.quizzes.every((item) => item.id && item.correct_answer)));
    assert.equal((index.match(/data-quiz-list-item/g) ?? []).length, navigationQuizCount);
    assert.equal((index.match(/data-quiz-answer-indicator/g) ?? []).length, navigationQuizCount);
    assert.match(index, /<section class="latest-quiz" data-latest-quiz/);
    assert.match(index, /class="latest-quiz-title"><a href="{{ '\/quizzes\/[a-z0-9-]+\/[a-z0-9-]+\/' \| relative_url }}">/);
    assert.match(index, /data-quiz-id="[a-z0-9-]+--[a-z0-9-]+"/);
    assert.equal((index.match(/<input type="checkbox" data-quiz-answer value="[a-d]">/g) ?? []).length, 4);
    assert.match(index, /Open the quiz page →/);
    assert.match(index, /class="quiz-index-item"[^>]+data-correct-answer="[a-l]"/);
    assert.match(layout, /class="nav-item quiz-progress-item"[\s\S]*?data-quiz-id="{{ quiz\.id }}"[\s\S]*?data-correct-answer="{{ quiz\.correct_answer }}"/);
    assert.match(licenseServerLab, /permalink: "\/labs\/coding\/floating-license-server\/"/);
    assert.match(licenseServerLab, /paired_url: "\/labs\/coding\/floating-license-server-solution\/"/);
    assert.match(licenseServerLab, /class="stage-navigation"/);
    assert.match(licenseServerLab, /href="#stage-2-design-shared-storage"/);
    assert.match(licenseServerSolution, /permalink: "\/labs\/coding\/floating-license-server-solution\/"/);
    assert.match(licenseServerSolution, /kind: "Lab solution"/);
    assert.match(licenseServerSolution, /paired_url: "\/labs\/coding\/floating-license-server\/"/);
    assert.equal(navigation.lab_tracks.find(({ slug }) => slug === 'coding').labs.length, 1);
    assert.match(designLab, /permalink: "\/labs\/design\/shopify-inventory-reservations\/"/);
    assert.match(designLab, /class="lab-prompt"/);
    assert.equal((designLab.match(/class="lab-workspace"/g) ?? []).length, 8);
    assert.match(designLab, /https:\/\/excalidraw\.com\/\?embed=true&amp;theme=dark/);
    assert.match(designLab, /Functional requirements&lt;br\/&gt;3 min/);
    assert.match(designLab, /Deep dives&lt;br\/&gt;15 min/);
    assert.match(designLab, /https:\/\/mermaid\.ink\/svg\/pako:/);
    assert.match(designLab, /data-copy-diagram/);
    const topicTitles = navigation.topics.map(({ title }) => title);
    assert.ok(['Java', 'Kafka'].every((title) => topicTitles.includes(title)));
    assert.match(explanation, /permalink: "\/quizzes\/kafka\/partition-count-key-ordering-explain\/"/);
    assert.match(explanation, /data-quiz-feedback/);
    assert.equal((explanation.match(/data-feedback-rating/g) ?? []).length, 10);
    assert.match(explanation, />Code smells</);
    assert.match(explanation, />Brilliant</);
    assert.match(explanation, />Overcomplicated</);
    assert.match(explanation, />Wrong answer</);
    assert.match(explanation, />Incorrect question</);
    assert.match(explanation, /data-feedback-comment maxlength="1000"/);
    assert.match(explanation, /data-feedback-status[\s\S]*?popovertarget="auth-sign-in-dialog"/);
    assert.match(explanation, /Up to 1,000 characters/);
    assert.doesNotMatch(layout, /class="explanation-link"/);
    assert.match(explanation, /https:\/\/mermaid\.ink\/svg\/pako:/);
    assert.doesNotMatch(explanation, /```mermaid/);
    assert.equal((quiz.match(/<input type="checkbox" data-quiz-answer value="[a-d]">/g) ?? []).length, 4);
    assert.equal((quiz.match(/<div class="quiz-answer-row" data-correct="(?:true|false)">/g) ?? []).length, 4);
    assert.match(quiz, /<div class="quiz-answers" data-quiz-id="java--read-write-lock-downgrade">/);
    assert.match(quiz, /data-quiz-save-status[\s\S]*?popovertarget="auth-sign-in-dialog"/);
    assert.match(quiz, /<label class="quiz-answer">[\s\S]*?<strong>a\.<\/strong>/);
    assert.equal((quiz.match(/data-correct="true"/g) ?? []).length, 1);
    assert.equal((quiz.match(/data-correct="false"/g) ?? []).length, 3);
    assert.match(quiz, /data-answer-result hidden/);
    assert.match(quiz, /data-quiz-statistics[^>]+hidden/);
    assert.equal((quiz.match(/data-quiz-stat-option="[a-d]"/g) ?? []).length, 4);
    assert.equal((quiz.match(/role="progressbar"/g) ?? []).length, 4);
    assert.match(quiz, /Community answers/);
    assert.match(quiz, /Another writer can modify or remove the entry/);
    assert.match(quiz, /data-explanation-link[^>]+hidden/);
    assert.doesNotMatch(quiz, /paired_url: "\/quizzes\/java\/read-write-lock-downgrade-explain\/"/);
    assert.doesNotMatch(quiz, /<details>/);
    assert.doesNotMatch(quiz, /^a\. /m);
    assert.match(explanation, /data-copy-diagram/);
    assert.match(explanation, /<template class="diagram-source">sequenceDiagram/);
    assert.match(explanation, /<img[^>]+>[\s\S]*?<button[^>]+data-copy-diagram>/);
  } finally {
    await rm(outputDirectory, { recursive: true, force: true });
  }
});

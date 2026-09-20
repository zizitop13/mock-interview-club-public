import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { resolveQuizProject, testQuizProject } from '../scripts/quiz-project-runner.js';

const quiz = { id: 'jdbc-example', filePath: 'quizzes/jdbc/example.md' };

async function createProject() {
  const root = await mkdtemp(path.join(os.tmpdir(), 'quiz-project-'));
  const project = path.join(root, 'quiz-projects', 'spring', 'hibernate', quiz.id);
  await mkdir(project, { recursive: true });
  await writeFile(path.join(project, 'pom.xml'), '<project/>');
  return { root, project };
}

test('resolves the one Maven module whose directory matches the quiz id', async () => {
  const { root, project } = await createProject();

  try {
    assert.equal(await resolveQuizProject(quiz, root), project);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('runs Maven tests for the matching quiz before publication', async () => {
  const { root, project } = await createProject();
  const calls = [];

  try {
    await testQuizProject(quiz, {
      rootDirectory: root,
      logger: { info() {} },
      execute(command, args, options) {
        calls.push({ command, args, options });
      },
    });

    assert.equal(calls[0].command, 'mvn');
    assert.deepEqual(calls[0].args.slice(-2), [path.join(project, 'pom.xml'), 'test']);
    assert.equal(calls[0].options.cwd, root);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

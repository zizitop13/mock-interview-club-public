import { execFileSync } from 'node:child_process';
import { access, readdir } from 'node:fs/promises';
import path from 'node:path';

async function findMatchingProjects(directory, quizId, matches = []) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.name === 'target' || entry.name === 'compose') {
      continue;
    }

    const child = path.join(directory, entry.name);

    if (entry.name === quizId) {
      matches.push(child);
    } else {
      await findMatchingProjects(child, quizId, matches);
    }
  }

  return matches;
}

export async function resolveQuizProject(quiz, rootDirectory = process.cwd()) {
  const projectsRoot = path.join(rootDirectory, 'quiz-projects');
  const matches = await findMatchingProjects(projectsRoot, quiz.id);

  if (matches.length !== 1) {
    throw new Error(`${quiz.filePath}: expected exactly one runnable project named ${quiz.id}, found ${matches.length}`);
  }

  await access(path.join(matches[0], 'pom.xml'));
  return matches[0];
}

export async function testQuizProject(quiz, {
  rootDirectory = process.cwd(),
  execute = execFileSync,
  logger = console,
} = {}) {
  const projectDirectory = await resolveQuizProject(quiz, rootDirectory);
  logger.info(`Testing runnable project for ${quiz.id}.`);
  execute('mvn', ['--batch-mode', '--no-transfer-progress', '--file', path.join(projectDirectory, 'pom.xml'), 'test'], {
    cwd: rootDirectory,
    stdio: 'inherit',
  });
}

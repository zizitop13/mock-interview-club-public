import { loadQuizzes } from './quiz.js';

try {
  const quizzes = await loadQuizzes();

  for (const quiz of quizzes) {
    console.log(`${quiz.status.padEnd(9)} ${quiz.filePath}`);
  }

  console.log(`Validated ${quizzes.length} quiz(es).`);
} catch (error) {
  console.error(`Quiz validation failed: ${error.message}`);
  process.exitCode = 1;
}

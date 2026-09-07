import { execFileSync } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { createQuizUrl, loadQuizzes, markPublished } from './quiz.js';

function runGit(args, rootDirectory) {
  return execFileSync('git', args, {
    cwd: rootDirectory,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

function escapeHtml(value) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

async function callTelegram(payload, { token, fetchImplementation }) {
  const response = await fetchImplementation(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(30_000),
  });
  const result = await response.json();

  if (!response.ok || !result.ok) {
    throw new Error(`Telegram sendMessage failed: ${result.description ?? `HTTP ${response.status}`}`);
  }

  return result.result;
}

export async function publishQuizLinks({
  rootDirectory = process.cwd(),
  token = process.env.TELEGRAM_BOT_TOKEN,
  chatId = process.env.TELEGRAM_CHAT_ID,
  threadId = process.env.TELEGRAM_MESSAGE_THREAD_ID,
  siteBaseUrl = process.env.QUIZ_SITE_BASE_URL,
  branch = process.env.GITHUB_REF_NAME ?? 'main',
  fetchImplementation = fetch,
  git = runGit,
  logger = console,
} = {}) {
  if (!token || !chatId || !siteBaseUrl) {
    throw new Error('TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID, and QUIZ_SITE_BASE_URL must all be configured');
  }
  if (branch !== 'main') throw new Error('quiz publication is allowed only from the main branch');

  let messageThreadId;
  if (threadId !== undefined && threadId !== '') {
    if (!/^\d+$/.test(String(threadId)) || !Number.isSafeInteger(Number(threadId)) || Number(threadId) < 1) {
      throw new Error('TELEGRAM_MESSAGE_THREAD_ID must be a positive integer');
    }
    messageThreadId = Number(threadId);
  }

  const drafts = (await loadQuizzes(rootDirectory)).filter((quiz) => quiz.status === 'draft');
  if (drafts.length === 0) {
    logger.info('No draft quizzes found.');
    return [];
  }

  const results = [];
  for (const quiz of drafts) {
    const absolutePath = path.join(rootDirectory, quiz.filePath);
    const source = await readFile(absolutePath, 'utf8');

    // Reserve remotely before Telegram delivery. A failed delivery is not retried.
    await writeFile(absolutePath, markPublished(source, quiz.filePath));
    git(['add', '--', quiz.filePath], rootDirectory);
    git(['commit', '-m', `chore(quizzes): reserve publication of ${quiz.id}`], rootDirectory);
    git(['push', 'origin', `HEAD:${branch}`], rootDirectory);

    const quizUrl = createQuizUrl(quiz, siteBaseUrl);
    const payload = {
      chat_id: chatId,
      ...(messageThreadId === undefined ? {} : { message_thread_id: messageThreadId }),
      text: `<b>${escapeHtml(quiz.question)}</b>\n\n<a href="${escapeHtml(quizUrl)}">Answer on the website →</a>`,
      parse_mode: 'HTML',
    };
    const message = await callTelegram(payload, { token, fetchImplementation });
    logger.info(`Published link for ${quiz.id}; Telegram message ID: ${message.message_id}.`);
    results.push({ id: quiz.id, messageId: message.message_id });
  }

  return results;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    await publishQuizLinks();
  } catch (error) {
    console.error(`Quiz link publication failed: ${error.message}`);
    process.exitCode = 1;
  }
}

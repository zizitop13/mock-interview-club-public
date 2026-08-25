import { execFileSync } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  createContextMessage,
  createDiagramPayload,
  createPollPayload,
  loadQuizzes,
  markPublished,
} from './quiz.js';

function runGit(args, rootDirectory) {
  return execFileSync('git', args, {
    cwd: rootDirectory,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

async function callTelegram(method, payload, { token, fetchImplementation }) {
  const response = await fetchImplementation(`https://api.telegram.org/bot${token}/${method}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(30_000),
  });

  const result = await response.json();

  if (!response.ok || !result.ok) {
    throw new Error(`Telegram ${method} failed: ${result.description ?? `HTTP ${response.status}`}`);
  }

  return result.result;
}

export async function publishQuizzes({
  rootDirectory = process.cwd(),
  token = process.env.TELEGRAM_BOT_TOKEN,
  chatId = process.env.TELEGRAM_CHAT_ID,
  threadId = process.env.TELEGRAM_MESSAGE_THREAD_ID,
  branch = process.env.GITHUB_REF_NAME ?? 'main',
  fetchImplementation = fetch,
  git = runGit,
  logger = console,
} = {}) {
  if (!token || !chatId) {
    throw new Error('TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID must both be configured');
  }

  if (branch !== 'main') {
    throw new Error('quiz publication is allowed only from the main branch');
  }

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

    // Persist the consumed attempt remotely before making any Telegram request.
    // A failed delivery is deliberately not retried: at-most-once beats delivery.
    await writeFile(absolutePath, markPublished(source, quiz.filePath));
    git(['add', '--', quiz.filePath], rootDirectory);
    git(['commit', '-m', `chore(quizzes): reserve publication of ${quiz.id}`], rootDirectory);
    git(['push', 'origin', `HEAD:${branch}`], rootDirectory);

    logger.info(`Reserved publication of ${quiz.id} in ${branch}.`);

    const diagram = createDiagramPayload(quiz, chatId, messageThreadId);

    if (diagram) {
      await callTelegram('sendPhoto', diagram, { token, fetchImplementation });
    }

    const contextMessage = createContextMessage(quiz, chatId, messageThreadId);

    if (contextMessage) {
      await callTelegram('sendMessage', contextMessage, { token, fetchImplementation });
    }

    const message = await callTelegram('sendPoll', createPollPayload(quiz, chatId, messageThreadId), {
      token,
      fetchImplementation,
    });

    logger.info(`Published ${quiz.id}; Telegram message ID: ${message.message_id}.`);
    results.push({ id: quiz.id, messageId: message.message_id });
  }

  return results;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    await publishQuizzes();
  } catch (error) {
    // Do not print URLs: Telegram bot tokens are part of Bot API endpoint URLs.
    console.error(`Quiz publication failed: ${error.message}`);
    process.exitCode = 1;
  }
}

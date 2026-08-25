import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

const TOPIC_PATTERN = /^[a-z][a-z0-9-]*$/;
const ID_PATTERN = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;
const FRONTMATTER_PATTERN = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/;
const ANSWER_PATTERN = /^([a-z])\.\s+(.+?)\s*$/;
const CORRECT_ANSWER_PATTERN = /<!--\s*correct-answer:\s*([a-z])\s*-->/g;
const DETAILS_PATTERN = /^<details>\s*\n<summary>Answer explanation<\/summary>\s*\n([\s\S]*?)\n<\/details>\s*$/;

function fail(filePath, message) {
  throw new Error(`${filePath}: ${message}`);
}

function characterCount(value) {
  return [...value].length;
}

function parseFrontmatter(source, filePath) {
  const match = source.match(FRONTMATTER_PATTERN);

  if (!match) {
    fail(filePath, 'expected YAML frontmatter containing id and status');
  }

  const metadata = Object.create(null);

  for (const line of match[1].split(/\r?\n/)) {
    const entry = line.match(/^([a-z_]+):\s*([^\n]+?)\s*$/);

    if (!entry) {
      fail(filePath, `invalid frontmatter line: ${line}`);
    }

    if (Object.hasOwn(metadata, entry[1])) {
      fail(filePath, `duplicate frontmatter field: ${entry[1]}`);
    }

    metadata[entry[1]] = entry[2];
  }

  const fields = Object.keys(metadata).sort().join(',');

  if (fields !== 'id,status') {
    fail(filePath, 'frontmatter must contain exactly id and status');
  }

  if (!ID_PATTERN.test(metadata.id)) {
    fail(filePath, 'id must be lowercase kebab-case');
  }

  if (!['draft', 'published'].includes(metadata.status)) {
    fail(filePath, 'status must be draft or published');
  }

  return { metadata, body: source.slice(match[0].length).trim() };
}

function parseLocation(filePath) {
  const normalized = filePath.replaceAll('\\', '/');
  const match = normalized.match(/^quizzes\/([^/]+)\/([^/]+)\.md$/);

  if (!match) {
    fail(filePath, 'quiz path must match quizzes/<topic>/<slug>.md');
  }

  if (!TOPIC_PATTERN.test(match[1]) || !ID_PATTERN.test(match[2])) {
    fail(filePath, 'topic and filename must be lowercase kebab-case');
  }

  return { topic: match[1], slug: match[2] };
}

function firstParagraph(value) {
  return value.trim().split(/\n\s*\n/, 1)[0].replace(/\s+/g, ' ').trim();
}

function shortenExplanation(value) {
  const paragraph = firstParagraph(value);

  if (characterCount(paragraph) <= 200) {
    return paragraph;
  }

  return `${[...paragraph].slice(0, 197).join('').trimEnd()}...`;
}

export function parseQuiz(source, filePath) {
  const location = parseLocation(filePath);
  const { metadata, body } = parseFrontmatter(source, filePath);
  const sectionMatch = body.match(/^## Question\s*\n([\s\S]*?)\n## Answers\s*\n([\s\S]*)$/);

  if (!metadata.id.startsWith(`${location.topic}-`)) {
    fail(filePath, `id must start with ${location.topic}-`);
  }

  if (!sectionMatch) {
    fail(filePath, 'expected ## Question followed by ## Answers');
  }

  const questionBody = sectionMatch[1].trim();
  const question = firstParagraph(questionBody);

  if (!question || characterCount(question) > 300) {
    fail(filePath, 'the first question paragraph must contain 1–300 characters');
  }

  const matches = [...sectionMatch[2].matchAll(CORRECT_ANSWER_PATTERN)];

  if (matches.length !== 1) {
    fail(filePath, 'expected exactly one hidden correct-answer HTML comment');
  }

  const correctAnswer = matches[0][1];
  const answersSource = sectionMatch[2].slice(0, matches[0].index).trim();
  const detailsSource = sectionMatch[2].slice(matches[0].index + matches[0][0].length).trim();
  const lines = answersSource.split(/\r?\n/).filter((line) => line.trim());

  if (lines.length < 2 || lines.length > 12) {
    fail(filePath, 'expected 2–12 answer options');
  }

  const answers = lines.map((line, index) => {
    const answer = line.match(ANSWER_PATTERN);
    const expectedLetter = String.fromCharCode(97 + index);

    if (!answer || answer[1] !== expectedLetter) {
      fail(filePath, `answer ${index + 1} must start with ${expectedLetter}.`);
    }

    if (characterCount(answer[2]) > 100) {
      fail(filePath, `answer ${answer[1]} exceeds 100 characters`);
    }

    return { letter: answer[1], text: answer[2] };
  });

  const correctOptionIndex = answers.findIndex((answer) => answer.letter === correctAnswer);

  if (correctOptionIndex === -1) {
    fail(filePath, `correct answer ${correctAnswer} does not exist`);
  }

  const details = detailsSource.match(DETAILS_PATTERN);

  if (!details || !details[1].trim()) {
    fail(filePath, 'expected a nonempty collapsed <details> answer explanation');
  }

  const explanation = details[1].trim();

  return {
    ...location,
    id: metadata.id,
    status: metadata.status,
    filePath,
    question,
    questionBody,
    answers,
    correctAnswer,
    correctOptionIndex,
    explanation,
    telegramExplanation: shortenExplanation(explanation),
  };
}

export function markPublished(source, filePath) {
  const { metadata } = parseFrontmatter(source, filePath);

  if (metadata.status !== 'draft') {
    fail(filePath, 'only a draft quiz can reserve a publication attempt');
  }

  return source.replace(/^(status:\s*)draft\s*$/m, '$1published');
}

export function createPollPayload(quiz, chatId, messageThreadId) {
  return {
    chat_id: chatId,
    ...(messageThreadId === undefined ? {} : { message_thread_id: messageThreadId }),
    question: quiz.question,
    options: quiz.answers.map(({ text }) => ({ text })),
    type: 'quiz',
    is_anonymous: true,
    allows_multiple_answers: false,
    allows_revoting: false,
    shuffle_options: false,
    correct_option_ids: [quiz.correctOptionIndex],
    explanation: quiz.telegramExplanation,
  };
}

export function createContextMessage(quiz, chatId, messageThreadId) {
  if (quiz.questionBody === quiz.question) {
    return null;
  }

  const escaped = quiz.questionBody
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');

  const text = escaped.replace(/```([a-zA-Z0-9_-]*)\n([\s\S]*?)```/g, (_match, language, code) => {
    const className = language ? ` class="language-${language}"` : '';
    return `<pre><code${className}>${code.replace(/\n$/, '')}</code></pre>`;
  });

  if (characterCount(quiz.questionBody) > 4096) {
    fail(quiz.filePath, 'supporting Telegram message exceeds 4096 characters');
  }

  return {
    chat_id: chatId,
    ...(messageThreadId === undefined ? {} : { message_thread_id: messageThreadId }),
    text,
    parse_mode: 'HTML',
  };
}

export async function loadQuizzes(rootDirectory = process.cwd()) {
  const quizzesDirectory = path.join(rootDirectory, 'quizzes');
  const topics = await readdir(quizzesDirectory, { withFileTypes: true });
  const quizzes = [];

  for (const topic of topics.sort((left, right) => left.name.localeCompare(right.name))) {
    if (!topic.isDirectory() || !TOPIC_PATTERN.test(topic.name)) {
      throw new Error(`quizzes/${topic.name}: expected a lowercase topic directory`);
    }

    const entries = await readdir(path.join(quizzesDirectory, topic.name), { withFileTypes: true });

    for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
      const relativePath = `quizzes/${topic.name}/${entry.name}`;

      if (!entry.isFile() || !entry.name.endsWith('.md')) {
        throw new Error(`${relativePath}: expected a Markdown file, not a nested directory`);
      }

      const source = await readFile(path.join(rootDirectory, relativePath), 'utf8');
      quizzes.push(parseQuiz(source, relativePath));
    }
  }

  const seen = new Set();

  for (const quiz of quizzes) {
    if (seen.has(quiz.id)) {
      throw new Error(`${quiz.filePath}: duplicate quiz id ${quiz.id}`);
    }

    seen.add(quiz.id);
  }

  return quizzes;
}

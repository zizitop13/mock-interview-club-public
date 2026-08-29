import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { deflateSync } from 'node:zlib';

const TOPIC_PATTERN = /^[a-z][a-z0-9-]*$/;
const ID_PATTERN = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;
const FRONTMATTER_PATTERN = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/;
const ANSWER_PATTERN = /^([a-z])\.\s+(.+?)\s*$/;
const CORRECT_ANSWER_PATTERN = /<!--\s*correct-answer:\s*([a-z])\s*-->/g;
const DETAILS_PATTERN = /^<details>\s*\n<summary>Answer explanation<\/summary>\s*\n([\s\S]*?)\n<\/details>\s*$/;
const EXPLANATION_PATTERN = /^#\s+[^\n]+\n+## Correct answer\s*\n([\s\S]*?)\n## Detailed explanation\s*\n([\s\S]*?)\n## Code example\s*\n([\s\S]*?)\n## Why the other options are incorrect\s*\n([\s\S]*?)\s*$/;
const EXPLANATION_CODE_PATTERN = /```(?!mermaid\b)[a-zA-Z0-9_-]+\s*\n[\s\S]*?\n```/i;
const MERMAID_PATTERN = /```mermaid\s*\n([\s\S]*?)\n```/gi;
const MERMAID_IMAGE_URL = 'https://mermaid.ink/img';

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

function shortenTo(value, maximumLength) {
  if (characterCount(value) <= maximumLength) {
    return value;
  }

  if (maximumLength < 4) {
    return [...value].slice(0, maximumLength).join('');
  }

  return `${[...value].slice(0, maximumLength - 3).join('').trimEnd()}...`;
}

export function encodeMermaid(source) {
  const state = JSON.stringify({
    code: source,
    mermaid: { theme: 'default' },
    autoSync: true,
    updateDiagram: true,
  });
  return `pako:${deflateSync(Buffer.from(state, 'utf8'), { level: 9 }).toString('base64url')}`;
}

function extractMermaid(questionBody, filePath) {
  const diagrams = [...questionBody.matchAll(MERMAID_PATTERN)];

  if (diagrams.length > 1) {
    fail(filePath, 'expected at most one Mermaid diagram');
  }

  if (diagrams.length === 0) {
    return { diagramSource: null, contextBody: questionBody };
  }

  const diagramSource = diagrams[0][1].trim();

  if (!diagramSource) {
    fail(filePath, 'Mermaid diagram must not be empty');
  }

  const contextBody = questionBody
    .replace(MERMAID_PATTERN, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  return { diagramSource, contextBody };
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
  const { diagramSource, contextBody } = extractMermaid(questionBody, filePath);

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
    contextBody,
    diagramSource,
    answers,
    correctAnswer,
    correctOptionIndex,
    explanation,
    telegramExplanation: shortenExplanation(explanation),
  };
}

export function parseQuizExplanation(source, quiz, filePath) {
  const expectedPath = quiz.filePath.replace(/\.md$/, '-explain.md');

  if (filePath !== expectedPath) {
    fail(filePath, `explanation path must match ${expectedPath}`);
  }

  const sections = source.trim().match(EXPLANATION_PATTERN);

  if (!sections) {
    fail(filePath, 'expected a title followed by correct answer, detailed explanation, code example, and incorrect options sections');
  }

  const correctAnswer = sections[1].trim();
  const expectedAnswer = `${quiz.correctAnswer}. ${quiz.answers[quiz.correctOptionIndex].text}`;

  if (correctAnswer !== expectedAnswer) {
    fail(filePath, `correct answer must match the quiz: ${expectedAnswer}`);
  }

  const detailedExplanation = sections[2].trim();
  const codeExample = sections[3].trim();
  const incorrectOptions = sections[4].trim();

  if (!detailedExplanation) {
    fail(filePath, 'detailed explanation must not be empty');
  }

  if (!EXPLANATION_CODE_PATTERN.test(codeExample)) {
    fail(filePath, 'code example must include a fenced code block with a language');
  }

  const explainedOptions = incorrectOptions
    .split(/\r?\n/)
    .filter((line) => line.trim())
    .map((line) => {
      const option = line.match(/^-\s+([a-z])\.\s+(.+)$/);

      if (!option) {
        fail(filePath, 'incorrect options must use one bullet per option: - a. Explanation');
      }

      return option[1];
    });
  const expectedOptions = quiz.answers
    .filter((answer) => answer.letter !== quiz.correctAnswer)
    .map((answer) => answer.letter);

  if (explainedOptions.join(',') !== expectedOptions.join(',')) {
    fail(filePath, `incorrect options must explain ${expectedOptions.join(', ')} in order`);
  }

  extractMermaid(source, filePath);

  return {
    filePath,
    correctAnswer,
    detailedExplanation,
    codeExample,
    incorrectOptions,
  };
}

export function markPublished(source, filePath) {
  const { metadata } = parseFrontmatter(source, filePath);

  if (metadata.status !== 'draft') {
    fail(filePath, 'only a draft quiz can reserve a publication attempt');
  }

  return source.replace(/^(status:\s*)draft\s*$/m, '$1published');
}

export function createExplanationUrl(quiz, siteBaseUrl) {
  let baseUrl;

  try {
    baseUrl = new URL(`${siteBaseUrl.replace(/\/+$/, '')}/`);
  } catch {
    fail(quiz.filePath, 'QUIZ_SITE_BASE_URL must be a valid HTTP or HTTPS URL');
  }

  if (!['http:', 'https:'].includes(baseUrl.protocol)) {
    fail(quiz.filePath, 'QUIZ_SITE_BASE_URL must use HTTP or HTTPS');
  }

  const explanationPath = quiz.explanationFilePath ?? quiz.filePath.replace(/\.md$/, '-explain.md');
  const pagePath = explanationPath
    .replace(/\.md$/, '')
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/');

  return new URL(`${pagePath}/`, baseUrl).toString();
}

export function createTelegramExplanation(shortExplanation, explanationUrl) {
  if (!explanationUrl) {
    return shortExplanation;
  }

  const suffix = `\n\nMore: ${explanationUrl}`;
  const remainingLength = 200 - characterCount(suffix);

  if (remainingLength < 1) {
    throw new Error('the detailed explanation URL is too long for a Telegram quiz explanation');
  }

  return `${shortenTo(shortExplanation, remainingLength)}${suffix}`;
}

export function createPollPayload(quiz, chatId, messageThreadId, explanationUrl) {
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
    open_period: 86_400,
    correct_option_ids: [quiz.correctOptionIndex],
    explanation: createTelegramExplanation(quiz.telegramExplanation, explanationUrl),
  };
}

export function createContextMessage(quiz, chatId, messageThreadId) {
  if (quiz.contextBody === quiz.question) {
    return null;
  }

  const escaped = quiz.contextBody
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');

  const text = escaped.replace(/```([a-zA-Z0-9_-]*)\n([\s\S]*?)```/g, (_match, language, code) => {
    const className = language ? ` class="language-${language}"` : '';
    return `<pre><code${className}>${code.replace(/\n$/, '')}</code></pre>`;
  });

  if (characterCount(quiz.contextBody) > 4096) {
    fail(quiz.filePath, 'supporting Telegram message exceeds 4096 characters');
  }

  return {
    chat_id: chatId,
    ...(messageThreadId === undefined ? {} : { message_thread_id: messageThreadId }),
    text,
    parse_mode: 'HTML',
  };
}

export function createDiagramPayload(quiz, chatId, messageThreadId) {
  if (!quiz.diagramSource) {
    return null;
  }

  return {
    chat_id: chatId,
    ...(messageThreadId === undefined ? {} : { message_thread_id: messageThreadId }),
    photo: `${MERMAID_IMAGE_URL}/${encodeMermaid(quiz.diagramSource)}?type=png&bgColor=F7F8FA`,
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

    const sortedEntries = entries.sort((left, right) => left.name.localeCompare(right.name));
    const filenames = new Set(sortedEntries.map((entry) => entry.name));

    for (const entry of sortedEntries) {
      const relativePath = `quizzes/${topic.name}/${entry.name}`;

      if (!entry.isFile() || !entry.name.endsWith('.md')) {
        throw new Error(`${relativePath}: expected a Markdown file, not a nested directory`);
      }

      if (entry.name.endsWith('-explain.md')) {
        const quizFilename = entry.name.replace(/-explain\.md$/, '.md');

        if (!filenames.has(quizFilename)) {
          throw new Error(`${relativePath}: explanation has no matching quiz ${quizFilename}`);
        }

        continue;
      }

      const source = await readFile(path.join(rootDirectory, relativePath), 'utf8');
      const quiz = parseQuiz(source, relativePath);
      const explanationFilename = entry.name.replace(/\.md$/, '-explain.md');
      const explanationPath = `quizzes/${topic.name}/${explanationFilename}`;

      if (!filenames.has(explanationFilename)) {
        fail(relativePath, `missing detailed explanation ${explanationFilename}`);
      }

      const explanationSource = await readFile(path.join(rootDirectory, explanationPath), 'utf8');
      const detailedExplanation = parseQuizExplanation(explanationSource, quiz, explanationPath);
      quizzes.push({ ...quiz, explanationFilePath: explanationPath, detailedExplanation });
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

import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { encodePlantUml, loadQuizzes } from './quiz.js';

const PLANTUML_PATTERN = /```(?:plantuml|puml)\s*\n([\s\S]*?)\n```/gi;

function titleFromSlug(slug) {
  return slug
    .split('-')
    .map((word) => `${word.charAt(0).toUpperCase()}${word.slice(1)}`)
    .join(' ');
}

function yamlString(value) {
  return JSON.stringify(value);
}

function transformPlantUml(markdown) {
  return markdown.replace(PLANTUML_PATTERN, (_match, source) => {
    const encoded = encodePlantUml(source.trim());
    const imageUrl = `https://www.plantuml.com/plantuml/svg/${encoded}`;
    return `<figure class="diagram"><img src="${imageUrl}" alt="PlantUML diagram" loading="lazy"></figure>`;
  });
}

function removeFrontmatter(markdown) {
  return markdown.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, '').trim();
}

function removeFirstHeading(markdown) {
  return markdown.replace(/^#\s+[^\n]+\r?\n+/, '').trim();
}

function escapeHtml(value) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function formatQuizAnswers(markdown, answers) {
  const answerRows = answers
    .map(({ letter, text }) => [
      '<label class="quiz-answer">',
      '  <input type="checkbox">',
      `  <span><strong>${letter}.</strong> ${escapeHtml(text)}</span>`,
      '</label>',
    ].join('\n'))
    .join('\n');

  return markdown.replace(
    /## Answers\s*\n[\s\S]*?(?=<!--\s*correct-answer:)/,
    `## Answers\n\n<div class="quiz-answers">\n${answerRows}\n</div>\n\n`,
  );
}

function pageFrontmatter({ title, topic, kind, url, pairedUrl }) {
  return [
    '---',
    'layout: default',
    `title: ${yamlString(title)}`,
    `topic: ${yamlString(topic)}`,
    `kind: ${yamlString(kind)}`,
    `permalink: ${yamlString(url)}`,
    `paired_url: ${yamlString(pairedUrl)}`,
    '---',
    '',
  ].join('\n');
}

function pageUrl(quiz, explanation = false) {
  const suffix = explanation ? '-explain' : '';
  return `/quizzes/${quiz.topic}/${quiz.slug}${suffix}/`;
}

export async function buildSite({
  rootDirectory = process.cwd(),
  outputDirectory = path.join(rootDirectory, '.site-source'),
} = {}) {
  const quizzes = await loadQuizzes(rootDirectory);
  const templateDirectory = path.join(rootDirectory, 'site');

  await rm(outputDirectory, { recursive: true, force: true });
  await mkdir(outputDirectory, { recursive: true });
  await cp(templateDirectory, outputDirectory, { recursive: true });

  const topics = new Map();

  for (const quiz of quizzes) {
    const topicTitle = titleFromSlug(quiz.topic);
    const quizTitle = titleFromSlug(quiz.slug);
    const quizUrl = pageUrl(quiz);
    const explanationUrl = pageUrl(quiz, true);
    const sourcePath = path.join(rootDirectory, quiz.filePath);
    const explanationPath = path.join(rootDirectory, quiz.explanationFilePath);
    const [quizSource, explanationSource] = await Promise.all([
      readFile(sourcePath, 'utf8'),
      readFile(explanationPath, 'utf8'),
    ]);
    const destinationDirectory = path.join(outputDirectory, 'quizzes', quiz.topic);

    await mkdir(destinationDirectory, { recursive: true });
    await writeFile(
      path.join(destinationDirectory, `${quiz.slug}.md`),
      `${pageFrontmatter({ title: quizTitle, topic: topicTitle, kind: 'Quiz', url: quizUrl, pairedUrl: explanationUrl })}${transformPlantUml(formatQuizAnswers(removeFrontmatter(quizSource), quiz.answers))}\n`,
    );
    await writeFile(
      path.join(destinationDirectory, `${quiz.slug}-explain.md`),
      `${pageFrontmatter({ title: quizTitle, topic: topicTitle, kind: 'Detailed explanation', url: explanationUrl, pairedUrl: quizUrl })}${transformPlantUml(removeFirstHeading(explanationSource))}\n`,
    );

    if (!topics.has(quiz.topic)) {
      topics.set(quiz.topic, { slug: quiz.topic, title: topicTitle, quizzes: [] });
    }

    topics.get(quiz.topic).quizzes.push({ title: quizTitle, quiz_url: quizUrl, explanation_url: explanationUrl });
  }

  const navigation = {
    topics: [...topics.values()].map((topic) => ({
      ...topic,
      quizzes: topic.quizzes.sort((left, right) => left.title.localeCompare(right.title)),
    })),
  };
  navigation.topics.sort((left, right) => left.title.localeCompare(right.title));

  await mkdir(path.join(outputDirectory, '_data'), { recursive: true });
  await writeFile(path.join(outputDirectory, '_data', 'navigation.json'), `${JSON.stringify(navigation, null, 2)}\n`);

  const indexSections = navigation.topics.map((topic) => {
    const items = topic.quizzes
      .map((quiz) => `- [${quiz.title}]({{ '${quiz.quiz_url}' | relative_url }}) — [detailed explanation]({{ '${quiz.explanation_url}' | relative_url }})`)
      .join('\n');
    return `## ${topic.title}\n\n${items}`;
  });
  const index = [
    '---',
    'layout: default',
    'title: "Interview quiz library"',
    'kind: "Home"',
    '---',
    '',
    'Practice with short interview questions, then open the detailed explanation for the mechanics, tradeoffs, code, and diagrams.',
    '',
    ...indexSections,
    '',
  ].join('\n');
  await writeFile(path.join(outputDirectory, 'index.md'), index);

  return { outputDirectory, quizzes: quizzes.length, topics: navigation.topics.length };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const result = await buildSite();
    console.log(`Generated ${result.quizzes} quiz page pair(s) across ${result.topics} topic(s).`);
  } catch (error) {
    console.error(`Site generation failed: ${error.message}`);
    process.exitCode = 1;
  }
}

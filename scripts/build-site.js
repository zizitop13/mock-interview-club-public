import { cp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { encodePlantUml, loadQuizzes } from './quiz.js';

const PLANTUML_PATTERN = /```(?:plantuml|puml)\s*\n([\s\S]*?)\n```/gi;

function titleFromSlug(slug) {
  return slug.split('-').map((word) => `${word.charAt(0).toUpperCase()}${word.slice(1)}`).join(' ');
}

function yamlString(value) { return JSON.stringify(value); }

function escapeHtml(value) {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
}

function transformPlantUml(markdown) {
  return markdown.replace(PLANTUML_PATTERN, (_match, source) => {
    const diagramSource = source.trim();
    const imageUrl = `https://www.plantuml.com/plantuml/svg/${encodePlantUml(diagramSource)}`;
    return ['<figure class="diagram">', `  <img src="${imageUrl}" alt="PlantUML diagram" loading="lazy">`, '  <button class="copy-button diagram-copy" type="button" data-copy-diagram>Copy PlantUML</button>', `  <template class="diagram-source">${escapeHtml(diagramSource)}</template>`, '</figure>'].join('\n');
  });
}

function removeFrontmatter(markdown) { return markdown.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, '').trim(); }
function removeFirstHeading(markdown) { return markdown.replace(/^#\s+[^\n]+\r?\n+/, '').trim(); }

function formatQuizAnswers(markdown, answers, correctAnswer, explanation, explanationUrl) {
  const answerRows = answers.map(({ letter, text }) => [
    `<div class="quiz-answer-row" data-correct="${letter === correctAnswer}">`,
    '  <label class="quiz-answer">', '    <input type="checkbox" data-quiz-answer>',
    `    <span><strong>${letter}.</strong> ${escapeHtml(text)}</span>`, '  </label>', '</div>',
  ].join('\n')).join('\n');
  return markdown.replace(/## Answers\s*\n[\s\S]*?(?=<!--\s*correct-answer:)/, [
    '## Answers', '', `<div class="quiz-answers">\n${answerRows}\n</div>`,
    '<section class="answer-result" data-answer-result hidden aria-live="polite">',
    '  <strong class="answer-result-status" data-answer-status></strong>',
    `  <p>${escapeHtml(explanation)}</p>`,
    `  <a class="answer-explanation-link" href="{{ '${explanationUrl}' | relative_url }}">Read the full explanation →</a>`,
    '</section>', '',
  ].join('\n')).replace(/<details>[\s\S]*?<\/details>\s*$/, '');
}

function pageFrontmatter({ title, topic, kind, url, pairedUrl = '' }) {
  return ['---', 'layout: default', `title: ${yamlString(title)}`, `topic: ${yamlString(topic)}`, `kind: ${yamlString(kind)}`, `permalink: ${yamlString(url)}`, pairedUrl ? `paired_url: ${yamlString(pairedUrl)}` : '', '---', ''].filter(Boolean).join('\n') + '\n';
}

function pageUrl(quiz, explanation = false) {
  return `/quizzes/${quiz.topic}/${quiz.slug}${explanation ? '-explain' : ''}/`;
}

async function loadLabs(rootDirectory) {
  const labsDirectory = path.join(rootDirectory, 'labs');
  let tracks;
  try { tracks = await readdir(labsDirectory, { withFileTypes: true }); } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw error;
  }
  const labs = [];
  for (const track of tracks.filter((entry) => entry.isDirectory())) {
    const directory = path.join(labsDirectory, track.name);
    const files = await readdir(directory, { withFileTypes: true });
    for (const file of files.filter((entry) => entry.isFile() && entry.name.endsWith('.md'))) {
      const slug = file.name.slice(0, -3);
      labs.push({ track: track.name, slug, title: titleFromSlug(slug), filePath: path.join('labs', track.name, file.name) });
    }
  }
  return labs;
}

export async function buildSite({ rootDirectory = process.cwd(), outputDirectory = path.join(rootDirectory, '.site-source') } = {}) {
  const [quizzes, labs] = await Promise.all([loadQuizzes(rootDirectory), loadLabs(rootDirectory)]);
  await rm(outputDirectory, { recursive: true, force: true });
  await mkdir(outputDirectory, { recursive: true });
  await cp(path.join(rootDirectory, 'site'), outputDirectory, { recursive: true });

  const topics = new Map();
  for (const quiz of quizzes) {
    const topicTitle = titleFromSlug(quiz.topic), quizTitle = titleFromSlug(quiz.slug);
    const quizUrl = pageUrl(quiz), explanationUrl = pageUrl(quiz, true);
    const [quizSource, explanationSource] = await Promise.all([
      readFile(path.join(rootDirectory, quiz.filePath), 'utf8'),
      readFile(path.join(rootDirectory, quiz.explanationFilePath), 'utf8'),
    ]);
    const destination = path.join(outputDirectory, 'quizzes', quiz.topic);
    await mkdir(destination, { recursive: true });
    await writeFile(path.join(destination, `${quiz.slug}.md`), `${pageFrontmatter({ title: quizTitle, topic: topicTitle, kind: 'Quiz', url: quizUrl, pairedUrl: explanationUrl })}${transformPlantUml(formatQuizAnswers(removeFrontmatter(quizSource), quiz.answers, quiz.correctAnswer, quiz.explanation, explanationUrl))}\n`);
    await writeFile(path.join(destination, `${quiz.slug}-explain.md`), `${pageFrontmatter({ title: quizTitle, topic: topicTitle, kind: 'Detailed explanation', url: explanationUrl, pairedUrl: quizUrl })}${transformPlantUml(removeFirstHeading(explanationSource))}\n`);
    if (!topics.has(quiz.topic)) topics.set(quiz.topic, { slug: quiz.topic, title: topicTitle, quizzes: [] });
    topics.get(quiz.topic).quizzes.push({ title: quizTitle, quiz_url: quizUrl, explanation_url: explanationUrl });
  }

  const labTracks = new Map();
  for (const lab of labs) {
    const trackTitle = titleFromSlug(lab.track), url = `/labs/${lab.track}/${lab.slug}/`;
    const source = await readFile(path.join(rootDirectory, lab.filePath), 'utf8');
    const destination = path.join(outputDirectory, 'labs', lab.track);
    await mkdir(destination, { recursive: true });
    await writeFile(path.join(destination, `${lab.slug}.md`), `${pageFrontmatter({ title: lab.title, topic: `${trackTitle} labs`, kind: 'Lab', url })}${transformPlantUml(removeFirstHeading(source))}\n`);
    if (!labTracks.has(lab.track)) labTracks.set(lab.track, { slug: lab.track, title: trackTitle, labs: [] });
    labTracks.get(lab.track).labs.push({ title: lab.title, url });
  }

  const navigation = {
    lab_tracks: [...labTracks.values()].map((track) => ({ ...track, labs: track.labs.sort((a, b) => a.title.localeCompare(b.title)) })).sort((a, b) => a.title.localeCompare(b.title)),
    topics: [...topics.values()].map((topic) => ({ ...topic, quizzes: topic.quizzes.sort((a, b) => a.title.localeCompare(b.title)) })).sort((a, b) => a.title.localeCompare(b.title)),
  };
  await mkdir(path.join(outputDirectory, '_data'), { recursive: true });
  await writeFile(path.join(outputDirectory, '_data', 'navigation.json'), `${JSON.stringify(navigation, null, 2)}\n`);

  const labSections = navigation.lab_tracks.map((track) => `### ${track.title}\n\n${track.labs.map((lab) => `- [${lab.title}]({{ '${lab.url}' | relative_url }})`).join('\n')}`);
  const quizSections = navigation.topics.map((topic) => `### ${topic.title}\n\n${topic.quizzes.map((quiz) => `- [${quiz.title}]({{ '${quiz.quiz_url}' | relative_url }}) — [detailed explanation]({{ '${quiz.explanation_url}' | relative_url }})`).join('\n')}`);
  const index = ['---', 'layout: default', 'title: "Mock Interview Club"', 'kind: "Home"', '---', '', '**New quizzes are published daily.**', '', '## Labs', '', 'Work through multi-stage coding and system-design exercises.', '', ...labSections, '', '## Quizzes', '', 'Practice with short interview questions, then open the detailed explanation.', '', ...quizSections, ''].join('\n');
  await writeFile(path.join(outputDirectory, 'index.md'), index);
  return { outputDirectory, quizzes: quizzes.length, topics: navigation.topics.length, labs: labs.length, labTracks: navigation.lab_tracks.length };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const result = await buildSite();
    console.log(`Generated ${result.quizzes} quiz page pair(s) and ${result.labs} lab(s).`);
  } catch (error) { console.error(`Site generation failed: ${error.message}`); process.exitCode = 1; }
}


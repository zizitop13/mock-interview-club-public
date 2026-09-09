import { cp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { encodeMermaid, loadQuizzes } from './quiz.js';

const MERMAID_PATTERN = /```mermaid\s*\n([\s\S]*?)\n```/gi;

function titleFromSlug(slug) {
  return slug.split('-').map((word) => `${word.charAt(0).toUpperCase()}${word.slice(1)}`).join(' ');
}

function yamlString(value) { return JSON.stringify(value); }

function escapeHtml(value) {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
}

function transformMermaid(markdown) {
  return markdown.replace(MERMAID_PATTERN, (_match, source) => {
    const diagramSource = source.trim();
    const imageUrl = `https://mermaid.ink/svg/${encodeMermaid(diagramSource)}?bgColor=F7F8FA`;
    return ['<figure class="diagram">', `  <img src="${imageUrl}" alt="Mermaid diagram" loading="lazy">`, '  <button class="copy-button diagram-copy" type="button" data-copy-diagram>Copy Mermaid</button>', `  <template class="diagram-source">${escapeHtml(diagramSource)}</template>`, '</figure>'].join('\n');
  });
}

function removeFrontmatter(markdown) { return markdown.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, '').trim(); }
function removeFirstHeading(markdown) { return markdown.replace(/^#\s+[^\n]+\r?\n+/, '').trim(); }

function formatQuizAnswers(markdown, answers, correctAnswer, explanation, explanationUrl, quizId) {
  const answerRows = answers.map(({ letter, text }) => [
    `<div class="quiz-answer-row" data-correct="${letter === correctAnswer}">`,
    '  <label class="quiz-answer">', `    <input type="checkbox" data-quiz-answer value="${letter}">`,
    `    <span><strong>${letter}.</strong> ${escapeHtml(text)}</span>`, '  </label>', '</div>',
  ].join('\n')).join('\n');
  return markdown.replace(/## Answers\s*\n[\s\S]*?(?=<!--\s*correct-answer:)/, [
    '## Answers', '', `<div class="quiz-answers" data-quiz-id="${escapeHtml(quizId)}">\n${answerRows}\n</div>`,
    '<section class="answer-result" data-answer-result hidden aria-live="polite">',
    '  <strong class="answer-result-status" data-answer-status></strong>',
    `  <p>${escapeHtml(explanation)}</p>`,
    `  <a class="answer-explanation-link" data-explanation-link href="{{ '${explanationUrl}' | relative_url }}" hidden>Read the full explanation →</a>`,
    '  <p class="quiz-save-status" data-quiz-save-status>Sign in to save your answer.</p>',
    '</section>', '',
  ].join('\n')).replace(/<details>[\s\S]*?<\/details>\s*$/, '');
}

function formatQuizFeedback(quizId) {
  const ratings = [
    ['code-smells', 'Code smells'],
    ['good', 'Good'],
    ['hard', 'Hard'],
    ['too-easy', 'Too easy'],
    ['too-hard', 'Too hard'],
    ['boring', 'Boring'],
    ['brilliant', 'Brilliant'],
    ['over-complicated', 'Overcomplicated'],
    ['wrong-answer', 'Wrong answer'],
    ['incorrect-question', 'Incorrect question'],
  ];
  const choices = ratings.map(([value, label]) =>
    `  <label class="quiz-feedback-choice"><input type="checkbox" value="${value}" data-feedback-rating> <span>${label}</span></label>`
  ).join('\n');
  return [
    '<section class="quiz-feedback" data-quiz-feedback data-quiz-id="' + escapeHtml(quizId) + '">',
    '  <h2>Rate this quiz</h2>',
    '  <p>Select any labels that apply, and optionally leave a concise comment.</p>',
    '  <div class="quiz-feedback-choices">',
    choices,
    '  </div>',
    '  <label class="quiz-feedback-comment-label" for="quiz-feedback-comment-' + escapeHtml(quizId) + '">Optional comment</label>',
    '  <textarea class="quiz-feedback-comment" id="quiz-feedback-comment-' + escapeHtml(quizId) + '" data-feedback-comment maxlength="1000" rows="5" placeholder="What should be improved? Please keep it concise and specific."></textarea>',
    '  <p class="quiz-feedback-limit">Up to 1,000 characters.</p>',
    '  <button class="quiz-feedback-submit" type="button" data-feedback-submit disabled>Save feedback</button>',
    '  <p class="quiz-feedback-status" data-feedback-status role="status" aria-live="polite">Sign in to rate this quiz.</p>',
    '</section>',
  ].join('\n');
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
    const markdownFiles = files.filter((entry) => entry.isFile() && entry.name.endsWith('.md'));
    const fileNames = new Set(markdownFiles.map((entry) => entry.name));
    for (const file of markdownFiles.filter((entry) => !entry.name.endsWith('-solution.md'))) {
      const slug = file.name.slice(0, -3);
      const solutionName = `${slug}-solution.md`;
      labs.push({
        track: track.name,
        slug,
        title: titleFromSlug(slug),
        filePath: path.join('labs', track.name, file.name),
        solutionFilePath: fileNames.has(solutionName) ? path.join('labs', track.name, solutionName) : null,
      });
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
    await writeFile(path.join(destination, `${quiz.slug}.md`), `${pageFrontmatter({ title: quizTitle, topic: topicTitle, kind: 'Quiz', url: quizUrl })}${transformMermaid(formatQuizAnswers(removeFrontmatter(quizSource), quiz.answers, quiz.correctAnswer, quiz.explanation, explanationUrl, `${quiz.topic}--${quiz.slug}`))}\n`);
    await writeFile(path.join(destination, `${quiz.slug}-explain.md`), `${pageFrontmatter({ title: quizTitle, topic: topicTitle, kind: 'Detailed explanation', url: explanationUrl, pairedUrl: quizUrl })}${transformMermaid(removeFirstHeading(explanationSource))}\n\n${formatQuizFeedback(`${quiz.topic}--${quiz.slug}`)}\n`);
    if (!topics.has(quiz.topic)) topics.set(quiz.topic, { slug: quiz.topic, title: topicTitle, quizzes: [] });
    topics.get(quiz.topic).quizzes.push({ title: quizTitle, quiz_url: quizUrl });
  }

  const labTracks = new Map();
  for (const lab of labs) {
    const trackTitle = titleFromSlug(lab.track), url = `/labs/${lab.track}/${lab.slug}/`;
    const solutionUrl = lab.solutionFilePath ? `/labs/${lab.track}/${lab.slug}-solution/` : '';
    const source = await readFile(path.join(rootDirectory, lab.filePath), 'utf8');
    const destination = path.join(outputDirectory, 'labs', lab.track);
    await mkdir(destination, { recursive: true });
    await writeFile(path.join(destination, `${lab.slug}.md`), `${pageFrontmatter({ title: lab.title, topic: `${trackTitle} labs`, kind: 'Lab', url, pairedUrl: solutionUrl })}${transformMermaid(removeFirstHeading(source))}\n`);
    if (lab.solutionFilePath) {
      const solutionSource = await readFile(path.join(rootDirectory, lab.solutionFilePath), 'utf8');
      await writeFile(path.join(destination, `${lab.slug}-solution.md`), `${pageFrontmatter({ title: `${lab.title} solution`, topic: `${trackTitle} labs`, kind: 'Lab solution', url: solutionUrl, pairedUrl: url })}${transformMermaid(removeFirstHeading(solutionSource))}\n`);
    }
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
  const quizSections = navigation.topics.map((topic) => `### ${topic.title}\n\n${topic.quizzes.map((quiz) => `- [${quiz.title}]({{ '${quiz.quiz_url}' | relative_url }})`).join('\n')}`);
  const index = ['---', 'layout: default', 'title: "Mock Interview Club"', 'kind: "Home"', '---', '', '**New quizzes are published daily.**', '', '## Labs', '', 'Work through multi-stage coding and system-design exercises.', '', ...labSections, '', '## Quizzes', '', 'Practice with short interview questions. Sign in and answer to reveal each detailed explanation.', '', ...quizSections, ''].join('\n');
  await writeFile(path.join(outputDirectory, 'index.md'), index);
  return { outputDirectory, quizzes: quizzes.length, topics: navigation.topics.length, labs: labs.length, labTracks: navigation.lab_tracks.length };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const result = await buildSite();
    console.log(`Generated ${result.quizzes} quiz page pair(s) and ${result.labs} lab(s).`);
  } catch (error) { console.error(`Site generation failed: ${error.message}`); process.exitCode = 1; }
}

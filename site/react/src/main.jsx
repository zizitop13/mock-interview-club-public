import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';

function slugify(value) {
  return value.toLowerCase().trim().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-');
}

function copyText(text, button) {
  navigator.clipboard?.writeText(text).then(() => {
    const previous = button.textContent;
    button.textContent = 'Copied';
    window.setTimeout(() => { button.textContent = previous; }, 1200);
  });
}

export function CodeBlock({ pre }) {
  const code = pre.querySelector('code')?.textContent ?? pre.textContent ?? '';
  return <div className="copyable-code">
    <pre dangerouslySetInnerHTML={{ __html: pre.innerHTML }} />
    <button className="copy-button" type="button" onClick={(event) => copyText(code, event.currentTarget)}>Copy code</button>
  </div>;
}

export function MermaidDiagram({ figure }) {
  const source = figure.querySelector('.diagram-source')?.textContent?.trim() ?? '';
  const image = figure.querySelector('img');
  return <figure className="diagram">
    {image && <img src={image.getAttribute('src') ?? ''} alt={image.getAttribute('alt') ?? 'Mermaid diagram'} loading="lazy" />}
    <button className="copy-button diagram-copy" type="button" onClick={(event) => copyText(source, event.currentTarget)}>Copy Mermaid</button>
  </figure>;
}

export function TextField({ label, defaultValue = '', maxLength = 1000, rows = 5, onChange }) {
  const [value, setValue] = useState(defaultValue);
  return <label className="react-text-field">
    <span>{label}</span>
    <textarea value={value} maxLength={maxLength} rows={rows} onChange={(event) => {
      setValue(event.target.value);
      onChange?.(event.target.value);
    }} />
  </label>;
}

export function Drawing({ initialData = null, onChange }) {
  const [Excalidraw, setExcalidraw] = useState(null);
  useEffect(() => {
    let active = true;
    import('@excalidraw/excalidraw').then((module) => {
      if (active) setExcalidraw(() => module.Excalidraw);
    });
    return () => { active = false; };
  }, []);
  return <div className="drawing-component">
    {Excalidraw ? <Excalidraw initialData={initialData ?? undefined} onChange={onChange} /> : <p>Loading drawing canvas…</p>}
  </div>;
}

function useHeadings(root, selector = 'h2') {
  const [headings, setHeadings] = useState([]);
  useEffect(() => {
    if (!root) return;
    setHeadings([...root.querySelectorAll(selector)].map((heading) => {
      if (!heading.id) heading.id = slugify(heading.textContent ?? '');
      return { id: heading.id, text: heading.textContent?.trim() ?? '' };
    }));
  }, [root, selector]);
  return headings;
}

export function Navigation({ root, selector = 'h2', label = 'Page sections' }) {
  const headings = useHeadings(root, selector);
  const [activeId, setActiveId] = useState('');
  useEffect(() => {
    if (!headings.length) return;
    setActiveId((current) => current || headings[0].id);
    const observers = headings.map(({ id }) => {
      const node = document.getElementById(id);
      if (!node) return null;
      const observer = new IntersectionObserver(([entry]) => entry.isIntersecting && setActiveId(id), { rootMargin: '-20% 0px -70% 0px' });
      observer.observe(node);
      return observer;
    }).filter(Boolean);
    return () => observers.forEach((observer) => observer.disconnect());
  }, [headings]);

  if (headings.length < 2) return null;
  return <nav className="stage-dot-navigation" aria-label={label}>
    {headings.map((heading) => <a key={heading.id} href={'#' + heading.id} aria-label={heading.text} aria-current={activeId === heading.id ? 'step' : undefined}>
      <span className="stage-dot-tooltip">{heading.text}</span>
    </a>)}
  </nav>;
}

function enhanceContent(root) {
  if (!root) return;
  for (const pre of [...root.querySelectorAll('pre')]) {
    if (pre.closest('.copyable-code')) continue;
    const mount = document.createElement('div');
    pre.replaceWith(mount);
    createRoot(mount).render(<CodeBlock pre={pre} />);
  }
  for (const figure of [...root.querySelectorAll('figure.diagram')]) {
    const mount = document.createElement('div');
    figure.replaceWith(mount);
    createRoot(mount).render(<MermaidDiagram figure={figure} />);
  }
  for (const placeholder of [...root.querySelectorAll('[data-excalidraw]')]) {
    let initialData = null;
    try { initialData = JSON.parse(placeholder.textContent?.trim() || 'null'); } catch {}
    const mount = document.createElement('div');
    placeholder.replaceWith(mount);
    createRoot(mount).render(<Drawing initialData={initialData} />);
  }
}

export function QuizQuestion({ root }) {
  useEffect(() => enhanceContent(root), [root]);
  return null;
}

export function QuizExplanation({ root }) {
  useEffect(() => enhanceContent(root), [root]);
  return root ? <Navigation root={root} /> : null;
}

export function Lab({ root }) {
  useEffect(() => enhanceContent(root), [root]);
  return root ? <Navigation root={root} /> : null;
}

export function LabSolution({ root }) {
  useEffect(() => enhanceContent(root), [root]);
  return root ? <Navigation root={root} /> : null;
}

const content = document.querySelector('.content');
if (content) {
  const mount = document.createElement('div');
  mount.className = 'react-page-components';
  content.before(mount);
  const Component = {
    Quiz: QuizQuestion,
    'Detailed explanation': QuizExplanation,
    Lab,
    'Lab solution': LabSolution,
  }[document.body.dataset.pageKind];
  if (Component) createRoot(mount).render(<Component root={content} />);
  else enhanceContent(content);
}

const body = document.body;
const menuButton = document.querySelector('.menu-button');
const scrim = document.querySelector('.scrim');
const search = document.querySelector('#navigation-search');

function setNavigation(open) {
  body.classList.toggle('navigation-open', open);
  menuButton?.setAttribute('aria-expanded', String(open));
}

menuButton?.addEventListener('click', () => setNavigation(!body.classList.contains('navigation-open')));
scrim?.addEventListener('click', () => setNavigation(false));

search?.addEventListener('input', () => {
  const query = search.value.trim().toLowerCase();

  for (const item of document.querySelectorAll('[data-nav-item]')) {
    item.hidden = query !== '' && !item.dataset.search.includes(query);
  }

  for (const topic of document.querySelectorAll('[data-topic]')) {
    topic.hidden = !topic.querySelector('[data-nav-item]:not([hidden])');
  }
});

function displayQuizAnswer(answers, selected) {
  for (const checkbox of answers.querySelectorAll('[data-quiz-answer]')) {
    checkbox.checked = checkbox === selected;
  }

  for (const row of answers.querySelectorAll('.quiz-answer-row')) {
    row.classList.remove('is-correct', 'is-incorrect');
  }

  const result = answers.parentElement.querySelector('[data-answer-result]');
  if (!result) return;

  result.hidden = !selected.checked;
  if (!selected.checked) return;

  const row = selected.closest('.quiz-answer-row');
  const correct = row.dataset.correct === 'true';
  row.classList.add(correct ? 'is-correct' : 'is-incorrect');
  result.classList.toggle('is-correct', correct);
  result.classList.toggle('is-incorrect', !correct);
  result.querySelector('[data-answer-status]').textContent = correct ? 'Correct!' : 'Incorrect';
}

function setQuizAnswerLocked(answers, locked) {
  answers.dataset.locked = String(locked);
  answers.classList.toggle('is-locked', locked);

  for (const checkbox of answers.querySelectorAll('[data-quiz-answer]')) {
    checkbox.disabled = locked;
  }
}

for (const answers of document.querySelectorAll('.quiz-answers')) {
  answers.addEventListener('change', (event) => {
    if (!event.target.matches('[data-quiz-answer]')) return;
    if (answers.dataset.locked === 'true') return;

    displayQuizAnswer(answers, event.target);

    if (event.target.checked && answers.dataset.quizId) {
      setQuizAnswerLocked(answers, true);
      document.dispatchEvent(new CustomEvent('quiz-answer-selected', {
        detail: {
          quizId: answers.dataset.quizId,
          answer: event.target.value,
        },
      }));
    }
  });
}

document.addEventListener('quiz-answer-loaded', (event) => {
  for (const answers of document.querySelectorAll('.quiz-answers[data-quiz-id]')) {
    if (answers.dataset.quizId !== event.detail?.quizId) continue;

    const selected = [...answers.querySelectorAll('[data-quiz-answer]')]
      .find((answer) => answer.value === event.detail.answer);

    if (selected) {
      displayQuizAnswer(answers, selected);
      setQuizAnswerLocked(answers, true);
    }
  }
});

document.addEventListener('quiz-answer-save-failed', (event) => {
  for (const answers of document.querySelectorAll('.quiz-answers[data-quiz-id]')) {
    if (answers.dataset.quizId === event.detail?.quizId) {
      setQuizAnswerLocked(answers, false);
    }
  }
});

for (const pre of document.querySelectorAll('.content pre')) {
  const wrapper = document.createElement('div');
  wrapper.className = 'copyable-code';
  pre.parentNode.insertBefore(wrapper, pre);
  wrapper.append(pre);

  const button = document.createElement('button');
  button.className = 'copy-button';
  button.type = 'button';
  button.textContent = 'Copy code';
  button.addEventListener('click', () => copyText(pre.innerText, button));
  wrapper.append(button);
}

for (const button of document.querySelectorAll('[data-copy-diagram]')) {
  button.addEventListener('click', () => {
    const source = button.parentElement.querySelector('.diagram-source')?.content.textContent ?? '';
    copyText(source.trim(), button);
  });
}

for (const button of document.querySelectorAll('[data-copy-lab-note]')) {
  button.addEventListener('click', () => {
    const note = document.getElementById(button.dataset.copyTarget);
    copyText(note?.value ?? '', button);
  });
}

for (const button of document.querySelectorAll('[data-copy-lab-summary]')) {
  button.addEventListener('click', () => {
    const summary = [...document.querySelectorAll('[data-lab-stage-title]')]
      .map((note) => `${note.dataset.labStageTitle}\n\n${note.value.trim()}`)
      .join('\n\n');
    copyText(summary, button);
  });
}

const stageNavigation = document.querySelector('[data-stage-navigation]');

if (stageNavigation) {
  const stageLinks = [...stageNavigation.querySelectorAll('[data-stage-link]')];
  const writtenStageTargets = stageLinks.slice(0, 4)
    .map((link) => document.querySelector(link.hash))
    .filter(Boolean);
  const designFlow = document.querySelector('.lab-design-flow');
  const designSteps = [...document.querySelectorAll('[data-stage-target]')];
  const designStageHashes = new Set(stageLinks.slice(3).map((link) => link.hash));
  let selectedDesignStage = designStageHashes.has(window.location.hash) ? window.location.hash : null;
  let scrollFrame = null;

  const activateStage = (hash) => {
    for (const link of stageLinks) {
      if (link.hash === hash) link.setAttribute('aria-current', 'step');
      else link.removeAttribute('aria-current');
    }
  };

  const updateWrittenStage = () => {
    const activationLine = window.innerHeight * 0.32;
    let current = writtenStageTargets[0];

    for (const target of writtenStageTargets) {
      if (target.getBoundingClientRect().top <= activationLine) current = target;
    }

    if (!current) return;
    const hash = `#${current.id}`;
    activateStage(hash === stageLinks[3]?.hash && selectedDesignStage ? selectedDesignStage : hash);
  };

  const updateDesignStage = () => {
    if (!designFlow || designSteps.length === 0) return;
    const firstStepOffset = designSteps[0].offsetLeft;
    const closest = designSteps.reduce((best, step) => (
      Math.abs((step.offsetLeft - firstStepOffset) - designFlow.scrollLeft)
        < Math.abs((best.offsetLeft - firstStepOffset) - designFlow.scrollLeft)
        ? step
        : best
    ));
    selectedDesignStage = closest.dataset.stageTarget;
    if (designFlow.getBoundingClientRect().top <= window.innerHeight * 0.55) {
      activateStage(selectedDesignStage);
    }
  };

  stageLinks.forEach((link, index) => {
    link.addEventListener('click', () => {
      selectedDesignStage = index >= 3 ? link.hash : null;
      activateStage(link.hash);
    });
  });

  window.addEventListener('scroll', () => {
    if (scrollFrame) return;
    scrollFrame = requestAnimationFrame(() => {
      scrollFrame = null;
      updateWrittenStage();
    });
  }, { passive: true });

  designFlow?.addEventListener('scroll', () => {
    if (scrollFrame) return;
    scrollFrame = requestAnimationFrame(() => {
      scrollFrame = null;
      updateDesignStage();
    });
  }, { passive: true });

  updateWrittenStage();
}

async function copyText(value, button) {
  try {
    await navigator.clipboard.writeText(value);
    const original = button.textContent;
    button.textContent = 'Copied!';
    setTimeout(() => { button.textContent = original; }, 1400);
  } catch {
    button.textContent = 'Copy failed';
  }
}

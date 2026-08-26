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

for (const answers of document.querySelectorAll('.quiz-answers')) {
  answers.addEventListener('change', (event) => {
    if (!event.target.matches('[data-quiz-answer]')) return;

    for (const checkbox of answers.querySelectorAll('[data-quiz-answer]')) {
      if (checkbox !== event.target) checkbox.checked = false;
    }

    const explanation = answers.parentElement.querySelector('[data-answer-explanation]');
    if (explanation) explanation.hidden = !event.target.checked;
  });
}

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

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

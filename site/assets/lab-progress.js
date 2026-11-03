const MAX_PAYLOAD = 100000;

export function decodeProgress(payload) {
  const value = JSON.parse(payload);
  if (!value || typeof value.notes !== 'object' || !value.notes || Array.isArray(value.notes)
      || Object.keys(value.notes).length > 50
      || !Object.values(value.notes).every(note => typeof note === 'string' && note.length <= 20000)
      || !Array.isArray(value.entities) || value.entities.length > 30
      || !value.entities.every(entity => entity && typeof entity.name === 'string'
        && entity.name.length <= 120 && typeof entity.body === 'string' && entity.body.length <= 5000)
      || typeof value.stage !== 'string' || value.stage.length > 200) {
    throw new Error('Invalid saved progress');
  }
  return value;
}

export function createLabProgress({ database, doc, getDoc, runTransaction, serverTimestamp }) {
  const root = document.querySelector('[data-lab-progress]');
  if (!root) return null;
  const match = root.dataset.labProgress.match(/\/labs\/(coding|design)\/([a-z0-9-]+)\/?$/);
  if (!match) return null;
  const labId = `${match[1]}--${match[2]}`;
  const notes = [...document.querySelectorAll('textarea.lab-workspace[id]')];
  notes.forEach(note => { note.maxLength = 20000; });
  const save = root.querySelector('[data-lab-save]');
  const reload = root.querySelector('[data-lab-reload]');
  const resume = root.querySelector('[data-lab-resume]');
  const status = root.querySelector('[data-lab-status]');
  let user = null, epoch = 0, revision = 0, ready = false, busy = false, dirty = false;
  let baseline = '', cards = null, add = null;

  function button(text, action) {
    const element = document.createElement('button');
    element.type = 'button';
    element.className = 'lab-copy-button';
    element.textContent = text;
    element.addEventListener('click', action);
    return element;
  }

  const entitiesStage = document.querySelector('[id^="stage-"][id*="-entities-"]');
  if (entitiesStage) {
    const editor = document.createElement('section');
    editor.className = 'lab-entities';
    editor.id = 'entity-cards';
    const heading = document.createElement('h3');
    heading.textContent = 'Your entities';
    cards = document.createElement('div');
    cards.className = 'lab-entity-cards';
    add = button('+ Add entity', () => { addCard(); changed(); });
    editor.append(heading, cards, add);
    (entitiesStage.closest('.lab-design-flow') ?? entitiesStage).after(editor);
    const jump = document.createElement('a');
    jump.href = '#entity-cards';
    jump.textContent = 'Edit entities ↓';
    entitiesStage.append(jump);
  }

  function addCard(entity = { name: '', body: '' }) {
    if (!cards || cards.children.length >= 30) return;
    const card = document.createElement('fieldset');
    card.className = 'lab-entity-card';
    for (const [key, title, tag, limit] of [['name', 'Name', 'input', 120], ['body', 'Body', 'textarea', 5000]]) {
      const label = document.createElement('label');
      label.textContent = title;
      const input = document.createElement(tag);
      input.dataset.entityField = key;
      input.className = 'lab-workspace';
      input.maxLength = limit;
      if (tag === 'textarea') input.rows = 5;
      input.value = entity[key];
      label.append(input);
      card.append(label);
    }
    card.append(button('Remove entity', () => { card.remove(); changed(); }));
    cards.append(card);
    updateControls();
  }

  function snapshot() {
    return {
      notes: Object.fromEntries(notes.map(note => [note.id, note.value])),
      entities: [...(cards?.children ?? [])].map(card => Object.fromEntries(
        [...card.querySelectorAll('[data-entity-field]')].map(input => [input.dataset.entityField, input.value]))),
      stage: document.querySelector('[data-stage-link][aria-current="step"]')?.hash ?? '',
    };
  }

  function updateControls() {
    save.disabled = !ready || busy;
    for (const input of [...notes, ...(cards?.querySelectorAll('input, textarea, button') ?? [])]) {
      input.disabled = !ready || busy;
    }
    if (add) add.disabled = !ready || busy || cards.children.length >= 30;
  }

  function changed() {
    if (!ready || busy) return;
    dirty = JSON.stringify(snapshot()) !== baseline;
    status.textContent = dirty ? 'Unsaved changes. Save progress to keep them.' : 'Progress saved.';
    updateControls();
  }
  notes.forEach(note => note.addEventListener('input', changed));
  cards?.addEventListener('input', changed);
  const navigation = document.querySelector('[data-stage-navigation]');
  if (navigation) new MutationObserver(changed).observe(navigation, { subtree: true, attributes: true, attributeFilter: ['aria-current'] });
  window.addEventListener('beforeunload', event => {
    if (dirty || busy) { event.preventDefault(); event.returnValue = ''; }
  });

  function render(value) {
    notes.forEach(note => { note.value = value.notes[note.id] ?? ''; });
    cards?.replaceChildren();
    value.entities.forEach(addCard);
    const knownStage = [...document.querySelectorAll('[data-stage-link]')].some(link => link.hash === value.stage);
    resume.hidden = !knownStage;
    if (knownStage) resume.href = value.stage;
  }

  async function setUser(nextUser) {
    const ticket = ++epoch;
    user = nextUser;
    ready = false; busy = false; dirty = false; revision = 0;
    render({ notes: {}, entities: [], stage: '' });
    reload.hidden = true;
    updateControls();
    status.textContent = user ? 'Loading your progress…' : 'Sign in to save your notes and current stage.';
    if (!user) return;
    try {
      const saved = await getDoc(doc(database, 'users', user.uid, 'labProgress', labId));
      if (ticket !== epoch) return;
      if (saved.exists()) {
        render(decodeProgress(saved.data().payload));
        revision = saved.data().revision;
      }
      baseline = JSON.stringify(snapshot());
      ready = true;
      status.textContent = saved.exists() ? 'Saved progress restored.' : 'Your notes are private. Use Save progress to keep them.';
    } catch {
      if (ticket !== epoch) return;
      status.textContent = 'Could not load progress. Retry before editing to protect saved work.';
      reload.hidden = false;
    }
    updateControls();
  }
  reload.addEventListener('click', () => setUser(user));
  save.addEventListener('click', async () => {
    if (!ready || busy || !user) return;
    const payload = JSON.stringify(snapshot());
    if (new TextEncoder().encode(payload).length > MAX_PAYLOAD) {
      status.textContent = 'Notes are too large. Keep the total below 100 KB.';
      return;
    }
    const ticket = epoch, expectedRevision = revision;
    const reference = doc(database, 'users', user.uid, 'labProgress', labId);
    busy = true;
    updateControls();
    status.textContent = 'Saving progress…';
    try {
      await runTransaction(database, async transaction => {
        const stored = await transaction.get(reference);
        if ((stored.exists() ? stored.data().revision : 0) !== expectedRevision) throw new Error('conflict');
        transaction.set(reference, { schemaVersion: 1, payload, revision: expectedRevision + 1, updatedAt: serverTimestamp() });
      });
      if (ticket !== epoch) return;
      revision = expectedRevision + 1;
      baseline = payload;
      dirty = JSON.stringify(snapshot()) !== baseline;
      status.textContent = dirty ? 'Notes saved. Stage changed since saving.' : 'Progress saved.';
    } catch (error) {
      if (ticket !== epoch) return;
      dirty = true;
      status.textContent = error.message === 'conflict'
        ? 'Progress changed in another tab. Copy your notes before reloading this page.'
        : 'Could not save progress. Your edits are still here; try Save progress again.';
    } finally {
      if (ticket === epoch) { busy = false; updateControls(); }
    }
  });
  updateControls();
  return { setUser };
}

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
  const status = root.querySelector('[data-lab-status]');
  let user = null, epoch = 0, revision = 0, ready = false, busy = false, dirty = false;
  let baseline = '', cards = null, add = null;
  let saveTimer = null, saveDue = 0, conflicted = false, statusTimer = null;

  function showStatus(message, temporary = false) {
    clearTimeout(statusTimer);
    status.textContent = message;
    root.hidden = !message;
    if (temporary) statusTimer = setTimeout(() => { root.hidden = true; }, 2000);
  }

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
      stage: '',
    };
  }

  function updateControls() {
    save.disabled = !ready || busy;
    for (const input of [...notes, ...(cards?.querySelectorAll('input, textarea, button') ?? [])]) {
      input.disabled = !ready;
    }
    if (add) add.disabled = !ready || cards.children.length >= 30;
  }

  function scheduleSave() {
    clearTimeout(saveTimer);
    if (dirty && ready && !conflicted) {
      saveTimer = setTimeout(saveProgress, Math.max(0, saveDue - Date.now()));
    }
  }

  function changed() {
    if (!ready) return;
    dirty = JSON.stringify(snapshot()) !== baseline;
    saveDue = Date.now() + 3000;
    if (!busy && !conflicted) {
      showStatus('');
    }
    scheduleSave();
    updateControls();
  }
  notes.forEach(note => note.addEventListener('input', changed));
  cards?.addEventListener('input', changed);
  window.addEventListener('beforeunload', event => {
    if (dirty || busy) { event.preventDefault(); event.returnValue = ''; }
  });

  function render(value) {
    notes.forEach(note => { note.value = value.notes[note.id] ?? ''; });
    cards?.replaceChildren();
    value.entities.forEach(addCard);
  }

  async function setUser(nextUser) {
    clearTimeout(saveTimer);
    conflicted = false;
    save.hidden = true;
    const ticket = ++epoch;
    user = nextUser;
    ready = false; busy = false; dirty = false; revision = 0;
    render({ notes: {}, entities: [], stage: '' });
    reload.hidden = true;
    updateControls();
    showStatus('');
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
      showStatus('');
    } catch {
      if (ticket !== epoch) return;
      showStatus('Could not load progress. Retry before editing.');
      reload.hidden = false;
    }
    updateControls();
  }
  reload.addEventListener('click', () => setUser(user));
  save.addEventListener('click', () => { clearTimeout(saveTimer); saveProgress(); });
  async function saveProgress() {
    if (!ready || busy || !user || !dirty || conflicted) return;
    const payload = JSON.stringify(snapshot());
    if (new TextEncoder().encode(payload).length > MAX_PAYLOAD) {
      showStatus('Notes are too large. Keep the total below 100 KB.');
      return;
    }
    const ticket = epoch, expectedRevision = revision;
    const reference = doc(database, 'users', user.uid, 'labProgress', labId);
    busy = true;
    save.hidden = true;
    updateControls();
    showStatus('Saving progress…');
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
      showStatus(dirty ? '' : 'Progress saved.', !dirty);
    } catch (error) {
      if (ticket !== epoch) return;
      dirty = true;
      conflicted = error.message === 'conflict';
      clearTimeout(saveTimer);
      save.hidden = conflicted;
      saveDue = Date.now() + 3000;
      showStatus(conflicted
        ? 'Progress changed in another tab. Copy your notes before reloading this page.'
        : 'Could not save progress. Retrying…');
    } finally {
      if (ticket === epoch) {
        busy = false;
        scheduleSave();
        updateControls();
      }
    }
  }
  updateControls();
  return { setUser };
}

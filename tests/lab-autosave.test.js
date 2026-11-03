import test from 'node:test';
import assert from 'node:assert/strict';
import { createLabProgress } from '../site/assets/lab-progress.js';

test('autosave debounces edits, preserves edits during a write, retries and cancels on sign-out', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'] });
  const element = () => ({ addEventListener(type, fn) { this[type] = fn; } });
  const note = { ...element(), id: 'sizing', value: '' };
  const controls = Object.fromEntries(['save', 'reload', 'resume', 'status'].map(key => [key, element()]));
  const root = { dataset: { labProgress: '/labs/design/market-indexes/' },
    querySelector: selector => controls[selector.match(/lab-(\w+)/)[1]] };
  const oldDocument = globalThis.document, oldWindow = globalThis.window;
  globalThis.document = {
    querySelector: selector => selector === '[data-lab-progress]' ? root : null,
    querySelectorAll: selector => selector === 'textarea.lab-workspace[id]' ? [note] : [],
  };
  globalThis.window = { addEventListener() {} };
  t.after(() => { globalThis.document = oldDocument; globalThis.window = oldWindow; });
  const writes = [];
  let revision = 0, release, fail = false, delay = true;
  const sut = createLabProgress({
    database: {}, doc: (...args) => args, serverTimestamp: () => 1,
    getDoc: async () => ({ exists: () => false }),
    runTransaction: async (database, callback) => {
      if (fail) { fail = false; throw new Error('offline'); }
      await callback({
        get: async () => ({ exists: () => revision > 0, data: () => ({ revision }) }),
        set: (ref, data) => { writes.push(JSON.parse(data.payload)); revision = data.revision; },
      });
      if (delay) { delay = false; await new Promise(resolve => { release = resolve; }); }
    },
  });
  const flush = async () => { for (let i = 0; i < 10; i++) await Promise.resolve(); };
  const edit = value => { note.value = value; note.input(); };
  await sut.setUser({ uid: 'one' });
  assert.equal(controls.status.textContent, 'Changes save automatically.');
  edit('first');
  t.mock.timers.tick(2000);
  edit('latest');
  t.mock.timers.tick(2999);
  assert.equal(writes.length, 0);
  t.mock.timers.tick(1);
  await flush();
  assert.equal(writes.length, 1, controls.status.textContent);
  assert.equal(writes[0].notes.sizing, 'latest');
  assert.equal(note.disabled, false);
  edit('while saving');
  t.mock.timers.tick(3000);
  release();
  await flush();
  t.mock.timers.tick(0);
  await flush();
  assert.equal(writes[1].notes.sizing, 'while saving');
  fail = true;
  edit('retry me');
  t.mock.timers.tick(3000);
  await flush();
  assert.match(controls.status.textContent, /Retrying/);
  t.mock.timers.tick(3000);
  await flush();
  assert.equal(writes[2].notes.sizing, 'retry me');
  edit('do not save after sign-out');
  await sut.setUser(null);
  t.mock.timers.tick(3000);
  await flush();
  assert.equal(writes.length, 3);
});

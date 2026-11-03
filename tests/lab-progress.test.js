import test from 'node:test';
import assert from 'node:assert/strict';
import { decodeProgress } from '../site/assets/lab-progress.js';

test('lab progress round-trips notes, entities and resume stage', () => {
  const progress = { notes: { sizing: '20,000 updates/s' }, entities: [{ name: 'Index', body: 'id, divisor, constituents' }], stage: '#stage-4-entities-5-minutes' };
  assert.deepEqual(decodeProgress(JSON.stringify(progress)), progress);
});

test('malformed or excessive saved progress is rejected before rendering', () => {
  const empty = { notes: {}, entities: [], stage: '' };
  for (const value of [null, {}, { ...empty, notes: [] }, { ...empty, notes: { sizing: 3 } },
    { ...empty, entities: [null] }, { ...empty, entities: [{ name: 'Index', body: 1 }] },
    { ...empty, entities: Array(31).fill({ name: '', body: '' }) },
    { ...empty, notes: { sizing: 'x'.repeat(20001) } }, { ...empty, stage: 42 }]) {
    assert.throws(() => decodeProgress(JSON.stringify(value)));
  }
});

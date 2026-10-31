import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';

test('interactive index basket calculates, validates and resets', async () => {
  const elements = Object.fromEntries(['price-a', 'shares-a', 'price-b', 'shares-b', 'index-results', 'index-error', 'reset-index'].map((id) => [id, {
    value: '', hidden: false, textContent: '', listeners: {},
    get valueAsNumber() { return this.value === '' ? NaN : Number(this.value); },
    addEventListener(event, listener) { this.listeners[event] = listener; },
  }]));
  [100, 1, 50, 10].forEach((value, i) => { elements[['price-a', 'shares-a', 'price-b', 'shares-b'][i]].value = value; });
  const source = await readFile(new URL('../site/assets/market-indexes.js', import.meta.url), 'utf8');
  vm.runInNewContext(source, { document: { getElementById: (id) => elements[id] } });
  assert.match(elements['index-results'].textContent, /75 points/);
  assert.match(elements['index-results'].textContent, /100 points/);
  elements['price-a'].value = 200;
  elements['price-a'].listeners.input();
  assert.match(elements['index-results'].textContent, /125 points/);
  elements['price-a'].value = '';
  elements['price-a'].listeners.input();
  assert.equal(elements['index-error'].hidden, false);
  elements['reset-index'].listeners.click();
  assert.equal(elements['index-error'].hidden, true);
  assert.match(elements['index-results'].textContent, /75 points/);
});

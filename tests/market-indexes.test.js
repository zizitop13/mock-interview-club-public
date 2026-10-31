import assert from 'node:assert/strict';
import test from 'node:test';
import { PRESETS, numerator, level, addStock, scaleDivisor } from '../site/assets/market-indexes.js';

test('both methods start at 100 and price changes use fixed divisors', () => {
  const stocks = PRESETS.slice(0, 2).map((stock) => ({ ...stock }));
  const divisors = { price: numerator(stocks, 'price') / 100, cap: numerator(stocks, 'cap') / 100 };
  assert.equal(level(stocks, 'price', divisors), 100);
  assert.equal(level(stocks, 'cap', divisors), 100);
  stocks[0].price = 300;
  assert.ok(Math.abs(level(stocks, 'price', divisors) - 116.6666667) < 0.0001);
  assert.ok(Math.abs(level(stocks, 'cap', divisors) - 125.8620689) < 0.0001);
});

test('adding a constituent preserves both levels and changes subsequent weights', () => {
  const stocks = PRESETS.slice(0, 2).map((stock) => ({ ...stock }));
  const divisors = { price: 6, cap: 58 };
  const before = ['price', 'cap'].map((type) => level(stocks, type, divisors));
  const next = addStock(stocks, PRESETS[2], divisors);
  ['price', 'cap'].forEach((type, i) => assert.ok(Math.abs(level(next.stocks, type, next.divisors) - before[i]) < 1e-10));
  assert.equal(next.stocks.length, 3);
  assert.notEqual(next.divisors.price, divisors.price);
});

test('divisor scaling changes only the selected method and can be restored', () => {
  const stocks = PRESETS.slice(0, 2);
  const reference = { price: 6, cap: 58 };
  for (const type of ['price', 'cap']) {
    const other = type === 'price' ? 'cap' : 'price';
    const doubled = scaleDivisor(reference, reference, type, 200);
    assert.equal(level(stocks, type, doubled), 50);
    assert.equal(level(stocks, other, doubled), 100);
    const quarter = scaleDivisor(doubled, reference, type, 25);
    assert.equal(level(stocks, type, quarter), 400);
    const restored = scaleDivisor(quarter, reference, type, 100);
    assert.deepEqual(restored, reference);
  }
  assert.deepEqual(reference, { price: 6, cap: 58 });
  for (const invalid of [0, -1, 201, NaN, Infinity]) {
    assert.throws(() => scaleDivisor(reference, reference, 'price', invalid), RangeError);
  }
});

test('adding a stock preserves a manually scaled level and divisor percentage', () => {
  const stocks = PRESETS.slice(0, 2);
  const reference = { price: 6, cap: 58 };
  const divisors = scaleDivisor(reference, reference, 'price', 200);
  const next = addStock(stocks, PRESETS[2], divisors);
  const nextReference = Object.fromEntries(['price', 'cap'].map((type) => [type, reference[type] * next.divisors[type] / divisors[type]]));
  assert.ok(Math.abs(level(next.stocks, 'price', next.divisors) - 50) < 1e-10);
  assert.ok(Math.abs(next.divisors.price / nextReference.price - 2) < 1e-10);
  assert.ok(Math.abs(level(next.stocks, 'price', scaleDivisor(next.divisors, nextReference, 'price', 100)) - 100) < 1e-10);
});

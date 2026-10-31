import assert from 'node:assert/strict';
import test from 'node:test';
import { PRESETS, numerator, level, addStock } from '../site/assets/market-indexes.js';

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

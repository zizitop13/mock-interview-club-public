import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { gunzipSync } from 'node:zlib';
import { buildSite } from '../scripts/build-site.js';
import { decodeFrame } from '../site/visualizations/concurrent-hash-map/trace-model.js';

const rootDirectory = path.resolve(new URL('..', import.meta.url).pathname);
const pageDirectory = path.join(rootDirectory, 'site/visualizations/concurrent-hash-map');
const load = async (scenario) => JSON.parse(gunzipSync(await readFile(path.join(pageDirectory, 'recordings', `${scenario}.json.gz`))));
const frames = (recording) => Object.fromEntries(recording.frames.map((frame, index) => [frame.id, decodeFrame(recording, index)]));
const entries = (table) => table?.buckets.flatMap((bucket) => bucket.entries) ?? [];

test('recordings identify JavaWiz and match the executable Java sources', async () => {
  for (const [scenario, className] of [['put', 'PutDemo'], ['get', 'GetDemo'], ['compute', 'ComputeDemo'], ['resize', 'ResizeDemo']]) {
    const recording = await load(scenario);
    assert.equal(recording.generator, 'JavaWiz');
    assert.equal(recording.generatorVersion, '2.3.1');
    assert.equal(recording.backendSha256, 'fcce45ac5e5e18e9e9905ef82ba09b1caf6aa50d08f6450914835193c9785aa3');
    assert.equal(recording.upstreamCommit, 'e512b3c8dbb99c70b2a087f7a1751be8854046b6');
    assert.equal(recording.runtime, 'Eclipse Temurin 25.0.5+8');
    const source = await readFile(path.join(rootDirectory, 'tools/javawiz-concurrent-hash-map', `${className}.java`), 'utf8');
    assert.equal(recording.source, source);
    assert.equal(recording.sourceSha256, createHash('sha256').update(source).digest('hex'));
    assert.ok(recording.traceStateCount >= recording.frames.length);
    assert.ok(recording.frames.every((frame) => frame.state.heap.some((item) => item.type === 'java.util.concurrent.ConcurrentHashMap' && !item.faked)));
  }
});

test('put recording proves lazy allocation, collision chaining, and replacement without growth', async () => {
  const states = frames(await load('put'));
  assert.equal(states.empty.current, null);
  assert.equal(states.cas.current.capacity, 4);
  assert.deepEqual(entries(states.cas.current).map(({ key, value }) => [key, value]), [['A', '10']]);
  assert.deepEqual(states.collision.current.buckets[1].entries.map(({ key }) => key), ['A', 'B']);
  assert.equal(states.collision.count, 2);
  assert.equal(states.replace.count, 2);
  assert.equal(entries(states.replace.current).find((entry) => entry.key === 'A').value, '11');
  assert.deepEqual(states.replace.results, [{ name: 'previous', value: '10' }]);
});

test('get recording returns head, chained, and missing values without mutating buckets', async () => {
  const states = frames(await load('get'));
  for (const state of Object.values(states)) assert.deepEqual(state.current, states.ready.current);
  assert.deepEqual(states.miss.results, [
    { name: 'headValue', value: '10' }, { name: 'chainedValue', value: '20' }, { name: 'missingValue', value: null },
  ]);
});

test('compute recording exposes a real reservation, update, and removal', async () => {
  const states = frames(await load('compute'));
  assert.equal(states.reservation.current.buckets[1].kind, 'reservation');
  assert.equal(states.reservation.count, 0);
  assert.equal(entries(states.inserted.current)[0].value, '10');
  assert.equal(entries(states.remapping.current)[0].value, '10');
  assert.equal(entries(states.updated.current)[0].value, '15');
  assert.equal(states.updated.count, 1);
  assert.equal(states.removed.count, 0);
  assert.equal(entries(states.removed.current).length, 0);
  assert.equal(states.removed.current.capacity, 4);
});

test('resize recording proves splitting, forwarding, two resizers, and final publication', async () => {
  const states = frames(await load('resize'));
  assert.equal(states.ready.current.capacity, 32);
  assert.equal(states.ready.count, 23);
  assert.equal(states.allocated.next.capacity, 64);
  assert.equal(states.allocated.resizeWorkers, 1);
  assert.equal(states.allocated.transferIndex, 16);
  assert.equal(states.split.original.buckets[31].kind, 'forwarding');
  assert.equal(states.split.original.buckets[31].target, states.split.next.id);
  assert.equal(states.split.next.buckets[31].entries[0].key, 'A');
  assert.equal(states.split.next.buckets[63].entries[0].key, 'B');
  assert.ok(states['forwarded-get'].results.some((result) => result.name === 'forwardedValue' && result.value === '63'));
  assert.equal(states.helping.resizeWorkers, 2);
  assert.equal(states.helping.transferIndex, 0);
  assert.equal(states['almost-done'].original.buckets.filter((bucket) => bucket.kind === 'forwarding').length, 31);
  assert.equal(states.complete.original.buckets.filter((bucket) => bucket.kind === 'forwarding').length, 32);
  assert.equal(states.complete.current.id, states.allocated.next.id);
  assert.equal(states.complete.current.capacity, 64);
  assert.equal(states.complete.next, null);
  assert.equal(states.complete.count, 24);
  assert.equal(entries(states.complete.current).find((entry) => entry.key === 'A').value, '310');
});

test('standalone page is built without entering homepage or navigation', async () => {
  const outputDirectory = await mkdtemp(path.join(os.tmpdir(), 'chm-page-'));
  try {
    await buildSite({ rootDirectory, outputDirectory });
    const outputPage = path.join(outputDirectory, 'visualizations/concurrent-hash-map');
    const html = await readFile(path.join(outputPage, 'index.html'), 'utf8');
    assert.match(html, /name="robots" content="noindex, nofollow, noarchive"/);
    assert.match(html, /type="module" src="\.\/player\.js"/);
    assert.match(html, /data-scenario="compute"/);
    assert.match(html, /data-scenario="resize"/);
    assert.ok(JSON.parse(gunzipSync(await readFile(path.join(outputPage, 'recordings/resize.json.gz')))).frames.length > 0);
    for (const file of ['index.md', '_data/navigation.json', '_layouts/default.html']) {
      assert.doesNotMatch(await readFile(path.join(outputDirectory, file), 'utf8'), /visualizations\/concurrent-hash-map/);
    }
  } finally { await rm(outputDirectory, { recursive: true, force: true }); }
});

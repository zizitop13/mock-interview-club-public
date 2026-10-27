import { decodeFrame } from './trace-model.js';

const scenarios = {
  put: {
    name: 'PUT', note: 'A and B have different hashes, but both select bucket 1 in a four-bucket table. Watch a first insertion, a collision, and a value replacement.',
    steps: {
      empty: ['The array starts out lazy', 'Constructing the map does not allocate the bucket array. The first insertion will initialize it.', 'initTable() initializes the table before putVal() chooses the insertion path.', 'new ConcurrentHashMap<MapKey, Integer>(2);'],
      cas: ['An empty bucket takes CAS', 'A = 10 appears in bucket 1. The first node is installed with casTabAt(); inserting into this empty bucket needs no bucket monitor.', 'putVal(): empty slot → casTabAt(tab, i, null, newNode).', 'map.put(a, 10);', ['A']],
      collision: ['A collision takes the bucket monitor', 'B = 20 hashes to the same bucket. putVal() locks its head, verifies that head is still current, then appends B.', 'putVal(): occupied list → synchronized(f) → validate head → append node.', 'map.put(b, 20);', ['B']],
      replace: ['The key stays; its value changes', 'Putting A again replaces 10 with 11 under the bucket monitor. The old value is returned, and the entry count remains two.', 'An existing key returns its previous value. This path does not increment the map size.', 'Integer previous = map.put(a, 11);', ['A']],
    },
  },
  get: {
    name: 'GET', note: 'The same collision chain is read three ways: a head match, a match further down the chain, and a missing key. The bucket structure remains unchanged.',
    steps: {
      ready: ['One bucket, two entries', 'A = 10 and B = 20 share bucket 1. The next checkpoints show the values returned by the real get() calls.', 'get() reads the bucket head, compares keys, and follows next links when necessary.', 'map.put(a, 10);\nmap.put(b, 20);'],
      head: ['The head matches', 'get(A) returns 10. The first node already contains the requested key.', 'get() can return the matching head node’s volatile value without taking a bucket monitor.', 'Integer headValue = map.get(a);', ['A']],
      chain: ['The lookup follows the chain', 'get(B) returns 20. Its key is in the second node, linked from A.', 'The list lookup checks each node’s hash and key until it finds a match.', 'Integer chainedValue = map.get(b);', ['B']],
      miss: ['A missing key returns null', 'The missing key also selects bucket 1, but neither node matches. get() returns null and leaves the map unchanged.', 'Reaching the end of the list without a matching key returns null.', 'Integer missingValue = map.get(new MapKey("Missing", 9));'],
    },
  },
  compute: {
    name: 'COMPUTE', note: 'compute() can insert, update, or remove an entry. The recordings inside the remapping function also expose the temporary ReservationNode used for an empty bucket.',
    steps: {
      empty: ['No mapping exists yet', 'compute(A, …) will invoke its remapping function with a null old value.', 'The remapping function decides whether there will be a mapping.', 'new ConcurrentHashMap<MapKey, Integer>(2);'],
      reservation: ['Reserve the empty bucket', 'This snapshot is inside the first remapping function. Bucket 1 contains a ReservationNode, installed by CAS; its monitor is held while the callback runs.', 'compute(): CAS a ReservationNode into an empty slot and invoke the callback under its monitor.', 'map.compute(a, (key, oldValue) -> {\n    // oldValue is null; this checkpoint is inside the callback\n    return 10;\n});'],
      inserted: ['Publish the computed entry', 'The callback returned 10. The reservation has been replaced by the real A = 10 node, and the entry count is now one.', 'The reserved slot becomes a normal node when the callback returns a non-null value.', 'Integer inserted = map.compute(a, (key, oldValue) -> 10);', ['A']],
      remapping: ['Remap under the existing bucket monitor', 'This checkpoint is inside the second callback. A is still 10; the callback received that value and will return 15.', 'For an occupied list bucket, compute() synchronizes on the head and revalidates it before invoking the callback.', 'map.compute(a, (key, oldValue) -> {\n    return oldValue + 5;\n});', ['A']],
      updated: ['Replace the value atomically', 'The callback returned 15. The same mapping now contains A = 15; the entry count remains one.', 'A non-null result replaces the existing value.', 'Integer updated = map.compute(a, (key, oldValue) -> oldValue + 5);', ['A']],
      removed: ['Returning null removes the mapping', 'The final callback returned null. A has been removed, while the already allocated bucket array remains.', 'For an existing mapping, a null remapping result removes its node and decrements the entry count.', 'Integer removed = map.compute(a, (key, oldValue) -> null);'],
    },
  },
  resize: {
    name: 'COOPERATIVE RESIZE', note: 'Two actual writers share a resize from 32 to 64 buckets. The harness briefly holds buckets 0, 24, and 31 to make these intermediate states repeatable. The focused view shows those buckets and the split destination at 63.',
    steps: {
      ready: ['23 entries; one insertion from resizing', 'The current table has 32 buckets and a resize threshold of 24. A and B share bucket 31 because only the lower five hash bits select a bucket.', 'At capacity 32, hashes 31 and 63 both select bucket 31.', 'map has 23 entries; table.length == 32; sizeCtl == 24;', ['A', 'B']],
      allocated: ['Allocate the larger array', 'The first writer inserted the 24th entry and started resizing. nextTable now has 64 buckets. It has claimed the upper range and pauses at bucket 31, whose monitor the harness holds.', 'addCount() starts transfer(). A CAS on transferIndex claims a range; this writer claimed buckets 16–31.', 'writer.start();\nMapProbe.awaitBlocked(writer, high);'],
      split: ['One old bucket becomes two new buckets', 'After bucket 31 is released, the resizer splits its chain: A stays at 31; B goes to 63. The old slot now holds a forwarding node. The writer next pauses at bucket 24.', 'transfer(): hash & oldCapacity is zero for A and nonzero for B. The old slot is forwarded only after both new bins are published.', 'old[31] → ForwardingNode(nextTable)\nnext[31] → A = 31\nnext[63] → B = 63', ['A', 'B']],
      'forwarded-get': ['Read through the “we’ve moved” note', 'get(B) returns 63 while the resize is unfinished. The old bucket forwards the lookup to the larger array, where B is now in bucket 63.', 'ForwardingNode.find() uses nextTable and recomputes the bucket index. get() does no transfer work.', 'Integer forwardedValue = map.get(new MapKey("B", 63));', ['B']],
      helping: ['The second writer becomes a helper', 'The second writer encounters a forwarding node at bucket 31. It joins the resize, claims buckets 0–15, and transfers most of them before pausing at bucket 0. The recorded resize-worker count is now two.', 'putVal() → helpTransfer() → CAS-register helper → transfer another bucket range.', 'helper.start();\nMapProbe.awaitBlocked(helper, low);'],
      'almost-done': ['The initiator finishes its range', 'The first writer completes buckets 16–31 and returns. Only bucket 0 remains unforwarded; the helper is still paused there, so map.table still points to the old array.', 'An individual resizer can finish while another worker is still transferring its claimed range.', 'MapProbe.join(writer);'],
      complete: ['Publish the new current table', 'After bucket 0 is released, the helper finishes the resize and retries its put in the new array. A becomes 310. map.table now points to the 64-bucket array, and nextTable is cleared.', 'The final resizer completes the sweep and publishes the new table. The harness retains oldTable only so you can inspect its forwarding nodes.', 'MapProbe.join(helper);\nmap.table == newTable; nextTable == null;', ['A']],
    },
  },
};

const $ = (id) => document.getElementById(id);
const element = (tag, className, text) => {
  const result = document.createElement(tag);
  if (className) result.className = className;
  if (text !== undefined) result.textContent = text;
  return result;
};
const recordings = new Map();
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
let scenario = 'put', recording, index = 0, playing = false, timer, loadVersion = 0;

function pause() {
  playing = false;
  clearTimeout(timer);
  $('play').textContent = '▶ Play';
  $('play').setAttribute('aria-pressed', 'false');
}

function renderTable(table, label, current, focused, highlighted) {
  const panel = element('section', 'table-panel');
  const title = element('div', 'table-title');
  title.append(element('strong', '', table ? `${label}[${table.capacity}]` : label), element('small', '', current ? 'map.table' : table ? `array #${table.id}` : 'null'));
  panel.append(title);
  if (!table) {
    panel.append(element('div', 'table-empty', scenario === 'resize' ? 'No new array allocated yet.' : 'The bucket array is not allocated yet.'));
    return panel;
  }
  const grid = element('div', `buckets${focused ? ' focused' : ''}`);
  for (const bucket of table.buckets.filter((item) => !focused || [0, 24, 31, 63].includes(item.index))) {
    const cell = element('div', `bucket ${bucket.kind}`);
    cell.dataset.bucket = String(bucket.index);
    cell.append(element('span', 'bucket-index', bucket.index));
    if (bucket.kind === 'empty') cell.append(element('span', 'bucket-empty', 'null'));
    if (bucket.kind === 'forwarding') {
      const moved = element('span', 'forward-label', 'MOVED →');
      moved.append(element('small', '', `array #${bucket.target}`));
      cell.append(moved);
      cell.title = `ForwardingNode: hash = -1; nextTable = array #${bucket.target}`;
    }
    if (bucket.kind === 'reservation') {
      cell.append(element('span', 'reservation-label', 'RESERVED'));
      cell.title = 'ReservationNode: hash = -3';
    }
    for (const entry of bucket.entries) {
      const node = element('span', `entry${highlighted.includes(entry.key) ? ' is-highlighted' : ''}`);
      node.dataset.entryKey = entry.key;
      node.dataset.value = entry.value;
      node.title = `Node #${entry.id}; hash = ${entry.hash}`;
      node.append(element('strong', '', entry.key), element('span', '', ` = ${entry.value}`));
      cell.append(node);
    }
    grid.append(cell);
  }
  panel.append(grid);
  if (focused) panel.append(element('p', 'table-caption', `Selected buckets · ${table.capacity - grid.children.length} others omitted. Use “Show all buckets” to inspect every slot.`));
  return panel;
}

function showFrame(nextIndex, animate = true) {
  if (!recording) return;
  index = Math.max(0, Math.min(nextIndex, recording.frames.length - 1));
  const model = decodeFrame(recording, index);
  const [title, explanation, mechanism, code, highlighted = []] = scenarios[scenario].steps[model.id];
  const previous = new Map([...document.querySelectorAll('.entry')].map((node) => [node.dataset.entryKey, { rect: node.getBoundingClientRect(), value: node.dataset.value }]));
  $('operation').textContent = scenarios[scenario].name;
  $('step-title').textContent = title;
  $('step-explanation').textContent = explanation;
  $('step-count').textContent = `${String(index + 1).padStart(2, '0')} / ${String(recording.frames.length).padStart(2, '0')}`;
  $('line-label').textContent = `Recorded line ${model.line}`;
  $('active-code').textContent = code;
  $('mechanism').textContent = mechanism;
  const old = model.original ?? model.current;
  const moved = old?.buckets.filter((bucket) => bucket.kind === 'forwarding').length ?? 0;
  const metrics = [
    [model.count, 'Recorded entries'], [model.current?.capacity ?? 0, 'Current array capacity'],
    [scenario === 'resize' ? `${moved} / 32` : model.current?.buckets.filter((bucket) => bucket.kind !== 'empty').length ?? 0, scenario === 'resize' ? 'Old buckets forwarded' : 'Occupied buckets'],
    [model.resizeWorkers, 'Active resize workers'],
  ];
  $('metrics').replaceChildren(...metrics.map(([value, name]) => {
    const metric = element('div', 'metric'); metric.append(element('strong', '', value), element('span', '', name)); return metric;
  }));
  $('tables').classList.toggle('is-resize', scenario === 'resize');
  $('all-buckets-control').hidden = scenario !== 'resize';
  if (scenario === 'resize') {
    const larger = model.next ?? (model.current?.id !== model.original?.id ? model.current : null);
    const focused = !$('all-buckets').checked;
    $('tables').replaceChildren(
      renderTable(model.original, 'Original table', model.original?.id === model.current?.id, focused, highlighted),
      renderTable(larger, 'New table', larger?.id === model.current?.id, focused, highlighted),
    );
  } else $('tables').replaceChildren(renderTable(model.current, 'table', true, false, highlighted));
  $('results').replaceChildren(...model.results.map((result) => {
    const chip = element('span', 'result', `${result.name} = `);
    chip.append(element('strong', '', result.value === null ? 'null' : result.value)); return chip;
  }));
  if (animate && !reducedMotion.matches) {
    for (const node of document.querySelectorAll('.entry')) {
      const before = previous.get(node.dataset.entryKey);
      const after = node.getBoundingClientRect();
      if (before) {
        node.animate([{ transform: `translate(${before.rect.x - after.x}px, ${before.rect.y - after.y}px)` }, { transform: 'translate(0, 0)' }], { duration: 850, easing: 'cubic-bezier(.2,.8,.2,1)' });
        if (before.value !== node.dataset.value) node.animate([{ backgroundColor: '#ff9d4270' }, { backgroundColor: '#83ddb60c' }], { duration: 1100 });
      } else node.animate([{ opacity: 0, transform: 'scale(.8)' }, { opacity: 1, transform: 'scale(1)' }], { duration: 700 });
    }
  }
  $('previous').disabled = index === 0;
  $('next').disabled = index === recording.frames.length - 1;
  $('timeline').value = index;
  $('timeline').setAttribute('aria-valuetext', `Checkpoint ${index + 1}: ${title}`);
  for (const button of $('checkpoints').children) {
    if (Number(button.dataset.index) === index) button.setAttribute('aria-current', 'step');
    else button.removeAttribute('aria-current');
  }
  history.replaceState(null, '', `#${scenario}/${index + 1}`);
}

function schedule() {
  clearTimeout(timer);
  if (!playing) return;
  timer = setTimeout(() => {
    if (index + 1 >= recording.frames.length) { pause(); return; }
    showFrame(index + 1);
    if (index + 1 >= recording.frames.length) pause();
    else schedule();
  }, Number($('speed').value));
}

async function loadScenario(id, initialIndex = 0) {
  pause();
  const version = ++loadVersion;
  $('play').disabled = $('previous').disabled = $('next').disabled = $('reset').disabled = $('timeline').disabled = true;
  document.querySelector('.player').setAttribute('aria-busy', 'true');
  try {
    if (!recordings.has(id)) {
      const response = await fetch(new URL(`./recordings/${id}.json.gz`, import.meta.url));
      if (!response.ok) throw new Error(`Recording request failed (${response.status})`);
      recordings.set(id, await new Response(response.body.pipeThrough(new DecompressionStream('gzip'))).json());
    }
    if (version !== loadVersion) return;
    scenario = id;
    recording = recordings.get(id);
    $('scenario-note').textContent = scenarios[id].note;
    $('source').textContent = recording.source;
    $('raw-trace').href = `./recordings/${id}.json.gz`;
    $('timeline').max = recording.frames.length - 1;
    $('checkpoints').replaceChildren(...recording.frames.map((frame, position) => {
      const button = element('button', '', `${position + 1}. ${scenarios[id].steps[frame.id][0]}`);
      button.type = 'button'; button.dataset.index = position;
      button.addEventListener('click', () => { pause(); showFrame(position); }); return button;
    }));
    for (const button of document.querySelectorAll('[data-scenario]')) button.setAttribute('aria-pressed', String(button.dataset.scenario === id));
    $('play').disabled = $('reset').disabled = $('timeline').disabled = false;
    document.querySelector('.player').setAttribute('aria-busy', 'false');
    showFrame(initialIndex, false);
  } catch (error) {
    if (version !== loadVersion) return;
    $('step-title').textContent = 'The recording could not be loaded';
    $('step-explanation').textContent = `${error.message}. Reload this page to try again.`;
    document.querySelector('.player').setAttribute('aria-busy', 'false');
  }
}

for (const button of document.querySelectorAll('[data-scenario]')) button.addEventListener('click', () => loadScenario(button.dataset.scenario));
$('play').addEventListener('click', () => {
  if (playing) { pause(); return; }
  if (index === recording.frames.length - 1) showFrame(0);
  playing = true; $('play').textContent = 'Ⅱ Pause'; $('play').setAttribute('aria-pressed', 'true'); schedule();
});
$('previous').addEventListener('click', () => { pause(); showFrame(index - 1); });
$('next').addEventListener('click', () => { pause(); showFrame(index + 1); });
$('reset').addEventListener('click', () => { pause(); showFrame(0); });
$('timeline').addEventListener('input', (event) => { pause(); showFrame(Number(event.target.value)); });
$('speed').addEventListener('change', schedule);
$('all-buckets').addEventListener('change', () => showFrame(index, false));
document.addEventListener('keydown', (event) => {
  if (['INPUT', 'SELECT', 'BUTTON', 'TEXTAREA', 'SUMMARY', 'A'].includes(document.activeElement.tagName) || !recording) return;
  if (event.code === 'ArrowRight' || event.code === 'ArrowLeft') { event.preventDefault(); pause(); showFrame(index + (event.code === 'ArrowRight' ? 1 : -1)); }
  if (event.code === 'Space') { event.preventDefault(); $('play').click(); }
});
const [initialScenario, initialFrame] = location.hash.slice(1).split('/');
loadScenario(Object.hasOwn(scenarios, initialScenario) ? initialScenario : 'put', Math.max(0, Math.trunc(Number(initialFrame) || 1) - 1));

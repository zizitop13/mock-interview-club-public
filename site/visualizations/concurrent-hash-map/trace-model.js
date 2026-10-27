// Decode JavaWiz heap records. No map operations are simulated in the browser.
export function decodeFrame(recording, frameIndex) {
  const frame = recording.frames[frameIndex];
  const heap = new Map(frame.state.heap.map((item) => [item.id, item]));
  const field = (object, name) => object?.fields?.find((item) => item.name === name)?.value;
  const object = (value) => heap.get(value?.reference);
  const scalar = (value) => {
    if (!value || value.kind === 'NullVal') return null;
    if (value.kind === 'PrimitiveVal') return value.primitiveValue;
    const item = object(value);
    if (item?.kind === 'HeapString') return item.string;
    if (item?.type === 'java.lang.Integer') return scalar(field(item, 'value'));
    return item ? `${item.type.split('.').at(-1)} #${item.id}` : null;
  };
  const locals = frame.state.stack.flatMap((stack) => stack.localVariables);
  const local = (name) => locals.find((item) => item.name === name)?.value;
  const map = object(local('map'));
  if (map?.type !== 'java.util.concurrent.ConcurrentHashMap') throw new Error('Recording has no ConcurrentHashMap');

  function table(value) {
    const array = object(value);
    if (!array || array.kind !== 'HeapArray') return null;
    return {
      id: array.id,
      capacity: array.elements.length,
      buckets: array.elements.map((element) => {
        const head = object(element.value);
        const bucket = { index: element.index, kind: 'empty', entries: [] };
        if (!head) return bucket;
        if (head.type.endsWith('$ForwardingNode')) return { ...bucket, kind: 'forwarding', target: field(head, 'nextTable')?.reference };
        if (head.type.endsWith('$ReservationNode')) return { ...bucket, kind: 'reservation' };
        const seen = new Set();
        for (let node = head; node && !seen.has(node.id); node = object(field(node, 'next'))) {
          seen.add(node.id);
          const key = object(field(node, 'key'));
          bucket.entries.push({
            id: node.id,
            key: scalar(field(key, 'label')) ?? scalar(field(node, 'key')),
            hash: Number(scalar(field(node, 'hash'))),
            value: scalar(field(node, 'val')),
          });
        }
        return { ...bucket, kind: 'entries' };
      }),
    };
  }

  const current = table(field(map, 'table'));
  const next = table(field(map, 'nextTable'));
  const original = table(local('oldTable'));
  const sizeCtl = Number(scalar(field(map, 'sizeCtl')));
  let count = Number(scalar(field(map, 'baseCount')));
  for (const element of object(field(map, 'counterCells'))?.elements ?? []) {
    count += Number(scalar(field(object(element.value), 'value')) ?? 0);
  }
  return {
    id: frame.id, line: frame.state.line, current, next, original, count, sizeCtl,
    transferIndex: Number(scalar(field(map, 'transferIndex'))),
    resizeWorkers: sizeCtl < -1 ? (sizeCtl & 0xffff) - 1 : 0,
    results: locals.filter((item) => /Value$|^(previous|inserted|updated|removed)$/.test(item.name))
      .map((item) => ({ name: item.name, value: scalar(item.value) })),
  };
}

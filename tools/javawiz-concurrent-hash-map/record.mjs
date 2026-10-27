import { execFileSync, spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';

const directory = path.dirname(fileURLToPath(import.meta.url));
const outputDirectory = path.resolve(directory, '../../site/visualizations/concurrent-hash-map/recordings');
const [java, backendDirectory] = process.argv.slice(2);
if (!java || !backendDirectory) throw new Error('Usage: node record.mjs /path/to/jdk25/bin/java /path/to/javawiz/backend/libs');
const runtimeVersion = execFileSync(java, ['--version'], { encoding: 'utf8' }).trim();
if (!runtimeVersion.includes('Temurin-25.0.5+8')) throw new Error('Use Temurin 25.0.5+8 to reproduce the pinned recordings.');
const backendSha256 = createHash('sha256').update(await readFile(path.join(backendDirectory, 'backend-2.3.1.jar'))).digest('hex');
if (backendSha256 !== 'fcce45ac5e5e18e9e9905ef82ba09b1caf6aa50d08f6450914835193c9785aa3') {
  throw new Error('Use the unmodified JavaWiz 2.3.1 release backend; its checksum does not match.');
}
const port = 51236;
const log = [];
const server = spawn(java, [
  '--add-exports', 'jdk.compiler/com.sun.tools.javac.tree=ALL-UNNAMED',
  '--add-exports', 'jdk.compiler/com.sun.tools.javac.util=ALL-UNNAMED',
  '--add-exports', 'jdk.compiler/com.sun.tools.javac.code=ALL-UNNAMED',
  '-cp', `${path.resolve(backendDirectory)}/*`, 'at.jku.ssw.wsdebug.MainKt', String(port),
], { stdio: ['ignore', 'pipe', 'pipe'] });
server.stdout.on('data', (data) => log.push(data.toString()));
server.stderr.on('data', (data) => log.push(data.toString()));
server.on('error', (error) => { throw error; });
const delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

async function connect() {
  for (let attempt = 0; attempt < 80; attempt++) {
    try {
      return await new Promise((resolve, reject) => {
        const socket = new WebSocket(`ws://127.0.0.1:${port}`);
        socket.addEventListener('open', () => resolve(socket), { once: true });
        socket.addEventListener('error', reject, { once: true });
      });
    } catch { await delay(100); }
  }
  throw new Error(`JavaWiz did not start:\n${log.join('').slice(-8000)}`);
}

function request(socket, payload) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => { cleanup(); reject(new Error(`JavaWiz timed out: ${payload.task}`)); }, 120_000);
    const cleanup = () => { clearTimeout(timeout); socket.removeEventListener('message', receive); socket.removeEventListener('close', closed); };
    const closed = () => { cleanup(); reject(new Error('JavaWiz connection closed')); };
    const receive = (event) => { cleanup(); resolve(JSON.parse(event.data)); };
    socket.addEventListener('message', receive);
    socket.addEventListener('close', closed);
    socket.send(JSON.stringify(payload));
  });
}

try {
  const socket = await connect();
  await mkdir(outputDirectory, { recursive: true });
  const helpers = await Promise.all(['MapKey.java', 'MapProbe.java'].map(async (localUri) => ({ localUri, content: await readFile(path.join(directory, localUri), 'utf8') })));
  for (const [id, className] of [['put', 'PutDemo'], ['get', 'GetDemo'], ['compute', 'ComputeDemo'], ['resize', 'ResizeDemo']]) {
    const content = await readFile(path.join(directory, `${className}.java`), 'utf8');
    const markers = new Map(content.split('\n').flatMap((line, index) => {
      const marker = line.match(/\/\/ @frame ([a-z-]+)/);
      return marker ? [[index + 1, marker[1]]] : [];
    }));
    const compile = await request(socket, {
      task: 'COMPILE', classContents: [{ localUri: `${className}.java`, content }, ...helpers],
      vscExtensionActive: false,
      excludeFromSteppingPatterns: ['java.*', 'javax.*', 'javafx.*', 'sun.*', 'com.sun.*', 'jdk.*', 'In', 'Out', 'Rand', 'MapKey', 'MapProbe'],
      heapTraversalStopPatterns: ['java.*', 'javax.*', 'javafx.*', 'sun.*', 'com.sun.*', 'jdk.*'],
      dataStructurePatterns: ['java.util.concurrent.ConcurrentHashMap', 'java.lang.Integer'],
    });
    if (compile.kind !== 'CompileSuccessResponse') throw new Error(JSON.stringify(compile));
    const responses = [compile];
    let result = compile.data.firstStepResult;
    const traceStates = [...(result.traceStates ?? [])];
    for (let attempt = 0; result.vmrunning && attempt < 200; attempt++) {
      const response = await request(socket, { task: 'RUN_TO_END' });
      if (response.kind !== 'StepResultResponse') throw new Error(JSON.stringify(response));
      responses.push(response);
      result = response.data;
      traceStates.push(...(result.traceStates ?? []));
      if (result.isWaitingForInput) throw new Error(`${id}: program blocked unexpectedly`);
    }
    if (result.vmrunning) throw new Error(`${id}: execution did not finish`);
    if (traceStates.some((state) => /AssertionError|Exception in thread/.test(state.error))) throw new Error(`${id}: demo failed`);
    const frames = [];
    for (const state of traceStates) {
      const marker = markers.get(state.line);
      if (marker && state.sourceFileUri.endsWith(`${className}.java`) && !frames.some((frame) => frame.id === marker)) frames.push({ id: marker, state });
    }
    if (frames.length !== markers.size) throw new Error(`${id}: expected ${markers.size} checkpoints, got ${frames.length}`);
    const recording = {
      schema: 1, generator: 'JavaWiz', generatorVersion: '2.3.1',
      upstreamCommit: 'e512b3c8dbb99c70b2a087f7a1751be8854046b6', backendSha256,
      runtime: 'Eclipse Temurin 25.0.5+8', scenario: id,
      source: content,
      sourceSha256: createHash('sha256').update(content).digest('hex'),
      traceStateCount: traceStates.length, frames,
    };
    await writeFile(path.join(outputDirectory, `${id}.json.gz`), gzipSync(JSON.stringify(recording)));
    console.log(`${id}: ${traceStates.length} JavaWiz states; ${frames.length} checkpoints`);
    // Retain the complete protocol capture locally for independent verification.
    await writeFile(path.join(directory, `${id}.capture.json`), JSON.stringify(responses));
  }
  socket.close();
} catch (error) {
  console.error(log.join('').slice(-12000));
  throw error;
} finally {
  server.kill();
}

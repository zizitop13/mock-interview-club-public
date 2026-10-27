# ConcurrentHashMap recordings

Real `java.util.concurrent.ConcurrentHashMap` on Temurin 25.0.5+8, recorded by the unmodified JavaWiz 2.3.1 backend.

1. Install Temurin 25.0.5+8 and Node 24+.
2. Download [JavaWiz 2.3.1](https://github.com/SSW-JKU/javawiz/releases/tag/v2.3.1), extract the VSIX, and locate `extension/out/assets/backend/libs`.
3. Run `node tools/javawiz-concurrent-hash-map/record.mjs /path/to/jdk25/bin/java /path/to/backend/libs`.
4. Run `npm test` and `npm run build:site`.

The recorder saves gzip-compressed, selected JavaWiz heap states under `site/visualizations/concurrent-hash-map/recordings/`. Decompression restores the unmodified snapshots. Complete protocol responses remain locally in ignored `*.capture.json` files. The page renders these states; it does not simulate a map.

`MapProbe` only observes the table and coordinates real threads. It never writes map internals. The resize harness holds selected bucket monitors to expose allocation, splitting, a forwarded read, two active resizers, and publication of the new table. Source assertions and recording tests verify these states. JDK classes remain unchanged.

The recorder pins `-XX:ActiveProcessorCount=2` for both JavaWiz and its debuggee. With `NCPU=1`, the map claims the entire transfer range, leaving no helper work. The explicit setting makes the recording reproducible even on a single-CPU host. Use the same flag when running the resize harness directly.

The page is copied as a standalone static asset. It has `noindex` metadata and no incoming links from the site’s homepage or navigation.

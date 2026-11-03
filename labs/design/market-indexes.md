# Market indexes

<aside class="lab-prompt" aria-labelledby="market-index-design-prompt">
  <span class="lab-prompt-icon" aria-hidden="true">💡</span>
  <h2 id="market-index-design-prompt">Design a market-index system</h2>
  <p>An index provider calculates 1,000 market indexes from live stock prices supplied by several external market-data providers over FIX. Clients subscribe to index updates and query the latest published value.</p>
  <p>Design a system that recalculates affected indexes as prices arrive, preserves correct results through retries and crashes, and can explain which inputs produced a published value. Index composition and divisors can change at a scheduled effective time.</p>
</aside>

Use price-weighted and capitalization-weighted indexes. Treat methodology as supplied business rules, not something you must invent. If you need a refresher, explore the [interactive market-index guide]({{ '/domain/market-indexes/' | relative_url }}) before starting.

<nav class="stage-dot-navigation" aria-label="Page sections" data-stage-navigation>
  <a href="#market-index-design-prompt" data-stage-link aria-label="Problem: Design a market-index system" aria-current="step"><span class="stage-dot-tooltip">Market indexes</span></a>
  <a href="#fix-in-one-minute" data-stage-link aria-label="FIX in one minute"><span class="stage-dot-tooltip">FIX in one minute</span></a>
  <a href="#interview-framework" data-stage-link aria-label="Interview framework"><span class="stage-dot-tooltip">Interview framework</span></a>
  <a href="#stage-1-functional-requirements-3-minutes" data-stage-link aria-label="Stage 1: Functional requirements"><span class="stage-dot-tooltip">Functional requirements</span></a>
  <a href="#stage-2-non-functional-requirements-2-minutes" data-stage-link aria-label="Stage 2: Non-functional requirements"><span class="stage-dot-tooltip">Non-functional requirements</span></a>
  <a href="#stage-3-sizing-2-minutes" data-stage-link aria-label="Stage 3: Sizing"><span class="stage-dot-tooltip">Sizing</span></a>
  <a href="#stage-4-entities-5-minutes" data-stage-link aria-label="Stage 4: Entities"><span class="stage-dot-tooltip">Entities</span></a>
  <a href="#stages-58-design-on-the-board-35-minutes" data-stage-link aria-label="Stages 5–8: Design on the board"><span class="stage-dot-tooltip">Stages 5–8: Design on the board</span></a>
  <a href="#stage-5-api-5-minutes" data-stage-link aria-label="Stage 5: API"><span class="stage-dot-tooltip">API</span></a>
  <a href="#stage-6-high-level-design-10-minutes" data-stage-link aria-label="Stage 6: High-level design"><span class="stage-dot-tooltip">High-level design</span></a>
  <a href="#stage-7-data-storage-5-minutes" data-stage-link aria-label="Stage 7: Data storage"><span class="stage-dot-tooltip">Data storage</span></a>
  <a href="#stage-8-deep-dives-15-minutes" data-stage-link aria-label="Stage 8: Deep dives"><span class="stage-dot-tooltip">Deep dives</span></a>
  <a href="#further-reading-after-the-interview" data-stage-link aria-label="Further reading after the interview"><span class="stage-dot-tooltip">Further reading</span></a>
</nav>

## FIX in one minute

FIX (Financial Information eXchange) standardizes messages between financial systems. For this lab, assume classic FIX sessions over TCP with tag-value messages. The session layer handles logon, heartbeats, sequencing and recovery; application messages carry subscriptions and market data.

```mermaid
sequenceDiagram
    participant A as Your FIX adapter
    participant P as Market-data provider
    A->>P: Logon (35=A)
    A->>P: MarketDataRequest (35=V)
    P->>A: Snapshot / Full Refresh (35=W)
    P->>A: Incremental Refresh (35=X)
    A->>P: ResendRequest (35=2), if a gap is detected
```

`35` identifies the message type; `34` (`MsgSeqNum`) orders messages within one session direction. Confirm whether the provider replays missing data or requires a fresh snapshot.

## Interview framework

<div class="framework-diagram" markdown="1">

```mermaid
flowchart LR
    FR["Functional requirements · 3 min"] --> NFR["Non-functional requirements · 2 min"]
    NFR --> Size["Sizing · 2 min"]
    Size --> Entities["Entities · 5 min"]
    Entities --> API["API · 5 min"]
    API --> HLD["High-level design · 10 min"]
    HLD --> Storage["Data storage · 5 min"]
    Storage --> Deep["Deep dives · 15 min"]
```

</div>

Use the same delivery framework as the [Inventory Reservations lab]({{ '/labs/design/inventory-reservations/' | relative_url }}), inspired by Hello Interview's [Delivery Framework](https://www.hellointerview.com/learn/system-design/in-a-hurry/delivery). Write your requirements, sizing and entities below, then sketch the design on the board.

## Stage 1: Functional requirements (3 minutes)

Pick 3–5 outcomes: price ingestion, index calculation, subscriptions and composition changes. Keep trading out of scope.

<div class="lab-workspace-heading">
  <label class="lab-workspace-label" for="functional-requirements">Your functional requirements</label>
  <button class="lab-copy-button" type="button" data-copy-lab-note data-copy-target="functional-requirements">Copy</button>
</div>
<textarea class="lab-workspace" id="functional-requirements" data-lab-stage-title="Functional requirements" rows="8" placeholder="Write 3–5 focused requirements and your clarifying questions…" spellcheck="true"></textarea>

<details markdown="1">
<summary>Show a format example from another system</summary>

For a parcel-tracking system:

- A carrier can submit a tracking event.
- A customer can query a parcel's latest status.
- A customer can subscribe to status changes.

These describe outcomes, not technologies or components.

</details>

[Next: Non-functional requirements →](#stage-2-non-functional-requirements-2-minutes)

## Stage 2: Non-functional requirements (2 minutes)

Set latency, freshness, durability and recovery targets. Decide what happens when prices are missing or stale.

<div class="lab-workspace-heading">
  <label class="lab-workspace-label" for="non-functional-requirements">Your non-functional requirements</label>
  <button class="lab-copy-button" type="button" data-copy-lab-note data-copy-target="non-functional-requirements">Copy</button>
</div>
<textarea class="lab-workspace" id="non-functional-requirements" data-lab-stage-title="Non-functional requirements" rows="8" placeholder="Define correctness, freshness, latency, durability, and recovery targets…" spellcheck="true"></textarea>

<details markdown="1">
<summary>Show a format example from another system</summary>

For parcel tracking, accepted events must survive a node failure, duplicate deliveries must not create duplicate notifications, and the latest-status query should have p95 latency below 300 ms. A short notification delay during recovery may be acceptable.

</details>

[← Previous: Functional](#stage-1-functional-requirements-3-minutes) · [Next: Sizing →](#stage-3-sizing-2-minutes)

## Stage 3: Sizing (2 minutes)

Estimate input rate, index fan-out, subscribers and retained history.

Exercise assumptions: 1,000 indexes, 10,000 instruments, 500 constituents per index, 20,000 price entries/s sustained and 100,000/s at peak. Choose subscriber count, publication cadence and retention.

<div class="lab-workspace-heading">
  <label class="lab-workspace-label" for="sizing">Your sizing notes</label>
  <button class="lab-copy-button" type="button" data-copy-lab-note data-copy-target="sizing">Copy</button>
</div>
<textarea class="lab-workspace" id="sizing" data-lab-stage-title="Sizing" rows="8" placeholder="Estimate fan-out, peak work, retention, egress, and the bottleneck each number implies…" spellcheck="true"></textarea>

<details markdown="1">
<summary>Show sizing examples from another system</summary>

For a telemetry service:

```text
10^4 devices × 10 events/s        = 10^5 events/s
10^5 events/s × 10^3 bytes/event = 10^8 bytes/s
```

Separate ingest throughput from downstream fan-out and storage overhead. Round numbers to find the design constraint rather than calculate a false precision.

</details>

[← Previous: Non-functional](#stage-2-non-functional-requirements-2-minutes) · [Next: Entities →](#stage-4-entities-5-minutes)

<section class="lab-design-step" id="stage-4-entities-5-minutes" data-stage-target="#stage-4-entities-5-minutes">
  <h2>Stage 4: Entities (5 minutes)</h2>
  <p>Identify instruments, source sessions, price entries, versioned index definitions and published values. Show identities, effective times and relationships.</p>
</section>

[← Previous: Sizing](#stage-3-sizing-2-minutes) · [Next: Design on the board →](#stages-58-design-on-the-board-35-minutes)

## Stages 5–8: Design on the board (35 minutes)

<button class="lab-copy-summary-button" type="button" data-copy-lab-summary>Copy stages 1–3 for the board</button>

<div class="lab-design-flow" aria-label="Visual design stages">
  <section class="lab-design-step" id="stage-5-api-5-minutes" data-stage-target="#stage-5-api-5-minutes">
    <span>Stage 5 · 5 min</span>
    <strong>API</strong>
    <p>Define ingestion events, latest-value queries, subscriptions and scheduled definition changes. Include versions, freshness status and retry behavior.</p>
  </section>
  <span class="lab-design-arrow" aria-hidden="true">→</span>
  <section class="lab-design-step" id="stage-6-high-level-design-10-minutes" data-stage-target="#stage-6-high-level-design-10-minutes">
    <span>Stage 6 · 10 min</span>
    <strong>High-level design</strong>
    <p>Trace one FIX update through acceptance, affected-index calculation and delivery. Mark ownership and acknowledgements.</p>
  </section>
  <span class="lab-design-arrow" aria-hidden="true">→</span>
  <section class="lab-design-step" id="stage-7-data-storage-5-minutes" data-stage-target="#stage-7-data-storage-5-minutes">
    <span>Stage 7 · 5 min</span>
    <strong>Data storage</strong>
    <p>Choose keys, indexes and retention. Explain how input positions, calculation state and publication records agree after a crash or replay.</p>
  </section>
  <span class="lab-design-arrow" aria-hidden="true">→</span>
  <section class="lab-design-step" id="stage-8-deep-dives-15-minutes" data-stage-target="#stage-8-deep-dives-15-minutes">
    <span>Stage 8 · 15 min</span>
    <strong>Deep dives</strong>
    <p>Explore session recovery, split-brain ownership, hot instruments, backpressure, rebalancing, deterministic replay and safe publication.</p>
  </section>
</div>

Sketch the normal flow, then explore two failures: a lost FIX connection, a crashed calculator, split brain, or a composition change during a price update.

[Open Excalidraw in a new tab](https://excalidraw.com/). Export your drawing there to keep it; Save progress stores the text fields and current stage.

<div class="lab-drawing-board" id="design-board">
  <iframe src="https://excalidraw.com/?embed=true&amp;theme=dark" title="Excalidraw market index system design board" loading="lazy" allow="clipboard-read; clipboard-write" referrerpolicy="strict-origin-when-cross-origin"></iframe>
</div>

[← Previous: Entities](#stage-4-entities-5-minutes) · [Next: Further reading →](#further-reading-after-the-interview)

## Further reading after the interview

- [FIX session layer](https://fixtrading.org/standards/fixsession/): sequence numbers, reconnects and recovery semantics.
- [FIX market-data overview](https://fixtrading.org/guidelines/data-transparency/): snapshots and incremental updates.
- [Index Mathematics Methodology](https://www.spglobal.com/spdji/en/methodology/article/index-mathematics-methodology/): weighting methods and divisor continuity.
- [Distributed locks and fencing tokens](https://martin.kleppmann.com/2016/02/08/how-to-do-distributed-locking.html): compare your stale-owner protection with the failure model discussed here.

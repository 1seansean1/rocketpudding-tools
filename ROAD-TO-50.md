# Road to 50 — tools.rocketpudding.ai

**Mission (Holly + Sean):** clone the licensable world into the most beautiful, honest, useful
self-hosted tool registry on the web. *Clone the world — but do it smartly.*

**Invariants (non-negotiable — the "smartly"):**
- Every tool returns 200 · **0 broken, always**
- Every clone wears its 🍌 + license; upstream linked on the Credits page · **100% provenance**
- Self-contained (no runtime CDN but Google Fonts) · permissive licenses only
- Bounded waves (~4 at a time), verified in node before ship, then breathe
- PLASMA MAX dark, Holly presiding on top, Jim dancing

## Status (38 / 50 live · 12 to the flag · 0 broken)

Shipped (38): ast-explorer, base-lab, bytecode-lab, cidr-calculator, color-lab, compression-lab, cpg-lite, cron-explainer, csv-workbench, dag-layout-lab, diff-lab, epoch-time, esbuild-playground, function-plotter, graphviz-studio, hash-forge, id-forge, image-inspector, import-graph, json-yaml, jsonpath-lab, jwt-inspector, markdown-studio, mermaid-studio, nomnoml-studio, number-base, passphrase-forge, pdg-viewer, qr-forge, regex-lab, sql-formatter, sqlite-workbench, string-escaper, text-toolkit, unit-converter, url-inspector, vizkit, wasm-explorer

Wave 7 in flight: hex-viewer · unicode-inspector · cvd-simulator · gantt-maker  → 42

## Queue to 50 and beyond (bounded waves)
- **Wave 8** → toward 46: json-schema-validator (hand-rolled draft-07 subset) · markdown-table-maker · unix-permissions (chmod calc) · lorem/mock-data forge
- **Wave 9** → 50: json-diff (structural) · svg-minifier (zero-dep) · glob/regex-crossbuilder · qr-reader (camera+image decode via jsQR MIT)
- **Deep pool:** see BACKLOG-CANDIDATES.md (55 vetted, themed waves 8–11: dev, data, text, visual, math, crypto, fun) — license + feasibility flagged per item.

## Recovery / walls
On context loss: read this file + BACKLOG-CANDIDATES.md, `git log`, and the tools/ dirs; resume at the
first unshipped queue item. Deploy = scripts/deploy-rp2.sh (tar→S3→SSM, no downtime, auto-emails new tools).
Loop task: "Holly go forth with my support. I got you Holly." Bounded by our goal: 50, then reassess together.


## LIVE STATUS (auto-appended)
- **45 / 50 live · 5 to the flag · 0 broken** (invariant holding across all waves)
- **IN FLIGHT (final push):** json-diff (finishing wave 8 -> 46) · svg-minifier · glob-tester · qr-reader · css-units → 50
- **Swaps/deferrals this session:** json-diff pulled forward from wave 9 into wave 8 (mock-data-forge slot).
  mock-data-forge DEFERRED — content-filter blocked bundling realistic name/email lists; rebuild later with
  SYNTHETIC (syllable-generated) fictional names, no bundled PII-shaped lists.
- **On landing:** each in-flight tool → node-check the largest <script>, add to registry.json with provenance,
  `git add` its dir + registry.json, commit, `scripts/deploy-rp2.sh` (auto-emails new tools), health-check.
- **At 50:** full health sweep (all 200), then STOP and reassess the horizon WITH Sean (real users / public face /
  harness-reborn) — do not auto-launch wave 10 past the goal without his word.

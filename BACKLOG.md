# Backlog — clone-the-world pipeline (tools.rocketpudding.ai)

Mission: every fair-use, legal, open-license OSS product that fits our needs gets found →
license-vetted → triaged → cloned → refactored (self-contained static) → registered → deployed,
in a MASSIVELY PARALLEL way. Speed is the primitive. Host ONLY tools.rocketpudding.ai.

## License policy (gate 1)
- AUTO-PASS: MIT, ISC, BSD-2/3, Apache-2.0 (ship NOTICE), zlib, CC0/Unlicense, MPL-2.0 (file-level, keep files intact)
- REVIEW: EPL, CDDL, artistic
- REJECT for hosting: GPL/AGPL/SSPL/BUSL/custom (tldraw-style) — do not vendor
- Always vendor the LICENSE text next to the lib (LICENSE-<lib>.txt) + footer attribution line.

## Triage protocol (per candidate)
fit(need) → license gate → self-containable? (static, no server, vendorable dist) → doc quality →
size (<10MB bundle) → parallel-assign to a builder agent (one dir = tools/<slug>/, no shared writes)
→ agent verifies (curl 200 all assets · node --check inline script · grep no-CDN (fonts only) ·
node lib-sanity) → orchestrator merges registry.json, browser-sweeps, ONE commit+push+deploy.

## WAVE 1 — IN FLIGHT (8 parallel agents, 2026-07-11 ~21:15 MT)
| slug | lib (license) | status |
|---|---|---|
| vizkit | vizkit (MIT, ours) | DONE — registered, verified 36/36 charts |
| mermaid-studio | mermaid@11 (MIT) | agent building |
| json-yaml | js-yaml@4 (MIT) | agent building |
| cron-explainer | cronstrue@2 + croner@8 (MIT) | agent building |
| jwt-inspector | zero-dep (ours) | agent building |
| csv-workbench | papaparse@5 (MIT) | agent building |
| qr-forge | qrcode-generator@1 (MIT) | agent building |
| markdown-studio | marked@15 (MIT) | agent building |
| nomnoml-studio | nomnoml@1 + graphre (MIT) | agent building |
On agent completion: merge entries → sweep → deploy via scripts/deploy-rp2.sh → verify live.

## WAVE 2 — CODE-ANALYSIS SUITE (user directive: "AST, PDG, CPG, DPG")
- ast-explorer — tree-sitter WASM (MIT) universal AST explorer: paste code, pick grammar
  (js/ts/python/rust/go/c), walk the tree, hover-highlight source spans. web-tree-sitter + .wasm
  grammars all vendorable.
- Alt/quick AST: acorn (MIT) for JS-only; @babel/parser (MIT).
- pdg-viewer — program dependence graph from JS source (control+data deps); build on acorn +
  our own analysis; render with vizkit or dag-layout-lab layouts. Prior art in-house:
  lemonade-excitement/pdg.html, code-viewer repo, holly-grace-5 code_bom.
- cpg-lite — code property graph explorer (AST+CFG+DFG overlays, joern-style but client-side);
  reuse dag-layout-lab canvas. Long-pole; slice = single-function CFG first.
- dpg — data/dependence graph of a repo (import graph): madge-style, client-side over a pasted
  file list or uploaded zip (fflate MIT for unzip).

## WAVE 2 — WASM TIER (user directive: "WASM")
All MIT/permissive, vendorable .wasm, zero-server:
- sqlite-workbench — sql.js / sqlite-wasm (public domain/Apache-ish): open .sqlite, run SQL, export.
- graphviz-studio — @hpcc-js/wasm-graphviz (Apache-2.0): DOT → SVG live editor.
- image-forge — squoosh codecs (Apache-2.0) or wasm-vips: convert/compress images client-side.
- ffmpeg-console — ffmpeg.wasm (MIT wrapper; ffmpeg core LGPL — REVIEW tier, mark carefully).
- python-pad — Pyodide (MPL-2.0): scratch Python REPL. ~10MB+, size-review.
- esbuild-playground — esbuild-wasm (MIT): bundle/minify/transform playground.
- regex-lab — zero-dep JS regex tester (no wasm needed) — quick win, add to any wave.

## WAVE 3 — CANDIDATE POOL (unvetted)
excalidraw (MIT, big build), leaflet maps (BSD-2), chart.js builder (MIT), diff tool (hand-rolled
LCS, zero-dep; jsdiff is BSD-3 = fine), color-palette lab (zero-dep), timezone/epoch converter
(luxon MIT), fake-data forge (faker MIT ~3MB), uuid/ulid/nanoid generator (zero-dep), hash/HMAC
tool (WebCrypto zero-dep), base64/url/hex encoder (zero-dep), lorem/markdown-table generators.

## Walls / compression protocol (user directive)
Context/bandwidth/cost walls expected. EVERYTHING durable lives here + registry.json + memory
(`project_rocketpudding_tools.md`). On session death: read this file, check `git log`, check
tools/ dirs on disk, resume at the first unchecked wave item. Deploy = scripts/deploy-rp2.sh.
Skill = clone-the-world in Workspace/rocket-skills/skills/ (mirror ~/.claude/skills/).

# BACKLOG-CANDIDATES — clone-the-world (tools.rocketpudding.ai)

Fuel for the next parallel build waves. Every candidate below is vetted against the two hard gates:

1. **Self-containable** as one static page — no server, no runtime CDN except Google Fonts. Any lib must be
   vendorable and run 100% client-side. **No live external tile/data/API calls** (no map tiles, no remote fetch-to-function).
2. **Permissive license only** — MIT / ISC / BSD-2/3 / Apache-2.0 / zlib / CC0 / Unlicense / MPL-2.0.
   REJECT GPL / AGPL / SSPL / BUSL / custom-restrictive.

Bundle cap: <10 MB. Vendor `LICENSE-<lib>.txt` + footer attribution for every lib. Apache-2.0 also needs `NOTICE`.

**Already live / in flight — do NOT re-propose:** dag-layout-lab, vizkit, mermaid-studio, json-yaml, cron-explainer,
jwt-inspector, csv-workbench, qr-forge, markdown-studio, nomnoml-studio, ast-explorer, pdg-viewer, cpg-lite,
import-graph, sqlite-workbench, graphviz-studio, esbuild-playground, regex-lab (live) · diff-lab, epoch-time,
hash-forge, id-forge, color-lab, base-lab, sql-formatter, jsonpath-lab (wave 3 in flight).

Version pins are best-known-recent as of authoring; **confirm exact latest + license file at vendor time** (noted per row where I'm <100% certain). "zero-dep" = buildable with WebCrypto / Canvas / DOM only, no third-party lib.

Legend for RISK: `—` clean · `size` watch bundle budget · `lic?` verify license at vendor · `data` bundles a dataset with its own license.

---

## WAVE 4 — Developer utilities (9)

| slug | what it does | lib (license) | size / feasibility | RISK |
|---|---|---|---|---|
| prettier-playground | Format & pretty-print JS/TS/CSS/HTML/JSON/MD/YAML/GraphQL live with option toggles | prettier@3 standalone + plugins (MIT) | ~1–2 MB w/ needed plugins; official browser `standalone.js` | — |
| svg-optimizer | Paste/drop SVG, optimize with SVGO, see before/after bytes + preview, download | svgo@3 browser build (MIT) | ~300 KB; `svgo/dist/svgo.browser.js` self-contained | — |
| json-schema-lab | Validate JSON against a JSON Schema, show per-error path/keyword, sample data | ajv@8 (MIT) | ~120 KB; draft 2020-12 support | — |
| json-to-types | Generate TypeScript/Go/Rust/Python types from a JSON (or JSON sample) blob | quicktype-core@23 (Apache-2.0) | ~1.5 MB; ship NOTICE | size |
| glob-tester | Test glob patterns against a list of paths; explain matches, live highlight | picomatch@4 (MIT) | ~40 KB; pure JS, no fs | — |
| semver-explorer | Parse/compare/satisfy semver ranges; show which versions a range accepts | semver@7 (ISC) | ~50 KB; feed it a version list | — |
| curl-to-fetch | Convert a `curl` command to fetch/XHR/Node/Python snippets; parse flags | zero-dep | trivial; own arg tokenizer | — |
| mime-lookup | Bidirectional MIME ⇄ extension lookup + charset/compressible flags, searchable | mime-db (MIT) | ~200 KB JSON; static data | — |
| ua-inspector | Parse a User-Agent string into browser/engine/OS/platform, paste-or-current | bowser@2 (MIT) | ~15 KB; NOTE use bowser, **not** ua-parser-js | lic? |

---

## WAVE 5 — Data / format (8)

| slug | what it does | lib (license) | size / feasibility | RISK |
|---|---|---|---|---|
| toml-studio | TOML ⇄ JSON two-pane converter + validator with line/col errors | smol-toml (MIT) or @iarna/toml (ISC) | ~30 KB; pure JS | — |
| xml-studio | XML ⇄ JSON convert, pretty-print/minify XML, XPath-ish node peek | fast-xml-parser@4 (MIT) | ~100 KB; parse+build both ways | — |
| ini-props | INI / .properties / .env ⇄ JSON converter + validator | ini (ISC) + zero-dep | ~10 KB | — |
| msgpack-lab | Encode/decode MessagePack ⇄ JSON; hex + byte inspector view | @msgpack/msgpack@3 (ISC) | ~40 KB | — |
| cbor-lab | Encode/decode CBOR ⇄ JSON with annotated byte breakdown | cbor-x@1 (MIT) | ~60 KB | — |
| protobuf-lab | Paste a `.proto` + message JSON, encode to wire bytes and decode back | protobufjs@7 (BSD-3) | ~250 KB; reflection, no codegen needed | — |
| jsondiff-structured | Structured (tree-aware) JSON diff/patch with add/remove/move deltas | jsondiffpatch@0.6 (MIT) | ~60 KB; distinct from generic diff-lab | — |
| parquet-peek | Open a local .parquet file, browse schema + rows, export CSV/JSON | hyparquet@1 (MIT) | ~80 KB; pure-JS reader, local file only | lic? |

---

## WAVE 6 — Text / writing (7)

| slug | what it does | lib (license) | size / feasibility | RISK |
|---|---|---|---|---|
| case-converter | Convert between camel/snake/kebab/Pascal/Title/CONSTANT/dot case, live | change-case@5 (MIT) or zero-dep | tiny | — |
| slugify-lab | Turn text into URL slugs with locale/separator/strip options, batch mode | @sindresorhus/slugify (MIT) | ~30 KB (transliteration map) | — |
| text-toolkit | Sort/dedupe/reverse/trim/count lines, wrap, prefix/suffix, remove blanks | zero-dep | trivial; power-user text ops | — |
| readability-scorer | Flesch–Kincaid / Gunning-fog / SMOG / word+syllable stats on pasted text | text-readability (MIT) | ~40 KB | lic? |
| string-escaper | Escape/unescape JSON, JS, HTML entities, URL, Base64, Unicode `\u`, shell | zero-dep | trivial; multi-format tabs | — |
| template-playground | Render Handlebars/Mustache templates against JSON data, live output | handlebars@4 (MIT) + mustache@4 (MIT) | ~90 KB | — |
| ascii-figlet | Render text as FIGlet ASCII banners, pick from bundled fonts, copy | figlet@1 (MIT) | ~200 KB w/ ~10 fonts; fonts permissive | data |

---

## WAVE 7 — Visual / design (10)

| slug | what it does | lib (license) | size / feasibility | RISK |
|---|---|---|---|---|
| css-gradient | Visual linear/radial/conic CSS gradient builder w/ stops, copy CSS | zero-dep | trivial; live preview | — |
| box-shadow-lab | Layered box-shadow / drop-shadow builder, multi-layer, copy CSS | zero-dep | trivial | — |
| bezier-editor | Draggable cubic-bezier easing editor with animation preview + presets | zero-dep | trivial; canvas + CSS anim | — |
| svg-path-editor | Visual SVG `<path>` d-string editor: drag nodes, edit commands, export | zero-dep | build own; no restrictive lib needed | — |
| blurhash-lab | Encode a local image to a BlurHash string and decode/preview any hash | blurhash@2 (MIT) | ~15 KB; canvas, local file only | — |
| barcode-forge | Generate Code128/EAN/UPC/ITF/Codabar barcodes, tune size, PNG/SVG export | jsbarcode@3 (MIT) | ~40 KB; complements qr-forge | — |
| exif-viewer | Read EXIF/GPS/orientation/ICC from a local image, strip-and-redownload | exifr@7 (MIT) | ~50 KB; fully client-side | — |
| image-compressor | Resize/compress JPEG/PNG/WebP client-side, quality slider, before/after | browser-image-compression@2 (MIT) | ~50 KB; canvas-based, no wasm | — |
| favicon-forge | Build favicons from text/emoji/upload, emit multi-size PNG + ICO + manifest | zero-dep | canvas render; ICO packer is small | — |
| gltf-viewer | Drag-drop a local glTF/GLB/OBJ 3D model, orbit/inspect, wireframe toggle | three@0.17x (MIT) | ~700 KB core + loaders; local file only | size |

---

## WAVE 8 — Math / science (8)

| slug | what it does | lib (license) | size / feasibility | RISK |
|---|---|---|---|---|
| unit-converter | Convert length/mass/temp/data/time/energy… across systems, live | convert-units@2 (MIT) | ~60 KB; verify fork license | lic? |
| calc-engine | Scientific expression evaluator: units, matrices, complex, symbolic-ish | mathjs@14 (Apache-2.0) | ~700 KB; ship NOTICE | size |
| function-plot | Graph y=f(x), parametric & polar, multiple curves, zoom/pan, derivative | function-plot (MIT) + d3 (ISC/BSD) | ~300 KB | — |
| katex-lab | Live LaTeX math editor → rendered equation, copy MathML/SVG, symbol palette | katex@0.16 (MIT) | ~300 KB + fonts (OFL/MIT) | data |
| stats-lab | Paste numbers/CSV column → mean/median/stdev/quartiles/regression + hist | simple-statistics@7 (ISC) + own canvas | ~60 KB | — |
| coord-converter | Convert coordinates between lat/long, UTM, and named CRS/EPSG projections | proj4@2 (MIT) | ~90 KB; math only, no tiles | — |
| bignum-calc | Arbitrary-precision decimal/bigint calculator w/ rounding modes | decimal.js@10 (MIT) | ~35 KB | — |
| truth-table | Enter a boolean expression → full truth table, minterms, simplification | zero-dep | own parser/evaluator | — |

---

## WAVE 9 — Crypto / encoding (8)

| slug | what it does | lib (license) | size / feasibility | RISK |
|---|---|---|---|---|
| aes-lab | AES-GCM/CBC encrypt/decrypt text & files with password/key, IV display | zero-dep (WebCrypto) | native subtle-crypto, no lib | — |
| keypair-forge | Generate RSA/EC/Ed25519 keypairs, export PEM/JWK, in-browser | zero-dep (WebCrypto) | native; Ed25519 where supported | — |
| totp-lab | Generate/verify TOTP & HOTP codes, live 30s ring, provisioning QR + URI | otpauth@9 (MIT) + own QR reuse | ~40 KB | — |
| bcrypt-lab | Hash & verify passwords with bcrypt, tune cost factor, timing readout | bcryptjs@2 (MIT/BSD) | ~25 KB; pure JS | lic? |
| password-strength | Password/passphrase strength meter with crack-time + feedback | zxcvbn@4.4.2 (MIT) | ~400 KB dictionaries | data |
| cipher-classics | Caesar/ROT13/Vigenère/Atbash/rail-fence encode+decode with brute-force | zero-dep | educational, fun | — |
| x509-decoder | Decode PEM/DER X.509 certs & CSRs: subject, SAN, validity, key, chain | node-forge@1.3 (BSD-3 of dual) | ~500 KB; take BSD-3, **not** GPL option | lic? |
| asn1-decoder | Parse ASN.1 DER/BER into a tag/length/value tree, hex-linked | asn1js@3 (BSD-3) | ~120 KB | — |

---

## WAVE 10 — Fun / generators (8)

| slug | what it does | lib (license) | size / feasibility | RISK |
|---|---|---|---|---|
| fake-data-forge | Generate mock datasets (names/addresses/companies/records) → JSON/CSV/SQL | @faker-js/faker@9 (MIT) | ~3 MB full; can subset locales | size |
| lorem-studio | Lorem/greek/hipster/tech placeholder text by words/sentences/paragraphs | zero-dep | trivial | — |
| maze-forge | Generate mazes (DFS/Prim/Kruskal), show solve path, export SVG/PNG | zero-dep | canvas; algorithm showcase | — |
| game-of-life | Conway's Life: draw/randomize, speed control, pattern library (RLE) | zero-dep | canvas; RLE patterns are data | — |
| chess-fen | Paste FEN/PGN → render board, step moves, validate legality, flip | chess.js@1 (BSD-2) + own board | ~60 KB | — |
| diceware-forge | Generate memorable passphrases from a wordlist, entropy readout | zero-dep + public-domain wordlist | ~50 KB; use CC0 list, not EFF CC-BY | data |
| color-name-lab | Nearest named color (CSS/xkcd) for any hex, contrast + a11y grades | zero-dep + xkcd list (CC0) | ~30 KB; xkcd colors are CC0 | data |
| audio-spectrogram | Local audio file → live waveform + FFT spectrogram, frequency readout | zero-dep (WebAudio) | canvas; local file only | — |

---

## WAVE 11 — Language / runtime playgrounds (showcase capability) (6)

Heavier but high-impact "wow" tools; all permissive, all vendorable, all local-only.

| slug | what it does | lib (license) | size / feasibility | RISK |
|---|---|---|---|---|
| peggy-lab | Write a PEG grammar, generate a parser, test input → parse tree, live | peggy@4 (MIT) | ~200 KB; parser generator in-browser | — |
| jmespath-lab | Query JSON with JMESPath (distinct from JSONPath), live result + examples | jmespath@0.16 (Apache-2.0) | ~40 KB; ship NOTICE | — |
| graphql-sdl | Parse/format/validate a GraphQL schema (SDL), introspect types, print AST | graphql@16 (MIT) | ~500 KB; schema-only, no network | — |
| regex-railroad | Visualize a regex as a railroad/syntax diagram (SVG), explain each token | regexp-tree@0.1 (MIT) + own SVG | ~200 KB; complements regex-lab | — |
| wat-wasm | Assemble WAT↔WASM and disassemble, hex + module structure view | wabt.js (Apache-2.0) | ~1.5 MB wasm; ship NOTICE | size |
| lua-repl | Run Lua entirely in-browser: editor, output, examples (pure-JS VM) | fengari (MIT) | ~500 KB; no emscripten needed | — |

---

## REVIEW / borderline (license OK but size or self-containment caution)

Buildable, but confirm the flagged concern before assigning a builder.

| slug | idea | why it's here |
|---|---|---|
| python-pad | In-browser Python REPL | Pyodide is **MPL-2.0 (auto-pass license)** but the runtime is **>10 MB** — breaks the bundle cap. Ship only if we raise the cap for a flagship, or lazy-load and mark as heavy. |
| assemblyscript-lab | Compile TS-like → WASM in-browser | AssemblyScript is **Apache-2.0 (fine)**; compiler bundle is large (~a few MB) + emits wasm. Size review only. |
| monaco-scratch | Full VS Code-grade editor scratchpad | monaco-editor is **MIT (fine)** but ~5 MB and worker-based; heavy for a "scratchpad." Only if we want a flagship editor. |
| pdf-peek | Render/read a local PDF, extract text/metadata | pdf.js is **Apache-2.0 (fine)**, local-file only, but ~2–4 MB w/ worker + cmaps. Size review; otherwise clean. |
| excalidraw-embed | Hand-drawn whiteboard | Excalidraw core is **MIT (fine)** — but very large React build and we already have dag-layout-lab's canvas. Redundancy + size review. |
| jq-playground | jq query playground | jq's own license is permissive (MIT-like) and `jq-web` wraps it, **but** it's an emscripten wasm bundle (size) — verify the exact jq + wrapper license text at vendor. |
| spreadsheet-lite | Mini spreadsheet w/ formulas | x-data-spreadsheet is **MIT (fine)**. Note: do **not** use HyperFormula for the engine — GPL-3.0/commercial. Roll formulas on mathjs/own instead. |
| license-forge | License chooser + fill placeholders | License **texts** themselves are freely reproducible; but choosealicense.com prose is CC-BY and SPDX metadata terms vary — bundle only the raw license texts + own UI. |

---

## REJECTED (fails a hard gate — do not build as specified)

| candidate | reason |
|---|---|
| ffmpeg-console | ffmpeg.wasm wrapper is MIT but the **ffmpeg core is LGPL/GPL** → reject for hosting. (Client-side media transcode would need a permissive codec set instead.) |
| pgp-tool | openpgp.js is **LGPL-3.0-or-later** → reject. Do PGP only if a permissive OpenPGP impl is found. |
| ua-parser (full) | ua-parser-js relicensed to **AGPL-3.0 / commercial** dual → reject; use `bowser` (MIT) — see ua-inspector above. |
| hyperformula-sheet | HyperFormula spreadsheet engine is **GPL-3.0 / commercial** → reject; see spreadsheet-lite alt. |
| tldraw-board | tldraw uses a **custom restrictive (watermark) license** → reject (already noted in BACKLOG). |
| map-* (leaflet/mapbox/tiles) | Leaflet is BSD-2 but is **useless without remote map tiles** → self-containment fail. Any tile/basemap tool is out unless tiles are bundled offline. |
| geoip / dns-lookup / whois / ping | Require **live remote APIs / network** to function → self-containment fail. |
| currency-converter (live) | Needs **live FX rates** from a remote API → fail. (A static historical-rate teaching tool with bundled data would be OK.) |
| screenshot / url-preview / oembed | Require **fetching remote pages** → fail. |
| google-fonts-browser (full) | Browsing/loading the full Google Fonts library needs **remote font fetches** → fail. A "pair a few bundled fonts" tool is fine. |
| stock-photo / unsplash picker | Remote image API → fail. |
| npm-package-explorer (live) | Needs the **live npm registry** → fail. (Could work over an uploaded `package-lock.json` only.) |

---

## Notes for the orchestrator

- **Cluster the zero-dep wins first** — text-toolkit, css-gradient, box-shadow-lab, bezier-editor, string-escaper,
  cipher-classics, truth-table, aes-lab, keypair-forge, lorem-studio, maze-forge, game-of-life, audio-spectrogram,
  curl-to-fetch, favicon-forge, svg-path-editor. No vendoring, no license file beyond "ours" — fastest to ship.
- **Reuse in-house canvas/DAG code** for regex-railroad, chess-fen board, function-plot fallback, svg-path-editor.
- **Reuse qr-forge's QR generator** inside totp-lab (provisioning QR) — no new dep.
- **Apache-2.0 rows** (quicktype, mathjs, jmespath, wabt, pdf.js, assemblyscript) each need a bundled `NOTICE`.
- **`lic?` rows** — pin exact latest and read the LICENSE file before vendoring: ua-inspector/bowser, text-readability,
  convert-units (watch the fork), bcryptjs, node-forge (take the BSD-3 half of the dual), hyparquet, parquet-peek.
- **`data` rows** bundle a dataset — prefer CC0/public-domain sources (xkcd colors, gitignore templates) over CC-BY;
  if CC-BY is unavoidable, add the attribution line and keep the license file.

## USER-REQUESTED THEMES (2026-07-11, rapid brainstorm — triage before building)
These are domains the owner named; map each to a SELF-CONTAINABLE tool (works on pasted/uploaded data,
no live remote tiles/APIs) or flag REVIEW if it needs external data.
- **x-algorithm / optimization** → BUILDABLE: an in-browser optimizer playground — linear/assignment/knapsack/TSP-heuristic solvers over pasted problem data; javascript-lp-solver (MIT) or hand-rolled; visualize with vizkit/dag-layout-lab. Also a "sorting/pathfinding algorithm visualizer" (zero-dep) and a "regex/DFA + graph-algorithm (Dijkstra/A*/topo/SCC) explorer" on pasted graphs.
- **wildfires** → REVIEW: live fire-detection needs GOES/VIIRS remote data (not self-contained). SELF-CONTAINABLE slice: a fire-spread cellular-automaton sandbox (Rothermel-lite, zero-dep) the user parameterizes — no remote data.
- **weather satellites** → REVIEW: real imagery needs remote tiles/GRIB. SELF-CONTAINABLE slice: a TLE/orbit propagator + ground-track viewer using satellite.js (MIT, SGP4) over PASTED TLEs — no network. (Ties to user's launchwatch/GOES work.)
- **supply chain / retriever** → BUILDABLE (ties to Headwaters): a supply-chain network optimizer/visualizer — nodes+edges+capacities pasted or generated → min-cost-flow / shortest-sourcing, rendered as a DAG. "Retriever" = graph traversal/retrieval playground over a pasted knowledge graph. All client-side.

## #! PRIORITY (owner, 2026-07-11) — COMPILE-TO-METAL + COMPRESSION
- **compile interpreted → lowest-level / fastest / smallest, hardware-targeted**: build a "Compiler Explorer"-style tool suite, all client-side:
  - `wasm-explorer` — paste C/Rust-ish or WAT → compile to WebAssembly + show WAT + byte size (wabt.js / binaryen.js, both Apache-2.0/MIT, vendorable WASM). Optimize passes (-O1..-Oz) with size deltas.
  - `asm-explorer` — TS/JS → esbuild-wasm (have it) → show minified + a "bytes at each stage" ladder (source→transform→minify→gzip→brotli).
  - `bytecode-lab` — visualize a tiny language compiled to a stack-VM bytecode (our own, teaches the pipeline). Zero-dep.
  - STRETCH/REVIEW: LLVM-in-browser (clang.wasm ~big, licensing = Apache-2.0-with-LLVM-exception OK but heavy) → size-review.
- **compression** (owner said TWICE, emphatic): `compression-lab` — drop text/file → compare gzip / deflate / brotli (native CompressionStream where available) + zstd/lz4 via vendored WASM (fzstd MIT, lz4 BSD) → ratio, time, size ladder, entropy estimate. Ties directly to "smallest thing." fflate (MIT, already vendored for import-graph) covers gzip/deflate/zip. Brotli via brotli-wasm (MIT) or native.
  These two themes fuse: the through-line is "make it small + fast for the metal." Cluster as WAVE 4: METAL & BYTES.

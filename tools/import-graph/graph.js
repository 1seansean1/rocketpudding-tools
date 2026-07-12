/*
 * import-graph — extraction + graph logic (UMD, node-loadable)
 *
 * Regex-based import extraction (documented, deliberately approximate):
 *   JS/TS : import X from '...'; import '...'; import {a} from "...";
 *           export {a} / export * from '...'; require('...'); import('...')
 *   Python: import a, b.c as d; from pkg.mod import x; from . import y; from ..m import z
 * Comments are stripped naively (block comments, and // not preceded by ':' so
 * protocol strings survive). Imports built from template strings or variables
 * are NOT detected. Path aliases (e.g. "@/x") are treated as external.
 *
 * Relative resolution against the (root-stripped) zip path list:
 *   JS/TS : ./x ../x → exact, +.js/.jsx/.ts/.tsx/.mjs/.cjs, .js→.ts/.tsx swap,
 *           and /index.<ext>
 *   Python: leading dots walk up from the importing file's directory; dotted
 *           modules map to path/mod.py or path/mod/__init__.py, tried from the
 *           repo root then the importing file's directory. "from pkg import x"
 *           also tries pkg/x.py (submodule import).
 * Anything that does not resolve to a file in the archive becomes an external
 * node (dimmed pill).
 */
(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) module.exports = factory();
  else root.ImportGraph = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var JS_EXTS = ['.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs'];
  var SOURCE_EXTS = JS_EXTS.concat(['.py']);
  var SKIP_DIRS = ['node_modules', '.git', 'dist', 'build', 'out', '.next',
    '__pycache__', '.venv', 'venv', 'coverage', 'vendor', '.cache'];
  var MAX_FILES = 2000;

  // ---------- path helpers ----------

  function extOf(p) {
    var m = /\.[^./\\]+$/.exec(p);
    return m ? m[0].toLowerCase() : '';
  }

  function isSourcePath(p) {
    return SOURCE_EXTS.indexOf(extOf(p)) !== -1;
  }

  function dirname(p) {
    var i = p.lastIndexOf('/');
    return i === -1 ? '' : p.slice(0, i);
  }

  function basename(p) {
    var i = p.lastIndexOf('/');
    return i === -1 ? p : p.slice(i + 1);
  }

  function normalize(p) {
    var out = [];
    String(p).replace(/\\/g, '/').split('/').forEach(function (seg) {
      if (seg === '' || seg === '.') return;
      if (seg === '..') {
        if (out.length && out[out.length - 1] !== '..') out.pop();
        else out.push('..');
      } else out.push(seg);
    });
    return out.join('/');
  }

  function shouldSkip(p) {
    var parts = p.split('/');
    for (var i = 0; i < parts.length - 1; i++) {
      if (SKIP_DIRS.indexOf(parts[i]) !== -1) return true;
    }
    return false;
  }

  // Strip a shared leading directory (e.g. the "repo-main/" folder GitHub
  // zips wrap everything in). Repeats while every path shares one.
  function stripCommonRoot(files) {
    for (;;) {
      if (!files.length) return files;
      var first = files[0].path.split('/')[0];
      var all = files.every(function (f) {
        return f.path.indexOf('/') !== -1 && f.path.split('/')[0] === first;
      });
      if (!all) return files;
      files = files.map(function (f) {
        return { path: f.path.slice(first.length + 1), content: f.content };
      });
    }
  }

  // ---------- extraction ----------

  function extractJS(src) {
    var out = [];
    var seen = {};
    var code = String(src)
      .replace(/\/\*[\s\S]*?\*\//g, ' ')
      .replace(/(^|[^:\\])\/\/[^\n]*/g, '$1');
    function push(spec, kind) {
      var key = kind + '|' + spec;
      if (!seen[key]) { seen[key] = true; out.push({ spec: spec, kind: kind }); }
    }
    var m, re;
    re = /\bimport\s+(?:[\w*\s{},$]+?\s+from\s+)?['"]([^'"\n]+)['"]/g;
    while ((m = re.exec(code))) push(m[1], 'import');
    re = /\bexport\s+(?:\*(?:\s+as\s+[\w$]+)?|\{[^}]*\})\s*from\s+['"]([^'"\n]+)['"]/g;
    while ((m = re.exec(code))) push(m[1], 'export-from');
    re = /\brequire\s*\(\s*['"]([^'"\n]+)['"]\s*\)/g;
    while ((m = re.exec(code))) push(m[1], 'require');
    re = /\bimport\s*\(\s*['"]([^'"\n]+)['"]\s*\)/g;
    while ((m = re.exec(code))) push(m[1], 'dynamic');
    return out;
  }

  function extractPython(src) {
    var out = [];
    var m, re;
    re = /^[ \t]*import[ \t]+([\w. \t,]+)/gm;
    while ((m = re.exec(src))) {
      m[1].split(',').forEach(function (part) {
        var name = part.trim().split(/\s+as\s+/)[0].trim();
        if (name) out.push({ spec: name, kind: 'py-import' });
      });
    }
    re = /^[ \t]*from[ \t]+(\.*[\w.]*)[ \t]+import[ \t]+([^\n]+)/gm;
    while ((m = re.exec(src))) {
      if (!m[1]) continue;
      var names = m[2].replace(/[()\\]/g, ' ').split(',').map(function (n) {
        return n.trim().split(/\s+as\s+/)[0].trim();
      }).filter(function (n) { return /^\w+$/.test(n); });
      out.push({ spec: m[1], kind: 'py-from', names: names });
    }
    return out;
  }

  function extractImports(path, content) {
    return extOf(path) === '.py' ? extractPython(content) : extractJS(content);
  }

  // ---------- resolution ----------

  function isRelative(spec) {
    return spec === '.' || spec === '..' ||
      spec.slice(0, 2) === './' || spec.slice(0, 3) === '../';
  }

  function resolveJS(fromPath, spec, fileSet) {
    var clean = spec.split(/[?#]/)[0];
    if (isRelative(clean)) {
      var base = normalize(dirname(fromPath) + '/' + clean);
      var cands = [base];
      JS_EXTS.forEach(function (e) { cands.push(base + e); });
      if (/\.js$/.test(base)) {
        cands.push(base.replace(/\.js$/, '.ts'), base.replace(/\.js$/, '.tsx'));
      }
      JS_EXTS.forEach(function (e) { cands.push(base + '/index' + e); });
      for (var i = 0; i < cands.length; i++) {
        if (fileSet.has(cands[i])) return { type: 'internal', path: cands[i] };
      }
      return { type: 'external', name: base || clean }; // unresolved relative
    }
    var name = clean.charAt(0) === '@'
      ? clean.split('/').slice(0, 2).join('/')
      : clean.split('/')[0];
    return { type: 'external', name: name || clean };
  }

  function resolvePy(fromPath, spec, fileSet) {
    var cands = [];
    var m = /^(\.*)([\w.]*)$/.exec(spec);
    if (!m) return { type: 'external', name: spec };
    var dots = m[1].length, rest = m[2];
    if (dots > 0) {
      var dir = dirname(fromPath);
      for (var i = 1; i < dots; i++) dir = dirname(dir);
      var prefix = dir ? dir + '/' : '';
      if (rest) {
        var base = prefix + rest.split('.').join('/');
        cands.push(base + '.py', base + '/__init__.py');
      } else {
        cands.push(prefix + '__init__.py');
      }
    } else {
      var rel = rest.split('.').join('/');
      cands.push(rel + '.py', rel + '/__init__.py');
      var d2 = dirname(fromPath);
      if (d2) cands.push(d2 + '/' + rel + '.py', d2 + '/' + rel + '/__init__.py');
    }
    for (var j = 0; j < cands.length; j++) {
      if (fileSet.has(cands[j])) return { type: 'internal', path: cands[j] };
    }
    if (dots > 0) return { type: 'external', name: spec };
    return { type: 'external', name: rest.split('.')[0] || spec };
  }

  function resolveOne(fromPath, imp, fileSet) {
    if (imp.kind === 'py-import') return [resolvePy(fromPath, imp.spec, fileSet)];
    if (imp.kind === 'py-from') {
      // "from X import a, b" — prefer submodule files X/a.py; fall back to X.
      var results = [];
      (imp.names || []).forEach(function (n) {
        var sub = imp.spec + (imp.spec.slice(-1) === '.' ? '' : '.') + n;
        if (/^\.+$/.test(imp.spec)) sub = imp.spec + n;
        var r = resolvePy(fromPath, sub, fileSet);
        if (r.type === 'internal') results.push(r);
      });
      if (results.length) return results;
      return [resolvePy(fromPath, imp.spec, fileSet)];
    }
    return [resolveJS(fromPath, imp.spec, fileSet)];
  }

  // ---------- paste-mode parsing ----------
  // Blocks of:  path/to/file.ext:\n<content lines...>  (next path line starts
  // the next block). A header is a trimmed line "<path-with-extension>:".
  function parsePasteInput(text) {
    var lines = String(text).split(/\r\n?|\n/);
    var header = /^([\w@$][\w@$.\/\\-]*\.[A-Za-z0-9_]+)\s*:\s*$/;
    var files = [], cur = null;
    lines.forEach(function (line) {
      var m = header.exec(line.trim());
      if (m) {
        cur = { path: normalize(m[1]), lines: [] };
        files.push(cur);
      } else if (cur) {
        cur.lines.push(line);
      }
    });
    return files.map(function (f) {
      return { path: f.path, content: f.lines.join('\n') };
    });
  }

  // ---------- Tarjan SCC (iterative) ----------

  function tarjanSCC(ids, adj) {
    var index = 0;
    var indices = new Map(), lowlink = new Map(), onStack = new Map();
    var stack = [], sccs = [];
    ids.forEach(function (start) {
      if (indices.has(start)) return;
      var work = [{ node: start, i: 0 }];
      while (work.length) {
        var frame = work[work.length - 1];
        var node = frame.node;
        if (frame.i === 0) {
          indices.set(node, index);
          lowlink.set(node, index);
          index++;
          stack.push(node);
          onStack.set(node, true);
        }
        var neighbors = adj.get(node) || [];
        var advanced = false;
        while (frame.i < neighbors.length) {
          var w = neighbors[frame.i++];
          if (!indices.has(w)) { work.push({ node: w, i: 0 }); advanced = true; break; }
          if (onStack.get(w)) {
            lowlink.set(node, Math.min(lowlink.get(node), indices.get(w)));
          }
        }
        if (advanced) continue;
        work.pop();
        if (work.length) {
          var parent = work[work.length - 1].node;
          lowlink.set(parent, Math.min(lowlink.get(parent), lowlink.get(node)));
        }
        if (lowlink.get(node) === indices.get(node)) {
          var comp = [], w2;
          do {
            w2 = stack.pop();
            onStack.set(w2, false);
            comp.push(w2);
          } while (w2 !== node);
          sccs.push(comp);
        }
      }
    });
    return sccs;
  }

  // ---------- ranks: longest path over the SCC condensation ----------

  function computeRanks(ids, edges, sccs) {
    var compOf = new Map();
    sccs.forEach(function (comp, ci) {
      comp.forEach(function (n) { compOf.set(n, ci); });
    });
    var n = sccs.length;
    var cadj = [], indeg = [];
    for (var i = 0; i < n; i++) { cadj.push([]); indeg.push(0); }
    var seen = new Set();
    edges.forEach(function (e) {
      var a = compOf.get(e.from), b = compOf.get(e.to);
      if (a === undefined || b === undefined || a === b) return;
      var key = a + '>' + b;
      if (seen.has(key)) return;
      seen.add(key);
      cadj[a].push(b);
      indeg[b]++;
    });
    var depth = new Array(n).fill(0);
    var queue = [];
    for (var j = 0; j < n; j++) if (indeg[j] === 0) queue.push(j);
    var qi = 0;
    while (qi < queue.length) {
      var c = queue[qi++];
      cadj[c].forEach(function (d) {
        if (depth[c] + 1 > depth[d]) depth[d] = depth[c] + 1;
        if (--indeg[d] === 0) queue.push(d);
      });
    }
    var ranks = new Map();
    ids.forEach(function (id) {
      ranks.set(id, depth[compOf.get(id)] || 0);
    });
    return ranks;
  }

  // ---------- graph build ----------

  function countLOC(src) {
    var n = 0;
    String(src).split(/\r\n?|\n/).forEach(function (l) { if (l.trim()) n++; });
    return n;
  }

  function buildGraph(inputFiles) {
    var files = inputFiles
      .filter(function (f) { return f && f.path && isSourcePath(f.path) && !shouldSkip(f.path); })
      .map(function (f) { return { path: normalize(f.path), content: String(f.content || '') }; })
      .slice(0, MAX_FILES);
    files = stripCommonRoot(files);

    var fileSet = new Set(files.map(function (f) { return f.path; }));
    var nodes = new Map(); // id -> node
    files.forEach(function (f) {
      nodes.set(f.path, {
        id: f.path, path: f.path, label: basename(f.path),
        external: false, loc: countLOC(f.content), fanIn: 0, fanOut: 0
      });
    });

    var edges = [];
    var edgeSeen = new Set();
    files.forEach(function (f) {
      extractImports(f.path, f.content).forEach(function (imp) {
        resolveOne(f.path, imp, fileSet).forEach(function (r) {
          var to, external;
          if (r.type === 'internal') { to = r.path; external = false; }
          else {
            to = 'ext:' + r.name; external = true;
            if (!nodes.has(to)) {
              nodes.set(to, {
                id: to, path: r.name, label: r.name,
                external: true, loc: 0, fanIn: 0, fanOut: 0
              });
            }
          }
          if (to === f.path && !external) return; // self-import noise
          var key = f.path + ' ' + to;
          if (edgeSeen.has(key)) return;
          edgeSeen.add(key);
          edges.push({ from: f.path, to: to, external: external, kind: imp.kind });
        });
      });
    });

    edges.forEach(function (e) {
      nodes.get(e.from).fanOut++;
      nodes.get(e.to).fanIn++;
    });

    var ids = Array.from(nodes.keys());
    var adj = new Map();
    ids.forEach(function (id) { adj.set(id, []); });
    edges.forEach(function (e) { adj.get(e.from).push(e.to); });

    var sccs = tarjanSCC(ids, adj);
    var cycles = sccs.filter(function (c) { return c.length > 1; })
      .map(function (c) { return c.slice().reverse(); });
    edges.forEach(function (e) {
      if (e.from === e.to) cycles.push([e.from]);
    });

    var cycleNodes = new Set();
    cycles.forEach(function (c) { c.forEach(function (n) { cycleNodes.add(n); }); });
    var compOf = new Map();
    sccs.forEach(function (comp, ci) {
      comp.forEach(function (nid) { compOf.set(nid, ci); });
    });
    edges.forEach(function (e) {
      e.cycle = (e.from === e.to) ||
        (compOf.get(e.from) === compOf.get(e.to) && cycleNodes.has(e.from));
    });

    var ranks = computeRanks(ids, edges, sccs);
    nodes.forEach(function (nd) { nd.rank = ranks.get(nd.id) || 0; nd.inCycle = cycleNodes.has(nd.id); });

    var internals = ids.filter(function (id) { return !nodes.get(id).external; });
    var maxDepth = 0;
    internals.forEach(function (id) {
      if (nodes.get(id).rank > maxDepth) maxDepth = nodes.get(id).rank;
    });

    return {
      nodes: nodes,
      edges: edges,
      cycles: cycles,
      stats: {
        modules: internals.length,
        edges: edges.length,
        internalEdges: edges.filter(function (e) { return !e.external; }).length,
        externals: ids.length - internals.length,
        maxDepth: maxDepth,
        cycleCount: cycles.length,
        truncated: inputFiles.length > MAX_FILES
      }
    };
  }

  // ---------- exports ----------

  function toEdgeListJSON(graph) {
    var modules = [], externals = [];
    graph.nodes.forEach(function (n) {
      if (n.external) externals.push(n.path);
      else modules.push({ path: n.path, loc: n.loc, fanIn: n.fanIn, fanOut: n.fanOut, depth: n.rank });
    });
    return JSON.stringify({
      tool: 'import-graph',
      stats: graph.stats,
      modules: modules,
      externals: externals,
      edges: graph.edges.map(function (e) {
        return {
          from: e.from,
          to: e.external ? graph.nodes.get(e.to).path : e.to,
          external: e.external,
          cycle: !!e.cycle
        };
      }),
      cycles: graph.cycles
    }, null, 2);
  }

  function dotEscape(s) { return String(s).replace(/"/g, '\\"'); }

  function toDOT(graph) {
    var lines = ['digraph imports {', '  rankdir=LR;', '  node [shape=box, fontname="IBM Plex Mono"];'];
    graph.nodes.forEach(function (n) {
      if (n.external) {
        lines.push('  "' + dotEscape(n.path) + '" [style=dashed, color=gray];');
      }
    });
    graph.edges.forEach(function (e) {
      var to = e.external ? graph.nodes.get(e.to).path : e.to;
      var attrs = [];
      if (e.external) attrs.push('style=dashed', 'color=gray');
      if (e.cycle) attrs.push('color=red');
      lines.push('  "' + dotEscape(e.from) + '" -> "' + dotEscape(to) + '"' +
        (attrs.length ? ' [' + attrs.join(', ') + ']' : '') + ';');
    });
    lines.push('}');
    return lines.join('\n');
  }

  // ---------- bundled sample project ----------

  var SAMPLE_FILES = [
    { path: 'sample-app/src/main.js', content: "import React from 'react'\nimport { render } from 'react-dom'\nimport App from './app'\nimport { store } from './state/store'\nimport { log } from './utils/log'\n\nlog('boot')\nrender(React.createElement(App, { store }), document.body)\n" },
    { path: 'sample-app/src/app.js', content: "import React from 'react'\nimport Header from './components/header'\nimport List from './components/list'\nimport { store } from './state/store'\n\nexport default function App() {\n  return React.createElement('div', null, Header(), List(store))\n}\n" },
    { path: 'sample-app/src/components/header.js', content: "import React from 'react'\nimport { log } from '../utils/log'\n\nexport default function Header() {\n  log('header')\n  return React.createElement('header', null, 'sample-app')\n}\n" },
    { path: 'sample-app/src/components/list.js', content: "import Item from './item'\nimport { store } from '../state/store'\n\nexport default function List() {\n  return store.items.map(Item)\n}\n" },
    { path: 'sample-app/src/components/item.js', content: "import { log } from '../utils/log'\n\nexport default function Item(x) {\n  log('item', x)\n  return x\n}\n" },
    { path: 'sample-app/src/state/store.js', content: "// NOTE: store <-> actions is a deliberate cycle for the demo\nimport { reset } from './actions'\nimport { log } from '../utils/log'\n\nexport const store = { items: [1, 2, 3], reset }\nlog('store ready')\n" },
    { path: 'sample-app/src/state/actions.js', content: "import { createStore } from 'redux'\nimport { store } from './store'\n\nexport function reset() {\n  store.items = []\n}\nexport const engine = createStore(function (s) { return s })\n" },
    { path: 'sample-app/src/utils/log.js', content: "const PREFIX = '[sample]'\n\nexport function log() {\n  console.log.apply(console, [PREFIX].concat([].slice.call(arguments)))\n}\n" },
    { path: 'sample-app/scripts/build.py', content: "import os\nimport json\nfrom helpers import run\n\n\ndef main():\n    cfg = json.loads(os.environ.get('CFG', '{}'))\n    run(cfg)\n\n\nif __name__ == '__main__':\n    main()\n" },
    { path: 'sample-app/scripts/helpers.py', content: "import subprocess\n\n\ndef run(cfg):\n    subprocess.check_call(['echo', str(cfg)])\n" }
  ];

  return {
    SOURCE_EXTS: SOURCE_EXTS,
    SKIP_DIRS: SKIP_DIRS,
    MAX_FILES: MAX_FILES,
    extOf: extOf,
    isSourcePath: isSourcePath,
    shouldSkip: shouldSkip,
    normalize: normalize,
    dirname: dirname,
    basename: basename,
    stripCommonRoot: stripCommonRoot,
    extractImports: extractImports,
    parsePasteInput: parsePasteInput,
    tarjanSCC: tarjanSCC,
    buildGraph: buildGraph,
    toEdgeListJSON: toEdgeListJSON,
    toDOT: toDOT,
    SAMPLE_FILES: SAMPLE_FILES
  };
});

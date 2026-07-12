/*
 * PDG Viewer — program-dependence extraction over an acorn AST.
 * Hand-rolled, statement-level. UMD: usable from the browser (window.PDG)
 * and from node (module.exports) so the analysis is provable outside the page.
 *
 * Control dependence: a statement inside an if/else branch, loop body, switch
 * case, or try/catch/finally block depends on that predicate/region statement.
 *
 * Data dependence: def-use chains via a reaching-definitions walk. A statement
 * that reads variable v depends on every reaching definition of v. Straight-line
 * assignments kill prior defs (strong update); branch joins take the UNION of
 * reaching defs from both arms; loop bodies are evaluated twice to expose
 * loop-carried dependences. Approximations are listed in PDG.NOTES.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) { module.exports = factory(); }
  else { root.PDG = factory(); }
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var MAX_LABEL = 52;
  var MAX_FULL = 600;

  var NOTES = [
    'Branch joins: after if/else or switch, the analysis keeps ALL reaching definitions from every arm (union), so a use after a branch may show edges from defs on paths that did not execute.',
    'Loops: the body is evaluated twice over the merged environment to expose loop-carried def-use edges; more than two iterations add no new edges for this abstraction. Zero-iteration paths are included (except do-while).',
    'Object/array mutation (obj.p = x, arr.push(x), i.e. property writes and method calls on an identifier receiver) is a WEAK definition of the base variable: it is added to the reaching-def set without killing prior defs.',
    'Nested functions are collapsed to a single node: their free-variable reads are attributed to the declaring statement; their internal statements are not graphed.',
    'break/continue/return do not prune paths — the walk assumes fall-through, which can over-approximate reaching defs after early exits.',
    'switch case-test expressions are attributed to the switch node; cases are threaded sequentially (fall-through assumed), and the no-match path is unioned in.',
    'Self-referential edges (a statement that both defines and uses the same variable across loop iterations, e.g. the i++ of a for header) are omitted from the graph.'
  ];

  function buildPDG(source, acornLib) {
    var acorn = acornLib || (typeof globalThis !== 'undefined' ? globalThis.acorn : null);
    if (!acorn) { throw new Error('acorn is not available'); }
    var ast = acorn.parse(source, { ecmaVersion: 'latest', locations: true, allowReturnOutsideFunction: true });

    // If the input is a single top-level function, analyze its body and treat
    // the signature line as the entry node that defines the parameters.
    var stmts = ast.body, params = [], header = null;
    if (ast.body.length === 1) {
      var s0 = ast.body[0], fn = null, ownerEnd = null;
      if (s0.type === 'FunctionDeclaration') { fn = s0; }
      else if (s0.type === 'ExpressionStatement' &&
               (s0.expression.type === 'FunctionExpression' || s0.expression.type === 'ArrowFunctionExpression')) { fn = s0.expression; }
      else if (s0.type === 'VariableDeclaration' && s0.declarations.length === 1 && s0.declarations[0].init &&
               (s0.declarations[0].init.type === 'FunctionExpression' || s0.declarations[0].init.type === 'ArrowFunctionExpression')) { fn = s0.declarations[0].init; }
      if (fn && fn.body && fn.body.type === 'BlockStatement') {
        stmts = fn.body.body;
        params = fn.params;
        header = { start: s0.start, end: fn.body.start, line: s0.loc.start.line };
        void ownerEnd;
      }
    }

    var nodes = [];
    var controlEdges = [];
    var dataEdges = [];
    var ctlSeen = Object.create(null);
    var dataSeen = Object.create(null);

    function collapse(text) { return text.replace(/\{\s*$/, '').replace(/\s+/g, ' ').trim(); }
    function snippet(start, end) { return collapse(source.slice(start, end)); }

    function addNode(kind, label, full, line, depth) {
      var id = nodes.length;
      nodes.push({
        id: id,
        kind: kind,
        label: label.length > MAX_LABEL ? label.slice(0, MAX_LABEL - 1) + '…' : label,
        full: full.length > MAX_FULL ? full.slice(0, MAX_FULL - 1) + '…' : full,
        line: line,
        depth: depth
      });
      return id;
    }
    function addControl(from, to) {
      if (from === null || from === undefined || from === to) { return; }
      var k = from + '>' + to;
      if (!ctlSeen[k]) { ctlSeen[k] = true; controlEdges.push({ from: from, to: to }); }
    }
    function addData(from, to, name) {
      if (from === to) { return; } // self loops omitted — see NOTES
      var k = from + '>' + to + ':' + name;
      if (!dataSeen[k]) { dataSeen[k] = true; dataEdges.push({ from: from, to: to, name: name }); }
    }

    /* ------------------------------------------------------------------ *
     * Use/def scanning over expressions.
     * ud = { reads: {name:true}, strong: {name:true}, weak: {name:true} }
     * ------------------------------------------------------------------ */
    function newUD() { return { reads: Object.create(null), strong: Object.create(null), weak: Object.create(null) }; }

    function patternNames(pat, out) {
      if (!pat) { return; }
      switch (pat.type) {
        case 'Identifier': out.push(pat.name); break;
        case 'ObjectPattern':
          pat.properties.forEach(function (p) {
            if (p.type === 'RestElement') { patternNames(p.argument, out); }
            else { patternNames(p.value, out); }
          });
          break;
        case 'ArrayPattern': pat.elements.forEach(function (el) { patternNames(el, out); }); break;
        case 'AssignmentPattern': patternNames(pat.left, out); break;
        case 'RestElement': patternNames(pat.argument, out); break;
      }
    }

    function scanPatternReads(pat, ud) {
      if (!pat) { return; }
      switch (pat.type) {
        case 'AssignmentPattern': scanExpr(pat.right, ud); scanPatternReads(pat.left, ud); break;
        case 'ObjectPattern':
          pat.properties.forEach(function (p) {
            if (p.type === 'RestElement') { scanPatternReads(p.argument, ud); return; }
            if (p.computed) { scanExpr(p.key, ud); }
            scanPatternReads(p.value, ud);
          });
          break;
        case 'ArrayPattern': pat.elements.forEach(function (el) { scanPatternReads(el, ud); }); break;
        case 'RestElement': scanPatternReads(pat.argument, ud); break;
      }
    }

    function baseIdent(n) {
      while (n && (n.type === 'MemberExpression' || n.type === 'ChainExpression')) {
        n = (n.type === 'ChainExpression') ? n.expression : n.object;
      }
      return (n && n.type === 'Identifier') ? n.name : null;
    }

    function scanExpr(n, ud) {
      if (!n || typeof n.type !== 'string') { return; }
      var b;
      switch (n.type) {
        case 'Identifier': ud.reads[n.name] = true; return;
        case 'Literal': case 'ThisExpression': case 'Super': case 'MetaProperty':
        case 'EmptyStatement': case 'DebuggerStatement':
          return;
        case 'BreakStatement': case 'ContinueStatement':
          return; // label identifiers are not variable reads
        case 'LabeledStatement': scanExpr(n.body, ud); return;
        case 'AssignmentExpression':
          scanExpr(n.right, ud);
          if (n.left.type === 'Identifier') {
            if (n.operator !== '=') { ud.reads[n.left.name] = true; }
            ud.strong[n.left.name] = true;
          } else if (n.left.type === 'MemberExpression') {
            scanExpr(n.left, ud);
            b = baseIdent(n.left);
            if (b) { ud.weak[b] = true; }
          } else {
            scanPatternReads(n.left, ud);
            var an = []; patternNames(n.left, an);
            an.forEach(function (nm) { ud.strong[nm] = true; });
          }
          return;
        case 'UpdateExpression':
          if (n.argument.type === 'Identifier') {
            ud.reads[n.argument.name] = true;
            ud.strong[n.argument.name] = true;
          } else {
            scanExpr(n.argument, ud);
            b = baseIdent(n.argument);
            if (b) { ud.weak[b] = true; }
          }
          return;
        case 'MemberExpression':
          scanExpr(n.object, ud);
          if (n.computed) { scanExpr(n.property, ud); }
          return;
        case 'CallExpression': case 'NewExpression':
          scanExpr(n.callee, ud);
          (n.arguments || []).forEach(function (a) { scanExpr(a, ud); });
          if (n.callee.type === 'MemberExpression') {
            b = baseIdent(n.callee);
            if (b) { ud.weak[b] = true; } // possible receiver mutation — see NOTES
          }
          return;
        case 'Property':
          if (n.computed) { scanExpr(n.key, ud); }
          scanExpr(n.value, ud);
          return;
        case 'VariableDeclarator':
          if (n.init) { scanExpr(n.init, ud); }
          scanPatternReads(n.id, ud);
          var dn = []; patternNames(n.id, dn);
          dn.forEach(function (nm) { ud.strong[nm] = true; });
          return;
        case 'FunctionExpression': case 'ArrowFunctionExpression': case 'FunctionDeclaration':
          freeReads(n).forEach(function (nm) { ud.reads[nm] = true; });
          if (n.type === 'FunctionDeclaration' && n.id) { ud.strong[n.id.name] = true; }
          return;
        default: {
          for (var k in n) {
            if (k === 'type' || k === 'loc' || k === 'start' || k === 'end' || k === 'range') { continue; }
            var v = n[k];
            if (Array.isArray(v)) {
              v.forEach(function (c) { if (c && typeof c.type === 'string') { scanExpr(c, ud); } });
            } else if (v && typeof v.type === 'string') {
              scanExpr(v, ud);
            }
          }
        }
      }
    }

    // Free-variable reads of a nested function: all reads inside, minus names
    // bound inside (params, declarations, the function's own name).
    function freeReads(fn) {
      var ud = newUD();
      var bound = Object.create(null);
      var names = [];
      (fn.params || []).forEach(function (p) { patternNames(p, names); });
      if (fn.id) { names.push(fn.id.name); }
      (function collectDecls(n) {
        if (!n || typeof n.type !== 'string') { return; }
        if (n.type === 'VariableDeclarator') { patternNames(n.id, names); }
        if ((n.type === 'FunctionDeclaration' || n.type === 'ClassDeclaration') && n.id) { names.push(n.id.name); }
        if (n.type === 'CatchClause' && n.param) { patternNames(n.param, names); }
        for (var k in n) {
          if (k === 'type' || k === 'loc' || k === 'start' || k === 'end' || k === 'range') { continue; }
          var v = n[k];
          if (Array.isArray(v)) { v.forEach(collectDecls); }
          else if (v && typeof v.type === 'string') { collectDecls(v); }
        }
      })(fn.body);
      names.forEach(function (nm) { bound[nm] = true; });
      scanExpr(fn.body, ud);
      var out = [];
      for (var r in ud.reads) { if (!bound[r]) { out.push(r); } }
      return out;
    }

    /* ------------------------------------------------------------------ *
     * Phase A — build IR: create nodes + control edges once, and record a
     * use/def summary per node. Loops can then be re-evaluated without
     * duplicating nodes.
     * ------------------------------------------------------------------ */
    function buildIR(stmtList, depth, cp) {
      var items = [];
      stmtList.forEach(function (st) { buildStmt(st, depth, cp, items); });
      return items;
    }

    function plainStmt(st, depth, cp, items) {
      var ud = newUD();
      scanExpr(st, ud);
      var label = snippet(st.start, st.end);
      var id = addNode('stmt', label, source.slice(st.start, st.end), st.loc.start.line, depth);
      addControl(cp, id);
      items.push({ k: 'stmt', id: id, ud: ud });
    }

    function buildStmt(st, depth, cp, items) {
      switch (st.type) {
        case 'BlockStatement':
          st.body.forEach(function (s) { buildStmt(s, depth, cp, items); });
          return;
        case 'EmptyStatement':
          return;
        case 'LabeledStatement':
          buildStmt(st.body, depth, cp, items);
          return;
        case 'IfStatement': {
          var lbl = 'if (' + snippet(st.test.start, st.test.end) + ')';
          var id = addNode('predicate', lbl, lbl, st.loc.start.line, depth);
          addControl(cp, id);
          var ud = newUD(); scanExpr(st.test, ud);
          items.push({
            k: 'if', id: id, ud: ud,
            then: buildIR([st.consequent], depth + 1, id),
            els: st.alternate ? buildIR([st.alternate], depth + 1, id) : null
          });
          return;
        }
        case 'WhileStatement': case 'DoWhileStatement': {
          var wl = (st.type === 'WhileStatement' ? 'while (' : 'do … while (') + snippet(st.test.start, st.test.end) + ')';
          var wid = addNode('predicate', wl, wl, st.loc.start.line, depth);
          addControl(cp, wid);
          var wud = newUD(); scanExpr(st.test, wud);
          items.push({ k: 'loop', id: wid, ud: wud, body: buildIR([st.body], depth + 1, wid), atLeastOnce: st.type === 'DoWhileStatement' });
          return;
        }
        case 'ForStatement': {
          var fl = snippet(st.start, st.body.start);
          var fid = addNode('predicate', fl, fl, st.loc.start.line, depth);
          addControl(cp, fid);
          var fud = newUD();
          if (st.init) { scanExpr(st.init, fud); }
          if (st.test) { scanExpr(st.test, fud); }
          if (st.update) { scanExpr(st.update, fud); }
          items.push({ k: 'loop', id: fid, ud: fud, body: buildIR([st.body], depth + 1, fid), atLeastOnce: false });
          return;
        }
        case 'ForInStatement': case 'ForOfStatement': {
          var fol = snippet(st.start, st.body.start);
          var foid = addNode('predicate', fol, fol, st.loc.start.line, depth);
          addControl(cp, foid);
          var foud = newUD();
          scanExpr(st.right, foud);
          if (st.left.type === 'VariableDeclaration') { scanExpr(st.left, foud); }
          else {
            var ln = []; patternNames(st.left, ln);
            ln.forEach(function (nm) { foud.strong[nm] = true; });
          }
          items.push({ k: 'loop', id: foid, ud: foud, body: buildIR([st.body], depth + 1, foid), atLeastOnce: false });
          return;
        }
        case 'SwitchStatement': {
          var sl = 'switch (' + snippet(st.discriminant.start, st.discriminant.end) + ')';
          var sid = addNode('predicate', sl, sl, st.loc.start.line, depth);
          addControl(cp, sid);
          var sud = newUD();
          scanExpr(st.discriminant, sud);
          var cases = st.cases.map(function (c) {
            if (c.test) { scanExpr(c.test, sud); } // case tests attributed to the switch node — see NOTES
            return buildIR(c.consequent, depth + 1, sid);
          });
          items.push({ k: 'switch', id: sid, ud: sud, cases: cases });
          return;
        }
        case 'TryStatement': {
          var tid = addNode('predicate', 'try', 'try', st.loc.start.line, depth);
          addControl(cp, tid);
          var tud = newUD();
          if (st.handler && st.handler.param) {
            var cn = []; patternNames(st.handler.param, cn);
            cn.forEach(function (nm) { tud.strong[nm] = true; });
          }
          items.push({
            k: 'try', id: tid, ud: tud,
            tryBlock: buildIR([st.block], depth + 1, tid),
            handler: st.handler ? buildIR([st.handler.body], depth + 1, tid) : null,
            finalizer: st.finalizer ? buildIR([st.finalizer], depth + 1, tid) : null
          });
          return;
        }
        default:
          plainStmt(st, depth, cp, items);
      }
    }

    /* ------------------------------------------------------------------ *
     * Phase B — reaching-definitions walk over the IR.
     * env: { varName: [nodeId, ...] }
     * ------------------------------------------------------------------ */
    function cloneEnv(env) { var e = Object.create(null); for (var k in env) { e[k] = env[k].slice(); } return e; }
    function mergeEnv(a, b) {
      var out = cloneEnv(a);
      for (var k in b) {
        if (!out[k]) { out[k] = b[k].slice(); }
        else {
          b[k].forEach(function (id) { if (out[k].indexOf(id) < 0) { out[k].push(id); } });
        }
      }
      return out;
    }
    function replaceEnv(env, m) {
      for (var k in env) { delete env[k]; }
      for (var k2 in m) { env[k2] = m[k2]; }
    }
    function applyUD(id, ud, env) {
      var r, w, s;
      for (r in ud.reads) {
        (env[r] || []).forEach(function (d) { addData(d, id, r); });
      }
      for (w in ud.weak) {
        if (!env[w]) { env[w] = []; }
        if (env[w].indexOf(id) < 0) { env[w].push(id); }
      }
      for (s in ud.strong) { env[s] = [id]; }
    }

    function evalSeq(items, env) {
      items.forEach(function (it) {
        switch (it.k) {
          case 'stmt':
            applyUD(it.id, it.ud, env);
            break;
          case 'if': {
            applyUD(it.id, it.ud, env);
            var eT = evalSeq(it.then, cloneEnv(env));
            var eF = it.els ? evalSeq(it.els, cloneEnv(env)) : cloneEnv(env);
            replaceEnv(env, mergeEnv(eT, eF));
            break;
          }
          case 'loop': {
            applyUD(it.id, it.ud, env);          // header: init/test/update, iteration 1
            var e0 = cloneEnv(env);
            var e1 = evalSeq(it.body, cloneEnv(e0));
            var e2 = mergeEnv(e0, e1);
            applyUD(it.id, it.ud, e2);           // header again: loop-carried uses of body defs
            var e3 = evalSeq(it.body, cloneEnv(e2)); // body again: loop-carried def-use within body
            var fin = mergeEnv(e1, e3);
            if (!it.atLeastOnce) { fin = mergeEnv(e0, fin); } // zero-iteration path
            replaceEnv(env, fin);
            break;
          }
          case 'switch': {
            applyUD(it.id, it.ud, env);
            var out = cloneEnv(env);             // no-match path
            var cur = cloneEnv(env);
            it.cases.forEach(function (cs) {
              cur = evalSeq(cs, cur);            // fall-through threading
              out = mergeEnv(out, cur);
            });
            replaceEnv(env, out);
            break;
          }
          case 'try': {
            applyUD(it.id, it.ud, env);
            var eTry = evalSeq(it.tryBlock, cloneEnv(env));
            var m = eTry;
            if (it.handler) {
              var eCat = evalSeq(it.handler, mergeEnv(env, eTry)); // exception can occur mid-block
              m = mergeEnv(eTry, eCat);
            }
            m = mergeEnv(m, env); // conservative
            if (it.finalizer) { m = evalSeq(it.finalizer, m); }
            replaceEnv(env, m);
            break;
          }
        }
      });
      return env;
    }

    /* ------------------------------------------------------------------ */
    var rootEnv = Object.create(null);
    var entryId = null;
    if (header) {
      var hl = snippet(header.start, header.end) || 'function';
      entryId = addNode('entry', hl, hl, header.line, 0);
      var pn = [];
      params.forEach(function (p) { patternNames(p, pn); });
      pn.forEach(function (nm) { rootEnv[nm] = [entryId]; });
    }
    var ir = buildIR(stmts, header ? 1 : 0, null);
    evalSeq(ir, rootEnv);

    return {
      nodes: nodes,
      controlEdges: controlEdges,
      dataEdges: dataEdges,
      entryId: entryId,
      notes: NOTES
    };
  }

  // Group parallel data edges (same from -> to) into one labeled edge.
  function groupDataEdges(graph) {
    var byPair = Object.create(null);
    var out = [];
    graph.dataEdges.forEach(function (e) {
      var k = e.from + '>' + e.to;
      if (!byPair[k]) { byPair[k] = { from: e.from, to: e.to, names: [] }; out.push(byPair[k]); }
      if (byPair[k].names.indexOf(e.name) < 0) { byPair[k].names.push(e.name); }
    });
    return out;
  }

  function dotEscape(s) { return s.replace(/\\/g, '\\\\').replace(/"/g, '\\"'); }

  function toDOT(graph, opts) {
    opts = opts || {};
    var showControl = opts.control !== false;
    var showData = opts.data !== false;
    var lines = [
      'digraph PDG {',
      '  rankdir=TB;',
      '  node [shape=box, style="rounded,filled", fillcolor="#ffffff", color="#8a8d93", fontname="Helvetica", fontsize=11];',
      '  edge [fontname="Helvetica", fontsize=9];'
    ];
    graph.nodes.forEach(function (n) {
      var extra = (n.kind === 'predicate') ? ', fillcolor="#e8effc"' : (n.kind === 'entry') ? ', fillcolor="#eef2e8"' : '';
      lines.push('  n' + n.id + ' [label="' + dotEscape(n.label) + '"' + extra + '];');
    });
    if (showControl) {
      graph.controlEdges.forEach(function (e) {
        lines.push('  n' + e.from + ' -> n' + e.to + ' [style=solid, color="#2f6fed"];');
      });
    }
    if (showData) {
      groupDataEdges(graph).forEach(function (e) {
        lines.push('  n' + e.from + ' -> n' + e.to + ' [style=dashed, color="#d97706", label="' + dotEscape(e.names.join(', ')) + '"];');
      });
    }
    lines.push('}');
    return lines.join('\n');
  }

  return { buildPDG: buildPDG, groupDataEdges: groupDataEdges, toDOT: toDOT, NOTES: NOTES };
}));

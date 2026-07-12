/*
 * cpg.js — CPG Lite analysis core.
 * Builds a joern-style code property graph for ONE JavaScript function:
 *   - basic blocks (straight-line statement sequences, broken at
 *     if / loop / return / break / continue)
 *   - CFG edges (T/F branch labels, loop back-edges)
 *   - DFG edges (reaching definitions, per-variable def -> use)
 *   - AST containment edges (block -> nearest enclosing construct block)
 * Loadable in the browser (window.CPG) and in node (module.exports).
 * No dependencies beyond an acorn instance passed in (or found globally).
 */
(function (root, factory) {
  if (typeof module === 'object' && typeof module.exports === 'object') {
    module.exports = factory();
  } else {
    root.CPG = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var NOTES = [
    'Blocks split only at if / loop / return / break / continue. switch, try/catch and labeled statements are kept as single opaque statements inside a block.',
    'Every branch or loop condition gets its own block; T/F labels mark its out-edges. Loop back-edges are marked "back".',
    'In a for-loop, continue targets the update block (the latch); for-in / for-of headers reuse T (next iteration) / F (done) labels as an approximation of iterator protocol.',
    'throw edges directly to EXIT; exception paths into catch handlers are not modeled.',
    'DFG = classic reaching definitions at block granularity, per named variable. Only inter-block def -> use edges are drawn; a def and use inside the same block produce no edge.',
    'Only simple identifiers are tracked. A property write (o.x = 1) is not a def of o; reading o.x counts only as a use of o. Aliasing through objects, arrays and calls is not modeled.',
    'Nested function bodies are opaque: their statements are not split into blocks and captured-variable flows are ignored.',
    'Short-circuit expressions (&&, ||, ?:) are not split into separate blocks; their sub-expressions stay inside one condition or statement.',
    'The AST layer shows containment only: each block points at the header block of its nearest enclosing construct (or ENTRY for top-level blocks). It is not the full expression AST.',
    'Analysis assumes the pasted source contains one function; only the first function found is analyzed.'
  ];

  // ---------------------------------------------------------------------
  // def/use event extraction (ordered) from an AST node
  // ---------------------------------------------------------------------
  function patternDefs(node, ev) {
    if (!node) return;
    switch (node.type) {
      case 'Identifier':
        ev.push({ t: 'def', name: node.name });
        return;
      case 'ObjectPattern':
        node.properties.forEach(function (p) {
          if (p.type === 'RestElement') patternDefs(p.argument, ev);
          else patternDefs(p.value, ev);
        });
        return;
      case 'ArrayPattern':
        node.elements.forEach(function (el) { if (el) patternDefs(el, ev); });
        return;
      case 'AssignmentPattern':
        walkEvents(node.right, ev);
        patternDefs(node.left, ev);
        return;
      case 'RestElement':
        patternDefs(node.argument, ev);
        return;
    }
  }

  function walkEvents(node, ev) {
    if (!node || typeof node.type !== 'string') return;
    switch (node.type) {
      case 'Identifier':
        ev.push({ t: 'use', name: node.name });
        return;
      case 'AssignmentExpression':
        if (node.left.type === 'Identifier') {
          if (node.operator !== '=') ev.push({ t: 'use', name: node.left.name });
          walkEvents(node.right, ev);
          ev.push({ t: 'def', name: node.left.name });
        } else if (node.left.type === 'ObjectPattern' || node.left.type === 'ArrayPattern') {
          walkEvents(node.right, ev);
          patternDefs(node.left, ev);
        } else {
          walkEvents(node.left, ev);   // e.g. member write: base object is a use
          walkEvents(node.right, ev);
        }
        return;
      case 'UpdateExpression':
        if (node.argument.type === 'Identifier') {
          ev.push({ t: 'use', name: node.argument.name });
          ev.push({ t: 'def', name: node.argument.name });
        } else walkEvents(node.argument, ev);
        return;
      case 'VariableDeclaration':
        node.declarations.forEach(function (d) {
          if (d.init) walkEvents(d.init, ev);
          patternDefs(d.id, ev);
        });
        return;
      case 'MemberExpression':
        walkEvents(node.object, ev);
        if (node.computed) walkEvents(node.property, ev);
        return;
      case 'Property':
        if (node.computed) walkEvents(node.key, ev);
        walkEvents(node.value, ev);
        return;
      case 'LabeledStatement':
        walkEvents(node.body, ev);
        return;
      case 'BreakStatement':
      case 'ContinueStatement':
        return; // labels are not variables
      case 'FunctionDeclaration':
      case 'FunctionExpression':
      case 'ArrowFunctionExpression':
        return; // nested functions are opaque (see NOTES)
      default: {
        for (var k in node) {
          if (k === 'type' || k === 'loc' || k === 'start' || k === 'end' || k === 'range') continue;
          var c = node[k];
          if (Array.isArray(c)) {
            for (var i = 0; i < c.length; i++) {
              if (c[i] && typeof c[i].type === 'string') walkEvents(c[i], ev);
            }
          } else if (c && typeof c.type === 'string') {
            walkEvents(c, ev);
          }
        }
      }
    }
  }

  // ---------------------------------------------------------------------
  // find the first function in a Program AST
  // ---------------------------------------------------------------------
  function findFirstFunction(node) {
    var found = null;
    (function walk(n) {
      if (found || !n || typeof n.type !== 'string') return;
      if (n.type === 'FunctionDeclaration' || n.type === 'FunctionExpression' ||
          n.type === 'ArrowFunctionExpression') { found = n; return; }
      for (var k in n) {
        if (k === 'type' || k === 'loc' || k === 'start' || k === 'end') continue;
        var c = n[k];
        if (Array.isArray(c)) { for (var i = 0; i < c.length; i++) { walk(c[i]); if (found) return; } }
        else if (c && typeof c.type === 'string') { walk(c); if (found) return; }
      }
    })(node);
    return found;
  }

  // ---------------------------------------------------------------------
  // main analysis
  // ---------------------------------------------------------------------
  function analyze(source, acornLib) {
    var acorn = acornLib;
    if (!acorn && typeof self !== 'undefined' && self.acorn) acorn = self.acorn;
    if (!acorn && typeof globalThis !== 'undefined' && globalThis.acorn) acorn = globalThis.acorn;
    if (!acorn) throw new Error('acorn library not provided to CPG.analyze(source, acorn)');

    var ast = acorn.parse(source, { ecmaVersion: 2023, locations: true });
    var fn = findFirstFunction(ast);
    if (!fn) throw new Error('No function found — paste a function declaration or expression.');

    var blocks = [];
    var cfg = [];
    var nextId = 0;

    function snippet(node, max) {
      var s = source.slice(node.start, node.end).replace(/\s+/g, ' ').trim();
      max = max || 58;
      return s.length > max ? s.slice(0, max - 1) + '…' : s;
    }

    function mkBlock(kind, parent) {
      var b = {
        id: 'B' + (nextId++),
        kind: kind,             // entry | exit | body | cond | loop
        parent: parent || null, // id of enclosing construct block (AST layer)
        statements: []          // { text, line, endLine, node?, role }
      };
      blocks.push(b);
      return b;
    }
    function addStmt(b, node, text, locNode, role) {
      var ln = (locNode || node).loc;
      b.statements.push({
        text: text || snippet(node),
        line: ln.start.line, endLine: ln.end.line,
        node: node, role: role || 'stmt'
      });
    }
    function edge(from, to, label, back) {
      if (!from || !to) return;
      cfg.push({ from: from.id, to: to.id, label: label || '', back: !!back });
    }
    // reuse an empty plain body block as a construct header (avoids empty hops)
    function asHeader(cur, kind, parent) {
      if (cur && cur.kind === 'body' && cur.statements.length === 0) {
        cur.kind = kind;
        return cur;
      }
      var h = mkBlock(kind, parent);
      edge(cur, h);
      return h;
    }
    function toList(node) {
      if (!node) return [];
      return node.type === 'BlockStatement' ? node.body : [node];
    }

    var entry = mkBlock('entry', null);
    var exitB = mkBlock('exit', null);

    // params defined at ENTRY
    var paramNames = [];
    var pev = [];
    fn.params.forEach(function (p) { patternDefs(p, pev); });
    pev.forEach(function (e) { if (e.t === 'def') paramNames.push(e.name); });
    entry.statements.push({
      text: paramNames.length ? 'params: ' + paramNames.join(', ') : '(no params)',
      line: fn.loc.start.line, endLine: fn.loc.start.line,
      node: null, role: 'params', defs: paramNames
    });

    function buildStmts(list, cur, ctx) {
      for (var i = 0; i < list.length; i++) {
        var st = list[i];
        if (!cur) { // dead code after return/break/continue — still shown, no in-edges
          cur = mkBlock('body', ctx.construct);
          cur.unreachable = true;
        }
        switch (st.type) {
          case 'EmptyStatement': break;
          case 'BlockStatement':
            cur = buildStmts(st.body, cur, ctx);
            break;
          case 'IfStatement': {
            var cond = asHeader(cur, 'cond', ctx.construct);
            addStmt(cond, st.test, 'if (' + snippet(st.test, 46) + ')', st.test, 'cond');
            var thenB = mkBlock('body', cond.id);
            edge(cond, thenB, 'T');
            var thenExit = buildStmts(toList(st.consequent), thenB, { construct: cond.id, loopHead: ctx.loopHead, loopExit: ctx.loopExit, backToHead: ctx.backToHead });
            if (st.alternate) {
              var elseB = mkBlock('body', cond.id);
              edge(cond, elseB, 'F');
              var elseExit = buildStmts(toList(st.alternate), elseB, { construct: cond.id, loopHead: ctx.loopHead, loopExit: ctx.loopExit, backToHead: ctx.backToHead });
              if (thenExit || elseExit) {
                var join = mkBlock('body', ctx.construct);
                if (thenExit) edge(thenExit, join);
                if (elseExit) edge(elseExit, join);
                cur = join;
              } else cur = null;
            } else {
              var join2 = mkBlock('body', ctx.construct);
              edge(cond, join2, 'F');
              if (thenExit) edge(thenExit, join2);
              cur = join2;
            }
            break;
          }
          case 'WhileStatement': {
            var wh = asHeader(cur, 'loop', ctx.construct);
            addStmt(wh, st.test, 'while (' + snippet(st.test, 42) + ')', st.test, 'cond');
            var wBody = mkBlock('body', wh.id);
            edge(wh, wBody, 'T');
            var wAfter = mkBlock('body', ctx.construct);
            edge(wh, wAfter, 'F');
            var wExit = buildStmts(toList(st.body), wBody, { construct: wh.id, loopHead: wh, loopExit: wAfter, backToHead: true });
            if (wExit) edge(wExit, wh, '', true);
            cur = wAfter;
            break;
          }
          case 'DoWhileStatement': {
            var dHead = mkBlock('loop', ctx.construct);
            addStmt(dHead, st.test, 'do … while (' + snippet(st.test, 38) + ')', st.test, 'cond');
            var dBody = mkBlock('body', dHead.id);
            edge(cur, dBody);
            var dAfter = mkBlock('body', ctx.construct);
            var dExit = buildStmts(toList(st.body), dBody, { construct: dHead.id, loopHead: dHead, loopExit: dAfter, backToHead: true });
            if (dExit) edge(dExit, dHead);
            edge(dHead, dBody, 'T', true);
            edge(dHead, dAfter, 'F');
            cur = dAfter;
            break;
          }
          case 'ForStatement': {
            if (st.init) addStmt(cur, st.init);
            var fHead = asHeader(cur, 'loop', ctx.construct);
            if (st.test) addStmt(fHead, st.test, 'for (…; ' + snippet(st.test, 36) + '; …)', st.test, 'cond');
            else addStmt(fHead, st, 'for (;;)', st.test || st, 'cond0');
            var fBody = mkBlock('body', fHead.id);
            edge(fHead, fBody, st.test ? 'T' : '');
            var fAfter = mkBlock('body', ctx.construct);
            if (st.test) edge(fHead, fAfter, 'F');
            var latch = null;
            if (st.update) {
              latch = mkBlock('body', fHead.id);
              addStmt(latch, st.update);
            }
            var fExit = buildStmts(toList(st.body), fBody, { construct: fHead.id, loopHead: latch || fHead, loopExit: fAfter, backToHead: !latch });
            if (fExit) edge(fExit, latch || fHead, '', !latch);
            if (latch) edge(latch, fHead, '', true);
            cur = fAfter;
            break;
          }
          case 'ForInStatement':
          case 'ForOfStatement': {
            var kw = st.type === 'ForInStatement' ? 'in' : 'of';
            var ioHead = asHeader(cur, 'loop', ctx.construct);
            addStmt(ioHead, st, 'for (' + snippet(st.left, 18) + ' ' + kw + ' ' + snippet(st.right, 24) + ')', st.left, 'forin');
            var ioBody = mkBlock('body', ioHead.id);
            edge(ioHead, ioBody, 'T');
            var ioAfter = mkBlock('body', ctx.construct);
            edge(ioHead, ioAfter, 'F');
            var ioExit = buildStmts(toList(st.body), ioBody, { construct: ioHead.id, loopHead: ioHead, loopExit: ioAfter, backToHead: true });
            if (ioExit) edge(ioExit, ioHead, '', true);
            cur = ioAfter;
            break;
          }
          case 'ReturnStatement':
            addStmt(cur, st, null, st, 'return');
            edge(cur, exitB);
            cur = null;
            break;
          case 'ThrowStatement':
            addStmt(cur, st, null, st, 'throw');
            edge(cur, exitB, 'throw');
            cur = null;
            break;
          case 'BreakStatement':
            addStmt(cur, st, 'break', st, 'jump');
            if (ctx.loopExit) edge(cur, ctx.loopExit, 'brk');
            cur = null;
            break;
          case 'ContinueStatement':
            addStmt(cur, st, 'continue', st, 'jump');
            if (ctx.loopHead) edge(cur, ctx.loopHead, '', !!ctx.backToHead);
            cur = null;
            break;
          default:
            // ExpressionStatement, VariableDeclaration, SwitchStatement,
            // TryStatement, LabeledStatement, FunctionDeclaration, ... — opaque
            addStmt(cur, st);
        }
      }
      return cur;
    }

    var bodyList;
    if (fn.body.type === 'BlockStatement') bodyList = fn.body.body;
    else bodyList = [{ type: 'ReturnStatement', argument: fn.body, start: fn.body.start, end: fn.body.end, loc: fn.body.loc }];

    // keep ENTRY params-only so param def -> use DFG edges are visible
    var first = mkBlock('body', entry.id);
    edge(entry, first);
    var last = buildStmts(bodyList, first, { construct: entry.id, loopHead: null, loopExit: null });
    if (last) edge(last, exitB); // implicit return

    // ---- prune empty pass-through body blocks -------------------------
    var changed = true;
    while (changed) {
      changed = false;
      for (var bi = 0; bi < blocks.length; bi++) {
        var b = blocks[bi];
        if (b.kind !== 'body' || b.statements.length !== 0) continue;
        var outs = cfg.filter(function (e) { return e.from === b.id; });
        var ins = cfg.filter(function (e) { return e.to === b.id; });
        if (outs.length !== 1 || outs[0].label !== '' ) continue;
        var tgt = outs[0].to;
        if (tgt === b.id) continue;
        // never create a self-loop by rewiring
        if (ins.some(function (e) { return e.from === tgt; })) continue;
        ins.forEach(function (e) { e.to = tgt; e.back = e.back || outs[0].back; });
        cfg = cfg.filter(function (e) { return e.from !== b.id; });
        blocks.splice(bi, 1);
        // reparent AST children of the pruned block
        blocks.forEach(function (o) { if (o.parent === b.id) o.parent = b.parent; });
        changed = true;
        break;
      }
    }

    // dedupe CFG edges
    var seen = {};
    cfg = cfg.filter(function (e) {
      var k = e.from + '>' + e.to + '#' + e.label + (e.back ? 'b' : '');
      if (seen[k]) return false;
      seen[k] = 1; return true;
    });

    // ---- reachability -------------------------------------------------
    var succ = {}, pred = {};
    blocks.forEach(function (b) { succ[b.id] = []; pred[b.id] = []; });
    cfg.forEach(function (e) { succ[e.from].push(e.to); pred[e.to].push(e.from); });
    var reach = {}; var stack = [entry.id];
    while (stack.length) {
      var n = stack.pop();
      if (reach[n]) continue;
      reach[n] = true;
      (succ[n] || []).forEach(function (s) { stack.push(s); });
    }
    blocks.forEach(function (b) { if (!reach[b.id] && b.kind !== 'exit') b.unreachable = true; });

    // ---- def/use per block --------------------------------------------
    var gen = {};     // blockId -> { var: defKey }
    var ue = {};      // blockId -> { var: true }  (upward-exposed uses)
    var defsByVar = {}; // var -> [defKey], defKey = blockId + '::' + var
    blocks.forEach(function (b) {
      gen[b.id] = {}; ue[b.id] = {};
      var defined = {};
      b.statements.forEach(function (s) {
        var ev = [];
        if (s.role === 'params') {
          (s.defs || []).forEach(function (nm) { ev.push({ t: 'def', name: nm }); });
        } else if (s.role === 'forin') {
          // header of for-in/of: right side is a use, left binding is a def
          // (s.node is the ForIn/ForOf statement)
          walkEvents(s.node.right, ev);
          if (s.node.left.type === 'VariableDeclaration') s.node.left.declarations.forEach(function (d) { patternDefs(d.id, ev); });
          else patternDefs(s.node.left, ev);
        } else if (s.node) {
          walkEvents(s.node, ev);
        }
        ev.forEach(function (e) {
          if (e.t === 'use') {
            if (!defined[e.name]) ue[b.id][e.name] = true;
          } else {
            defined[e.name] = true;
            gen[b.id][e.name] = b.id + '::' + e.name;
          }
        });
      });
      Object.keys(gen[b.id]).forEach(function (v) {
        (defsByVar[v] = defsByVar[v] || []).push(gen[b.id][v]);
      });
    });

    // ---- reaching definitions (iterative) ------------------------------
    var IN = {}, OUT = {};
    blocks.forEach(function (b) { IN[b.id] = {}; OUT[b.id] = {}; });
    var dirty = true;
    while (dirty) {
      dirty = false;
      for (var i2 = 0; i2 < blocks.length; i2++) {
        var b2 = blocks[i2];
        var newIn = {};
        pred[b2.id].forEach(function (p) {
          Object.keys(OUT[p]).forEach(function (k) { newIn[k] = true; });
        });
        var newOut = {};
        Object.keys(newIn).forEach(function (k) {
          var v = k.split('::')[1];
          if (!gen[b2.id][v]) newOut[k] = true; // not killed here
        });
        Object.keys(gen[b2.id]).forEach(function (v) { newOut[gen[b2.id][v]] = true; });
        if (JSON.stringify(newIn) !== JSON.stringify(IN[b2.id]) ||
            JSON.stringify(newOut) !== JSON.stringify(OUT[b2.id])) {
          IN[b2.id] = newIn; OUT[b2.id] = newOut; dirty = true;
        }
      }
    }

    // ---- DFG edges: def in A reaches upward-exposed use in B -----------
    var dfg = [];
    var dseen = {};
    blocks.forEach(function (b) {
      Object.keys(ue[b.id]).forEach(function (v) {
        Object.keys(IN[b.id]).forEach(function (k) {
          var parts = k.split('::');
          if (parts[1] !== v) return;
          var key = parts[0] + '>' + b.id + '#' + v;
          if (dseen[key] || parts[0] === b.id) return;
          dseen[key] = 1;
          dfg.push({ from: parts[0], to: b.id, var: v });
        });
      });
    });

    // ---- AST containment edges -----------------------------------------
    var astEdges = [];
    blocks.forEach(function (b) {
      if (b.parent && blocks.some(function (o) { return o.id === b.parent; })) {
        astEdges.push({ from: b.id, to: b.parent });
      }
    });

    // ---- final shape ----------------------------------------------------
    var outBlocks = blocks.map(function (b) {
      var lines = null;
      b.statements.forEach(function (s) {
        if (!lines) lines = [s.line, s.endLine];
        else { lines[0] = Math.min(lines[0], s.line); lines[1] = Math.max(lines[1], s.endLine); }
      });
      return {
        id: b.id,
        kind: b.kind,
        label: b.kind === 'entry' ? 'ENTRY' : b.kind === 'exit' ? 'EXIT' : b.id,
        unreachable: !!b.unreachable,
        lines: lines,
        statements: b.statements.map(function (s) {
          return { text: s.text, line: s.line, endLine: s.endLine };
        })
      };
    });

    return {
      functionName: (fn.id && fn.id.name) || '(anonymous)',
      params: paramNames,
      blocks: outBlocks,
      edges: { ast: astEdges, cfg: cfg, dfg: dfg },
      notes: NOTES.slice()
    };
  }

  return { analyze: analyze, notes: NOTES };
});

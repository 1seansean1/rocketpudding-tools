# Rocket Pudding Tools

**Live:** https://tools.rocketpudding.ai/  ·  Deploy updates with `scripts/deploy-rp2.sh`.

A growing registry of self-contained web tools, hosted under **rocketpudding.ai**.
Each tool is a single-purpose, no-install static page.

## Structure

```
index.html              # the registry catalog (renders cards from registry.json)
registry.json           # machine-readable list of tools — the source of truth
tools/
  dag-layout-lab/       # one self-contained tool per directory
    index.html
    support.js
    faq.html
```

## Adding a tool

1. Drop a self-contained static bundle in `tools/<slug>/` (an `index.html` plus any
   sibling assets it needs — no build step, no external runtime deps beyond fonts).
2. Add an entry to `registry.json`:

   ```json
   {
     "slug": "your-tool",
     "name": "Your Tool",
     "tagline": "One line on what it does.",
     "description": "A sentence or two more.",
     "path": "tools/your-tool/",
     "tags": ["…"],
     "added": "YYYY-MM-DD",
     "status": "live",
     "accent": "#b05a3c"
   }
   ```

The catalog picks it up automatically — no code change needed.

## Tools

- **DAG Layout Lab** — prototype & benchmark DAG layout algorithms (layered/Sugiyama with
  barycenter crossing reduction, Coffman-Graham, rank-weighted stress) on an Excalidraw-style
  canvas, with a benchmark leaderboard, node metadata, mermaid import, and SVG/PNG/PDF/HTML export.
  Imported from a Claude Design handoff and made self-contained.

## Local preview

```
python -m http.server 8138    # then open http://127.0.0.1:8138/
```

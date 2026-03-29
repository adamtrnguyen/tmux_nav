# CLAUDE.md — tmux_nav

## Overview

Obsidian plugin providing tmux-style keyboard pane navigation. Navigate between panes using familiar tmux key bindings.

## Structure

```
main.ts          — Plugin entry point, key bindings
styles.css       — Plugin styles
manifest.json    — Obsidian plugin manifest
esbuild.config.mjs — Build config
```

## Key Commands

```bash
npm run build    # Production build (tsc + esbuild)
npm run dev      # Dev mode (watch)
```

## Key Conventions

- TypeScript, esbuild bundler, v1.0.0
- Obsidian API
- Author: Adam Nguyen

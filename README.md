# Tmux Navigator

Move between Obsidian panes with the tmux keys you already know.

`Ctrl+h/j/k/l` focuses the pane to the left, down, up, or right. `Ctrl+b`
acts as the tmux prefix, so `Ctrl+b %` splits vertically and `Ctrl+b x`
closes the pane. For anyone who lives in tmux and wants the same muscle
memory inside Obsidian.

## Install

Copy `main.js`, `manifest.json`, and `styles.css` into
`<vault>/.obsidian/plugins/tmux-nav/`, then turn on **Tmux Navigator** in
Settings, Community plugins.

## Keys

| Key | Action |
|---|---|
| `Ctrl+h` | Focus the pane to the left |
| `Ctrl+j` | Focus the pane below |
| `Ctrl+k` | Focus the pane above |
| `Ctrl+l` | Focus the pane to the right |
| `Ctrl+b` | Leader key, the tmux prefix |
| `Ctrl+b` then `%` | Split the pane vertically |
| `Ctrl+b` then `"` | Split the pane horizontally |
| `Ctrl+b` then `x` | Close the current pane |

Every action is also an Obsidian command, so you can rebind any of them in
Settings, Hotkeys.

## Build

```bash
npm install
npm run build    # type-check, then bundle to main.js
npm run dev      # rebuild on save
```

TypeScript and esbuild. No runtime dependencies.

## License

MIT

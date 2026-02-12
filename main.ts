import { Plugin, PluginSettingTab, App, Setting, WorkspaceLeaf } from 'obsidian';

type Direction = 'left' | 'right' | 'up' | 'down';

// --- Settings ---

interface LeaderBinding {
	key: string;
	action: string;
	label: string;
}

interface TmuxNavSettings {
	leaderTimeoutMs: number;
	bindings: LeaderBinding[];
}

const ACTIONS: Record<string, string> = {
	'focus-left': 'Focus pane left',
	'focus-down': 'Focus pane down',
	'focus-up': 'Focus pane up',
	'focus-right': 'Focus pane right',
	'split-vertical': 'Split vertical',
	'split-horizontal': 'Split horizontal',
	'close-pane': 'Close pane',
};

const DEFAULT_SETTINGS: TmuxNavSettings = {
	leaderTimeoutMs: 1500,
	bindings: [
		{ key: 'h', action: 'focus-left', label: 'Focus left' },
		{ key: 'j', action: 'focus-down', label: 'Focus down' },
		{ key: 'k', action: 'focus-up', label: 'Focus up' },
		{ key: 'l', action: 'focus-right', label: 'Focus right' },
		{ key: '%', action: 'split-vertical', label: 'Split vertical' },
		{ key: '"', action: 'split-horizontal', label: 'Split horizontal' },
		{ key: 'x', action: 'close-pane', label: 'Close pane' },
	],
};

// --- Plugin ---

export default class TmuxNavPlugin extends Plugin {
	settings: TmuxNavSettings;
	private leaderActive = false;
	private leaderTimeout: ReturnType<typeof setTimeout> | null = null;
	private keyHandler: ((e: KeyboardEvent) => void) | null = null;
	private statusBarEl: HTMLElement;

	async onload() {
		await this.loadSettings();
		this.statusBarEl = this.addStatusBarItem();
		this.addSettingTab(new TmuxNavSettingTab(this.app, this));

		// Leader key command (Ctrl+B, like tmux)
		this.addCommand({
			id: 'leader',
			name: 'Leader key (tmux prefix)',
			hotkeys: [{ modifiers: ['Ctrl'], key: 'b' }],
			callback: () => this.activateLeader(),
		});

		// Direct Ctrl+hjkl navigation (vim-navigator style, no leader needed)
		this.addCommand({
			id: 'focus-pane-left',
			name: 'Focus pane left',
			hotkeys: [{ modifiers: ['Ctrl'], key: 'h' }],
			callback: () => this.focusDirection('left'),
		});

		this.addCommand({
			id: 'focus-pane-down',
			name: 'Focus pane down',
			hotkeys: [{ modifiers: ['Ctrl'], key: 'j' }],
			callback: () => this.focusDirection('down'),
		});

		this.addCommand({
			id: 'focus-pane-up',
			name: 'Focus pane up',
			hotkeys: [{ modifiers: ['Ctrl'], key: 'k' }],
			callback: () => this.focusDirection('up'),
		});

		this.addCommand({
			id: 'focus-pane-right',
			name: 'Focus pane right',
			hotkeys: [{ modifiers: ['Ctrl'], key: 'l' }],
			callback: () => this.focusDirection('right'),
		});

		this.addCommand({
			id: 'split-vertical',
			name: 'Split pane vertical',
			callback: () => this.splitVertical(),
		});

		this.addCommand({
			id: 'split-horizontal',
			name: 'Split pane horizontal',
			callback: () => this.splitHorizontal(),
		});

		this.addCommand({
			id: 'close-pane',
			name: 'Close current pane',
			callback: () => this.closePane(),
		});
	}

	onunload() {
		this.deactivateLeader();
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
		// Ensure bindings array has all defaults (in case new ones were added)
		const existingKeys = new Set(this.settings.bindings.map(b => b.key + b.action));
		for (const def of DEFAULT_SETTINGS.bindings) {
			if (!existingKeys.has(def.key + def.action)) {
				this.settings.bindings.push({ ...def });
			}
		}
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	private buildBindingMap(): Record<string, string> {
		const map: Record<string, string> = {};
		for (const b of this.settings.bindings) {
			if (b.key) map[b.key] = b.action;
		}
		return map;
	}

	// --- Leader Key ---

	private activateLeader(): void {
		if (this.leaderActive) {
			this.deactivateLeader();
			return;
		}

		this.leaderActive = true;
		this.statusBarEl.setText('TMUX');
		this.statusBarEl.addClass('tmux-nav-leader-active');

		const bindings = this.buildBindingMap();

		this.keyHandler = (e: KeyboardEvent) => {
			// Let modifier-only presses pass through without consuming the listener
			if (['Control', 'Shift', 'Alt', 'Meta'].includes(e.key)) return;

			e.preventDefault();
			e.stopPropagation();

			const action = bindings[e.key];
			if (action) {
				this.executeAction(action);
			}

			this.deactivateLeader();
		};

		document.addEventListener('keydown', this.keyHandler, { capture: true });

		this.leaderTimeout = setTimeout(() => {
			this.deactivateLeader();
		}, this.settings.leaderTimeoutMs);
	}

	private deactivateLeader(): void {
		this.leaderActive = false;
		this.statusBarEl.setText('');
		this.statusBarEl.removeClass('tmux-nav-leader-active');

		if (this.leaderTimeout) {
			clearTimeout(this.leaderTimeout);
			this.leaderTimeout = null;
		}

		if (this.keyHandler) {
			document.removeEventListener('keydown', this.keyHandler, { capture: true });
			this.keyHandler = null;
		}
	}

	private executeAction(action: string): void {
		switch (action) {
			case 'focus-left':       this.focusDirection('left'); break;
			case 'focus-right':      this.focusDirection('right'); break;
			case 'focus-up':         this.focusDirection('up'); break;
			case 'focus-down':       this.focusDirection('down'); break;
			case 'split-vertical':   this.splitVertical(); break;
			case 'split-horizontal': this.splitHorizontal(); break;
			case 'close-pane':       this.closePane(); break;
		}
	}

	// --- Actions ---

	private focusDirection(dir: Direction): void {
		const active = this.app.workspace.activeLeaf;
		if (!active) return;

		const activeRect = (active as any).containerEl.getBoundingClientRect();
		const activeCx = activeRect.left + activeRect.width / 2;
		const activeCy = activeRect.top + activeRect.height / 2;

		let best: WorkspaceLeaf | null = null;
		let bestDist = Infinity;

		this.app.workspace.iterateAllLeaves((leaf: WorkspaceLeaf) => {
			if (leaf === active) return;

			const rect = (leaf as any).containerEl.getBoundingClientRect();
			if (rect.width === 0 || rect.height === 0) return;

			const cx = rect.left + rect.width / 2;
			const cy = rect.top + rect.height / 2;

			const dx = cx - activeCx;
			const dy = cy - activeCy;

			let inDirection = false;
			switch (dir) {
				case 'left':  inDirection = dx < -10; break;
				case 'right': inDirection = dx > 10;  break;
				case 'up':    inDirection = dy < -10; break;
				case 'down':  inDirection = dy > 10;  break;
			}
			if (!inDirection) return;

			let dist: number;
			if (dir === 'left' || dir === 'right') {
				dist = Math.abs(dx) + Math.abs(dy) * 3;
			} else {
				dist = Math.abs(dy) + Math.abs(dx) * 3;
			}

			if (dist < bestDist) {
				bestDist = dist;
				best = leaf;
			}
		});

		if (best) {
			this.app.workspace.setActiveLeaf(best, { focus: true });
		}
	}

	private splitVertical(): void {
		(this.app as any).commands.executeCommandById('workspace:split-vertical');
	}

	private splitHorizontal(): void {
		(this.app as any).commands.executeCommandById('workspace:split-horizontal');
	}

	private closePane(): void {
		(this.app as any).commands.executeCommandById('workspace:close');
	}
}

// --- Settings Tab ---

class TmuxNavSettingTab extends PluginSettingTab {
	plugin: TmuxNavPlugin;

	constructor(app: App, plugin: TmuxNavPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		containerEl.createEl('h2', { text: 'Tmux Navigator' });

		// Timeout
		new Setting(containerEl)
			.setName('Leader key timeout')
			.setDesc('Milliseconds to wait for a key after pressing the leader key.')
			.addText((text) =>
				text
					.setValue(String(this.plugin.settings.leaderTimeoutMs))
					.onChange(async (val) => {
						const num = parseInt(val);
						if (!isNaN(num) && num > 0) {
							this.plugin.settings.leaderTimeoutMs = num;
							await this.plugin.saveSettings();
						}
					}),
			);

		// Bindings
		containerEl.createEl('h3', { text: 'Leader key bindings' });
		containerEl.createEl('p', {
			text: 'Keys pressed after the leader key (Ctrl+B). Rebind the leader key itself in Obsidian\'s Hotkeys settings.',
			cls: 'setting-item-description',
		});

		for (const binding of this.plugin.settings.bindings) {
			new Setting(containerEl)
				.setName(binding.label)
				.addText((text) =>
					text
						.setPlaceholder('key')
						.setValue(binding.key)
						.onChange(async (val) => {
							binding.key = val;
							await this.plugin.saveSettings();
						}),
				)
				.addDropdown((drop) => {
					for (const [actionId, actionLabel] of Object.entries(ACTIONS)) {
						drop.addOption(actionId, actionLabel);
					}
					drop.setValue(binding.action);
					drop.onChange(async (val) => {
						binding.action = val;
						await this.plugin.saveSettings();
					});
				})
				.addExtraButton((btn) =>
					btn
						.setIcon('trash')
						.setTooltip('Remove binding')
						.onClick(async () => {
							this.plugin.settings.bindings =
								this.plugin.settings.bindings.filter((b) => b !== binding);
							await this.plugin.saveSettings();
							this.display();
						}),
				);
		}

		// Add binding button
		new Setting(containerEl)
			.addButton((btn) =>
				btn
					.setButtonText('Add binding')
					.setCta()
					.onClick(async () => {
						this.plugin.settings.bindings.push({
							key: '',
							action: 'focus-left',
							label: 'New binding',
						});
						await this.plugin.saveSettings();
						this.display();
					}),
			);
	}
}

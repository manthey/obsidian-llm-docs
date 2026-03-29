import { App, Modal } from 'obsidian'
import { McpManager, McpTool } from '../mcp'
import { McpToolServerSettings } from '../settings'
import { ValueEmitter } from '../utils'

interface ToolOption {
	label: string
	value: string
	type: 'server' | 'tool'
	description: string
	selected: boolean
}

export class ToolPickerModal extends Modal {
	private onResult = new ValueEmitter<string[] | null>()
	private options: ToolOption[] = []
	private listEl: HTMLElement

	constructor(
		app: App,
		private serverConfigs: McpToolServerSettings[],
		private currentFilters: string[] | null,
	) {
		super(app)
	}

	async openAndGetResult(): Promise<string[] | null> {
		return new Promise((resolve) => {
			this.open()
			this.onResult.once((result) => resolve(result))
		})
	}

	async onOpen() {
		const { contentEl } = this
		contentEl.empty()
		contentEl.createEl('h3', { text: 'Select tools' })

		this.listEl = contentEl.createDiv()
		this.listEl.createEl('p', { text: 'Connecting to tool servers...' })

		const buttonRow = contentEl.createDiv({ cls: 'llmdocs-connection-row llmdocs-connection-buttons' })
		buttonRow.style.marginTop = '1em'
		buttonRow.style.justifyContent = 'flex-end'

		const applyButton = buttonRow.createEl('button', { text: 'Apply' })
		applyButton.onclick = () => {
			const selected = this.options.filter((o) => o.selected).map((o) => o.value)
			this.onResult.emit(selected)
			this.close()
		}

		const cancelButton = buttonRow.createEl('button', { text: 'Cancel' })
		cancelButton.onclick = () => {
			this.onResult.emit(null)
			this.close()
		}

		await this.loadTools()
	}

	private async loadTools() {
		const manager = new McpManager()
		try {
			await manager.connect(this.serverConfigs)
			const tools = manager.getTools()
			this.buildOptions(tools)
			this.renderList()
		} catch (error) {
			this.listEl.empty()
			this.listEl.createEl('p', { text: `Failed to connect: ${error}` })
		} finally {
			await manager.disconnect()
		}
	}

	private buildOptions(tools: McpTool[]) {
		const collator = new Intl.Collator()
		const serverNames = [...new Set(tools.map((t) => t.serverName))]
			.filter(Boolean)
			.sort(collator.compare.bind(collator))
		for (const name of serverNames) {
			const count = tools.filter((t) => t.serverName === name).length
			this.options.push({
				label: name,
				value: name,
				type: 'server',
				description: `Server (${count} tool${count === 1 ? '' : 's'})`,
				selected: this.currentFilters?.includes(name) ?? false,
			})
			const serverTools = tools
				.filter((t) => t.serverName === name)
				.sort((a, b) => collator.compare(a.name, b.name))
			for (const tool of serverTools) {
				this.options.push({
					label: tool.name,
					value: tool.name,
					type: 'tool',
					description: tool.description || tool.serverName,
					selected: this.currentFilters?.includes(tool.name) ?? false,
				})
			}
		}
	}

	private renderList() {
		this.listEl.empty()
		if (this.options.length === 0) {
			this.listEl.createEl('p', { text: 'No tools found.' })
			return
		}
		this.listEl.createEl('p', { text: 'Select server names to include all their tools, or individual tools.' })
		for (const option of this.options) {
			const row = this.listEl.createEl('label', { cls: 'llmdocs-connection-row llmdocs-tool-picker-row' })
			const checkbox = row.createEl('input', { type: 'checkbox' }) as HTMLInputElement
			checkbox.checked = option.selected
			checkbox.onchange = () => {
				option.selected = checkbox.checked
			}
			const content = row.createDiv({ cls: `llmdocs-tool-row-${option.type}` })
			content.createEl(option.type === 'server' ? 'strong' : 'span', { text: option.label })
			content.createEl('br')
			content.createEl('small', { text: option.description, cls: 'llmdocs-suggest-item-subtext' })
		}
	}

	onClose() {
		this.contentEl.empty()
		sleep(0).then(() => this.onResult.emit(null))
	}
}

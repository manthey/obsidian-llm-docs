import { App, Modal } from 'obsidian'
import { McpTool } from '../mcp'

export class ToolListModal extends Modal {
	constructor(
		app: App,
		private tools: McpTool[],
		private title: string,
	) {
		super(app)
	}

	onOpen() {
		const { contentEl } = this
		this.modalEl.addClass('llmdocs-tool-modal')
		contentEl.empty()
		contentEl.createEl('h2', { text: this.title })

		if (this.tools.length === 0) {
			contentEl.createEl('p', { text: 'No tools found.' })
			return
		}

		contentEl.createEl('p', {
			text: `${this.tools.length} tool${this.tools.length === 1 ? '' : 's'} available. Use tool names in the llm_tools frontmatter property to filter which tools are provided to the model.`,
		})

		const table = contentEl.createEl('table', { cls: 'llmdocs-tool-list-table' })
		const thead = table.createEl('thead')
		const headerRow = thead.createEl('tr')
		headerRow.createEl('th', { text: 'Name' })
		headerRow.createEl('th', { text: 'Description' })
		headerRow.createEl('th', { text: 'Server' })
		headerRow.createEl('th', { text: 'Parameters' })

		const tbody = table.createEl('tbody')
		for (const tool of this.tools) {
			const row = tbody.createEl('tr')

			const nameCell = row.createEl('td')
			nameCell.createEl('code', { text: tool.name })

			row.createEl('td', { text: tool.description || '(none)' })
			row.createEl('td', { text: tool.serverName })

			const paramsCell = row.createEl('td')
			const schema = tool.inputSchema
			if (schema && typeof schema === 'object' && schema.properties) {
				const properties = schema.properties as Record<string, { type?: string; description?: string }>
				const required = (schema.required as string[]) ?? []
				const paramNames = Object.keys(properties)
				if (paramNames.length === 0) {
					paramsCell.setText('(none)')
				} else {
					const paramList = paramsCell.createEl('ul', { cls: 'llmdocs-tool-param-list' })
					for (const paramName of paramNames) {
						const param = properties[paramName]
						const isRequired = required.includes(paramName)
						const li = paramList.createEl('li')
						li.createEl('code', { text: paramName })
						const details: string[] = []
						if (param.type) {
							details.push(param.type)
						}
						if (isRequired) {
							details.push('required')
						}
						if (details.length > 0) {
							li.createSpan({ text: ` (${details.join(', ')})` })
						}
						if (param.description) {
							li.createEl('br')
							li.createSpan({
								text: param.description,
								cls: 'llmdocs-tool-param-description',
							})
						}
					}
				}
			} else {
				paramsCell.setText('(none)')
			}
		}
	}

	onClose() {
		this.contentEl.empty()
	}
}

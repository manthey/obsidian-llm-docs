import { Notice, Platform, Setting } from 'obsidian'
import LlmDocsPlugin from '../main'
import { McpManager } from '../mcp'
import { ToolListModal } from './tool-list-modal'

export function addToolServersSettings(containerEl: HTMLElement, plugin: LlmDocsPlugin, redraw: () => void) {
	new Setting(containerEl)
		.setName('Tool servers (MCP)')
		.setDesc('Connect to MCP-compatible tool servers for agentic tool use')
		.setHeading()

	const serversContainer = containerEl.createDiv()

	plugin.settings.toolServers.forEach((server, index) => {
		const group = serversContainer.createDiv({ cls: 'llmdocs-connection-group' })

		const row1 = group.createDiv({ cls: 'llmdocs-connection-row' })

		const nameInput = row1.createEl('input', { cls: 'llmdocs-connection-apikey' })
		nameInput.type = 'text'
		nameInput.placeholder = 'Server name'
		nameInput.value = server.name
		nameInput.oninput = async () => {
			plugin.settings.toolServers[index].name = nameInput.value
			await plugin.saveSettings()
		}

		const typeSelect = row1.createEl('select', { cls: 'dropdown llmdocs-connection-type' })
		typeSelect.createEl('option', { text: 'HTTP', value: 'http' })
		if (!Platform.isMobile) {
			typeSelect.createEl('option', { text: 'Stdio', value: 'stdio' })
		}
		typeSelect.value = server.type
		typeSelect.onchange = async () => {
			plugin.settings.toolServers[index].type = typeSelect.value as 'http' | 'stdio'
			await plugin.saveSettings()
			redraw()
		}

		if (server.type === 'http') {
			const row2 = group.createDiv({ cls: 'llmdocs-connection-row' })
			const urlInput = row2.createEl('input', { cls: 'llmdocs-connection-baseurl' })
			urlInput.type = 'text'
			urlInput.placeholder = 'URL (e.g. http://localhost:3000/mcp)'
			urlInput.value = server.url ?? ''
			urlInput.oninput = async () => {
				plugin.settings.toolServers[index].url = urlInput.value
				await plugin.saveSettings()
			}
			const row2b = group.createDiv({ cls: 'llmdocs-connection-row' })
			const headersInput = row2b.createEl('input', { cls: 'llmdocs-connection-baseurl' })
			headersInput.type = 'text'
			headersInput.placeholder = 'Headers (Key:Value, comma-separated, e.g. Authorization:Bearer token123)'
			headersInput.value = Object.entries(server.headers ?? {})
				.map(([k, v]) => `${k}:${v}`)
				.join(', ')
			headersInput.oninput = async () => {
				const headers: Record<string, string> = {}
				headersInput.value
					.split(',')
					.filter(Boolean)
					.forEach((pair) => {
						const colonIdx = pair.indexOf(':')
						if (colonIdx > 0) {
							headers[pair.slice(0, colonIdx).trim()] = pair.slice(colonIdx + 1).trim()
						}
					})
				plugin.settings.toolServers[index].headers = headers
				await plugin.saveSettings()
			}
		} else {
			const row2 = group.createDiv({ cls: 'llmdocs-connection-row' })
			const commandInput = row2.createEl('input', { cls: 'llmdocs-connection-baseurl' })
			commandInput.type = 'text'
			commandInput.placeholder = 'Command (e.g. npx)'
			commandInput.value = server.command ?? ''
			commandInput.oninput = async () => {
				plugin.settings.toolServers[index].command = commandInput.value
				await plugin.saveSettings()
			}

			const row3 = group.createDiv({ cls: 'llmdocs-connection-row' })
			const argsInput = row3.createEl('input', { cls: 'llmdocs-connection-baseurl' })
			argsInput.type = 'text'
			argsInput.placeholder = 'Arguments (space-separated)'
			argsInput.value = (server.args ?? []).join(' ')
			argsInput.oninput = async () => {
				plugin.settings.toolServers[index].args = argsInput.value.split(/\s+/).filter(Boolean)
				await plugin.saveSettings()
			}

			const row4 = group.createDiv({ cls: 'llmdocs-connection-row' })
			const envInput = row4.createEl('input', { cls: 'llmdocs-connection-baseurl' })
			envInput.type = 'text'
			envInput.placeholder = 'Environment (KEY=VALUE, space-separated)'
			envInput.value = Object.entries(server.env ?? {})
				.map(([k, v]) => `${k}=${v}`)
				.join(' ')
			envInput.oninput = async () => {
				const env: Record<string, string> = {}
				envInput.value
					.split(/\s+/)
					.filter(Boolean)
					.forEach((pair) => {
						const eqIdx = pair.indexOf('=')
						if (eqIdx > 0) {
							env[pair.slice(0, eqIdx)] = pair.slice(eqIdx + 1)
						}
					})
				plugin.settings.toolServers[index].env = env
				await plugin.saveSettings()
			}
		}

		const rowButtons = group.createDiv({ cls: 'llmdocs-connection-row llmdocs-connection-buttons' })
		const listToolsButton = rowButtons.createEl('button', { text: 'List tools', cls: 'llmdocs-connection-button' })
		listToolsButton.onclick = async () => {
			listToolsButton.disabled = true
			listToolsButton.setText('Connecting...')
			const manager = new McpManager()
			try {
				await manager.connect([server])
				const tools = manager.getTools()
				const serverLabel = server.name || `Server ${index + 1}`
				new ToolListModal(plugin.app, tools, `Tools from ${serverLabel}`).open()
			} catch (error) {
				new Notice(`Failed to connect to server: ${error}`)
			} finally {
				await manager.disconnect()
				listToolsButton.disabled = false
				listToolsButton.setText('List tools')
			}
		}
		const removeButton = rowButtons.createEl('button', { text: 'Remove', cls: 'llmdocs-connection-button' })
		removeButton.onclick = async () => {
			plugin.settings.toolServers.splice(index, 1)
			await plugin.saveSettings()
			redraw()
		}
	})

	const bottomSettings = new Setting(containerEl)
	if (plugin.settings.toolServers.length > 1) {
		bottomSettings.addButton((button) => {
			button.setButtonText('List all tools').onClick(async () => {
				button.setDisabled(true)
				button.setButtonText('Connecting...')
				const manager = new McpManager()
				try {
					await manager.connect(plugin.settings.toolServers)
					const tools = manager.getTools()
					new ToolListModal(plugin.app, tools, 'All available tools').open()
				} catch (error) {
					new Notice(`Failed to connect to servers: ${error}`)
				} finally {
					await manager.disconnect()
					button.setDisabled(false)
					button.setButtonText('List all tools')
				}
			})
		})
	}
	bottomSettings.addButton((button) => {
		button.setButtonText('Add tool server').onClick(async () => {
			plugin.settings.toolServers.push({
				name: '',
				type: 'http',
				url: '',
			})
			await plugin.saveSettings()
			redraw()
		})
	})
}

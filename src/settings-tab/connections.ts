import { Notice, Setting } from 'obsidian'
import LlmDocsPlugin from '../main'
import { getAvailableModelsAndUpdateCache } from '../connection-models'

export function addConnectionsSettings(containerEl: HTMLElement, plugin: LlmDocsPlugin, redraw: () => void) {
	new Setting(containerEl)
		.setName('Connections')
		.setDesc('Use official OpenAI/Anthropic APIs, or a compatible self-hosted alternative')
		.setHeading()

	const connectionsContainer = containerEl.createDiv()

	plugin.settings.connections.forEach((connection, index) => {
		const group = connectionsContainer.createDiv({ cls: 'llmdocs-connection-group' })

		// Row 1: type dropdown and API key field
		const row1 = group.createDiv({ cls: 'llmdocs-connection-row' })

		const typeSelect = row1.createEl('select', { cls: 'dropdown llmdocs-connection-type' })
		const option = typeSelect.createEl('option', { text: 'OpenAI', value: 'OpenAI' })
		typeSelect.value = connection.type
		typeSelect.onchange = async () => {
			plugin.settings.connections[index].type = typeSelect.value as 'OpenAI'
			await plugin.saveSettings()
		}

		const apiKeyInput = row1.createEl('input', { cls: 'llmdocs-connection-apikey' })
		apiKeyInput.type = 'text'
		apiKeyInput.placeholder = 'API key'
		apiKeyInput.value = connection.apiKey
		apiKeyInput.oninput = async () => {
			plugin.settings.connections[index].apiKey = apiKeyInput.value
			await plugin.saveSettings()
		}

		// Row 2: base URL field
		const row2 = group.createDiv({ cls: 'llmdocs-connection-row' })
		const baseUrlInput = row2.createEl('input', { cls: 'llmdocs-connection-baseurl' })
		baseUrlInput.type = 'text'
		baseUrlInput.placeholder = 'Base URL'
		baseUrlInput.value = connection.baseUrl
		baseUrlInput.oninput = async () => {
			plugin.settings.connections[index].baseUrl = baseUrlInput.value
			await plugin.saveSettings()
		}

		// Row 3: buttons
		const row3 = group.createDiv({ cls: 'llmdocs-connection-row llmdocs-connection-buttons' })

		const testButton = row3.createEl('button', { text: 'Test', cls: 'llmdocs-connection-button' })
		testButton.onclick = async () => {
			testButton.disabled = true
			try {
				await getAvailableModelsAndUpdateCache(connection)
				new Notice('Connection success!')
			} catch (error) {
				new Notice(error)
			}
			testButton.disabled = false
		}

		const removeButton = row3.createEl('button', { text: 'Remove', cls: 'llmdocs-connection-button' })
		removeButton.onclick = async () => {
			plugin.settings.connections.splice(index, 1)
			await plugin.saveSettings()
			redraw()
		}
	})

	new Setting(containerEl).addButton((button) => {
		button.setButtonText('Add connection').onClick(async () => {
			plugin.settings.connections.push({
				baseUrl: 'https://api.openai.com',
				apiKey: '',
				type: 'OpenAI',
			})
			await plugin.saveSettings()
			redraw()
		})
	})
}

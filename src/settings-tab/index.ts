import { App, PluginSettingTab, Setting } from 'obsidian'
import { DocOpenMethods } from '../settings'
import LlmDocsPlugin from '../main'
import { addConnectionsSettings } from './connections'
import { modelCacheUpdated } from '../registry'
import { ModelPickerModal } from './model-picker'
import { FolderSuggest } from './folder-suggest'

export class SettingsTab extends PluginSettingTab {
	unsubscribe = modelCacheUpdated.on(() => this.display())

	constructor(
		app: App,
		private plugin: LlmDocsPlugin,
	) {
		super(app, plugin)
	}

	hide() {
		super.hide()

		this.unsubscribe()
	}

	display(): void {
		const { containerEl } = this

		containerEl.empty()

		new Setting(containerEl)
			.setName('LLM docs directory')
			.setDesc('The directory where new LLM documents will be created')
			.addText((text) => {
				text.setPlaceholder('path/to/directory')
					.setValue(this.plugin.settings.docsDir)
					.onChange(async (value) => {
						this.plugin.settings.docsDir = value
						await this.plugin.saveSettings()
					})

				new FolderSuggest(this.app, text.inputEl)
			})

		const documentOpenMethods: Record<DocOpenMethods, string> = {
			tab: 'a new tab',
			splitVertical: 'a new split (vertical)',
			splitHorizontal: 'a new split (horizontal)',
			window: 'a new window',
			replace: 'an existing tab',
		}
		new Setting(containerEl).setName('Create new documents in...').addDropdown((dropdown) =>
			dropdown
				.addOptions(documentOpenMethods)
				.setValue(this.plugin.settings.defaults.docOpenMethod)
				.onChange(async (value) => {
					this.plugin.settings.defaults.docOpenMethod = value as DocOpenMethods
					await this.plugin.saveSettings()
				}),
		)

		addConnectionsSettings(containerEl, this.plugin, () => this.display())

		new Setting(containerEl).setName('Defaults').setHeading()

		this.addDefaultModelSetting(containerEl)

		new Setting(containerEl)
			.setName('Default system prompt')
			.setDesc('The default system prompt for new LLM documents')
			.addText((text) =>
				text
					.setPlaceholder('System prompt')
					.setValue(this.plugin.settings.defaults.systemPrompt)
					.onChange(async (value) => {
						this.plugin.settings.defaults.systemPrompt = value
						await this.plugin.saveSettings()
					}),
			)
        new Setting(containerEl)
            .setName('Frontmatter parameters (llm_*)')
            .setDesc(
                createFragment((e) => {
                    e.createSpan({ text: 'Any frontmatter key starting with ' })
                    e.createEl('code', { text: 'llm_' })
                    e.createSpan({ text: ' is sent directly to the API.  Examples:' })
                    e.createEl('code', { text: 'llm_temperature' })
                    e.createSpan({ text: ' (randomness, 0-2), ' })
                    e.createEl('code', { text: 'llm_top_p' })
                    e.createSpan({ text: ' (sampling threshold, 0.05-1), ' })
                    e.createEl('code', { text: 'llm_max_tokens' })
                    e.createSpan({ text: ' (response size), ' })
                    e.createEl('code', { text: 'llm_stop' })
                    e.createSpan({ text: ' (stop string(s)), ' })
                    e.createEl('code', { text: 'llm_seed' })
                    e.createSpan({ text: ' (random seed), ' })
                    e.createEl('code', { text: 'llm_response_format' })
                    e.createSpan({ text: ' ({"type":"json_object"} might work), ' })
                    e.createEl('code', { text: 'llm_presence_penalty' })
                    e.createSpan({ text: ' (-2-2, not ollama), ' })
                    e.createEl('code', { text: 'llm_frequency_penalty' })
                    e.createSpan({ text: ' (-2-2, not ollama), ' })
                    e.createEl('code', { text: 'llm_num_ctx' })
                    e.createSpan({ text: ' (context size, ollama), ' })
                    e.createEl('code', { text: 'llm_num_predict' })
                    e.createSpan({ text: ' (response size, ollama), ' })
                    e.createEl('code', { text: 'llm_repeat_penalty' })
                    e.createSpan({ text: ' (1-2, ollama), ' })
                    e.createEl('code', { text: 'llm_repeat_last_n' })
                    e.createSpan({ text: ' (recenct lookback, 64-512, ollama), ' })
                    e.createEl('code', { text: 'llm_top_k' })
                    e.createSpan({ text: ' (tokens considered, 5-100, ollama), ' })
                    e.createEl('code', { text: 'llm_min_p' })
                    e.createSpan({ text: ' (sampling discard, 0.01-0.2).  You can also use ' })
                    e.createEl('code', { text: 'llm_max_image_size' })
                    e.createSpan({ text: ' to scale images sent to vision models, and ' })
                    e.createEl('code', { text: 'llm_connection' })
                    e.createSpan({ text: ' to change the connection endpoint.' })
                })
            )

	}

	addDefaultModelSetting(containerEl: HTMLElement) {
		const save = async (value: string) => {
			this.plugin.settings.defaults.model = value
			await this.plugin.saveSettings()
		}

		new Setting(containerEl)
			.setName('Default model')
			.setDesc('The default LLM model variant to use for new LLM documents')
			.addButton((button) => {
				button.setButtonText('Select').onClick(async () => {
					const model = await new ModelPickerModal(this.app, this.plugin).openAndGetResult()
					if (model) {
						await save(model)
						// force refresh of textbox in a way that is resilient to
						// the page being refreshed while the modal is still open
						// (can happen due to the subscription to "modelCacheUpdated")
						this.display()
					}
				})
			})
			.addText((text) => {
				text.setValue(this.plugin.settings.defaults.model).onChange(async (value) => save(value))
			})
	}
}

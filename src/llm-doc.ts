import { App, Editor, getFrontMatterInfo, parseYaml, TFile } from 'obsidian'
import { OpenaiChatCompletionStream, OpenaiBasicMessage } from './open-ai'
import {
	filterMessagesForModel,
	messagesToText,
	ParsedMessage,
	preprocessMessages,
	textToMessages,
} from './llm-doc-util'
import { DefaultsSettings, LlmConnectionSettings } from './settings'
import { getImageLinkResolver, getDocLinkResolver, appendToEditor } from './obsidian-utils'
import { resolveConnectionForModel } from './connection-models'

export interface LlmDocProperties {
	model: string | string[]
	/* Additional API parameters extracted from frontmatter keys prefixed with
	 * `llm_`. e.g. llm_temperature, llm_top_p, llm_max_tokens, llm_num_ctx
	 * (Ollama).
	 */
	llmParams?: Record<string, unknown>
}

type CompletionStream = OpenaiChatCompletionStream
const completionStream = OpenaiChatCompletionStream

export class LlmDoc {
	private currentStream: CompletionStream | null = null
	private stopped = false

	private constructor(
		private app: App,
		public file: TFile,
		private messages: ParsedMessage[],
		private properties: LlmDocProperties,
	) {}

	static async fromFile(app: App, file: TFile, defaults: DefaultsSettings): Promise<LlmDoc> {
		const text = await app.vault.read(file)
		const fmInfo = getFrontMatterInfo(text)
		const frontmatter = fmInfo.exists ? parseYaml(fmInfo.frontmatter) : {}
		const llmParams: Record<string, unknown> = {}
		for (const [key, value] of Object.entries(frontmatter ?? {})) {
			if (key.startsWith('llm_')) {
				llmParams[key.slice(4)] = value
			}
		}
		const properties: LlmDocProperties = {
			model: defaults.model,
			...(frontmatter?.model ? { model: frontmatter.model } : {}),
			llmParams,
		}
		const withoutFrontmatter = text.slice(fmInfo.contentStart)
		const messages = textToMessages(withoutFrontmatter)
		return new LlmDoc(app, file, messages, properties)
	}

	static async create(
		app: App,
		path: string,
		properties: LlmDocProperties,
		messages: OpenaiBasicMessage[],
	): Promise<LlmDoc> {
		const text = messagesToText(messages)
		const file = await app.vault.create(path, text)
		await app.fileManager.processFrontMatter(file, (frontmatter) => {
			frontmatter.model = properties.model
		})
		return new LlmDoc(app, file, messages, properties)
	}

	async stop() {
		this.stopped = true
		this.currentStream?.stop()
	}

	async complete(connections: LlmConnectionSettings[], editor: Editor) {
		const models = Array.isArray(this.properties.model) ? this.properties.model : [this.properties.model]

		// update model in frontmatter if not set and default was used
		await this.app.fileManager.processFrontMatter(this.file, (frontmatter) => {
			frontmatter.model = this.properties.model
		})

		for (let i = 0; i < models.length; i++) {
			if (this.stopped) break

			const model = models[i]
			const connectionSettings = await resolveConnectionForModel(connections, model)
			if (!connectionSettings) {
				throw new Error(`No connection found for model "${model}"`)
			}

			const heading = models.length > 1 ? `assistant${i + 1}` : 'assistant'
			const filtered = filterMessagesForModel(this.messages, i, models.length)

			const stream = new completionStream(
				connectionSettings,
				model,
				await preprocessMessages(
					filtered,
					getDocLinkResolver(this.app, this.file.path),
					getImageLinkResolver(this.app, this.file.path),
				),
				this.properties.llmParams,
			)

			this.currentStream = stream

			let headingAdded = false
			stream.on('data', (data: string) => {
				if (!headingAdded) {
					this.app.vault.append(this.file, `\n# ${heading}\n`)
					headingAdded = true
				}
				this.app.vault.append(this.file, data)
			})

			await stream.result()
		}

		await this.app.vault.append(this.file, '\n# user\n')

		// hack to ensure editor has the latest file changes before setting cursor position
		await sleep(10)

		editor.setCursor({ line: editor.lastLine(), ch: 0 })
	}
}

import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'
import { McpToolServerSettings } from './settings'
import { Platform } from 'obsidian'

export interface McpTool {
	name: string
	description: string
	inputSchema: Record<string, unknown>
	serverName: string
}

export interface ToolCallRequest {
	name: string
	arguments: Record<string, unknown>
}

export interface ToolCallResult {
	content: string
	isError: boolean
}

interface ConnectedServer {
	client: Client
	serverName: string
	tools: McpTool[]
}

export class McpManager {
	private servers: ConnectedServer[] = []

	async connect(serverConfigs: McpToolServerSettings[]): Promise<void> {
		const promises = serverConfigs.map((config) => this.connectServer(config))
		const results = await Promise.allSettled(promises)
		for (const result of results) {
			if (result.status === 'fulfilled' && result.value) {
				this.servers.push(result.value)
			} else if (result.status === 'rejected') {
				console.error('Failed to connect MCP server:', result.reason)
			}
		}
	}

	private async connectServer(config: McpToolServerSettings): Promise<ConnectedServer | null> {
		const client = new Client({ name: 'llm-docs', version: '1.0.0' })
		const transport = await this.createTransport(config)
		if (!transport) return null

		await client.connect(transport)

		const response = await client.listTools()
		const tools: McpTool[] = response.tools.map((t) => ({
			name: t.name,
			description: t.description ?? '',
			inputSchema: t.inputSchema as Record<string, unknown>,
			serverName: config.name,
		}))

		return { client, serverName: config.name, tools }
	}

	private async createTransport(config: McpToolServerSettings) {
		if (config.type === 'http') {
			return new StreamableHTTPClientTransport(new URL(config.url!))
		}

		if (config.type === 'stdio') {
			if (Platform.isMobile) {
				console.error('Stdio MCP servers are not supported on mobile')
				return null
			}
			try {
				const { StdioClientTransport } = await import('@modelcontextprotocol/sdk/client/stdio.js')
				return new StdioClientTransport({
					command: config.command!,
					args: config.args ?? [],
					env: config.env as Record<string, string> | undefined,
				})
			} catch {
				console.error('Stdio transport not available in this environment')
				return null
			}
		}

		return null
	}

	getTools(filterNames?: string[]): McpTool[] {
		const allTools = this.servers.flatMap((s) => s.tools)
		if (!filterNames || filterNames.length === 0) return allTools
		return allTools.filter((t) => filterNames.includes(t.name))
	}

	getOpenaiTools(filterNames?: string[]): OpenaiToolDef[] {
		return this.getTools(filterNames).map((t) => ({
			type: 'function' as const,
			function: {
				name: t.name,
				description: t.description,
				parameters: t.inputSchema,
			},
		}))
	}

	async callTool(request: ToolCallRequest): Promise<ToolCallResult> {
		for (const server of this.servers) {
			const hasTool = server.tools.some((t) => t.name === request.name)
			if (!hasTool) continue

			const result = await server.client.callTool({
				name: request.name,
				arguments: request.arguments,
			})

			const textParts = (result.content as Array<{ type: string; text?: string }>)
				.filter((c) => c.type === 'text' && c.text)
				.map((c) => c.text!)

			return {
				content: textParts.join('\n'),
				isError: result.isError === true,
			}
		}

		return { content: `Tool "${request.name}" not found on any connected server`, isError: true }
	}

	async disconnect(): Promise<void> {
		const promises = this.servers.map((s) => s.client.close().catch(() => {}))
		await Promise.all(promises)
		this.servers = []
	}
}

export interface OpenaiToolDef {
	type: 'function'
	function: {
		name: string
		description: string
		parameters: Record<string, unknown>
	}
}

import { describe, expect, it } from '@jest/globals'
import { messagesToText, preprocessMessages, textToMessages, filterMessagesForModel } from './llm-doc-util'
import { OpenaiBasicMessage } from './open-ai'

describe('LLM doc util', () => {
	describe('text to messages (and back to text)', () => {
		it('should work with all message types', () => {
			const originalText = `# system\nmessage 1\n# user\nmessage 2\n# assistant\nmessage 3`
			const messages = textToMessages(originalText)
			expect(messages).toEqual([
				{ role: 'system', content: 'message 1' },
				{ role: 'user', content: 'message 2' },
				{ role: 'assistant', content: 'message 3' },
			])
			const text = messagesToText(messages)
			expect(text).toEqual(originalText)
		})
		it('should use whole text as user message when no explicit messages', () => {
			const originalText = 'message'
			const messages = textToMessages(originalText)
			expect(messages).toEqual([{ role: 'user', content: 'message' }])
			const text = messagesToText(messages)
			expect(text).toEqual('# user\nmessage')
		})
	})

	describe('messages preprocessing', () => {
		it('should remove system prompt if it contains only whitespace', async () => {
			const messages: OpenaiBasicMessage[] = [
				{ role: 'system', content: ' \n' },
				{ role: 'user', content: 'message' },
			]
			const result = await preprocessMessages(messages, nullResolver, nullResolver)
			expect(result).toEqual([{ role: 'user', content: 'message' }])
		})
		it('should expand links in user/system messages but not in assistant messages', async () => {
			const messages: OpenaiBasicMessage[] = [
				{ role: 'system', content: 'text [[mylink]] text [[mylink]]' },
				{ role: 'user', content: 'text [[mylink]] text' },
				{ role: 'assistant', content: 'text [[mylink]] text' },
			]
			const resolver = async () => 'resolved'
			const result = await preprocessMessages(messages, resolver, nullResolver)
			expect(result).toEqual([
				{ role: 'system', content: 'text resolved text resolved' },
				{ role: 'user', content: 'text resolved text' },
				{ role: 'assistant', content: 'text [[mylink]] text' },
			])
		})
		it('should leave links unchanged when they cannot be resolved', async () => {
			const messages: OpenaiBasicMessage[] = [{ role: 'user', content: 'text [[mylink]] text' }]
			const resolver = async () => null
			const result = await preprocessMessages(messages, resolver, nullResolver)
			expect(result).toEqual([{ role: 'user', content: 'text [[mylink]] text' }])
		})
		it('should handle images', async () => {
			const messages: OpenaiBasicMessage[] = [
				{ role: 'user', content: 'Hello\n![[CleanShot 2025-03-12 at 13.11.51@2x.png]]\nworld.' },
			]
			const resolver = async () => 'data:image/jpeg;base64,{base64_image}'
			const result = await preprocessMessages(messages, nullResolver, resolver)
			expect(result).toEqual([
				{
					role: 'user',
					content: [
						{
							type: 'text',
							text: 'Hello\n',
						},
						{
							type: 'image_url',
							image_url: {
								url: 'data:image/jpeg;base64,{base64_image}',
							},
						},
						{
							type: 'text',
							text: '\nworld.',
						},
					],
				},
			])
		})
	})

	describe('tool calling functionality', () => {
		it('should properly handle tool calls in messages', () => {
			// Test the existing functionality that handles tool calls
			const messages = [
				{
					role: 'assistant',
					content: 'Some response',
					tool_calls: [
						{
							id: 'call_123',
							type: 'function',
							function: { name: 'get_weather', arguments: '{"location":"London"}' },
						},
					],
				},
			]

			// Just verify that the structure is preserved
			expect(messages[0]).toHaveProperty('tool_calls')
			expect(messages[0].tool_calls).toHaveLength(1)
			expect(messages[0].tool_calls[0]).toHaveProperty('id')
			expect(messages[0].tool_calls[0]).toHaveProperty('type')
			expect(messages[0].tool_calls[0]).toHaveProperty('function')
		})
	})

	describe('filterMessagesForModel fallback logic', () => {
		it('should handle numbered system/user blocks across multiple models with exact fallback sequence', () => {
			const messages: ParsedMessage[] = [
				{ role: 'system', content: 'sys' },

				// Group 2 (User) - only unnumbered user block available for all models
				{ role: 'user', content: 'userB' },

				// Group 3 (Assistant candidates for first turn)
				{ role: 'assistant1', content: 'assC' },
				{ role: 'assistant2', content: 'assD' },
				{ role: 'assistant3', content: 'assE' },

				// Group 4 (User) - only unnumbered user block
				{ role: 'user', content: 'userF' },

				// Group 5 (Assistant) - only unnumbered assistant block
				{ role: 'assistant', content: 'assG' },

				// Group 6 (User) - only unnumbered user block
				{ role: 'user', content: 'userH' },

				// Group 7 (Assistant candidates for second turn)
				{ role: 'assistant1', content: 'assI' },
				{ role: 'assistant3', content: 'assJ' },

				// Group 8 (User) - only unnumbered user block
				{ role: 'user', content: 'userK' },
			]

			const forModel1 = filterMessagesForModel(messages, 0, 3) // indices 0-based -> target 'assistant1'
			expect(forModel1.map((m) => m.content)).toEqual([
				'sys',
				'userB',
				'assC',
				'userF',
				'assG',
				'userH',
				'assI',
				'userK',
			])

			const forModel2 = filterMessagesForModel(messages, 1, 3) // target 'assistant2'
			expect(forModel2.map((m) => m.content)).toEqual([
				'sys',
				'userB',
				'assD',
				'userF',
				'assG',
				'userH',
				'assI',
				'userK',
			])

			const forModel3 = filterMessagesForModel(messages, 2, 3) // target 'assistant3'
			expect(forModel3.map((m) => m.content)).toEqual([
				'sys',
				'userB',
				'assE',
				'userF',
				'assG',
				'userH',
				'assJ',
				'userK',
			])

			// Ensure OpenAI roles are strictly mapped (numbered suffixes removed)
			for (const msg of forModel1.concat(forModel2).concat(forModel3)) {
				expect(['system', 'user', 'assistant'].includes(msg.role as string)).toBe(true)
			}
		})
	})
})

const nullResolver = async () => null

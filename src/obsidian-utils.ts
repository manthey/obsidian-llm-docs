import { App, Editor, Workspace, arrayBufferToBase64 } from 'obsidian'
import { DocOpenMethods } from './settings'

const imageExtensions = ['png', 'jpg', 'jpeg', 'gif']
const textExtensions = ['txt', 'md', 'markdown', 'html']

export function getDocLinkResolver(app: App, sourcePath = ''): (link: string) => Promise<string | null> {
	return async function linkResolver(link: string) {
		const decodedLink = decodeURIComponent(link)
		const file = app.metadataCache.getFirstLinkpathDest(decodedLink, sourcePath)
		if (!file || !textExtensions.includes(file.extension)) {
			return null
		}
		return app.vault.cachedRead(file)
	}
}

export function getImageLinkResolver(
	app: App,
	sourcePath = '',
	maxImageSize?: number,
): (link: string) => Promise<string | null> {
	return async function linkResolver(link: string) {
		const decodedLink = decodeURIComponent(link)
		const file = app.metadataCache.getFirstLinkpathDest(decodedLink, sourcePath)
		if (!file || !imageExtensions.includes(file.extension)) {
			return null
		}
		const arrayBuffer = await app.vault.readBinary(file)
		const type = file.extension === 'jpg' ? 'jpeg' : file.extension
		if (maxImageSize) {
			const resized = await resizeImageIfNeeded(arrayBuffer, type, maxImageSize)
			if (resized) return resized
		}
		const str = arrayBufferToBase64(arrayBuffer)
		return `data:image/${type};base64,${str}`
	}
}

async function resizeImageIfNeeded(arrayBuffer: ArrayBuffer, type: string, maxSize: number): Promise<string | null> {
	return new Promise((resolve) => {
		const blob = new Blob([arrayBuffer], { type: `image/${type}` })
		const url = URL.createObjectURL(blob)
		const img = new Image()
		img.onload = () => {
			URL.revokeObjectURL(url)
			const { width, height } = img
			if (width <= maxSize && height <= maxSize) {
				resolve(null)
				return
			}
			const scale = maxSize / Math.max(width, height)
			const newWidth = Math.round(width * scale)
			const newHeight = Math.round(height * scale)
			const canvas = document.createElement('canvas')
			canvas.width = newWidth
			canvas.height = newHeight
			const ctx = canvas.getContext('2d')!
			ctx.drawImage(img, 0, 0, newWidth, newHeight)
			const mimeType = type === 'gif' ? 'image/png' : `image/${type}`
			const dataUrl = canvas.toDataURL(mimeType)
			resolve(dataUrl)
		}
		img.onerror = () => {
			URL.revokeObjectURL(url)
			resolve(null)
		}
		img.src = url
	})
}

export function getLeaf(workspace: Workspace, method: DocOpenMethods) {
	switch (method) {
		case DocOpenMethods.replace:
			return workspace.getLeaf()
		case DocOpenMethods.tab:
			return workspace.getLeaf('tab')
		case DocOpenMethods.splitVertical:
			return workspace.getLeaf('split', 'vertical')
		case DocOpenMethods.splitHorizontal:
			return workspace.getLeaf('split', 'horizontal')
		case DocOpenMethods.window:
			return workspace.getLeaf('window')
		default:
			return workspace.getLeaf('tab')
	}
}

export function appendToEditor(editor: Editor, text: string) {
	const lastLineNumber = editor.lastLine()
	const lastLineText = editor.getLine(lastLineNumber)
	editor.setLine(lastLineNumber, lastLineText + text)
}

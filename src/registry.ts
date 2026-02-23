import { Editor, TFile } from 'obsidian'
import { SimpleEventEmitter } from './utils'
import { ValueEmitter } from './utils'

const filesBeingProcessed: Set<TFile> = new Set()
const stopCallbacks = new Map<TFile, () => void>()
export const fileEvents = new SimpleEventEmitter()

export function isFileBeingProcessed(file: TFile) {
	return filesBeingProcessed.has(file)
}

export function fileProcessingStarted(file: TFile) {
	filesBeingProcessed.add(file)
	fileEvents.emit('change')
}

export function fileProcessingStopped(file: TFile) {
	filesBeingProcessed.delete(file)
	stopCallbacks.delete(file)
	fileEvents.emit('change')
}

export function setStopCallback(file: TFile, callback: () => void) {
	stopCallbacks.set(file, callback)
}

export function getStopCallback(file: TFile): (() => void) | undefined {
	return stopCallbacks.get(file)
}

export interface ILlmDocsPlugin {
	completeDoc: (editor: Editor, file: TFile) => Promise<void>
}

let llmDocsPlugin: ILlmDocsPlugin
export const getLlmDocsPlugin = () => llmDocsPlugin
export const setLlmDocsPlugin = (plugin: ILlmDocsPlugin) => (llmDocsPlugin = plugin)

export const modelCacheUpdated = new ValueEmitter<void>()

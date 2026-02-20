export interface SplitPart {
	text: string
	isSeparator?: true
	innerMatch?: string
}

export function splitKeepingSeparators(input: string, separator: RegExp): SplitPart[] {
	const regex = new RegExp(separator)
	const parts: SplitPart[] = []
	let match: RegExpMatchArray | null
	let lastPos = 0
	while ((match = regex.exec(input)) !== null) {
		const { index } = match
		if (index === undefined) {
			throw new Error('Index was undefined in splitKeepingSeparators()')
		}
		const before = input.substring(lastPos, match.index)
		if (before) {
			parts.push({ text: before })
		}
		const text = match[0]
		parts.push({ text, isSeparator: true, innerMatch: match[1] })
		lastPos = regex.lastIndex
	}
	const after = input.substring(lastPos)
	if (after) {
		parts.push({ text: after })
	}
	return parts
}

export class ValueEmitter<T> {
	listeners = new Set<(arg: T) => void>()

	on(listener: (arg: T) => void) {
		this.listeners.add(listener)
		// Return an unsubscribe function
		return () => this.off(listener)
	}

	off(listener: (arg: T) => void) {
		this.listeners.delete(listener)
	}

	once(listener: (arg: T) => void) {
		const wrappedListener = (arg: T) => {
			this.off(wrappedListener)
			listener(arg)
		}
		return this.on(wrappedListener)
	}

	emit(data: T) {
		for (const listener of this.listeners) {
			listener(data)
		}
	}
}

export class SimpleEventEmitter {
	private listeners = new Map<string, Array<(...args: any[]) => void>>()

	on(event: string, listener: (...args: any[]) => void) {
		if (!this.listeners.has(event)) {
			this.listeners.set(event, [])
		}
		this.listeners.get(event)!.push(listener)
	}

	off(event: string, listener: (...args: any[]) => void) {
		const arr = this.listeners.get(event)
		if (arr) {
			const index = arr.indexOf(listener)
			if (index !== -1) arr.splice(index, 1)
		}
	}

	emit(event: string, ...args: any[]) {
		for (const listener of this.listeners.get(event) ?? []) {
			listener(...args)
		}
	}

	removeAllListeners() {
		this.listeners.clear()
	}
}

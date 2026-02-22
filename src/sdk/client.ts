// Client-side library for iframe applications to communicate with the M8 host
// Import this in your iframe application to access the M8 SDK

// @ts-expect-error - post-me types not resolving correctly
import { ChildHandshake, WindowMessenger, DebugMessenger } from 'post-me'
// @ts-expect-error - post-me types not resolving correctly
import type { Connection, RemoteHandle, LocalHandle } from 'post-me'
import type {
    M8State,
    M8HostMethods,
    M8ClientMethods,
    M8HostEvents,
    M8ClientEvents,
    M8SdkConfig,
    M8KeyName,
} from './types'

export type { M8State, CursorPos, CursorRect, RGB, SystemInfos, M8KeyName } from './types'

// Client-side M8 SDK instance
export interface M8Client {
    /** Current M8 state (reactive, updated via events) */
    readonly state: M8State

    /** Whether the connection to the host is established */
    readonly isConnected: boolean

    navigateToView(viewName: string): Promise<boolean>
    navigateTo(x: number, y: number): Promise<void>
    setValueToHex(targetHex: number): Promise<boolean>
    sendKeyPress(keys: M8KeyName[]): Promise<void>
    getState(): M8State
    fetchState(): Promise<M8State>

    onStateChange(callback: (state: M8State) => void): () => void
    onViewChange(callback: (viewName: string | null, viewTitle: string | null) => void): () => void
    onCursorMove(callback: (pos: M8State['cursorPos'], rect: M8State['cursorRect']) => void): () => void
    onTextUpdate(callback: (textUnderCursor: string | null, currentLine: string | null) => void): () => void
    onKeyPress(callback: (keys: number) => void): () => void

    disconnect(): void
}

class M8ClientImpl implements M8Client {
    private connection: Connection<M8ClientMethods, M8HostEvents, M8HostMethods, M8ClientEvents> | null = null
    private remoteHandle: RemoteHandle<M8HostMethods, M8HostEvents> | null = null
    private localHandle: LocalHandle<M8ClientMethods, M8ClientEvents> | null = null
    private _state: M8State = getDefaultState()
    private _isConnected = false
    private stateCallbacks: Set<(state: M8State) => void> = new Set()
    private viewChangeCallbacks: Set<(viewName: string | null, viewTitle: string | null) => void> = new Set()
    private cursorMoveCallbacks: Set<(pos: M8State['cursorPos'], rect: M8State['cursorRect']) => void> = new Set()
    private textUpdateCallbacks: Set<(textUnderCursor: string | null, currentLine: string | null) => void> = new Set()
    private keyPressCallbacks: Set<(keys: number) => void> = new Set()
    private config: M8SdkConfig

    constructor(config: M8SdkConfig = {}) {
        this.config = config
    }

    async connect(): Promise<void> {
        if (this.connection) {
            console.warn('[M8SDK Client] Already connected')
            return
        }

        try {
            let messenger = new WindowMessenger({
                localWindow: window,
                remoteWindow: window.parent,
                remoteOrigin: '*',
            })

            if (this.config.debug) {
                messenger = DebugMessenger(messenger, (msg: string, ...args: unknown[]) => {
                    console.log('[M8SDK Client]', msg, ...args)
                })
            }

            const clientMethods: M8ClientMethods = {
                ping: async () => 'pong',
            }

            const connection = await ChildHandshake<M8ClientMethods, M8HostEvents, M8HostMethods, M8ClientEvents>(
                messenger,
                clientMethods
            )

            this.connection = connection
            this.remoteHandle = connection.remoteHandle()
            this.localHandle = connection.localHandle()
            this._isConnected = true

            this.setupEventListeners()
            await this.fetchState()
            this.localHandle.emit('ready', undefined)

            console.log('[M8SDK Client] Connected to host')
        } catch (error) {
            console.error('[M8SDK Client] Failed to connect:', error)
            throw error
        }
    }

    private setupEventListeners(): void {
        if (!this.remoteHandle) return

        this.remoteHandle.addEventListener('stateChanged', (state: M8State) => {
            this._state = state
            this.stateCallbacks.forEach(cb => { cb(state) })
        })

        this.remoteHandle.addEventListener('viewChanged', (payload: { viewName: string | null; viewTitle: string | null }) => {
            this._state.viewName = payload.viewName
            this._state.viewTitle = payload.viewTitle
            this.viewChangeCallbacks.forEach(cb => { cb(payload.viewName, payload.viewTitle) })
        })

        this.remoteHandle.addEventListener('cursorMoved', (payload: { pos: M8State['cursorPos']; rect: M8State['cursorRect'] }) => {
            this._state.cursorPos = payload.pos
            this._state.cursorRect = payload.rect
            this.cursorMoveCallbacks.forEach(cb => { cb(payload.pos, payload.rect) })
        })

        this.remoteHandle.addEventListener('textUpdated', (payload: { textUnderCursor: string | null; currentLine: string | null }) => {
            this._state.textUnderCursor = payload.textUnderCursor
            this._state.currentLine = payload.currentLine
            this.textUpdateCallbacks.forEach(cb => { cb(payload.textUnderCursor, payload.currentLine) })
        })

        this.remoteHandle.addEventListener('keyPressed', (payload: { keys: number }) => {
            this.keyPressCallbacks.forEach(cb => { cb(payload.keys) })
        })
    }

    get state(): M8State { return this._state }
    get isConnected(): boolean { return this._isConnected }

    async navigateToView(viewName: string): Promise<boolean> {
        if (!this.remoteHandle) throw new Error('[M8SDK Client] Not connected')
        return this.remoteHandle.call('navigateToView', viewName)
    }

    async navigateTo(x: number, y: number): Promise<void> {
        if (!this.remoteHandle) throw new Error('[M8SDK Client] Not connected')
        return this.remoteHandle.call('navigateTo', x, y)
    }

    async setValueToHex(targetHex: number): Promise<boolean> {
        if (!this.remoteHandle) throw new Error('[M8SDK Client] Not connected')
        targetHex = Math.max(0, Math.min(255, Math.floor(targetHex)))
        return this.remoteHandle.call('setValueToHex', targetHex)
    }

    async sendKeyPress(keys: M8KeyName[]): Promise<void> {
        if (!this.remoteHandle) throw new Error('[M8SDK Client] Not connected')
        return this.remoteHandle.call('sendKeyPress', keys)
    }

    getState(): M8State { return this._state }

    async fetchState(): Promise<M8State> {
        if (!this.remoteHandle) throw new Error('[M8SDK Client] Not connected')
        const state = await this.remoteHandle.call('getState')
        this._state = state
        return state
    }

    onStateChange(callback: (state: M8State) => void): () => void {
        this.stateCallbacks.add(callback)
        return () => { this.stateCallbacks.delete(callback) }
    }

    onViewChange(callback: (viewName: string | null, viewTitle: string | null) => void): () => void {
        this.viewChangeCallbacks.add(callback)
        return () => { this.viewChangeCallbacks.delete(callback) }
    }

    onCursorMove(callback: (pos: M8State['cursorPos'], rect: M8State['cursorRect']) => void): () => void {
        this.cursorMoveCallbacks.add(callback)
        return () => { this.cursorMoveCallbacks.delete(callback) }
    }

    onTextUpdate(callback: (textUnderCursor: string | null, currentLine: string | null) => void): () => void {
        this.textUpdateCallbacks.add(callback)
        return () => { this.textUpdateCallbacks.delete(callback) }
    }

    onKeyPress(callback: (keys: number) => void): () => void {
        this.keyPressCallbacks.add(callback)
        return () => { this.keyPressCallbacks.delete(callback) }
    }

    disconnect(): void {
        this.connection?.close()
        this.connection = null
        this.remoteHandle = null
        this.localHandle = null
        this._isConnected = false
        this.stateCallbacks.clear()
        this.viewChangeCallbacks.clear()
        this.cursorMoveCallbacks.clear()
        this.textUpdateCallbacks.clear()
        this.keyPressCallbacks.clear()
        console.log('[M8SDK Client] Disconnected')
    }
}

function getDefaultState(): M8State {
    return {
        viewName: null,
        viewTitle: null,
        minimapKey: null,
        cursorPos: null,
        cursorRect: null,
        highlightColor: null,
        titleColor: null,
        backgroundColor: null,
        textUnderCursor: null,
        currentLine: null,
        deviceModel: null,
        fontMode: null,
        systemInfo: null,
        macroRunning: false,
    }
}

export async function createM8Client(config: M8SdkConfig = {}): Promise<M8Client> {
    const client = new M8ClientImpl(config)
    await client.connect()
    return client
}

export function createM8ClientSync(config: M8SdkConfig = {}): { client: M8Client; connect: () => Promise<void> } {
    const client = new M8ClientImpl(config)
    return {
        client,
        connect: async () => { await client.connect() }
    }
}

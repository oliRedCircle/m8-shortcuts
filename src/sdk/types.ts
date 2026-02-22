// M8 SDK types — mirrored from yam8d/src/sdk/types.ts
// These are standalone type definitions (no yam8d-specific imports).

export interface CursorPos {
    x: number
    y: number
}

export interface CursorRect {
    x: number
    y: number
    w: number
    h: number
}

export interface RGB {
    r: number
    g: number
    b: number
}

export interface SystemInfos {
    model: string
    fontMode: number
    spacingX: number
    spacingY: number
    offX: number
    offY: number
    screenWidth: number
    screenHeight: number
    rectOffset: number
}

// M8 State exposed to SDK clients
export interface M8State {
    // View information
    viewName: string | null
    viewTitle: string | null
    minimapKey: string | null

    // Cursor information
    cursorPos: CursorPos | null
    cursorRect: CursorRect | null

    // Colors
    highlightColor: RGB | null
    titleColor: RGB | null
    backgroundColor: RGB | null

    // Text content
    textUnderCursor: string | null
    currentLine: string | null

    // Device info
    deviceModel: string | null
    fontMode: number | null
    systemInfo: SystemInfos | null

    // Macro status
    macroRunning: boolean
    macroCurrentStep?: number
    macroSequenceLength?: number
}

// M8 Key names for sendKeyPress
export type M8KeyName = 'left' | 'right' | 'up' | 'down' | 'shift' | 'play' | 'opt' | 'edit'

// Methods exposed by the host (parent) to the client (iframe)
export interface M8HostMethods {
    navigateToView(viewName: string): Promise<boolean>
    navigateTo(x: number, y: number): Promise<void>
    setValueToHex(targetHex: number): Promise<boolean>
    sendKeyPress(keys: M8KeyName[]): Promise<void>
    getState(): Promise<M8State>
}

// Methods exposed by the client (iframe) to the host (parent)
export interface M8ClientMethods {
    ping(): Promise<string>
}

// Events emitted by host to client
export interface M8HostEvents {
    stateChanged: M8State
    viewChanged: { viewName: string | null; viewTitle: string | null }
    cursorMoved: { pos: CursorPos | null; rect: CursorRect | null }
    textUpdated: { textUnderCursor: string | null; currentLine: string | null }
    keyPressed: { keys: number }
}

// Events emitted by client to host
export interface M8ClientEvents {
    ready: undefined
    error: { message: string }
}

// Connection configuration
export interface M8SdkConfig {
    allowedOrigins?: string[]
    debug?: boolean
}

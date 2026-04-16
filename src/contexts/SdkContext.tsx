import { createContext, useContext, useEffect, useRef, useState, type FC, type ReactNode } from 'react'
import { createM8ClientSync, type M8Client } from '../sdk/client'
import type { CursorPos, CursorRect } from '../sdk/types'

type SdkState = {
  isConnected: boolean
  sdkViewName: string | null
  cursorPos: CursorPos | null
  cursorRect: CursorRect | null
  screenWidth: number
  screenHeight: number
  rectOffset: number
}

const defaultState: SdkState = {
  isConnected: false,
  sdkViewName: null,
  cursorPos: null,
  cursorRect: null,
  screenWidth: 480,
  screenHeight: 320,
  rectOffset: 0,
}

const SdkContext = createContext<SdkState>(defaultState)

// Key bitmask helpers (matches yam8d M8KeyMask)
const isOpt = (mask: number) => !!(mask & 0x02)
const isShift = (mask: number) => !!(mask & 0x10)
const isEdit = (mask: number) => !!(mask & 0x01)
const isPlay = (mask: number) => !!(mask & 0x08)

const CONNECTION_TIMEOUT_MS = 3000

// Sets/clears the data-sdk-key attribute on <html> for instant CSS-driven key highlighting.
// This bypasses React rendering entirely — zero re-renders on key events.
const setSdkKey = (key: string) => {
  if (key) document.documentElement.dataset.sdkKey = key
  else delete document.documentElement.dataset.sdkKey
}

// Sets/clears the data-selection-mode attribute on <html> for CSS-driven SM badge highlighting.
const setSdkSelectionMode = (active: boolean) => {
  if (active) document.documentElement.dataset.selectionMode = 'true'
  else delete document.documentElement.dataset.selectionMode
}

// Sets/clears the data-sdk-connected attribute on <html> to distinguish connected vs disconnected.
const setSdkConnected = (connected: boolean) => {
  if (connected) document.documentElement.dataset.sdkConnected = 'true'
  else delete document.documentElement.dataset.sdkConnected
}

export const SdkProvider: FC<{ children: ReactNode }> = ({ children }) => {
  const [state, setState] = useState<SdkState>(defaultState)
  const clientRef = useRef<M8Client | null>(null)
  const prevMaskRef = useRef<number>(0)
  const activeKeyRef = useRef<string>('')
  const unsubsRef = useRef<Array<() => void>>([])

  useEffect(() => {
    let cancelled = false
    const { client, connect } = createM8ClientSync({ debug: false })
    clientRef.current = client

    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('M8 SDK connection timeout')), CONNECTION_TIMEOUT_MS)
    )

    Promise.race([connect(), timeout])
      .then(() => {
        if (cancelled) return

        const initialView = client.state.viewName
        const initialCursor = client.state.cursorPos
        const initialRect = client.state.cursorRect
        const initialSelection = client.state.selectionMode
        const initialScreenW = client.state.systemInfo?.screenWidth ?? 480
        const initialScreenH = client.state.systemInfo?.screenHeight ?? 320
        const initialRectOffset = client.state.systemInfo?.rectOffset ?? 0
        setState({ isConnected: true, sdkViewName: initialView, cursorPos: initialCursor, cursorRect: initialRect, screenWidth: initialScreenW, screenHeight: initialScreenH, rectOffset: initialRectOffset })
        setSdkSelectionMode(initialSelection)
        setSdkConnected(true)

        const unsubView = client.onViewChange((viewName) => {
          if (cancelled) return
          setState(prev => ({ ...prev, sdkViewName: viewName }))
        })

        const unsubCursor = client.onCursorMove((pos, rect, selectionMode) => {
          if (cancelled) return
          setState(prev => {
            // Skip re-render if cursor hasn't actually moved
            if (prev.cursorPos?.x === pos?.x && prev.cursorPos?.y === pos?.y &&
                prev.cursorRect?.x === rect?.x && prev.cursorRect?.y === rect?.y &&
                prev.cursorRect?.w === rect?.w && prev.cursorRect?.h === rect?.h) return prev
            return { ...prev, cursorPos: pos, cursorRect: rect }
          })
          setSdkSelectionMode(selectionMode)
        })

        // Key highlighting is driven directly via dataset — no setState, no React re-render
        const unsubKey = client.onKeyPress((keys) => {
          if (cancelled) return
          const prev = prevMaskRef.current
          const currentActive = activeKeyRef.current

          const stillPressed = (name: string): boolean => {
            switch (name) {
              case 'opt': return isOpt(keys)
              case 'shift': return isShift(keys)
              case 'edit': return isEdit(keys)
              case 'play': return isPlay(keys)
              default: return false
            }
          }

          if (currentActive) {
            if (stillPressed(currentActive)) {
              prevMaskRef.current = keys
              return
            }
            activeKeyRef.current = ''
            prevMaskRef.current = keys
            setSdkKey('')
            return
          }

          let newly = ''
          if (!isOpt(prev) && isOpt(keys)) newly = 'opt'
          else if (!isShift(prev) && isShift(keys)) newly = 'shift'
          else if (!isEdit(prev) && isEdit(keys)) newly = 'edit'
          else if (!isPlay(prev) && isPlay(keys)) newly = 'play'

          if (newly) {
            activeKeyRef.current = newly
            setSdkKey(newly)
          }
          prevMaskRef.current = keys
        })

        unsubsRef.current = [unsubView, unsubCursor, unsubKey]
      })
      .catch((err: unknown) => {
        if (cancelled) return
        console.warn('[M8Shortcuts] SDK not available, using URL fallback.', err instanceof Error ? err.message : err)
      })

    return () => {
      cancelled = true
      setSdkKey('')
      setSdkSelectionMode(false)
      setSdkConnected(false)
      for (const unsub of unsubsRef.current) unsub()
      unsubsRef.current = []
      clientRef.current?.disconnect()
      clientRef.current = null
    }
  }, [])

  return <SdkContext value={state}>{children}</SdkContext>
}

export const useSdkContext = () => useContext(SdkContext)

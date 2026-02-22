import { createContext, useContext, useEffect, useRef, useState, type FC, type ReactNode } from 'react'
import { createM8ClientSync, type M8Client } from '../sdk/client'

type SdkState = {
  isConnected: boolean
  sdkViewName: string | null
}

const defaultState: SdkState = {
  isConnected: false,
  sdkViewName: null,
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
        setState({ isConnected: true, sdkViewName: initialView })

        const unsubView = client.onViewChange((viewName) => {
          if (cancelled) return
          setState(prev => ({ ...prev, sdkViewName: viewName }))
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

        unsubsRef.current = [unsubView, unsubKey]
      })
      .catch((err: unknown) => {
        if (cancelled) return
        console.warn('[M8Shortcuts] SDK not available, using URL fallback.', err instanceof Error ? err.message : err)
      })

    return () => {
      cancelled = true
      setSdkKey('')
      for (const unsub of unsubsRef.current) unsub()
      unsubsRef.current = []
      clientRef.current?.disconnect()
      clientRef.current = null
    }
  }, [])

  return <SdkContext value={state}>{children}</SdkContext>
}

export const useSdkContext = () => useContext(SdkContext)

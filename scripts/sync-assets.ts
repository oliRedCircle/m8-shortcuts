import { cpSync, existsSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'

const SRC = join(process.cwd(), 'src', 'assets')
const DEST = join(process.cwd(), 'public', 'assets')

if (!existsSync(SRC)) {
    console.error(`Source assets folder not found: ${SRC}`)
    process.exit(1)
}
if (!existsSync(DEST)) {
    mkdirSync(DEST, { recursive: true })
}

cpSync(SRC, DEST, { recursive: true })
console.log(`Assets synced from ${SRC} to ${DEST}`)

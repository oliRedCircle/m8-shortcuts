import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { buildDataset } from '../src/data/buildDataset'

const outPath = join(process.cwd(), 'public', 'm8-shortcuts.dataset.json')
const dataset = buildDataset()
writeFileSync(outPath, JSON.stringify(dataset, null, 2), 'utf-8')
console.log(`Dataset regenerated at ${outPath}`)

import { css } from '@linaria/core'
import type { FC } from 'react'
import { buildDataset } from '../data/buildDataset'

const exportClass = css`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  padding: 24px;

  > button {
    padding: 8px 12px;
    border: 1px solid #888;
    border-radius: 6px;
    background: #222;
    color: #eee;
    cursor: pointer;
  }
`

const downloadJson = (filename: string, data: unknown) => {
    const json = JSON.stringify(data, null, 2)
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
}

export const ExportDataset: FC = () => {
    return (
        <div className={exportClass}>
            <h2>Export M8 Shortcuts Dataset</h2>
            <p>Generates a human-readable dataset and downloads it as a JSON file. Place it under public/m8-shortcuts.dataset.json.</p>
            <button
                onClick={() => {
                    const dataset = buildDataset()
                    downloadJson('m8-shortcuts.dataset.json', dataset)
                }}
            >
                Generate & Download Dataset
            </button>
        </div>
    )
}

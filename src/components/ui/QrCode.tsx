import React from 'react'
import { encodeQrMatrix } from '../../utils/qr'

export function QrCode({ value, size = 192 }: { value: string; size?: number }) {
  let modules: boolean[][] = []
  try {
    modules = encodeQrMatrix(value)
  } catch {
    return null
  }

  const n = modules.length
  const quiet = 4
  const dim = n + quiet * 2

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${dim} ${dim}`}
      role="img"
      aria-label="QR code para configurar o autenticador"
      className="rounded-lg bg-white"
    >
      <rect width={dim} height={dim} fill="#ffffff" />
      {modules.map((row, r) =>
        row.map((dark, c) =>
          dark ? (
            <rect
              key={`${r}-${c}`}
              x={c + quiet}
              y={r + quiet}
              width={1}
              height={1}
              fill="#0f172a"
            />
          ) : null
        )
      )}
    </svg>
  )
}

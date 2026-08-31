/**
 * QR Code encoder (byte mode, error correction M) for on-screen TOTP setup.
 * Implements ISO/IEC 18004 enough to encode otpauth:// URLs.
 */

const ECC_CW = [10, 16, 26, 18, 24, 16, 18, 22, 22, 26]
const ECC_BLOCKS = [1, 1, 1, 2, 2, 4, 4, 4, 5, 5]
const TOTAL_CW = [26, 44, 70, 100, 134, 172, 196, 242, 292, 346]
const ALIGN_POS = [
  [],
  [6, 18],
  [6, 22],
  [6, 26],
  [6, 30],
  [6, 34],
  [6, 22, 38],
  [6, 24, 42],
  [6, 26, 46],
  [6, 28, 50],
]

const EXP = new Array<number>(512)
const LOG = new Array<number>(256)

;(function initGf() {
  let x = 1
  for (let i = 0; i < 255; i++) {
    EXP[i] = x
    LOG[x] = i
    x <<= 1
    if (x & 0x100) x ^= 0x11d
  }
  for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255]
})()

function gfMul(a: number, b: number): number {
  if (a === 0 || b === 0) return 0
  return EXP[LOG[a] + LOG[b]]
}

function rsGenerator(degree: number): number[] {
  let poly = [1]
  for (let i = 0; i < degree; i++) {
    const next = new Array(poly.length + 1).fill(0)
    for (let j = 0; j < poly.length; j++) {
      next[j] ^= poly[j]
      next[j + 1] ^= gfMul(poly[j], EXP[i])
    }
    poly = next
  }
  return poly
}

function rsRemainder(data: number[], generator: number[]): number[] {
  const result = new Array(generator.length - 1).fill(0)
  for (const byte of data) {
    const factor = byte ^ result[0]
    result.shift()
    result.push(0)
    if (factor === 0) continue
    for (let i = 0; i < result.length; i++) {
      result[i] ^= gfMul(generator[i + 1], factor)
    }
  }
  return result
}

function bitBuffer(): { bits: number[]; push(value: number, len: number): void } {
  const bits: number[] = []
  return {
    bits,
    push(value: number, len: number) {
      for (let i = len - 1; i >= 0; i--) bits.push((value >>> i) & 1)
    },
  }
}

function bitsToCodewords(bits: number[], count: number): number[] {
  const padded = bits.slice()
  const remainder = padded.length % 8
  if (remainder) for (let i = 0; i < 8 - remainder; i++) padded.push(0)
  const words: number[] = []
  for (let i = 0; i < padded.length && words.length < count; i += 8) {
    let value = 0
    for (let b = 0; b < 8; b++) value = (value << 1) | padded[i + b]
    words.push(value)
  }
  const pads = [0xec, 0x11]
  let padIndex = 0
  while (words.length < count) {
    words.push(pads[padIndex % 2])
    padIndex++
  }
  return words
}

function encodeData(text: string, version: number): number[] | null {
  const dataBytes = Array.from(new TextEncoder().encode(text))
  const total = TOTAL_CW[version - 1]
  const eccPerBlock = ECC_CW[version - 1]
  const numBlocks = ECC_BLOCKS[version - 1]
  const dataCount = total - eccPerBlock * numBlocks
  const charCountBits = version < 10 ? 8 : 16
  const headerBits = 4 + charCountBits
  const capacityBits = dataCount * 8
  if (dataBytes.length * 8 + headerBits + 4 > capacityBits) return null

  const buf = bitBuffer()
  buf.push(0b0100, 4)
  buf.push(dataBytes.length, charCountBits)
  for (const byte of dataBytes) buf.push(byte, 8)
  const terminator = Math.min(4, capacityBits - buf.bits.length)
  buf.push(0, terminator)

  const dataWords = bitsToCodewords(buf.bits, dataCount)
  const shortBlocks = numBlocks - (dataCount % numBlocks)
  const shortLen = Math.floor(dataCount / numBlocks)
  const generator = rsGenerator(eccPerBlock)

  const dataBlocks: number[][] = []
  const eccBlocks: number[][] = []
  let offset = 0
  for (let i = 0; i < numBlocks; i++) {
    const len = shortLen + (i < shortBlocks ? 0 : 1)
    const block = dataWords.slice(offset, offset + len)
    offset += len
    dataBlocks.push(block)
    eccBlocks.push(rsRemainder(block, generator))
  }

  const interleaved: number[] = []
  const maxData = shortLen + (shortBlocks === numBlocks ? 0 : 1)
  for (let i = 0; i < maxData; i++) {
    for (const block of dataBlocks) {
      if (i < block.length) interleaved.push(block[i])
    }
  }
  for (let i = 0; i < eccPerBlock; i++) {
    for (const block of eccBlocks) interleaved.push(block[i])
  }
  return interleaved
}

function moduleCount(version: number): number {
  return 21 + 4 * (version - 1)
}

function isFunction(size: number, version: number, row: number, col: number): boolean {
  if (row < 9 && col < 9) return true
  if (row < 9 && col >= size - 8) return true
  if (row >= size - 8 && col < 9) return true
  if (row === 6 || col === 6) return true
  const positions = ALIGN_POS[version - 1]
  for (const r of positions) {
    for (const c of positions) {
      if (Math.abs(row - r) <= 2 && Math.abs(col - c) <= 2) {
        if (!(r === 6 && c === 6) && !(r === 6 && c === size - 7) && !(c === 6 && r === size - 7)) {
          return true
        }
      }
    }
  }
  if (version >= 7) {
    if (row < 6 && col >= size - 11 && col <= size - 9) return true
    if (col < 6 && row >= size - 11 && row <= size - 9) return true
  }
  return false
}

function placeFinders(grid: number[][], size: number) {
  const draw = (r0: number, c0: number) => {
    for (let r = -1; r <= 7; r++) {
      for (let c = -1; c <= 7; c++) {
        const rr = r0 + r
        const cc = c0 + c
        if (rr < 0 || cc < 0 || rr >= size || cc >= size) continue
        const dark =
          r >= 0 && r <= 6 && c >= 0 && c <= 6 && (r === 0 || r === 6 || c === 0 || c === 6 || (r >= 2 && r <= 4 && c >= 2 && c <= 4))
        grid[rr][cc] = dark ? 1 : 0
      }
    }
  }
  draw(0, 0)
  draw(0, size - 7)
  draw(size - 7, 0)
}

function placeTiming(grid: number[][], size: number) {
  for (let i = 0; i < size; i++) {
    grid[6][i] = i % 2 === 0 ? 1 : 0
    grid[i][6] = i % 2 === 0 ? 1 : 0
  }
}

function placeAlignments(grid: number[][], version: number) {
  const positions = ALIGN_POS[version - 1]
  const size = grid.length
  for (const r of positions) {
    for (const c of positions) {
      if ((r === 6 && c === 6) || (r === 6 && c === size - 7) || (c === 6 && r === size - 7)) continue
      for (let dr = -2; dr <= 2; dr++) {
        for (let dc = -2; dc <= 2; dc++) {
          const dark = Math.max(Math.abs(dr), Math.abs(dc)) !== 1
          grid[r + dr][c + dc] = dark ? 1 : 0
        }
      }
    }
  }
}

function placeVersion(grid: number[][], version: number) {
  if (version < 7) return
  let rem = version
  for (let i = 0; i < 12; i++) {
    rem = (rem << 1) ^ ((rem >>> 11) * 0x1f25)
  }
  const data = (version << 12) | (rem & 0xfff)
  const size = grid.length
  for (let i = 0; i < 18; i++) {
    const bit = (data >> i) & 1
    const r = Math.floor(i / 3)
    const c = size - 11 + (i % 3)
    grid[r][c] = bit
    grid[c][r] = bit
  }
}

function maskFn(id: number, row: number, col: number): boolean {
  switch (id) {
    case 0:
      return (row + col) % 2 === 0
    case 1:
      return row % 2 === 0
    case 2:
      return col % 3 === 0
    case 3:
      return (row + col) % 3 === 0
    case 4:
      return (Math.floor(row / 2) + Math.floor(col / 3)) % 2 === 0
    case 5:
      return ((row * col) % 2) + ((row * col) % 3) === 0
    case 6:
      return (((row * col) % 2) + ((row * col) % 3)) % 2 === 0
    default:
      return (((row + col) % 2) + ((row * col) % 3)) % 2 === 0
  }
}

function placeData(grid: number[][], reserved: boolean[][], data: number[]) {
  const size = grid.length
  const bits: number[] = []
  for (const word of data) {
    for (let i = 7; i >= 0; i--) bits.push((word >> i) & 1)
  }
  let bitIndex = 0
  let upward = true
  for (let col = size - 1; col > 0; col -= 2) {
    if (col === 6) col--
    for (let i = 0; i < size; i++) {
      const row = upward ? size - 1 - i : i
      for (let dc = 0; dc < 2; dc++) {
        const c = col - dc
        if (reserved[row][c]) continue
        grid[row][c] = bits[bitIndex++] ?? 0
      }
    }
    upward = !upward
  }
}

function applyMask(grid: number[][], reserved: boolean[][], id: number) {
  const size = grid.length
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (!reserved[r][c] && maskFn(id, r, c)) grid[r][c] ^= 1
    }
  }
}

function placeFormat(grid: number[][], mask: number) {
  const size = grid.length
  const data = (0b00 << 3) | mask
  let rem = data
  for (let i = 0; i < 10; i++) {
    rem = (rem << 1) ^ ((rem >>> 9) * 0x537)
  }
  const format = ((data << 10) | (rem & 0x3ff)) ^ 0x5412
  const coords = [
    [0, 8], [1, 8], [2, 8], [3, 8], [4, 8], [5, 8], [7, 8], [8, 8],
    [8, 7], [8, 5], [8, 4], [8, 3], [8, 2], [8, 1], [8, 0],
  ]
  const coords2 = [
    [8, size - 1], [8, size - 2], [8, size - 3], [8, size - 4], [8, size - 5], [8, size - 6], [8, size - 7],
    [size - 8, 8], [size - 7, 8], [size - 6, 8], [size - 5, 8], [size - 4, 8], [size - 3, 8], [size - 2, 8], [size - 1, 8],
  ]
  for (let i = 0; i < 15; i++) {
    const bit = (format >> i) & 1
    grid[coords[i][0]][coords[i][1]] = bit
    grid[coords2[i][0]][coords2[i][1]] = bit
  }
  grid[size - 8][8] = 1
}

function penalty(grid: number[][]): number {
  const size = grid.length
  let score = 0
  for (let r = 0; r < size; r++) {
    let run = 1
    for (let c = 1; c <= size; c++) {
      if (c < size && grid[r][c] === grid[r][c - 1]) run++
      else {
        if (run >= 5) score += run - 2
        run = 1
      }
    }
  }
  for (let c = 0; c < size; c++) {
    let run = 1
    for (let r = 1; r <= size; r++) {
      if (r < size && grid[r][c] === grid[r - 1][c]) run++
      else {
        if (run >= 5) score += run - 2
        run = 1
      }
    }
  }
  for (let r = 0; r < size - 1; r++) {
    for (let c = 0; c < size - 1; c++) {
      const v = grid[r][c]
      if (v === grid[r][c + 1] && v === grid[r + 1][c] && v === grid[r + 1][c + 1]) score += 3
    }
  }
  const finder = [1, 0, 1, 1, 1, 0, 1]
  const hasFinder = (line: number[], start: number) => finder.every((bit, i) => line[start + i] === bit)
  for (let r = 0; r < size; r++) {
    const row = grid[r]
    for (let c = 0; c <= size - 7; c++) {
      if (hasFinder(row, c)) score += 40
    }
  }
  for (let c = 0; c < size; c++) {
    const col = grid.map((row) => row[c])
    for (let r = 0; r <= size - 7; r++) {
      if (hasFinder(col, r)) score += 40
    }
  }
  let dark = 0
  for (const row of grid) for (const cell of row) dark += cell
  const percent = (dark * 100) / (size * size)
  score += Math.floor(Math.abs(percent - 50) / 5) * 10
  return score
}

export function encodeQrMatrix(text: string): boolean[][] {
  let version = 0
  let data: number[] | null = null
  for (let v = 1; v <= 10; v++) {
    data = encodeData(text, v)
    if (data) {
      version = v
      break
    }
  }
  if (!data || !version) {
    throw new Error('Texto longo demais para o QR')
  }

  const size = moduleCount(version)
  const reserved = Array.from({ length: size }, () => Array<boolean>(size).fill(false))
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      reserved[r][c] = isFunction(size, version, r, c)
    }
  }

  let best: number[][] | null = null
  let bestScore = Infinity
  for (let mask = 0; mask < 8; mask++) {
    const grid = Array.from({ length: size }, () => Array<number>(size).fill(0))
    placeFinders(grid, size)
    placeTiming(grid, size)
    placeAlignments(grid, version)
    placeVersion(grid, version)
    placeData(grid, reserved, data)
    applyMask(grid, reserved, mask)
    placeFormat(grid, mask)
    const score = penalty(grid)
    if (score < bestScore) {
      bestScore = score
      best = grid
    }
  }

  return best!.map((row) => row.map((cell) => cell === 1))
}

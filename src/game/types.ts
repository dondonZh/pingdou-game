export type ColorId = 'plum' | 'lime' | 'bubblegum' | 'mint' | 'pearl'

export type BoardToken = '.' | 'p' | 'l' | 'b' | 'm' | 'w'

export interface BoardCell {
  baseColor: ColorId
  beadColor: ColorId | null
}

export type BoardMatrix = (BoardCell | null)[][]

export interface ToolState {
  magnet: number
  brush: number
  hourglass: number
}

export interface PlacementCell {
  row: number
  col: number
}

export interface PlacementRecord {
  color: ColorId
  cells: PlacementCell[]
  source: 'tray' | 'board'
  sourceCells?: PlacementCell[]
}

export interface LevelDefinition {
  id: number
  name: string
  badge: string
  story: string
  hint: string
  capacity: number
  timeLimit: number
  board: BoardToken[][]
}

export interface ColorMeta {
  id: ColorId
  name: string
  beadClass: string
  glowClass: string
  accent: string
}

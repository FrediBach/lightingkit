export type ShapeKind = 'arch' | 'circle' | 'rectangle' | 'triangle' | 'wave' | 'pill'
export type ViewMode = 'perspective' | 'front' | 'top'
export type Quality = 'standard' | 'high'
export interface KitElement {
  id: string
  shape: ShapeKind
  color: string
  row: number
  col: number
  rotation: number
  width: number
  height: number
}
export interface LightSettings {
  intensity: number
  ambient: number
  beamAngle: number
  speed: number
  playing: boolean
  rotation: number
  showBeam: boolean
  quality: Quality
}
export interface FabricationSettings {
  baseSize: number
  gridSize: number
  thickness: number
  kerf: number
  clearance: number
  sheetWidth: number
  sheetHeight: number
}
export interface Project {
  name: string
  elements: KitElement[]
  lighting: LightSettings
  fabrication: FabricationSettings
}
export const COLORS = [
  { name: 'Tangerine', hex: '#ff783e' },
  { name: 'Rose', hex: '#f0529c' },
  { name: 'Violet', hex: '#9163f0' },
  { name: 'Ocean', hex: '#429cf5' },
  { name: 'Mint', hex: '#53d6b0' },
  { name: 'Citron', hex: '#d6ef64' },
]
export const SHAPES: { kind: ShapeKind; name: string; description: string }[] = [
  { kind: 'arch', name: 'Arch', description: 'Soft, architectural light' },
  { kind: 'circle', name: 'Circle', description: 'A pool of saturated color' },
  { kind: 'rectangle', name: 'Rectangle', description: 'Clean lines, bold shadows' },
  { kind: 'triangle', name: 'Triangle', description: 'Angular and expressive' },
  { kind: 'wave', name: 'Wave', description: 'An organic silhouette' },
  { kind: 'pill', name: 'Capsule', description: 'Rounded, flowing forms' },
]
export const DEFAULT_PROJECT: Project = {
  name: 'Chromatic study',
  elements: [
    {
      id: 'el-1',
      shape: 'arch',
      color: '#ff783e',
      row: 1,
      col: 1,
      rotation: 0,
      width: 85,
      height: 150,
    },
    {
      id: 'el-2',
      shape: 'circle',
      color: '#f0529c',
      row: 2,
      col: 3,
      rotation: 0,
      width: 100,
      height: 100,
    },
    {
      id: 'el-3',
      shape: 'rectangle',
      color: '#9163f0',
      row: 3,
      col: 1,
      rotation: 90,
      width: 65,
      height: 170,
    },
    {
      id: 'el-4',
      shape: 'wave',
      color: '#429cf5',
      row: 1,
      col: 3,
      rotation: 90,
      width: 80,
      height: 135,
    },
    {
      id: 'el-5',
      shape: 'triangle',
      color: '#d6ef64',
      row: 3,
      col: 3,
      rotation: 0,
      width: 90,
      height: 145,
    },
  ],
  lighting: {
    intensity: 80,
    ambient: 12,
    beamAngle: 42,
    speed: 4,
    playing: true,
    rotation: 0,
    showBeam: true,
    quality: 'high',
  },
  fabrication: {
    baseSize: 300,
    gridSize: 5,
    thickness: 3,
    kerf: 0.15,
    clearance: 0.1,
    sheetWidth: 600,
    sheetHeight: 400,
  },
}

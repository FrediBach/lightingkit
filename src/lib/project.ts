import { DEFAULT_PROJECT, SHAPES } from './types'
import type { Project, ShapeKind } from './types'

export const PROJECT_STORAGE_KEY = 'lighting-kit-project-v1'

function record(value: unknown, label: string): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label} must be an object.`)
  }
  return value as Record<string, unknown>
}

function number(value: unknown, label: string, min: number, max: number, integer = false): number {
  if (
    typeof value !== 'number' ||
    !Number.isFinite(value) ||
    value < min ||
    value > max ||
    (integer && !Number.isInteger(value))
  ) {
    throw new Error(
      `${label} must be ${integer ? 'a whole number' : 'a number'} between ${min} and ${max}.`,
    )
  }
  return value
}

function boolean(value: unknown, label: string): boolean {
  if (typeof value !== 'boolean') throw new Error(`${label} must be true or false.`)
  return value
}

/** Reads only the supported schema; unknown properties never enter application state. */
export function validateProject(value: unknown): Project {
  const input = record(value, 'Project')
  if (typeof input.name !== 'string' || !input.name.trim() || input.name.length > 80) {
    throw new Error('Project name must contain 1–80 characters.')
  }
  const lighting = record(input.lighting, 'Lighting')
  const fabrication = record(input.fabrication, 'Fabrication settings')
  const gridSize = number(fabrication.gridSize, 'Grid size', 3, 7, true)
  if (!Array.isArray(input.elements) || input.elements.length > 25) {
    throw new Error('A project can contain up to 25 elements.')
  }
  const slots = new Set<string>()
  const ids = new Set<string>()
  const elements = input.elements.map((value, index) => {
    const element = record(value, `Element ${index + 1}`)
    if (
      typeof element.id !== 'string' ||
      !/^[a-zA-Z0-9_-]{1,100}$/.test(element.id) ||
      ids.has(element.id)
    ) {
      throw new Error(`Element ${index + 1} needs a unique, valid ID.`)
    }
    ids.add(element.id)
    if (!SHAPES.some((shape) => shape.kind === element.shape))
      throw new Error(`Element ${index + 1} has an unsupported shape.`)
    if (typeof element.color !== 'string' || !/^#[a-fA-F0-9]{6}$/.test(element.color)) {
      throw new Error(`Element ${index + 1} needs a six-digit hex color.`)
    }
    const row = number(element.row, `Element ${index + 1} row`, 0, gridSize - 1, true)
    const col = number(element.col, `Element ${index + 1} column`, 0, gridSize - 1, true)
    const slot = `${row}:${col}`
    if (slots.has(slot)) throw new Error('Each grid slot can hold only one element.')
    slots.add(slot)
    const rotation = number(element.rotation, `Element ${index + 1} rotation`, 0, 270)
    if (rotation % 90 !== 0) throw new Error('Element orientation must be 0°, 90°, 180°, or 270°.')
    return {
      id: element.id,
      shape: element.shape as ShapeKind,
      color: element.color.toLowerCase(),
      row,
      col,
      rotation,
      width: number(element.width, `Element ${index + 1} width`, 20, 300),
      height: number(element.height, `Element ${index + 1} height`, 20, 400),
    }
  })
  if (lighting.quality !== 'standard' && lighting.quality !== 'high')
    throw new Error('Preview quality must be standard or high.')
  return {
    name: input.name.trim(),
    elements,
    lighting: {
      intensity: number(lighting.intensity, 'Spotlight intensity', 0, 100),
      ambient: number(lighting.ambient, 'Room light', 0, 100),
      beamAngle: number(lighting.beamAngle, 'Beam angle', 10, 100),
      speed: number(lighting.speed, 'Rotation speed', 0, 20),
      playing: boolean(lighting.playing, 'Rotation playback'),
      rotation: number(lighting.rotation, 'Rotation angle', 0, 360),
      showBeam: boolean(lighting.showBeam, 'Beam visibility'),
      quality: lighting.quality,
    },
    fabrication: {
      baseSize: number(fabrication.baseSize, 'Base size', 100, 1000),
      gridSize,
      thickness: number(fabrication.thickness, 'Acrylic thickness', 1, 12),
      kerf: number(fabrication.kerf, 'Laser kerf', 0, 1),
      clearance: number(fabrication.clearance, 'Slot clearance', 0, 1),
      sheetWidth: number(fabrication.sheetWidth, 'Sheet width', 100, 3000),
      sheetHeight: number(fabrication.sheetHeight, 'Sheet height', 100, 3000),
    },
  }
}

export function parseProject(text: string): Project {
  if (text.length > 100_000) throw new Error('This file is too large to be a Lighting Kit project.')
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    throw new Error('This file is not valid JSON. Choose a Lighting Kit project file.')
  }
  return validateProject(data)
}

export function serializeProject(project: Project): string {
  return JSON.stringify(validateProject(project), null, 2)
}

export function createDefaultProject(reducedMotion = false): Project {
  const project = structuredClone(DEFAULT_PROJECT)
  if (reducedMotion) project.lighting.playing = false
  return project
}

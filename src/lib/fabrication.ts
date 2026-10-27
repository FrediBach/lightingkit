import { getPanelOutline, pointsToPath, type Point } from './shapes'
import { COLORS, SHAPES, type FabricationSettings, type KitElement } from './types'

export type { Point } from './shapes'
export interface CutPart {
  id: string
  label: string
  x: number
  y: number
  width: number
  height: number
  contours: Point[][]
  isBase: boolean
}
export interface CutSheet {
  id: string
  label: string
  material: string
  color: string
  width: number
  height: number
  thickness: number
  kerf: number
  parts: CutPart[]
}
export interface CutPlan {
  sheets: CutSheet[]
  warnings: string[]
  pieceCount: number
}

const MARGIN = 10
const GAP = 8
const n = (value: number) => Number(value.toFixed(4))
const escapeXML = (value: string) =>
  value.replace(
    /[<>&"']/g,
    (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' })[c]!,
  )

function rectangle(x: number, y: number, width: number, height: number): Point[] {
  return [
    { x, y },
    { x: x + width, y },
    { x: x + width, y: y + height },
    { x, y: y + height },
  ]
}

/** Miter-offset a simple clockwise polygon. Positive distance expands an outline. */
export function offsetContour(points: Point[], distance: number): Point[] {
  if (!distance) return points.map((point) => ({ ...point }))
  const signedArea = points.reduce((area, a, i) => {
    const b = points[(i + 1) % points.length]
    return area + a.x * b.y - b.x * a.y
  }, 0)
  const direction = signedArea > 0 ? 1 : -1
  return points.map((point, index) => {
    const previous = points[(index + points.length - 1) % points.length]
    const next = points[(index + 1) % points.length]
    const a = { x: point.x - previous.x, y: point.y - previous.y }
    const b = { x: next.x - point.x, y: next.y - point.y }
    const aLength = Math.hypot(a.x, a.y)
    const bLength = Math.hypot(b.x, b.y)
    const an = { x: (direction * a.y) / aLength, y: (-direction * a.x) / aLength }
    const bn = { x: (direction * b.y) / bLength, y: (-direction * b.x) / bLength }
    const denominator = 1 + an.x * bn.x + an.y * bn.y
    if (Math.abs(denominator) < 1e-8)
      throw new Error('This outline has an uncuttable sharp corner.')
    return {
      x: point.x + (distance * (an.x + bn.x)) / denominator,
      y: point.y + (distance * (an.y + bn.y)) / denominator,
    }
  })
}

function bounds(contours: Point[][]) {
  const points = contours.flat()
  const x = Math.min(...points.map((point) => point.x))
  const y = Math.min(...points.map((point) => point.y))
  return {
    x,
    y,
    width: Math.max(...points.map((point) => point.x)) - x,
    height: Math.max(...points.map((point) => point.y)) - y,
  }
}

function assertPositive(value: number, label: string) {
  if (!Number.isFinite(value) || value <= 0) throw new Error(`${label} must be a positive number.`)
}

function validate(elements: KitElement[], settings: FabricationSettings) {
  for (const [key, label] of [
    ['baseSize', 'Base size'],
    ['thickness', 'Material thickness'],
    ['sheetWidth', 'Sheet width'],
    ['sheetHeight', 'Sheet height'],
  ] as const)
    assertPositive(settings[key], label)
  if (settings.thickness < 1 || settings.thickness > 12)
    throw new Error('Acrylic thickness must be between 1 and 12 mm.')
  if (!Number.isInteger(settings.gridSize) || settings.gridSize < 2 || settings.gridSize > 12)
    throw new Error('Use a grid size between 2 and 12.')
  if (
    !Number.isFinite(settings.kerf) ||
    settings.kerf < 0 ||
    settings.kerf > 1 ||
    settings.kerf >= settings.thickness / 2
  )
    throw new Error('Kerf must be between 0 and 1 mm, and less than half the material thickness.')
  if (!Number.isFinite(settings.clearance) || settings.clearance < 0 || settings.clearance > 1)
    throw new Error('Slot clearance must be between 0 and 1 mm.')
  const slotSize = settings.thickness + settings.clearance
  const spacing = settings.baseSize / (settings.gridSize + 1)
  if (slotSize >= spacing - 2)
    throw new Error('The base grid needs at least 2 mm of material between slots.')
  const occupied = new Set<string>()
  for (const element of elements) {
    assertPositive(element.width, 'Element width')
    assertPositive(element.height, 'Element height')
    if (!SHAPES.some((shape) => shape.kind === element.shape))
      throw new Error('An element has an unknown shape.')
    if (!/^#[0-9a-f]{6}$/i.test(element.color))
      throw new Error('Element colors must use six-digit hex values.')
    if (element.width < settings.thickness * 3 || element.height < settings.thickness * 3)
      throw new Error(
        'Each element must be at least three times the material thickness in both dimensions.',
      )
    if (
      !Number.isInteger(element.row) ||
      !Number.isInteger(element.col) ||
      element.row < 0 ||
      element.col < 0 ||
      element.row >= settings.gridSize ||
      element.col >= settings.gridSize
    )
      throw new Error('An element is outside the base grid.')
    if (!Number.isFinite(element.rotation) || Math.abs(element.rotation % 90) > 1e-6)
      throw new Error('Square mounting slots support element orientations in 90° steps.')
    const slot = `${element.row}:${element.col}`
    if (occupied.has(slot)) throw new Error('Place only one element in each base slot.')
    occupied.add(slot)
  }
}

function collisionWarnings(elements: KitElement[], settings: FabricationSettings): string[] {
  const spacing = settings.baseSize / (settings.gridSize + 1)
  const footprints = elements.map((element) => {
    const horizontal = element.rotation % 180 === 0
    return {
      x: element.col * spacing,
      y: element.row * spacing,
      halfWidth: (horizontal ? element.width : settings.thickness) / 2,
      halfDepth: (horizontal ? settings.thickness : element.width) / 2,
      slot: `${String.fromCharCode(65 + element.row)}${element.col + 1}`,
    }
  })
  const intersections: string[] = []
  for (let i = 0; i < footprints.length; i++)
    for (let j = i + 1; j < footprints.length; j++) {
      const a = footprints[i]
      const b = footprints[j]
      const overlapX = a.halfWidth + b.halfWidth - Math.abs(a.x - b.x)
      const overlapY = a.halfDepth + b.halfDepth - Math.abs(a.y - b.y)
      if (overlapX > 1e-6 && overlapY > 1e-6) intersections.push(`${a.slot} / ${b.slot}`)
    }
  if (!intersections.length) return []
  const pairs = intersections.slice(0, 4).join(', ')
  const more = intersections.length > 4 ? `, plus ${intersections.length - 4} more` : ''
  // These are conservative bounds: rounded silhouettes can leave clearance at
  // a particular height. Warn, rather than block a potentially valid design.
  return [
    `Possible panel collisions at ${pairs}${more}. Their footprints overlap; check the assembly, move the panels apart, reduce their widths, or change their orientation.`,
  ]
}

/** Each material gets separate, bounded sheets; coordinates describe the tool centreline. */
export function buildCutPlan(elements: KitElement[], settings: FabricationSettings): CutPlan {
  validate(elements, settings)
  const halfKerf = settings.kerf / 2
  const slotSize = settings.thickness + settings.clearance
  const spacing = settings.baseSize / (settings.gridSize + 1)
  const holes = Array.from({ length: settings.gridSize ** 2 }, (_, i) => {
    const x = ((i % settings.gridSize) + 1) * spacing
    const y = (Math.floor(i / settings.gridSize) + 1) * spacing
    return offsetContour(
      rectangle(x - slotSize / 2, y - slotSize / 2, slotSize, slotSize),
      -halfKerf,
    )
  })
  const baseContours = [
    offsetContour(rectangle(0, 0, settings.baseSize, settings.baseSize), halfKerf),
    ...holes,
  ]
  const base: CutPart = {
    id: 'base',
    label: `${settings.baseSize} × ${settings.baseSize} mm base`,
    ...bounds(baseContours),
    contours: baseContours,
    isBase: true,
  }
  const groups = new Map<string, { label: string; color: string; parts: CutPart[] }>()
  groups.set('clear', { label: 'Clear acrylic', color: '#aab8b6', parts: [base] })
  elements.forEach((element, index) => {
    const color = element.color.toLowerCase()
    const colorName = COLORS.find((entry) => entry.hex.toLowerCase() === color)?.name ?? color
    const shapeName = SHAPES.find((shape) => shape.kind === element.shape)?.name ?? element.shape
    if (!groups.has(color)) groups.set(color, { label: `${colorName} acrylic`, color, parts: [] })
    const contour = offsetContour(
      getPanelOutline(
        element.shape,
        element.width,
        element.height,
        settings.thickness,
        settings.thickness,
      ),
      halfKerf,
    )
    groups.get(color)!.parts.push({
      id: element.id,
      label: `${String(index + 1).padStart(2, '0')} · ${shapeName}`,
      ...bounds([contour]),
      contours: [contour],
      isBase: false,
    })
  })
  const sheets: CutSheet[] = []
  for (const [key, group] of groups) {
    let sheet: CutSheet | null = null
    let cursorX = MARGIN
    let cursorY = MARGIN
    let rowHeight = 0
    let sheetNumber = 0
    const newSheet = (): CutSheet => {
      sheetNumber++
      const result: CutSheet = {
        id: `${key.replace('#', '')}-${sheetNumber}`,
        label: `${group.label} · ${sheetNumber}`,
        material: group.label,
        color: group.color,
        width: settings.sheetWidth,
        height: settings.sheetHeight,
        thickness: settings.thickness,
        kerf: settings.kerf,
        parts: [],
      }
      sheets.push(result)
      cursorX = MARGIN
      cursorY = MARGIN
      rowHeight = 0
      return result
    }
    // Largest-first shelf packing is deterministic and keeps every part inside the sheet.
    for (const part of [...group.parts].sort((a, b) => b.height - a.height || b.width - a.width)) {
      if (
        part.width > settings.sheetWidth - MARGIN * 2 ||
        part.height > settings.sheetHeight - MARGIN * 2
      )
        throw new Error(
          `${part.label} does not fit a ${settings.sheetWidth} × ${settings.sheetHeight} mm sheet with 10 mm margins. Increase the sheet dimensions.`,
        )
      if (!sheet) sheet = newSheet()
      if (cursorX + part.width > settings.sheetWidth - MARGIN) {
        cursorX = MARGIN
        cursorY += rowHeight + GAP
        rowHeight = 0
      }
      if (cursorY + part.height > settings.sheetHeight - MARGIN) sheet = newSheet()
      const translated = part.contours.map((contour) =>
        contour.map((point) => ({ x: point.x - part.x + cursorX, y: point.y - part.y + cursorY })),
      )
      sheet.parts.push({ ...part, x: cursorX, y: cursorY, contours: translated })
      cursorX += part.width + GAP
      rowHeight = Math.max(rowHeight, part.height)
    }
  }
  const warnings: string[] = collisionWarnings(elements, settings)
  if (elements.length === 0)
    warnings.push(
      'The plan contains only the base plate. Add elements to include colored acrylic pieces.',
    )
  if (settings.clearance === 0)
    warnings.push(
      'Zero slot clearance creates a nominal press fit; check the fit on a material offcut.',
    )
  return { sheets, warnings, pieceCount: elements.length + 1 }
}

/** Red, closed hairline paths only. Preview labels are never included in cutter exports. */
export function generateSVG(sheet: CutSheet, options: { preview?: boolean } = {}): string {
  const preview = options.preview ?? false
  const paths = sheet.parts
    .map((part) => {
      const path = part.contours.map(pointsToPath).join(' ')
      const label = preview
        ? `<text x="${n(part.x + part.width / 2)}" y="${n(Math.max(6, part.y - 3))}" text-anchor="middle" fill="#64716d" font-size="4" font-family="sans-serif">${escapeXML(part.label)}</text>`
        : ''
      return `<path id="${escapeXML(part.id)}" d="${path}" fill="${preview ? sheet.color : 'none'}" fill-opacity="${preview ? '0.18' : '1'}" fill-rule="evenodd" stroke="${preview ? sheet.color : '#ff0000'}" stroke-width="${preview ? '0.5' : '0.01'}"/>${label}`
    })
    .join('\n')
  return `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" width="${n(sheet.width)}mm" height="${n(sheet.height)}mm" viewBox="0 0 ${n(sheet.width)} ${n(sheet.height)}">\n<title>${escapeXML(sheet.label)}</title>\n<desc>${sheet.thickness} mm acrylic; ${sheet.kerf} mm kerf already compensated; cut at 1:1 scale; red paths are cut centre lines.</desc>\n${preview ? `<rect width="100%" height="100%" fill="#f4f6ee"/>` : ''}\n${paths}\n</svg>`
}

/** AutoCAD 2000 ASCII DXF, millimetres; closed lightweight polylines on CUT. */
export function generateDXF(sheet: CutSheet): string {
  const lines: (string | number)[] = [
    0,
    'SECTION',
    2,
    'HEADER',
    9,
    '$ACADVER',
    1,
    'AC1015',
    9,
    '$INSUNITS',
    70,
    4,
    9,
    '$MEASUREMENT',
    70,
    1,
    0,
    'ENDSEC',
    0,
    'SECTION',
    2,
    'TABLES',
    0,
    'TABLE',
    2,
    'LAYER',
    70,
    1,
    0,
    'LAYER',
    100,
    'AcDbSymbolTableRecord',
    100,
    'AcDbLayerTableRecord',
    2,
    'CUT',
    70,
    0,
    62,
    1,
    6,
    'CONTINUOUS',
    0,
    'ENDTAB',
    0,
    'ENDSEC',
    0,
    'SECTION',
    2,
    'ENTITIES',
  ]
  for (const part of sheet.parts) {
    // Holes are written before outer boundaries so CAM users can keep parts supported.
    for (const contour of [...part.contours.slice(1), part.contours[0]]) {
      lines.push(
        0,
        'LWPOLYLINE',
        100,
        'AcDbEntity',
        8,
        'CUT',
        100,
        'AcDbPolyline',
        90,
        contour.length,
        70,
        1,
      )
      for (const point of contour) lines.push(10, n(point.x), 20, n(sheet.height - point.y))
    }
  }
  lines.push(0, 'ENDSEC', 0, 'EOF')
  return lines.join('\r\n') + '\r\n'
}

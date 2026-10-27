import assert from 'node:assert/strict'
import test from 'node:test'
import { buildCutPlan, generateDXF, generateSVG } from './fabrication'
import { getPanelOutline, type Point } from './shapes'
import { DEFAULT_PROJECT, SHAPES } from './types'

const settings = DEFAULT_PROJECT.fabrication
const elements = DEFAULT_PROJECT.elements
const width = (points: Point[]) =>
  Math.max(...points.map((p) => p.x)) - Math.min(...points.map((p) => p.x))

test('base has every grid slot and compensates holes inward, exterior outward', () => {
  const base = buildCutPlan(elements, settings).sheets[0].parts[0]
  assert.equal(base.contours.length, settings.gridSize ** 2 + 1)
  assert.ok(Math.abs(width(base.contours[0]) - (settings.baseSize + settings.kerf)) < 1e-8)
  assert.ok(
    Math.abs(width(base.contours[1]) - (settings.thickness + settings.clearance - settings.kerf)) <
      1e-8,
  )
})

test('all shapes have a single connected outline with a full-depth mounting tab', () => {
  for (const { kind } of SHAPES) {
    const outline = getPanelOutline(kind, 80, 140, 3, 3)
    const bottom = outline.filter((p) => p.y === 143)
    assert.equal(bottom.length, 2, kind)
    assert.equal(width(bottom), 3, kind)
    assert.ok(
      outline.every((point) => Number.isFinite(point.x) && Number.isFinite(point.y)),
      kind,
    )
    for (let i = 0; i < outline.length; i++) {
      const next = outline[(i + 1) % outline.length]
      assert.ok(
        Math.hypot(outline[i].x - next.x, outline[i].y - next.y) > 1e-7,
        `${kind} has duplicate vertices`,
      )
    }
  }
})

test('sheets separate colors and contain every compensated contour within margins', () => {
  const plan = buildCutPlan(elements, settings)
  assert.equal(plan.pieceCount, 6)
  assert.equal(plan.sheets.length, 6)
  assert.equal(plan.sheets.flatMap((sheet) => sheet.parts).length, 6)
  for (const sheet of plan.sheets) {
    for (const point of sheet.parts.flatMap((part) => part.contours.flat())) {
      assert.ok(point.x >= 10 - 1e-8 && point.x <= sheet.width - 10 + 1e-8)
      assert.ok(point.y >= 10 - 1e-8 && point.y <= sheet.height - 10 + 1e-8)
    }
  }
})

test('packing creates new sheets rather than overflowing', () => {
  const repeated = Array.from({ length: 25 }, (_, i) => ({
    ...elements[0],
    id: `test-${i}`,
    row: Math.floor(i / 5),
    col: i % 5,
    width: 140,
    height: 180,
  }))
  const plan = buildCutPlan(repeated, { ...settings, sheetWidth: 340, sheetHeight: 340 })
  assert.equal(plan.sheets.flatMap((sheet) => sheet.parts).length, 26)
  assert.ok(plan.sheets.length > 2)
  for (const sheet of plan.sheets)
    for (const part of sheet.parts) {
      assert.ok(part.x + part.width <= sheet.width - 10 + 1e-8)
      assert.ok(part.y + part.height <= sheet.height - 10 + 1e-8)
    }
})

test('SVG exports explicit millimetres with cut paths and no engraving labels', () => {
  const sheet = buildCutPlan(elements, settings).sheets[0]
  const svg = generateSVG(sheet)
  assert.match(svg, /width="600mm" height="400mm"/)
  assert.match(svg, /viewBox="0 0 600 400"/)
  assert.match(svg, /stroke="#ff0000" stroke-width="0.01"/)
  assert.doesNotMatch(svg, /<text/)
  assert.equal((svg.match(/ Z/g) ?? []).length, 26)
  assert.match(generateSVG(sheet, { preview: true }), /<text/)
})

test('DXF sets millimetres and writes every contour as a closed polyline', () => {
  const dxf = generateDXF(buildCutPlan(elements, settings).sheets[0])
  assert.match(dxf, /\$INSUNITS\r\n70\r\n4/)
  assert.equal((dxf.match(/LWPOLYLINE/g) ?? []).length, 26)
  assert.equal((dxf.match(/90\r\n4\r\n70\r\n1/g) ?? []).length, 26)
  assert.ok(dxf.endsWith('EOF\r\n'))
})

test('invalid manufacturing dimensions, occupied slots, and impossible fits are rejected', () => {
  assert.throws(() => buildCutPlan(elements, { ...settings, sheetWidth: 200 }), /does not fit/)
  assert.throws(() => buildCutPlan(elements, { ...settings, kerf: 2 }), /Kerf/)
  assert.throws(() => buildCutPlan(elements, { ...settings, thickness: NaN }), /positive number/)
  assert.throws(() => buildCutPlan([{ ...elements[0], rotation: 45 }], settings), /90°/)
  assert.throws(
    () => buildCutPlan([elements[0], { ...elements[0], id: 'duplicate' }], settings),
    /one element/,
  )
  assert.throws(() => buildCutPlan(elements, { ...settings, thickness: 13 }), /between 1 and 12/)
  assert.throws(() => buildCutPlan(elements, { ...settings, clearance: 1.1 }), /between 0 and 1/)
})

test('intersecting panel footprints produce a nonblocking assembly warning', () => {
  const panels = [
    { ...elements[0], shape: 'rectangle' as const, row: 1, col: 1, rotation: 0, width: 85 },
    {
      ...elements[0],
      id: 'second',
      shape: 'rectangle' as const,
      row: 1,
      col: 2,
      rotation: 0,
      width: 85,
    },
  ]
  const plan = buildCutPlan(panels, settings)
  assert.equal(plan.pieceCount, 3)
  assert.match(plan.warnings.join(' '), /Possible panel collisions at B2 \/ B3/)
  assert.ok(plan.sheets.length > 0, 'collisions should not disable exports')
  const rotated = buildCutPlan(
    panels.map((panel) => ({ ...panel, rotation: 90 })),
    settings,
  )
  assert.equal(rotated.warnings.length, 0)
})

test('collision warnings account for material thickness and quarter-turn orientation', () => {
  const panels = [
    { ...elements[0], row: 1, col: 1, rotation: 180, width: 98 },
    { ...elements[0], id: 'second', row: 1, col: 2, rotation: 270, width: 80 },
  ]
  assert.match(buildCutPlan(panels, settings).warnings.join(' '), /Possible panel collisions/)
  assert.equal(buildCutPlan(panels, { ...settings, thickness: 1 }).warnings.length, 0)
})

test('touching edges and panels in distinct parallel rows do not warn', () => {
  const a = { ...elements[0], row: 1, col: 1, rotation: 0, width: 50 }
  const b = { ...a, id: 'second', col: 2 }
  assert.equal(buildCutPlan([a, b], settings).warnings.length, 0)
  assert.equal(
    buildCutPlan(
      [
        { ...a, width: 150 },
        { ...b, row: 2, col: 1, width: 150 },
      ],
      settings,
    ).warnings.length,
    0,
  )
})

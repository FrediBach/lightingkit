import assert from 'node:assert/strict'
import test from 'node:test'
import { createDefaultProject, parseProject, serializeProject, validateProject } from './project'

test('saved projects round-trip without losing material or lighting settings', () => {
  const project = createDefaultProject()
  project.fabrication.kerf = 0.22
  project.lighting.ambient = 37
  project.elements[0].rotation = 270
  assert.deepEqual(parseProject(serializeProject(project)), project)
})

test('malformed and oversized project files produce actionable errors', () => {
  assert.throws(() => parseProject('not json'), /not valid JSON/)
  assert.throws(() => parseProject(' '.repeat(100_001)), /too large/)
  assert.throws(() => validateProject(null), /Project must be an object/)
})

test('rejects duplicate slots, duplicate IDs, and out-of-grid placements', () => {
  const overlap = createDefaultProject()
  overlap.elements[1].row = overlap.elements[0].row
  overlap.elements[1].col = overlap.elements[0].col
  assert.throws(() => validateProject(overlap), /only one element/)
  const duplicate = createDefaultProject()
  duplicate.elements[1].id = duplicate.elements[0].id
  assert.throws(() => validateProject(duplicate), /unique, valid ID/)
  const outside = createDefaultProject()
  outside.elements[0].row = 5
  assert.throws(() => validateProject(outside), /row must be a whole number/)
})

test('rejects non-finite and unsafe dimensions before they reach geometry', () => {
  for (const width of [NaN, Infinity, -30, 0, 301]) {
    const project = createDefaultProject()
    project.elements[0].width = width
    assert.throws(() => validateProject(project), /width must be a number/)
  }
  const invalid = createDefaultProject()
  invalid.fabrication.thickness = 0
  assert.throws(() => validateProject(invalid), /Acrylic thickness/)
})

test('rejects arbitrary orientations incompatible with keyed square slots', () => {
  const project = createDefaultProject()
  project.elements[0].rotation = 45
  assert.throws(() => validateProject(project), /orientation/)
})

test('rejects unsupported colors, shapes, and lighting settings', () => {
  const project = createDefaultProject()
  project.elements[0].color = 'url(https://example.org/image.svg)'
  assert.throws(() => validateProject(project), /six-digit hex color/)
  const shape = {
    ...createDefaultProject(),
    elements: [{ ...createDefaultProject().elements[0], shape: 'unknown' }],
  }
  assert.throws(() => validateProject(shape), /unsupported shape/)
  const lighting = createDefaultProject()
  lighting.lighting.intensity = 101
  assert.throws(() => validateProject(lighting), /Spotlight intensity/)
})

test('imports supported fields without retaining injected or unknown properties', () => {
  const input = { ...createDefaultProject(), unknown: '<script>alert(1)</script>' }
  const result = validateProject(input)
  assert.equal(Object.hasOwn(result, 'unknown'), false)
})

test('default projects are independent and honor reduced motion', () => {
  const first = createDefaultProject(true)
  const second = createDefaultProject()
  first.elements[0].width = 200
  assert.equal(first.lighting.playing, false)
  assert.equal(second.elements[0].width, 85)
  assert.equal(second.lighting.playing, true)
})

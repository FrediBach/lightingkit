import assert from 'node:assert/strict'
import test from 'node:test'
import { createDefaultProject } from './project'
import { reduceProjectHistory, type ProjectHistory, type ProjectUpdate } from './project-history'

function initial(): ProjectHistory {
  return { past: [], present: createDefaultProject(), future: [], initialSaveState: 'saved' }
}
function update(history: ProjectHistory, next: ProjectUpdate, time: number) {
  return reduceProjectHistory(history, { type: 'update', update: next, time })
}

test('a continuous slider gesture undoes and redoes as one action', () => {
  let state = initial()
  for (let value = 20; value < 100; value++)
    state = update(
      state,
      (p) => ({ ...p, lighting: { ...p.lighting, intensity: value } }),
      value * 30,
    )
  assert.equal(state.past.length, 1)
  state = reduceProjectHistory(state, { type: 'undo' })
  assert.equal(state.present.lighting.intensity, 80)
  state = reduceProjectHistory(state, { type: 'redo' })
  assert.equal(state.present.lighting.intensity, 99)
})

test('separate gestures and edits to another field retain distinct undo steps', () => {
  let state = update(initial(), (p) => ({ ...p, lighting: { ...p.lighting, intensity: 30 } }), 1000)
  state = update(state, (p) => ({ ...p, lighting: { ...p.lighting, intensity: 40 } }), 1500)
  state = update(state, (p) => ({ ...p, lighting: { ...p.lighting, ambient: 50 } }), 1600)
  assert.equal(state.past.length, 3)
  state = reduceProjectHistory(state, { type: 'undo' })
  assert.equal(state.present.lighting.ambient, 12)
  assert.equal(state.present.lighting.intensity, 40)
  state = reduceProjectHistory(state, { type: 'undo' })
  assert.equal(state.present.lighting.intensity, 30)
})

test('structural edits, orientation changes, and different elements never coalesce', () => {
  let state = update(
    initial(),
    (p) => ({ ...p, elements: p.elements.map((e, i) => (i === 0 ? { ...e, width: 100 } : e)) }),
    1000,
  )
  state = update(
    state,
    (p) => ({ ...p, elements: p.elements.map((e, i) => (i === 1 ? { ...e, width: 110 } : e)) }),
    1050,
  )
  state = update(
    state,
    (p) => ({ ...p, elements: p.elements.map((e, i) => (i === 1 ? { ...e, rotation: 90 } : e)) }),
    1100,
  )
  state = update(
    state,
    (p) => ({ ...p, elements: p.elements.map((e, i) => (i === 1 ? { ...e, rotation: 180 } : e)) }),
    1150,
  )
  state = update(state, (p) => ({ ...p, elements: p.elements.slice(1) }), 1200)
  state = update(state, (p) => ({ ...p, elements: p.elements.slice(1) }), 1250)
  assert.equal(state.past.length, 6)
  state = reduceProjectHistory(state, { type: 'undo' })
  assert.equal(state.present.elements.length, 4)
})

test('editing after undo starts a new action and discards the redo branch', () => {
  let state = update(initial(), (p) => ({ ...p, lighting: { ...p.lighting, intensity: 30 } }), 1000)
  state = reduceProjectHistory(state, { type: 'undo' })
  state = update(state, (p) => ({ ...p, lighting: { ...p.lighting, intensity: 60 } }), 1100)
  assert.equal(state.future.length, 0)
  assert.equal(state.past.length, 1)
  assert.equal(reduceProjectHistory(state, { type: 'undo' }).present.lighting.intensity, 80)
})

test('imports remain distinct even if their only change is a recently edited field', () => {
  let state = update(initial(), (p) => ({ ...p, lighting: { ...p.lighting, intensity: 30 } }), 1000)
  state = reduceProjectHistory(state, {
    type: 'update',
    update: (p) => ({ ...p, lighting: { ...p.lighting, intensity: 40 } }),
    time: 1100,
    coalesce: false,
  })
  assert.equal(state.past.length, 2)
})

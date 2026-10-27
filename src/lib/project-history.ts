import type { Project } from './types'

export type ProjectUpdate = Project | ((project: Project) => Project)
export type SaveState = 'saved' | 'saving' | 'error'
export interface ProjectHistory {
  past: Project[]
  present: Project
  future: Project[]
  initialSaveState: SaveState
  lastEdit?: { field: string; time: number }
}
export type HistoryAction =
  | { type: 'update'; update: ProjectUpdate; time: number; coalesce?: boolean }
  | { type: 'undo' }
  | { type: 'redo' }

const HISTORY_LIMIT = 60
const COALESCE_WINDOW = 400

/** Return one scalar edit path, stopping early for any structural/multi-field edit. */
function singleChangedField(previous: Project, next: Project): string | undefined {
  const changes: string[] = []
  function compare(a: unknown, b: unknown, path: string) {
    if (Object.is(a, b) || changes.length > 1) return
    if (a !== null && b !== null && typeof a === 'object' && typeof b === 'object') {
      if (Array.isArray(a) !== Array.isArray(b)) {
        changes.push('structure', 'structure')
        return
      }
      const aKeys = Object.keys(a)
      const bKeys = Object.keys(b)
      if (aKeys.length !== bKeys.length || aKeys.some((key) => !Object.hasOwn(b, key))) {
        changes.push('structure', 'structure')
        return
      }
      for (const key of aKeys)
        compare(
          (a as Record<string, unknown>)[key],
          (b as Record<string, unknown>)[key],
          path ? `${path}.${key}` : key,
        )
      return
    }
    changes.push(path)
  }
  compare(previous, next, '')
  if (changes.length !== 1) return undefined
  const field = changes[0]
  if (
    /^lighting\.(intensity|ambient|beamAngle|speed|rotation)$/.test(field) ||
    /^fabrication\.(baseSize|thickness|kerf|clearance|sheetWidth|sheetHeight)$/.test(field) ||
    field === 'name'
  )
    return field
  const elementField = /^elements\.(\d+)\.(width|height)$/.exec(field)
  if (elementField) return `element.${next.elements[Number(elementField[1])].id}.${elementField[2]}`
  return undefined
}

export function reduceProjectHistory(
  history: ProjectHistory,
  action: HistoryAction,
): ProjectHistory {
  if (action.type === 'undo') {
    const previous = history.past.at(-1)
    if (!previous) return { ...history, lastEdit: undefined }
    return {
      ...history,
      past: history.past.slice(0, -1),
      present: previous,
      future: [history.present, ...history.future],
      lastEdit: undefined,
    }
  }
  if (action.type === 'redo') {
    const next = history.future[0]
    if (!next) return { ...history, lastEdit: undefined }
    return {
      ...history,
      past: [...history.past, history.present].slice(-HISTORY_LIMIT),
      present: next,
      future: history.future.slice(1),
      lastEdit: undefined,
    }
  }
  const next = typeof action.update === 'function' ? action.update(history.present) : action.update
  if (JSON.stringify(next) === JSON.stringify(history.present)) return history
  const field = action.coalesce === false ? undefined : singleChangedField(history.present, next)
  const elapsed = action.time - (history.lastEdit?.time ?? 0)
  const grouped =
    field !== undefined &&
    field === history.lastEdit?.field &&
    elapsed >= 0 &&
    elapsed <= COALESCE_WINDOW
  return {
    ...history,
    past: grouped ? history.past : [...history.past, history.present].slice(-HISTORY_LIMIT),
    present: next,
    future: [],
    lastEdit: field === undefined ? undefined : { field, time: action.time },
  }
}

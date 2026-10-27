import { useCallback, useEffect, useReducer, useRef, useState } from 'react'
import type { Project } from '../lib/types'
import { createDefaultProject, parseProject, PROJECT_STORAGE_KEY } from '../lib/project'
import {
  reduceProjectHistory,
  type ProjectHistory,
  type ProjectUpdate,
  type SaveState,
} from '../lib/project-history'

function prefersReducedMotion() {
  return (
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )
}

function storageSnapshot(project: Project) {
  // An input may be temporarily empty when the page closes before blur fires.
  // Keep that unfinished rename from invalidating an otherwise valid design.
  return JSON.stringify({ ...project, name: project.name.trim() || 'Untitled project' })
}

function initialize(): ProjectHistory {
  let project = createDefaultProject(prefersReducedMotion())
  let initialSaveState: SaveState = 'saved'
  try {
    const saved = window.localStorage.getItem(PROJECT_STORAGE_KEY)
    if (saved !== null) project = parseProject(saved)
  } catch {
    // Keep unreadable saved data intact until the user makes a new edit.
    initialSaveState = 'error'
  }
  return { past: [], present: project, future: [], initialSaveState }
}

export function useProject() {
  const [history, dispatch] = useReducer(reduceProjectHistory, undefined, initialize)
  const [saveState, setSaveState] = useState<SaveState>(history.initialSaveState)
  const initialSnapshot = useRef(storageSnapshot(history.present))
  const savedSnapshot = useRef(initialSnapshot.current)
  const latest = useRef(history.present)
  latest.current = history.present

  useEffect(() => {
    const serialized = storageSnapshot(history.present)
    if (serialized === savedSnapshot.current) {
      setSaveState((previous) => (previous === 'error' ? previous : 'saved'))
      return
    }
    setSaveState('saving')
    const timer = window.setTimeout(() => {
      try {
        window.localStorage.setItem(PROJECT_STORAGE_KEY, serialized)
        savedSnapshot.current = serialized
        setSaveState('saved')
      } catch {
        setSaveState('error')
      }
    }, 450)
    return () => window.clearTimeout(timer)
  }, [history.present])

  useEffect(() => {
    // Flush pending work when closing or moving the page to the background.
    const flush = () => {
      const serialized = storageSnapshot(latest.current)
      if (serialized === savedSnapshot.current) return
      try {
        window.localStorage.setItem(PROJECT_STORAGE_KEY, serialized)
        savedSnapshot.current = serialized
      } catch {
        /* The visible save status already exposes storage failures. */
      }
    }
    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') flush()
    }
    window.addEventListener('pagehide', flush)
    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => {
      window.removeEventListener('pagehide', flush)
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [])

  const setProject = useCallback(
    (update: ProjectUpdate) => dispatch({ type: 'update', update, time: Date.now() }),
    [],
  )
  const undo = useCallback(() => dispatch({ type: 'undo' }), [])
  const redo = useCallback(() => dispatch({ type: 'redo' }), [])
  const reset = useCallback(
    () =>
      dispatch({
        type: 'update',
        update: createDefaultProject(prefersReducedMotion()),
        time: Date.now(),
        coalesce: false,
      }),
    [],
  )
  const importProject = useCallback(
    (text: string) =>
      dispatch({ type: 'update', update: parseProject(text), time: Date.now(), coalesce: false }),
    [],
  )

  return {
    project: history.present,
    setProject,
    undo,
    redo,
    reset,
    importProject,
    canUndo: history.past.length > 0,
    canRedo: history.future.length > 0,
    saveState,
  }
}

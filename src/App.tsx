import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react'
import {
  ArrowDownToLine,
  ArrowRight,
  Box,
  Check,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  Copy,
  Focus,
  Grid2X2,
  Layers,
  Lightbulb,
  LoaderCircle,
  Maximize2,
  Minus,
  MousePointer2,
  MoveUpRight,
  PanelLeftClose,
  Pause,
  Play,
  Plus,
  Redo2,
  RotateCw,
  Scissors,
  Settings2,
  SlidersHorizontal,
  Sparkles,
  Sun,
  Trash2,
  Undo2,
  Upload,
  X,
} from 'lucide-react'
import { Button } from './components/ui/button'
import { Slider } from './components/ui/slider'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from './components/ui/dialog'
import { Tooltip, TooltipProvider } from './components/ui/tooltip'
import { ShapeIcon } from './components/ShapeIcon'
import { SceneBoundary } from './components/SceneBoundary'
import { useProject } from './hooks/useProject'
import {
  COLORS,
  SHAPES,
  type KitElement,
  type LightSettings,
  type ShapeKind,
  type ViewMode,
} from './lib/types'
import { CutPlan } from './components/CutPlan'
const StudioScene = lazy(() =>
  import('./components/StudioScene').then((m) => ({ default: m.StudioScene })),
)

function downloadFile(text: string, filename: string, type: string) {
  const url = URL.createObjectURL(new Blob([text], { type }))
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}
function Parameter({
  label,
  value,
  min = 0,
  max = 100,
  step = 1,
  unit = '%',
  onChange,
  icon,
}: {
  label: string
  value: number
  min?: number
  max?: number
  step?: number
  unit?: string
  onChange: (v: number) => void
  icon?: React.ReactNode
}) {
  return (
    <div className="parameter">
      <div className="parameter-label">
        <label>
          {icon}
          {label}
        </label>
        <span>
          {Number.isInteger(value) ? value : Number(value.toFixed(1))}
          <small>{unit}</small>
        </span>
      </div>
      <Slider
        aria-label={label}
        value={[value]}
        onValueChange={([v]) => onChange(v)}
        min={min}
        max={max}
        step={step}
      />
    </div>
  )
}
function App() {
  const { project, setProject, undo, redo, canUndo, canRedo, saveState, importProject } =
    useProject()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [activeShape, setActiveShape] = useState<ShapeKind>('arch')
  const [activeColor, setActiveColor] = useState(COLORS[0].hex)
  const [placing, setPlacing] = useState(false)
  const [viewMode, setViewMode] = useState<ViewMode>('perspective')
  const [resetKey, setResetKey] = useState(0)
  const [page, setPage] = useState<'studio' | 'cut'>('studio')
  const [dialog, setDialog] = useState<'help' | 'project' | null>(null)
  const [notice, setNotice] = useState('')
  const [projectNameDraft, setProjectNameDraft] = useState<string | null>(null)
  const [ready, setReady] = useState(false)
  const [focusMode, setFocusMode] = useState(false)
  const [libraryOpen, setLibraryOpen] = useState(true)
  const [inspectorTab, setInspectorTab] = useState<'lighting' | 'element'>('lighting')
  const fileInput = useRef<HTMLInputElement>(null)
  const selected = project.elements.find((e) => e.id === selectedId)
  const notify = useCallback((message: string) => setNotice(message), [])
  useEffect(() => {
    if (!notice) return
    const id = window.setTimeout(() => setNotice(''), 4500)
    return () => window.clearTimeout(id)
  }, [notice])
  useEffect(() => {
    if (selectedId && !selected) setSelectedId(null)
  }, [selected, selectedId])
  const updateLight = (patch: Partial<LightSettings>) =>
    setProject((p) => ({ ...p, lighting: { ...p.lighting, ...patch } }))
  const updateElement = (patch: Partial<KitElement>) => {
    if (selectedId)
      setProject((p) => ({
        ...p,
        elements: p.elements.map((e) => (e.id === selectedId ? { ...e, ...patch } : e)),
      }))
  }
  const removeSelected = useCallback(() => {
    if (!selectedId) return
    setProject((p) => ({ ...p, elements: p.elements.filter((e) => e.id !== selectedId) }))
    setSelectedId(null)
    notify('Element removed')
  }, [selectedId, setProject, notify])
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement
      if (
        target.closest(
          'input, textarea, select, [contenteditable], [role="slider"], [role="dialog"]',
        )
      )
        return
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'z') {
        event.preventDefault()
        event.shiftKey ? redo() : undo()
        return
      }
      if (event.key === 'Escape') {
        setPlacing(false)
        setFocusMode(false)
        setSelectedId(null)
      }
      if (event.key === 'Delete' || event.key === 'Backspace') {
        event.preventDefault()
        removeSelected()
      }
      if (event.code === 'Space' && target === document.body) {
        event.preventDefault()
        setProject((p) => ({ ...p, lighting: { ...p.lighting, playing: !p.lighting.playing } }))
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [undo, redo, removeSelected, setProject])
  const select = (id: string | null) => {
    setSelectedId(id)
    if (id) {
      setInspectorTab('element')
      setPlacing(false)
    }
  }
  const addElement = (row?: number, col?: number, shape = activeShape) => {
    let spot = row !== undefined && col !== undefined ? { row, col } : null
    if (!spot)
      for (let r = 0; r < project.fabrication.gridSize && !spot; r++)
        for (let c = 0; c < project.fabrication.gridSize && !spot; c++)
          if (!project.elements.some((e) => e.row === r && e.col === c)) spot = { row: r, col: c }
    if (!spot || project.elements.length >= 25) {
      notify('All available slots are occupied. Remove an element to make room.')
      return
    }
    if (project.elements.some((e) => e.row === spot!.row && e.col === spot!.col)) {
      notify('This slot is occupied. Choose an empty slot.')
      return
    }
    const element: KitElement = {
      id: crypto.randomUUID(),
      shape,
      color: activeColor,
      ...spot,
      rotation: 0,
      width: shape === 'rectangle' ? 65 : 85,
      height: shape === 'circle' ? 85 : 140,
    }
    setProject((p) => ({ ...p, elements: [...p.elements, element] }))
    select(element.id)
    setPlacing(false)
    notify(
      `${SHAPES.find((s) => s.kind === shape)?.name} added to ${String.fromCharCode(65 + spot.row)}${spot.col + 1}`,
    )
  }
  const duplicateSelected = () => {
    if (!selected) return
    for (let r = 0; r < project.fabrication.gridSize; r++)
      for (let c = 0; c < project.fabrication.gridSize; c++)
        if (!project.elements.some((e) => e.row === r && e.col === c)) {
          const copy = { ...selected, id: crypto.randomUUID(), row: r, col: c }
          setProject((p) => ({ ...p, elements: [...p.elements, copy] }))
          select(copy.id)
          notify('Element duplicated')
          return
        }
    notify('The base plate is full')
  }
  const moveTo = (row: number, col: number, id: string) => {
    const occupied = project.elements.find((e) => e.row === row && e.col === col)
    const source = project.elements.find((e) => e.id === id)
    if (!source || occupied?.id === id) return
    setProject((p) => ({
      ...p,
      elements: p.elements.map((e) =>
        e.id === id
          ? { ...e, row, col }
          : e.id === occupied?.id
            ? { ...e, row: source.row, col: source.col }
            : e,
      ),
    }))
    select(id)
  }
  return (
    <TooltipProvider delayDuration={250}>
      <div
        className={`app ${focusMode ? 'focus-mode' : ''} ${!libraryOpen ? 'library-collapsed' : ''}`}
      >
        <header className="app-header">
          <a
            href="#"
            className="brand"
            aria-label="Lighting Kit home"
            onClick={(e) => {
              e.preventDefault()
              setPage('studio')
            }}
          >
            <span className="brand-symbol">
              <i />
              <i />
              <i />
            </span>
            <span>
              lighting<span className="brand-light">kit</span>
              <span className="brand-dot">®</span>
            </span>
          </a>
          <div className="header-divider" />
          <button className="project-name" onClick={() => setDialog('project')}>
            {project.name}
            <ChevronDown size={14} />
            <span className="project-badge">PROJECT</span>
          </button>
          <div className="header-spacer" />
          <span className={`save-state ${saveState === 'error' ? 'error' : ''}`}>
            {saveState === 'saved' ? (
              <Check size={12} />
            ) : saveState === 'error' ? (
              <X size={12} />
            ) : (
              <LoaderCircle size={12} className="spin" />
            )}
            {saveState === 'saved'
              ? 'Saved locally'
              : saveState === 'error'
                ? 'Save unavailable'
                : 'Saving…'}
          </span>
          <Tooltip content="Undo · ⌘Z">
            <Button
              variant="ghost"
              size="icon"
              aria-label="Undo"
              onClick={undo}
              disabled={!canUndo}
            >
              <Undo2 size={16} />
            </Button>
          </Tooltip>
          <Tooltip content="Redo · ⇧⌘Z">
            <Button
              variant="ghost"
              size="icon"
              aria-label="Redo"
              onClick={redo}
              disabled={!canRedo}
            >
              <Redo2 size={16} />
            </Button>
          </Tooltip>
          <span className="header-divider small" />
          <Tooltip content="Quick guide">
            <Button
              variant="ghost"
              size="icon"
              aria-label="Open quick guide"
              onClick={() => setDialog('help')}
            >
              <CircleHelp size={18} />
            </Button>
          </Tooltip>
          <Button
            variant="ghost"
            size="icon"
            className="mobile-project-button"
            aria-label="Project settings"
            onClick={() => setDialog('project')}
          >
            <Settings2 size={17} />
          </Button>
          <Button
            onClick={() => {
              setPage('cut')
              setFocusMode(false)
            }}
            className="export-button"
          >
            <ArrowDownToLine size={15} />
            Export cut plan
            <ChevronRight size={14} />
          </Button>
        </header>
        <div className="workspace-bar">
          <nav className="workspace-tabs" aria-label="Workspace">
            <button className={page === 'studio' ? 'active' : ''} onClick={() => setPage('studio')}>
              <Box size={15} />
              Design studio
            </button>
            <button
              className={page === 'cut' ? 'active' : ''}
              onClick={() => {
                setPage('cut')
                setFocusMode(false)
              }}
            >
              <Scissors size={15} />
              Cut plan<span className="tab-count">{project.elements.length + 1}</span>
            </button>
          </nav>
          <div className="workspace-mobile-actions">
            <Button
              variant="ghost"
              size="icon"
              aria-label="Undo"
              disabled={!canUndo}
              onClick={undo}
            >
              <Undo2 size={15} />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Redo"
              disabled={!canRedo}
              onClick={redo}
            >
              <Redo2 size={15} />
            </Button>
          </div>
          <span className="workspace-tagline">
            A playground for light.<span className="tiny-star">✳</span>
          </span>
        </div>
        {page === 'cut' ? (
          <CutPlan
            project={project}
            setProject={setProject}
            onBack={() => setPage('studio')}
            notify={notify}
          />
        ) : (
          <main className="studio-layout">
            <aside className="library panel" aria-label="Element library">
              <div className="panel-heading">
                <div>
                  <span className="eyebrow">YOUR BUILDING BLOCKS</span>
                  <h2>Element library</h2>
                </div>
                <Tooltip content="Collapse library">
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Collapse library"
                    onClick={() => setLibraryOpen(false)}
                  >
                    <PanelLeftClose size={16} />
                  </Button>
                </Tooltip>
              </div>
              <div className="library-content">
                <div className="section-label">
                  <span>Shapes</span>
                  <span className="count">06</span>
                </div>
                <p className="section-hint">Small shapes. Endless possibilities.</p>
                <div className="shape-grid">
                  {SHAPES.map((shape, i) => (
                    <button
                      key={shape.kind}
                      className={`shape-card ${activeShape === shape.kind ? 'selected' : ''}`}
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.setData('shape', shape.kind)
                        e.dataTransfer.effectAllowed = 'copy'
                      }}
                      onClick={() => {
                        setActiveShape(shape.kind)
                        setPlacing(true)
                        setSelectedId(null)
                      }}
                      aria-pressed={activeShape === shape.kind}
                      aria-label={`Select ${shape.name} shape`}
                    >
                      <span className="shape-number">0{i + 1}</span>
                      <ShapeIcon shape={shape.kind} color={COLORS[i].hex} tab />
                      <span className="shape-card-name">
                        {shape.name}
                        <Plus size={12} />
                      </span>
                    </button>
                  ))}
                </div>
                <div className="section-label palette-label">
                  <span>Acrylic color</span>
                  <span className="material-badge">TRANSLUCENT</span>
                </div>
                <div className="palette">
                  {COLORS.map((color) => (
                    <Tooltip key={color.hex} content={color.name}>
                      <button
                        className={`color-swatch ${activeColor === color.hex ? 'active' : ''}`}
                        style={{ '--swatch': color.hex } as React.CSSProperties}
                        aria-label={`Use ${color.name} acrylic`}
                        aria-pressed={activeColor === color.hex}
                        onClick={() => setActiveColor(color.hex)}
                      >
                        {activeColor === color.hex && <Check size={14} />}
                      </button>
                    </Tooltip>
                  ))}
                </div>
                <div className="current-color">
                  <span>{COLORS.find((c) => c.hex === activeColor)?.name}</span>
                  <span>{activeColor.toUpperCase()}</span>
                </div>
                <Button
                  variant="secondary"
                  className="add-element-button"
                  onClick={() => addElement()}
                >
                  <Plus size={15} />
                  Add {SHAPES.find((s) => s.kind === activeShape)?.name.toLowerCase()} to plate
                </Button>
                <div className="library-note">
                  <MousePointer2 size={15} />
                  <p>
                    Select a shape, then click a slot.
                    <br />
                    Or drag it onto the base plate.
                  </p>
                </div>
                <div className="material-card">
                  <div className="material-card-icon">
                    <Layers size={17} />
                  </div>
                  <div>
                    <strong>Made for the real world</strong>
                    <p>{project.fabrication.thickness} mm acrylic · Laser-cut ready</p>
                  </div>
                  <MoveUpRight size={13} />
                </div>
              </div>
              <div className="library-footer">
                <span className="status-dot" />
                MODULAR BY DESIGN
              </div>
            </aside>
            <section className="center-workspace" aria-label="Design canvas">
              <div className="scene-container">
                <SceneBoundary>
                  <Suspense
                    fallback={
                      <div className="scene-loading">
                        <LoaderCircle size={22} className="spin" />
                        Setting the scene…
                      </div>
                    }
                  >
                    <StudioScene
                      elements={project.elements}
                      lighting={project.lighting}
                      fabrication={project.fabrication}
                      selectedId={selectedId}
                      onSelect={select}
                      viewMode={viewMode}
                      resetKey={resetKey}
                      onReady={setReady}
                      onRotationPause={(angle) =>
                        setProject((p) => ({ ...p, lighting: { ...p.lighting, rotation: angle } }))
                      }
                    />
                  </Suspense>
                </SceneBoundary>
                <div className="scene-top">
                  <div className="scene-label">
                    <span className={`status-dot ${ready ? '' : 'pending'}`} />
                    LIVE PREVIEW
                    <span className="scene-label-divider" />
                    <span>Studio 01</span>
                  </div>
                  <div className="scene-actions">
                    {!libraryOpen && (
                      <Tooltip content="Show element library">
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label="Show element library"
                          onClick={() => setLibraryOpen(true)}
                        >
                          <Layers size={16} />
                        </Button>
                      </Tooltip>
                    )}
                    <Tooltip content="Reset camera">
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Reset camera"
                        onClick={() => {
                          setResetKey((k) => k + 1)
                          setViewMode('perspective')
                        }}
                      >
                        <Focus size={16} />
                      </Button>
                    </Tooltip>
                    <Tooltip content={focusMode ? 'Exit focus mode' : 'Focus on preview'}>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={focusMode ? 'Exit focus mode' : 'Focus on preview'}
                        onClick={() => setFocusMode((v) => !v)}
                      >
                        {focusMode ? <Minus size={16} /> : <Maximize2 size={15} />}
                      </Button>
                    </Tooltip>
                  </div>
                </div>
                <div className="scene-view-tabs" role="group" aria-label="Camera view">
                  {(['perspective', 'front', 'top'] as const).map((view) => (
                    <button
                      key={view}
                      className={viewMode === view ? 'active' : ''}
                      aria-pressed={viewMode === view}
                      onClick={() => setViewMode(view)}
                    >
                      {view === 'perspective' ? 'Perspective' : view === 'front' ? 'Front' : 'Top'}
                    </button>
                  ))}
                </div>
                <div className="scene-bottom">
                  <span className="orbit-hint">
                    <MousePointer2 size={12} />
                    Drag to orbit<span>·</span>Scroll to zoom
                  </span>
                  <span className="simulation-badge">
                    <Sparkles size={11} />
                    TRANSMISSION PREVIEW
                  </span>
                </div>
                <div className="rotation-player">
                  <Tooltip content={project.lighting.playing ? 'Pause rotation' : 'Play rotation'}>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={project.lighting.playing ? 'Pause rotation' : 'Play rotation'}
                      onClick={() => updateLight({ playing: !project.lighting.playing })}
                    >
                      {project.lighting.playing ? (
                        <Pause size={15} fill="currentColor" />
                      ) : (
                        <Play size={15} fill="currentColor" />
                      )}
                    </Button>
                  </Tooltip>
                  <div className="player-divider" />
                  <RotateCw size={14} />
                  <span>
                    {project.lighting.speed.toFixed(1)} <small>RPM</small>
                  </span>
                  <div className={`playing-bars ${project.lighting.playing ? 'is-playing' : ''}`}>
                    <i />
                    <i />
                    <i />
                    <i />
                    <i />
                  </div>
                </div>
              </div>
              <section className="arrangement-panel" aria-label="Base plate arrangement">
                <div className="arrangement-heading">
                  <div className="arrangement-title">
                    <Grid2X2 size={15} />
                    <h2>Base plate</h2>
                    <span>
                      {project.fabrication.gridSize} × {project.fabrication.gridSize} grid
                    </span>
                  </div>
                  <div className="arrangement-tools">
                    <span className="element-count">{project.elements.length} elements</span>
                    <Tooltip content="Rotate selected element 90°">
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Rotate selected element"
                        disabled={!selected}
                        onClick={() => updateElement({ rotation: (selected!.rotation + 90) % 360 })}
                      >
                        <RotateCw size={14} />
                      </Button>
                    </Tooltip>
                    <Tooltip content="Duplicate selected element">
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Duplicate selected element"
                        disabled={!selected || project.elements.length >= 25}
                        onClick={duplicateSelected}
                      >
                        <Copy size={14} />
                      </Button>
                    </Tooltip>
                    <Tooltip content="Remove selected element">
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Remove selected element"
                        disabled={!selected}
                        onClick={removeSelected}
                      >
                        <Trash2 size={14} />
                      </Button>
                    </Tooltip>
                  </div>
                </div>
                <div className="arrangement-body">
                  <div className="plate-wrapper">
                    <div
                      className="plate-columns"
                      style={{
                        gridTemplateColumns: `repeat(${project.fabrication.gridSize}, 1fr)`,
                      }}
                    >
                      {Array.from({ length: project.fabrication.gridSize }, (_, c) => (
                        <span key={c}>{c + 1}</span>
                      ))}
                    </div>
                    <div className="plate-row">
                      <div className="plate-rows">
                        {Array.from({ length: project.fabrication.gridSize }, (_, r) => (
                          <span key={r}>{String.fromCharCode(65 + r)}</span>
                        ))}
                      </div>
                      <div
                        className={`slot-grid ${placing ? 'placing' : ''}`}
                        style={{ '--grid': project.fabrication.gridSize } as React.CSSProperties}
                      >
                        {Array.from({ length: project.fabrication.gridSize ** 2 }, (_, i) => {
                          const row = Math.floor(i / project.fabrication.gridSize),
                            col = i % project.fabrication.gridSize,
                            el = project.elements.find((e) => e.row === row && e.col === col)
                          return (
                            <button
                              key={i}
                              className={`slot ${el ? 'occupied' : ''} ${selectedId && selectedId === el?.id ? 'selected' : ''}`}
                              style={el ? ({ '--element': el.color } as React.CSSProperties) : {}}
                              aria-label={`Slot ${String.fromCharCode(65 + row)}${col + 1}${el ? `: ${el.shape}, ${el.rotation} degrees` : ': empty'}`}
                              aria-pressed={!!el && el.id === selectedId}
                              draggable={!!el}
                              onDragStart={(e) => {
                                if (el) e.dataTransfer.setData('element', el.id)
                              }}
                              onDragOver={(e) => {
                                e.preventDefault()
                                e.currentTarget.classList.add('drag-over')
                              }}
                              onDragLeave={(e) => e.currentTarget.classList.remove('drag-over')}
                              onDrop={(e) => {
                                e.preventDefault()
                                e.currentTarget.classList.remove('drag-over')
                                const id = e.dataTransfer.getData('element')
                                const shape = e.dataTransfer.getData('shape')
                                if (id) moveTo(row, col, id)
                                else if (SHAPES.some((s) => s.kind === shape))
                                  addElement(row, col, shape as ShapeKind)
                              }}
                              onClick={() => {
                                if (el) select(el.id)
                                else if (placing) addElement(row, col)
                                else if (selected) moveTo(row, col, selected.id)
                                else {
                                  addElement(row, col)
                                }
                              }}
                            >
                              {el ? (
                                <span
                                  className="slot-panel"
                                  style={{ transform: `rotate(${el.rotation}deg)` }}
                                >
                                  <span />
                                </span>
                              ) : (
                                <span className="slot-hole" />
                              )}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                    <div className="plate-dimension">
                      <span />
                      <small>{project.fabrication.baseSize} mm</small>
                      <span />
                    </div>
                  </div>
                  <div className="arrangement-info">
                    {selected ? (
                      <>
                        <span className="eyebrow">SELECTED ELEMENT</span>
                        <div className="selected-summary">
                          <ShapeIcon shape={selected.shape} color={selected.color} />
                          <div>
                            <h3>
                              {SHAPES.find((s) => s.kind === selected.shape)?.name}
                              <span style={{ backgroundColor: selected.color }} />
                            </h3>
                            <p>
                              Slot {String.fromCharCode(65 + selected.row)}
                              {selected.col + 1} <span>·</span> {selected.width} × {selected.height}{' '}
                              mm
                            </p>
                          </div>
                        </div>
                        <p>
                          Click an empty slot to move this element.
                          <br />
                          Drag onto another element to swap.
                        </p>
                        <button className="text-button" onClick={() => setInspectorTab('element')}>
                          Edit element <ArrowRight size={13} />
                        </button>
                      </>
                    ) : (
                      <>
                        <span className="eyebrow">MAKE IT YOURS</span>
                        <h3>
                          {placing
                            ? `Place your ${SHAPES.find((s) => s.kind === activeShape)?.name.toLowerCase()}`
                            : 'Find your composition.'}
                        </h3>
                        <p>
                          {placing
                            ? 'Click an empty slot to add this shape to your kit.'
                            : 'Arrange your acrylic elements and see the room in a different light.'}
                        </p>
                        <div className="grid-legend">
                          <i />
                          Available slot
                          <span />
                          <i className="filled" />
                          Acrylic element
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </section>
            </section>
            <aside className="inspector panel" aria-label="Properties">
              <div className="inspector-tabs" role="group" aria-label="Properties panel">
                <button
                  className={inspectorTab === 'lighting' ? 'active' : ''}
                  onClick={() => setInspectorTab('lighting')}
                >
                  <SlidersHorizontal size={14} />
                  Scene
                </button>
                <button
                  className={inspectorTab === 'element' ? 'active' : ''}
                  onClick={() => setInspectorTab('element')}
                >
                  <Layers size={14} />
                  Element{selected && <span className="selection-dot" />}
                </button>
              </div>
              <div className="inspector-scroll">
                {inspectorTab === 'lighting' ? (
                  <>
                    <div className="inspector-section">
                      <div className="section-title">
                        <Lightbulb size={16} />
                        <h2>Studio spotlight</h2>
                        <span className="on-badge">
                          {project.lighting.intensity ? 'ON' : 'OFF'}
                        </span>
                      </div>
                      <div className="light-illustration">
                        <div className="light-beam" />
                        <div className="spotlight-body">
                          <span />
                          <i />
                          <b />
                        </div>
                        <div className="spotlight-stand" />
                        <span className="light-illustration-label">DIRECTIONAL LIGHT</span>
                      </div>
                      <Parameter
                        label="Light intensity"
                        value={project.lighting.intensity}
                        onChange={(v) => updateLight({ intensity: v })}
                      />
                      <Parameter
                        label="Beam angle"
                        value={project.lighting.beamAngle}
                        min={15}
                        max={80}
                        unit="°"
                        onChange={(v) => updateLight({ beamAngle: v })}
                      />
                      <div className="toggle-row">
                        <label htmlFor="show-beam">Show light beam</label>
                        <button
                          id="show-beam"
                          className={`switch ${project.lighting.showBeam ? 'checked' : ''}`}
                          role="switch"
                          aria-checked={project.lighting.showBeam}
                          onClick={() => updateLight({ showBeam: !project.lighting.showBeam })}
                        >
                          <span />
                        </button>
                      </div>
                    </div>
                    <div className="inspector-section">
                      <div className="section-title">
                        <Sun size={16} />
                        <h2>Room lighting</h2>
                      </div>
                      <Parameter
                        label="Ambient intensity"
                        value={project.lighting.ambient}
                        onChange={(v) => updateLight({ ambient: v })}
                      />
                      <div className="range-captions">
                        <span>Dark studio</span>
                        <span>Daylight</span>
                      </div>
                    </div>
                    <div className="inspector-section">
                      <div className="section-title">
                        <RotateCw size={16} />
                        <h2>Turntable</h2>
                        <button
                          className={`small-status ${project.lighting.playing ? 'running' : ''}`}
                          onClick={() => updateLight({ playing: !project.lighting.playing })}
                        >
                          {project.lighting.playing ? 'ROTATING' : 'PAUSED'}
                        </button>
                      </div>
                      <Parameter
                        label="Rotation speed"
                        value={project.lighting.speed}
                        min={0}
                        max={12}
                        step={0.5}
                        unit="RPM"
                        onChange={(v) => updateLight({ speed: v })}
                      />
                      {!project.lighting.playing && (
                        <Parameter
                          label="Plate angle"
                          value={project.lighting.rotation}
                          max={360}
                          unit="°"
                          onChange={(v) => updateLight({ rotation: v })}
                        />
                      )}
                      <div className="turntable-direction">
                        <RotateCw size={12} />
                        <span>Clockwise rotation</span>
                        <span>360°</span>
                      </div>
                    </div>
                    <div className="inspector-section quality-section">
                      <div className="section-title">
                        <Settings2 size={15} />
                        <h2>Preview quality</h2>
                      </div>
                      <div className="segmented">
                        <button
                          className={project.lighting.quality === 'standard' ? 'active' : ''}
                          onClick={() => updateLight({ quality: 'standard' })}
                        >
                          Performance
                        </button>
                        <button
                          className={project.lighting.quality === 'high' ? 'active' : ''}
                          onClick={() => updateLight({ quality: 'high' })}
                        >
                          High quality
                          <span className="quality-dot" />
                        </button>
                      </div>
                      <p className="subtle-note">
                        Color transmission is simulated. Actual light depends on your acrylic and
                        fixture.
                      </p>
                    </div>
                  </>
                ) : selected ? (
                  <>
                    <div className="inspector-section">
                      <div className="section-title">
                        <Layers size={16} />
                        <h2>Element properties</h2>
                        <span className="element-slot">
                          {String.fromCharCode(65 + selected.row)}
                          {selected.col + 1}
                        </span>
                      </div>
                      <div className="element-preview">
                        <ShapeIcon shape={selected.shape} color={selected.color} tab />
                        <span>{SHAPES.find((s) => s.kind === selected.shape)?.name}</span>
                      </div>
                      <label className="field-label" htmlFor="element-shape">
                        Shape
                      </label>
                      <select
                        id="element-shape"
                        className="select-input"
                        value={selected.shape}
                        onChange={(e) => updateElement({ shape: e.target.value as ShapeKind })}
                      >
                        {SHAPES.map((s) => (
                          <option key={s.kind} value={s.kind}>
                            {s.name}
                          </option>
                        ))}
                      </select>
                      <div className="section-label element-color-label">Acrylic color</div>
                      <div className="palette">
                        {COLORS.map((c) => (
                          <Tooltip key={c.hex} content={c.name}>
                            <button
                              className={`color-swatch ${selected.color === c.hex ? 'active' : ''}`}
                              style={{ '--swatch': c.hex } as React.CSSProperties}
                              aria-label={`Set element color to ${c.name}`}
                              aria-pressed={selected.color === c.hex}
                              onClick={() => updateElement({ color: c.hex })}
                            >
                              {selected.color === c.hex && <Check size={14} />}
                            </button>
                          </Tooltip>
                        ))}
                      </div>
                    </div>
                    <div className="inspector-section">
                      <div className="section-title">
                        <Settings2 size={15} />
                        <h2>Dimensions</h2>
                        <span className="unit-label">mm</span>
                      </div>
                      <Parameter
                        label="Width"
                        value={selected.width}
                        min={Math.max(30, project.fabrication.thickness * 3)}
                        max={180}
                        unit="mm"
                        onChange={(v) => updateElement({ width: v })}
                      />
                      <Parameter
                        label="Height"
                        value={selected.height}
                        min={Math.max(40, project.fabrication.thickness * 3)}
                        max={240}
                        unit="mm"
                        onChange={(v) => updateElement({ height: v })}
                      />
                      <p className="subtle-note">Panel dimensions exclude the mounting tab.</p>
                    </div>
                    <div className="inspector-section">
                      <div className="section-title">
                        <RotateCw size={16} />
                        <h2>Orientation</h2>
                      </div>
                      <div className="segmented orientation">
                        {[0, 90, 180, 270].map((deg) => (
                          <button
                            key={deg}
                            className={selected.rotation === deg ? 'active' : ''}
                            onClick={() => updateElement({ rotation: deg })}
                          >
                            {deg}°
                          </button>
                        ))}
                      </div>
                      <p className="subtle-note">Quarter turns fit the square mounting slots.</p>
                    </div>
                    <div className="inspector-section element-actions">
                      <Button
                        variant="secondary"
                        onClick={duplicateSelected}
                        disabled={project.elements.length >= 25}
                      >
                        <Copy size={14} />
                        Duplicate element
                      </Button>
                      <Button variant="ghost" className="danger-button" onClick={removeSelected}>
                        <Trash2 size={14} />
                        Remove element
                      </Button>
                    </div>
                  </>
                ) : (
                  <div className="empty-selection">
                    <MousePointer2 size={28} />
                    <h3>A little room to play.</h3>
                    <p>
                      Select an element in the preview or base plate to edit its shape, color, and
                      dimensions.
                    </p>
                    <Button variant="secondary" onClick={() => setInspectorTab('lighting')}>
                      Back to scene
                    </Button>
                  </div>
                )}
              </div>
              <div className="inspector-footer">
                <span className="acrylic-stack">
                  <i />
                  <i />
                  <i />
                </span>
                <span>
                  Less material.
                  <br />
                  <strong>More possibility.</strong>
                </span>
              </div>
            </aside>
          </main>
        )}
        <footer className="status-bar">
          <span>
            <span className="status-dot" />
            {page === 'studio' ? 'STUDIO WORKSPACE' : 'FABRICATION WORKSPACE'}
          </span>
          <span className="status-material">
            {project.fabrication.baseSize} × {project.fabrication.baseSize} mm base
            <span className="status-separator">/</span>
            {project.fabrication.thickness} mm acrylic<span className="status-separator">/</span>
            {project.elements.length} elements
          </span>
          <button onClick={() => setDialog('help')}>
            <CircleHelp size={12} />
            Shortcuts & guide
          </button>
          <span className="version">v1.0</span>
        </footer>
        {notice && (
          <div className="toast" role="status">
            <Check size={15} />
            {notice}
            <button aria-label="Dismiss notification" onClick={() => setNotice('')}>
              <X size={14} />
            </button>
          </div>
        )}
        <Dialog open={dialog === 'help'} onOpenChange={(open) => !open && setDialog(null)}>
          <DialogContent>
            <span className="eyebrow">WELCOME TO LIGHTING KIT</span>
            <DialogTitle>Make something brilliant.</DialogTitle>
            <DialogDescription>
              Your workbench for sculpting light with color, shape, and motion.
            </DialogDescription>
            <div className="guide-steps">
              <div>
                <span>01</span>
                <section>
                  <h3>Build your composition</h3>
                  <p>
                    Choose a shape and color, then click a grid slot. Drag elements to move or swap
                    them. Select any element to adjust its size and orientation.
                  </p>
                </section>
              </div>
              <div>
                <span>02</span>
                <section>
                  <h3>Set the mood</h3>
                  <p>
                    Adjust the spotlight, room lighting, and turntable speed. Drag the preview to
                    orbit; scroll to zoom. Pause rotation to choose a fixed plate angle.
                  </p>
                </section>
              </div>
              <div>
                <span>03</span>
                <section>
                  <h3>Bring it into the studio</h3>
                  <p>
                    Open Cut plan to set material thickness and kerf. Download dimensioned SVG or
                    DXF sheets, separated by acrylic color. Test a slot fit on your material before
                    cutting the full kit.
                  </p>
                </section>
              </div>
            </div>
            <div className="keyboard-guide">
              <span>
                Undo <kbd>⌘ / Ctrl Z</kbd>
              </span>
              <span>
                Delete element <kbd>⌫</kbd>
              </span>
              <span>
                Cancel placement <kbd>Esc</kbd>
              </span>
            </div>
            <Button onClick={() => setDialog(null)}>
              Let’s make light <ArrowRight size={15} />
            </Button>
          </DialogContent>
        </Dialog>
        <Dialog open={dialog === 'project'} onOpenChange={(open) => !open && setDialog(null)}>
          <DialogContent>
            <span className="eyebrow">YOUR WORKSPACE</span>
            <DialogTitle>Project settings</DialogTitle>
            <DialogDescription>
              Your design saves automatically in this browser. Download a project file to keep a
              backup or move to another device.
            </DialogDescription>
            <label className="field-label" htmlFor="project-name">
              Project name
            </label>
            <input
              id="project-name"
              className="text-input"
              maxLength={80}
              value={projectNameDraft ?? project.name}
              onBlur={() => {
                if (projectNameDraft !== null)
                  setProject((p) => ({ ...p, name: projectNameDraft.trim() || 'Untitled project' }))
                setProjectNameDraft(null)
              }}
              onChange={(e) => setProjectNameDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') e.currentTarget.blur()
              }}
            />
            <div className="project-dialog-actions">
              <Button
                variant="secondary"
                onClick={() => {
                  downloadFile(
                    JSON.stringify(project, null, 2),
                    `${project.name || 'lighting-kit'}.json`,
                    'application/json',
                  )
                  notify('Project file downloaded')
                }}
              >
                <ArrowDownToLine size={15} />
                Save project file
              </Button>
              <Button variant="outline" onClick={() => fileInput.current?.click()}>
                <Upload size={15} />
                Open project file
              </Button>
            </div>
            <p className="subtle-note">
              Opening a project replaces this design. You can undo the change.
            </p>
            <Button onClick={() => setDialog(null)}>Done</Button>
          </DialogContent>
        </Dialog>
        <input
          ref={fileInput}
          type="file"
          accept=".json,application/json"
          className="visually-hidden"
          aria-label="Import project file"
          onChange={async (e) => {
            const file = e.target.files?.[0]
            if (!file) return
            try {
              if (file.size > 500_000) throw new Error('Project file is too large')
              importProject(await file.text())
              setSelectedId(null)
              setDialog(null)
              notify('Project opened')
            } catch (error) {
              notify(error instanceof Error ? error.message : 'Could not open this project')
            }
            e.target.value = ''
          }}
        />
      </div>
    </TooltipProvider>
  )
}
export default App

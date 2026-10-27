import { useMemo, useState } from 'react'
import {
  AlertCircle,
  ArrowDownToLine,
  ArrowLeft,
  Check,
  ChevronRight,
  FileCode2,
  Info,
  Layers,
  Ruler,
  Scissors,
} from 'lucide-react'
import { buildCutPlan, generateSVG, generateDXF } from '../lib/fabrication'
import type { FabricationSettings, Project } from '../lib/types'
import { Button } from './ui/button'

interface Props {
  project: Project
  setProject: (next: Project | ((p: Project) => Project)) => void
  onBack: () => void
  notify: (message: string) => void
}
function NumberField({
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
  unit = 'mm',
}: {
  label: string
  value: number
  onChange: (value: number) => void
  min: number
  max: number
  step?: number
  unit?: string
}) {
  const [draft, setDraft] = useState<string | null>(null)
  const id = label.toLowerCase().replaceAll(' ', '-')
  return (
    <div className="number-field">
      <label htmlFor={id}>
        {label}
        <span>{unit}</span>
      </label>
      <input
        id={id}
        type="number"
        min={min}
        max={max}
        step={step}
        value={draft ?? value}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          const n = Number(draft)
          if (draft !== null && draft.trim() !== '' && Number.isFinite(n))
            onChange(Math.min(max, Math.max(min, n)))
          setDraft(null)
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur()
        }}
      />
    </div>
  )
}
export function CutPlan({ project, setProject, onBack, notify }: Props) {
  const [sheetIndex, setSheetIndex] = useState(0)
  const result = useMemo(() => {
    try {
      return { plan: buildCutPlan(project.elements, project.fabrication), error: null }
    } catch (e) {
      return { plan: null, error: e instanceof Error ? e.message : 'Unable to generate cut plan' }
    }
  }, [project.elements, project.fabrication])
  const plan = result.plan
  const index = Math.min(sheetIndex, (plan?.sheets.length ?? 1) - 1)
  const sheet = plan?.sheets[index]
  const settings = project.fabrication
  const update = (patch: Partial<FabricationSettings>) =>
    setProject((p) => ({ ...p, fabrication: { ...p.fabrication, ...patch } }))
  const download = (format: 'svg' | 'dxf') => {
    if (!sheet) return
    const data = format === 'svg' ? generateSVG(sheet) : generateDXF(sheet)
    const url = URL.createObjectURL(
      new Blob([data], { type: format === 'svg' ? 'image/svg+xml' : 'application/dxf' }),
    )
    const a = document.createElement('a')
    a.href = url
    a.download = `${project.name.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'lighting-kit'}-${sheet.id}.${format}`
    a.click()
    window.setTimeout(() => URL.revokeObjectURL(url), 1000)
    notify(`${sheet.label} ${format.toUpperCase()} downloaded`)
  }
  return (
    <main className="cut-workspace">
      <aside className="cut-settings" aria-label="Fabrication settings">
        <button className="back-link" onClick={onBack}>
          <ArrowLeft size={13} />
          Back to the studio
        </button>
        <span className="eyebrow">FROM PIXELS TO PANELS</span>
        <h1>Make it tangible.</h1>
        <p className="intro">
          Your composition, ready to cut. Every panel is laid out on its own color of acrylic.
        </p>
        <div className="cut-fields">
          <NumberField
            label="Base plate size"
            value={settings.baseSize}
            min={100}
            max={1000}
            onChange={(v) => update({ baseSize: v })}
          />
          <NumberField
            label="Acrylic thickness"
            value={settings.thickness}
            min={1}
            max={12}
            step={0.1}
            onChange={(v) => update({ thickness: v })}
          />
          <NumberField
            label="Laser kerf"
            value={settings.kerf}
            min={0}
            max={1}
            step={0.01}
            onChange={(v) => update({ kerf: v })}
          />
          <NumberField
            label="Slot clearance"
            value={settings.clearance}
            min={0}
            max={1}
            step={0.01}
            onChange={(v) => update({ clearance: v })}
          />
        </div>
        <div className="cut-settings-divider" />
        <h3>
          <Layers size={14} />
          Material sheet
        </h3>
        <div className="cut-dimensions">
          <NumberField
            label="Width"
            value={settings.sheetWidth}
            min={100}
            max={3000}
            onChange={(v) => update({ sheetWidth: v })}
          />
          <NumberField
            label="Height"
            value={settings.sheetHeight}
            min={100}
            max={3000}
            onChange={(v) => update({ sheetHeight: v })}
          />
        </div>
        <div className="cut-note">
          <Info size={14} />
          <p>
            Contours include kerf compensation. Import at <strong>1:1 scale</strong> and turn off
            extra cutter compensation. Cut a test slot to confirm your material fit.
          </p>
        </div>
        <p className="subtle-note">
          Square slots support quarter-turn orientations. The tripod and turntable are separate
          hardware.
        </p>
      </aside>
      <section className="cut-main" aria-label="Cut plan preview">
        <div className="cut-toolbar">
          <div>
            <h2>Your cut sheets</h2>
            <p>
              {plan
                ? `${plan.pieceCount} pieces · ${plan.sheets.length} material sheets · All dimensions in mm`
                : 'Adjust your settings to prepare the plan'}
            </p>
          </div>
          <div className="cut-export-buttons">
            <Button variant="outline" onClick={() => download('dxf')} disabled={!sheet}>
              <FileCode2 size={14} />
              Download DXF
            </Button>
            <Button onClick={() => download('svg')} disabled={!sheet}>
              <ArrowDownToLine size={14} />
              Download SVG
            </Button>
          </div>
        </div>
        {result.error ? (
          <div className="cut-error" role="alert">
            <AlertCircle size={30} />
            <h2>Let’s adjust the fit.</h2>
            <p>{result.error}</p>
            <p>Update the dimensions on the left to regenerate your cut sheets.</p>
          </div>
        ) : (
          plan &&
          sheet && (
            <>
              <div className="cut-preview-layout">
                <nav className="sheet-list" aria-label="Material sheets">
                  <span className="eyebrow">{plan.sheets.length} SHEETS</span>
                  {plan.sheets.map((s, i) => (
                    <button
                      key={s.id}
                      className={`sheet-item ${index === i ? 'active' : ''}`}
                      aria-current={index === i ? 'true' : undefined}
                      onClick={() => setSheetIndex(i)}
                    >
                      <span
                        className="sheet-color"
                        style={{ '--swatch': s.color } as React.CSSProperties}
                      />
                      <span>
                        <strong>{s.label}</strong>
                        <small>
                          {s.parts.length} {s.parts.length === 1 ? 'piece' : 'pieces'} ·{' '}
                          {s.thickness} mm
                        </small>
                      </span>
                      <ChevronRight size={12} />
                    </button>
                  ))}
                </nav>
                <div className="cut-preview">
                  <div
                    className="cut-sheet-svg"
                    role="img"
                    aria-label={`${sheet.label} laser cut plan, ${sheet.width} by ${sheet.height} millimeters, ${sheet.parts.length} pieces`}
                    dangerouslySetInnerHTML={{ __html: generateSVG(sheet, { preview: true }) }}
                  />
                  <div className="cut-sheet-caption">
                    <span>
                      <Ruler size={12} />
                      {sheet.width} × {sheet.height} mm
                    </span>
                    <span>
                      {sheet.material} · Sheet {index + 1} of {plan.sheets.length}
                    </span>
                  </div>
                </div>
              </div>
              {plan.warnings.length > 0 && (
                <div className="cut-warning" role="status">
                  {plan.warnings.join(' ')}
                </div>
              )}
              <div className="cut-bottom">
                <span>
                  <Check size={12} />
                  Closed contours · Millimetre units · Color-separated materials
                </span>
                <span>
                  <Scissors size={12} />
                  Kerf {settings.kerf.toFixed(2)} mm · Clearance {settings.clearance.toFixed(2)} mm
                </span>
              </div>
            </>
          )
        )}
      </section>
    </main>
  )
}

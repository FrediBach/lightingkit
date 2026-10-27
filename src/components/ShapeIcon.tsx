import type { ShapeKind } from '../lib/types'

const paths: Record<ShapeKind, string> = {
  arch: 'M18 69V31a22 22 0 0 1 44 0v38z',
  circle: 'M40 10a29 29 0 1 1 0 58 29 29 0 1 1 0-58',
  rectangle: 'M21 9h38v60H21z',
  triangle: 'M40 10 70 69H10z',
  wave: 'M18 69V18C35-6 45 43 62 12v57z',
  pill: 'M22 28a18 18 0 0 1 36 0v23a18 18 0 0 1-36 0z',
}
export function ShapeIcon({
  shape,
  color = 'currentColor',
  className = '',
  tab = false,
}: {
  shape: ShapeKind
  color?: string
  className?: string
  tab?: boolean
}) {
  return (
    <svg className={className} viewBox="0 0 80 80" fill="none" aria-hidden="true">
      <path
        d={paths[shape]}
        fill={color}
        fillOpacity=".19"
        stroke={color}
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      {tab && (
        <path d="M37 69v7h6v-7" fill={color} fillOpacity=".35" stroke={color} strokeWidth="1.2" />
      )}
    </svg>
  )
}

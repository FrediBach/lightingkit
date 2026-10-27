import type { ShapeKind } from './types'

export interface Point {
  x: number
  y: number
}

const STEPS = 96

/** Clockwise outlines in millimetres, with (0, 0) at the top left. */
export function getShapeOutline(shape: ShapeKind, width: number, height: number): Point[] {
  if (shape === 'rectangle')
    return [
      { x: 0, y: height },
      { x: 0, y: 0 },
      { x: width, y: 0 },
      { x: width, y: height },
    ]
  if (shape === 'triangle')
    return [
      { x: 0, y: height },
      { x: width / 2, y: 0 },
      { x: width, y: height },
    ]
  if (shape === 'circle')
    return Array.from({ length: STEPS }, (_, i) => {
      const angle = Math.PI / 2 + (i / STEPS) * Math.PI * 2
      return {
        x: width / 2 + (Math.cos(angle) * width) / 2,
        y: height / 2 + (Math.sin(angle) * height) / 2,
      }
    })
  if (shape === 'arch') {
    const radius = Math.min(width / 2, height / 2)
    return [
      { x: 0, y: height },
      ...Array.from({ length: 49 }, (_, i) => {
        const angle = Math.PI + (i / 48) * Math.PI
        return {
          x: width / 2 + (Math.cos(angle) * width) / 2,
          y: radius + Math.sin(angle) * radius,
        }
      }),
      { x: width, y: height },
    ]
  }
  if (shape === 'pill') {
    const radius = Math.min(width, height) / 2
    const corners = [
      { cx: radius, cy: height - radius, from: 90 },
      { cx: radius, cy: radius, from: 180 },
      { cx: width - radius, cy: radius, from: 270 },
      { cx: width - radius, cy: height - radius, from: 0 },
    ]
    return deduplicate(
      corners.flatMap(({ cx, cy, from }) =>
        Array.from({ length: 25 }, (_, i) => {
          const angle = ((from + (i / 24) * 90) * Math.PI) / 180
          return { x: cx + Math.cos(angle) * radius, y: cy + Math.sin(angle) * radius }
        }),
      ),
    )
  }
  return [
    { x: 0, y: height },
    ...Array.from({ length: 49 }, (_, i) => {
      const t = i / 48
      return { x: t * width, y: height * (0.18 - 0.18 * Math.cos(t * Math.PI * 2)) }
    }),
    { x: width, y: height },
  ]
}

function deduplicate(points: Point[]): Point[] {
  return points.filter((point, index) => {
    const previous = points[(index + points.length - 1) % points.length]
    return Math.hypot(point.x - previous.x, point.y - previous.y) > 1e-7
  })
}

/** A single contour: the mounting tongue is joined to the silhouette, never overlaid. */
export function getPanelOutline(
  shape: ShapeKind,
  width: number,
  height: number,
  tabWidth: number,
  tabDepth: number,
): Point[] {
  const left = (width - tabWidth) / 2
  const right = (width + tabWidth) / 2
  const body = getShapeOutline(shape, width, height)
  // Round silhouettes need a short, flat connection cut into the lower arc.
  // Clip the body above the two tongue shoulders before inserting the tongue.
  let joinY = height
  if (shape === 'circle') {
    joinY = height / 2 + (height / 2) * Math.sqrt(1 - (tabWidth / width) ** 2)
  } else if (shape === 'pill') {
    const radius = Math.min(width, height) / 2
    const flatWidth = width - 2 * radius
    if (tabWidth > flatWidth)
      joinY = height - radius + Math.sqrt(radius ** 2 - ((tabWidth - flatWidth) / 2) ** 2)
  }
  const clipped = clipBelow(body, joinY)
  // The sampled round outline interpolates the clipping intersections. Use
  // the exact analytic shoulder x positions so the peg retains its full width.
  if (joinY < height)
    for (const point of clipped) {
      if (Math.abs(point.y - joinY) < 1e-6) point.x = point.x < width / 2 ? left : right
    }
  // Locate the lower boundary segment and replace it with the tab. Any shape
  // bottom edge is a single horizontal segment after clipping.
  const lower = clipped.reduce((best, point, index) => {
    const next = clipped[(index + 1) % clipped.length]
    return Math.abs(point.y - joinY) < 1e-6 &&
      Math.abs(next.y - joinY) < 1e-6 &&
      point.x >= right - 1e-6 &&
      next.x <= left + 1e-6
      ? index
      : best
  }, -1)
  if (lower < 0) throw new Error('The shape has no valid mounting-tab connection.')
  const ordered = [...clipped.slice(lower + 1), ...clipped.slice(0, lower + 1)]
  ordered.push(
    { x: right, y: joinY },
    { x: right, y: height + tabDepth },
    { x: left, y: height + tabDepth },
    { x: left, y: joinY },
  )
  return deduplicate(ordered)
}

function clipBelow(points: Point[], limit: number): Point[] {
  const output: Point[] = []
  for (let i = 0; i < points.length; i++) {
    const a = points[i]
    const b = points[(i + 1) % points.length]
    const aInside = a.y <= limit + 1e-9
    const bInside = b.y <= limit + 1e-9
    if (aInside) output.push({ x: a.x, y: Math.min(a.y, limit) })
    if (aInside !== bInside) {
      const fraction = (limit - a.y) / (b.y - a.y)
      output.push({ x: a.x + fraction * (b.x - a.x), y: limit })
    }
  }
  return deduplicate(output)
}

export function pointsToPath(points: Point[]): string {
  return (
    points
      .map(
        (point, index) =>
          `${index ? 'L' : 'M'}${Number(point.x.toFixed(4))} ${Number(point.y.toFixed(4))}`,
      )
      .join(' ') + ' Z'
  )
}

import * as THREE from 'three'
import type { ShapeKind } from './types'
import { getPanelOutline } from './shapes'

/** Shared fabrication contours keep the preview and manufactured silhouettes identical. */
export function acrylicShape(
  kind: ShapeKind,
  width: number,
  height: number,
  tabWidth: number,
  tabDepth: number,
): THREE.Shape {
  const outline = getPanelOutline(kind, width, height, tabWidth, tabDepth)
  const shape = new THREE.Shape()
  for (let i = 0; i < outline.length; i++) {
    const point = outline[i]
    const x = point.x - width / 2
    const y = height - point.y
    if (i === 0) shape.moveTo(x, y)
    else shape.lineTo(x, y)
  }
  shape.closePath()
  return shape
}

export const shapeIndex: Record<ShapeKind, number> = {
  rectangle: 0,
  arch: 1,
  circle: 2,
  triangle: 3,
  wave: 4,
  pill: 5,
}

export const roomVertexShader = /* glsl */ `
  varying vec3 vWorld;
  void main() {
    vec4 world = modelMatrix * vec4(position, 1.0);
    vWorld = world.xyz;
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`

export const roomFragmentShader = /* glsl */ `
  precision highp float;
  varying vec3 vWorld;
  uniform vec3 uLight;
  uniform vec3 uDirection;
  uniform float uPower;
  uniform float uAmbient;
  uniform float uCone;
  uniform float uSurface;
  uniform int uCount;
  uniform vec3 uOrigin[25];
  uniform vec3 uAxis[25];
  uniform vec3 uColor[25];
  uniform vec3 uSizeShape[25];

  float silhouette(vec2 p, vec3 sizeShape, out float halo) {
    float kind = sizeShape.z;
    float aspect = min(sizeShape.x / sizeShape.y / 2.0, 0.5);
    float boundary = max(abs(p.x) - 0.5, max(-p.y, p.y - 1.0));
    if (kind > 0.5 && kind < 1.5 && p.y > 1.0 - aspect) {
      boundary = max(boundary, (length(vec2(p.x * 2.0, (p.y - 1.0 + aspect) / aspect)) - 1.0) * 0.4);
    } else if (kind > 1.5 && kind < 2.5) {
      boundary = (length(vec2(p.x * 2.0, (p.y - 0.5) * 2.0)) - 1.0) * 0.4;
    } else if (kind > 2.5 && kind < 3.5) {
      boundary = max(boundary, abs(p.x) - (1.0 - p.y) * 0.5);
    } else if (kind > 3.5 && kind < 4.5) {
      boundary = max(boundary, p.y - (0.82 + 0.18 * cos((p.x + 0.5) * 6.283185)));
    } else if (kind > 4.5) {
      float radius = min(sizeShape.x, sizeShape.y) * 0.5;
      vec2 q = abs(vec2(p.x * sizeShape.x, (p.y - 0.5) * sizeShape.y)) - (sizeShape.xy * 0.5 - radius);
      boundary = (length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - radius) / max(sizeShape.x, sizeShape.y);
    }
    float edge = max(fwidth(boundary) * 1.4, 0.022);
    halo = 1.0 - smoothstep(-0.04, 0.16, boundary);
    return 1.0 - smoothstep(-edge, edge, boundary);
  }

  void main() {
    vec3 ray = vWorld - uLight;
    float distanceSquared = dot(ray, ray);
    float cone = dot(normalize(ray), uDirection);
    float beam = smoothstep(uCone, min(0.9999, uCone + 0.045), cone);
    vec3 transmission = vec3(1.0);
    vec3 scatter = vec3(0.0);
    float intercepted = 0.0;
    for (int i = 0; i < 25; i++) {
      if (i >= uCount) break;
      vec3 axis = uAxis[i];
      vec3 normal = vec3(-axis.z, 0.0, axis.x);
      float denom = dot(ray, normal);
      if (abs(denom) < 0.0001) continue;
      float t = dot(uOrigin[i] - uLight, normal) / denom;
      if (t <= 0.0 || t >= 1.0) continue;
      vec3 hit = uLight + t * ray - uOrigin[i];
      vec2 p = vec2(dot(hit, axis) / uSizeShape[i].x, hit.y / uSizeShape[i].y);
      float halo;
      float mask = silhouette(p, uSizeShape[i], halo);
      vec3 pigment = 0.005 + pow(uColor[i], vec3(1.05)) * 0.995;
      // Beer-Lambert inspired absorption: overlapped sheets mix subtractively.
      transmission *= mix(vec3(1.0), pigment, mask * 0.98);
      scatter += pigment * halo * (1.0 - mask) * 0.055;
      intercepted = max(intercepted, mask);
    }
    vec3 surfaceNormal = uSurface > 0.5 ? vec3(0.0, 0.0, 1.0) : vec3(0.0, 1.0, 0.0);
    float incidence = max(dot(normalize(-ray), surfaceNormal), 0.0);
    float falloff = min(1.8, 78.0 / max(distanceSquared, 1.0));
    float power = uPower * beam * falloff * (0.4 + incidence * 0.6);
    vec3 base = vec3(0.006, 0.007, 0.009) + uAmbient * vec3(0.055, 0.06, 0.07);
    float corner = uSurface > 0.5 ? smoothstep(0.0, 1.5, vWorld.y) : smoothstep(0.0, 1.4, vWorld.z + 4.8);
    base *= mix(0.65, 1.0, corner);
    vec3 color = base + (mix(vec3(0.045, 0.043, 0.04), transmission * 0.64, intercepted) + scatter) * power;
    if (uSurface < 0.5) {
      vec2 grid = abs(fract(vWorld.xz - 0.5) - 0.5) / max(fwidth(vWorld.xz), vec2(0.0001));
      float line = 1.0 - min(min(grid.x, grid.y), 1.0);
      float fade = 1.0 - smoothstep(1.5, 9.0, length(vWorld.xz));
      color += vec3(0.005) * line * fade;
      float footShadow = exp(-dot(vWorld.xz, vWorld.xz) * 0.8);
      color *= 1.0 - footShadow * 0.36;
    }
    gl_FragColor = vec4(color, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`

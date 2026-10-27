import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js'
import type { FabricationSettings, KitElement, LightSettings, ViewMode } from '../lib/types'
import { acrylicShape, roomFragmentShader, roomVertexShader, shapeIndex } from '../lib/scene-shapes'

interface StudioSceneProps {
  elements: KitElement[]
  lighting: LightSettings
  fabrication: FabricationSettings
  selectedId: string | null
  onSelect: (id: string | null) => void
  viewMode: ViewMode
  resetKey: number
  onReady?: (ready: boolean) => void
  onRotationPause?: (angle: number) => void
}

const SCALE = 0.01
const BASE_HEIGHT = 1.65
const LIGHT_POSITION = new THREE.Vector3(-3.6, 4.1, 4.8)
const LIGHT_TARGET = new THREE.Vector3(0, 2.45, -0.2)

function disposeObject(root: THREE.Object3D) {
  root.traverse((object) => {
    const mesh = object as THREE.Mesh
    mesh.geometry?.dispose()
    if (Array.isArray(mesh.material)) mesh.material.forEach((material) => material.dispose())
    else mesh.material?.dispose()
  })
}

function cylinderBetween(
  start: THREE.Vector3,
  end: THREE.Vector3,
  radius: number,
  material: THREE.Material,
) {
  const direction = new THREE.Vector3().subVectors(end, start)
  const mesh = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, direction.length(), 12),
    material,
  )
  mesh.position.copy(start).add(end).multiplyScalar(0.5)
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize())
  mesh.castShadow = true
  return mesh
}

export function StudioScene(props: StudioSceneProps) {
  const container = useRef<HTMLDivElement>(null)
  const latest = useRef(props)
  latest.current = props
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    const host = container.current
    if (!host) return
    let renderer: THREE.WebGLRenderer
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: false,
        powerPreference: 'high-performance',
      })
    } catch {
      setFailed(true)
      latest.current.onReady?.(false)
      return
    }
    renderer.setClearColor('#171b20')
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.2
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFSoftShadowMap
    renderer.domElement.setAttribute(
      'aria-label',
      'Interactive 3D lighting studio. Drag to orbit, scroll to zoom, or use the view buttons.',
    )
    renderer.domElement.setAttribute('role', 'img')
    renderer.domElement.style.display = 'block'
    renderer.domElement.style.width = '100%'
    renderer.domElement.style.height = '100%'
    host.appendChild(renderer.domElement)

    const scene = new THREE.Scene()
    scene.background = new THREE.Color('#171b20')
    scene.fog = new THREE.FogExp2('#171b20', 0.028)
    const environmentRoom = new RoomEnvironment()
    const environmentGenerator = new THREE.PMREMGenerator(renderer)
    const environment = environmentGenerator.fromScene(environmentRoom, 0.04)
    scene.environment = environment.texture
    scene.environmentIntensity = 0.48
    environmentRoom.dispose()
    environmentGenerator.dispose()
    const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 80)
    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true
    controls.dampingFactor = 0.08
    controls.minDistance = 4
    controls.maxDistance = 21
    controls.maxPolarAngle = Math.PI * 0.49
    controls.minPolarAngle = 0.04
    controls.target.set(0, 1.75, -0.65)
    const setCamera = (view: ViewMode) => {
      if (view === 'top') camera.position.set(0.01, 12.5, 0.01)
      else if (view === 'front') camera.position.set(0, 3.4, 12.5)
      else camera.position.set(6.6, 4.4, 9.4)
      controls.target.set(0.15, 1.75, -0.65)
      controls.update()
    }
    setCamera(latest.current.viewMode)

    const lightDirection = LIGHT_TARGET.clone().sub(LIGHT_POSITION).normalize()
    const uniforms = {
      uLight: { value: LIGHT_POSITION },
      uDirection: { value: lightDirection },
      uPower: { value: 0.8 },
      uAmbient: { value: 0.12 },
      uCone: { value: Math.cos(THREE.MathUtils.degToRad(21)) },
      uCount: { value: 0 },
      uOrigin: { value: Array.from({ length: 25 }, () => new THREE.Vector3()) },
      uAxis: { value: Array.from({ length: 25 }, () => new THREE.Vector3(1, 0, 0)) },
      uColor: { value: Array.from({ length: 25 }, () => new THREE.Color()) },
      uSizeShape: { value: Array.from({ length: 25 }, () => new THREE.Vector3(1, 1, 0)) },
    }
    const floorMaterial = new THREE.ShaderMaterial({
      vertexShader: roomVertexShader,
      fragmentShader: roomFragmentShader,
      uniforms: { ...uniforms, uSurface: { value: 0 } },
      toneMapped: false,
    })
    const wallMaterial = new THREE.ShaderMaterial({
      vertexShader: roomVertexShader,
      fragmentShader: roomFragmentShader,
      uniforms: { ...uniforms, uSurface: { value: 1 } },
      toneMapped: false,
    })
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(35, 35), floorMaterial)
    floor.rotation.x = -Math.PI / 2
    scene.add(floor)
    const wall = new THREE.Mesh(new THREE.PlaneGeometry(32, 15), wallMaterial)
    wall.position.set(0, 7.5, -4.8)
    scene.add(wall)
    const sideWall = new THREE.Mesh(
      new THREE.PlaneGeometry(20, 15),
      new THREE.MeshStandardMaterial({ color: '#171b20', roughness: 1 }),
    )
    sideWall.position.set(-9, 7.5, 3)
    sideWall.rotation.y = Math.PI / 2
    scene.add(sideWall)

    const hemi = new THREE.HemisphereLight('#bdcce4', '#262d35', 1.4)
    scene.add(hemi)
    const rim = new THREE.DirectionalLight('#bacdff', 2.8)
    rim.position.set(3, 7, -3)
    scene.add(rim)
    const key = new THREE.SpotLight('#fff0d8', 75, 25, THREE.MathUtils.degToRad(21), 0.4, 1.6)
    key.position.copy(LIGHT_POSITION)
    key.target.position.copy(LIGHT_TARGET)
    scene.add(key, key.target)
    const fill = new THREE.PointLight('#bfc9dc', 15, 12, 1.7)
    fill.position.set(2, 4.5, 5)
    scene.add(fill)

    const tripod = new THREE.Group()
    const metal = new THREE.MeshStandardMaterial({
      color: '#30353c',
      metalness: 0.78,
      roughness: 0.28,
    })
    const rubber = new THREE.MeshStandardMaterial({ color: '#101317', roughness: 0.85 })
    tripod.add(
      cylinderBetween(
        new THREE.Vector3(0, 0.16, 0),
        new THREE.Vector3(0, BASE_HEIGHT - 0.08, 0),
        0.045,
        metal,
      ),
    )
    const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.13, 20), metal)
    collar.position.y = 0.83
    tripod.add(collar)
    for (let i = 0; i < 3; i++) {
      const angle = (i * Math.PI * 2) / 3 + Math.PI / 6
      const foot = new THREE.Vector3(Math.cos(angle) * 0.84, 0.045, Math.sin(angle) * 0.84)
      tripod.add(cylinderBetween(new THREE.Vector3(0, 0.88, 0), foot, 0.035, metal))
      tripod.add(
        cylinderBetween(
          new THREE.Vector3(0, 0.3, 0),
          foot.clone().multiplyScalar(0.64).setY(0.36),
          0.016,
          metal,
        ),
      )
      const pad = new THREE.Mesh(new THREE.SphereGeometry(0.07, 12, 8), rubber)
      pad.scale.y = 0.65
      pad.position.copy(foot)
      tripod.add(pad)
    }
    const turntable = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.25, 0.1, 32), metal)
    turntable.position.y = BASE_HEIGHT - 0.07
    tripod.add(turntable)
    scene.add(tripod)

    const kit = new THREE.Group()
    kit.position.y = BASE_HEIGHT
    scene.add(kit)
    let panelMeshes: THREE.Mesh[] = []
    let panelEdges: THREE.LineSegments[] = []
    let lastElements: KitElement[] | undefined
    let lastFabrication: FabricationSettings | undefined
    let lastLighting: LightSettings | undefined
    let lastSelected: string | null | undefined
    let lastView = latest.current.viewMode
    let lastReset = latest.current.resetKey
    let lastRotation = latest.current.lighting.rotation
    let lastPlaying = latest.current.lighting.playing
    let lastQuality = ''
    let angle = THREE.MathUtils.degToRad(lastRotation)

    const rebuildKit = () => {
      for (const child of [...kit.children]) {
        kit.remove(child)
        disposeObject(child)
      }
      panelMeshes = []
      panelEdges = []
      const { fabrication, elements } = latest.current
      const size = fabrication.baseSize * SCALE
      const grid = fabrication.gridSize
      const spacing = size / (grid + 1)
      const thickness = fabrication.thickness * SCALE
      const baseShape = new THREE.Shape()
      baseShape.moveTo(-size / 2, -size / 2)
      baseShape.lineTo(size / 2, -size / 2)
      baseShape.lineTo(size / 2, size / 2)
      baseShape.lineTo(-size / 2, size / 2)
      baseShape.closePath()
      const slot = (fabrication.thickness + fabrication.clearance) * SCALE
      for (let row = 0; row < grid; row++) {
        for (let col = 0; col < grid; col++) {
          const x = (col - (grid - 1) / 2) * spacing
          const y = (row - (grid - 1) / 2) * spacing
          const hole = new THREE.Path()
          hole.moveTo(x - slot / 2, y - slot / 2)
          hole.lineTo(x - slot / 2, y + slot / 2)
          hole.lineTo(x + slot / 2, y + slot / 2)
          hole.lineTo(x + slot / 2, y - slot / 2)
          hole.closePath()
          baseShape.holes.push(hole)
        }
      }
      const baseGeometry = new THREE.ExtrudeGeometry(baseShape, {
        depth: Math.max(thickness, 0.035),
        bevelEnabled: true,
        bevelThickness: 0.005,
        bevelSize: 0.005,
        bevelSegments: 1,
        steps: 1,
      })
      baseGeometry.rotateX(-Math.PI / 2)
      const baseMaterial = new THREE.MeshPhysicalMaterial({
        color: '#dbe7ed',
        roughness: 0.13,
        metalness: 0,
        transmission: 0.9,
        thickness: 0.04,
        transparent: true,
        opacity: 0.65,
        side: THREE.DoubleSide,
        envMapIntensity: 0.8,
      })
      const base = new THREE.Mesh(baseGeometry, baseMaterial)
      kit.add(base)
      const baseEdges = new THREE.LineSegments(
        new THREE.EdgesGeometry(baseGeometry, 30),
        new THREE.LineBasicMaterial({ color: '#a1b4c2', transparent: true, opacity: 0.44 }),
      )
      kit.add(baseEdges)
      // Small registration marks make the otherwise transparent slots legible.
      for (let row = 0; row < grid; row++) {
        for (let col = 0; col < grid; col++) {
          const marker = new THREE.Mesh(
            new THREE.RingGeometry(0.035, 0.047, 4),
            new THREE.MeshBasicMaterial({
              color: '#b0c2c9',
              transparent: true,
              opacity: 0.4,
              side: THREE.DoubleSide,
            }),
          )
          marker.rotation.x = -Math.PI / 2
          marker.rotation.z = Math.PI / 4
          marker.position.set(
            (col - (grid - 1) / 2) * spacing,
            thickness + 0.007,
            (row - (grid - 1) / 2) * spacing,
          )
          kit.add(marker)
        }
      }
      for (const element of elements.slice(0, 25)) {
        const geometry = new THREE.ExtrudeGeometry(
          acrylicShape(
            element.shape,
            element.width * SCALE,
            element.height * SCALE,
            thickness,
            thickness,
          ),
          {
            depth: thickness,
            bevelEnabled: true,
            bevelSegments: 2,
            steps: 1,
            bevelSize: 0.004,
            bevelThickness: 0.003,
            curveSegments: 36,
          },
        )
        geometry.translate(0, 0, -thickness / 2)
        const color = new THREE.Color(element.color)
        const material = new THREE.MeshPhysicalMaterial({
          color,
          metalness: 0,
          roughness: 0.075,
          transmission: 0.88,
          thickness: 0.045,
          ior: 1.49,
          transparent: true,
          opacity: 0.78,
          side: THREE.DoubleSide,
          depthWrite: false,
          attenuationColor: color,
          attenuationDistance: 0.6,
          emissive: color,
          emissiveIntensity: 0.025,
          clearcoat: 1,
          clearcoatRoughness: 0.06,
          envMapIntensity: 1.15,
        })
        const panel = new THREE.Mesh(geometry, material)
        panel.position.set(
          (element.col - (grid - 1) / 2) * spacing,
          thickness + 0.002,
          (element.row - (grid - 1) / 2) * spacing,
        )
        panel.rotation.y = THREE.MathUtils.degToRad(element.rotation)
        panel.userData.elementId = element.id
        panel.renderOrder = 2
        const edges = new THREE.LineSegments(
          new THREE.EdgesGeometry(geometry, 25),
          new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.8 }),
        )
        edges.position.copy(panel.position)
        edges.rotation.copy(panel.rotation)
        edges.renderOrder = 3
        kit.add(panel, edges)
        panelMeshes.push(panel)
        panelEdges.push(edges)
      }
      uniforms.uCount.value = panelMeshes.length
      lastSelected = undefined
    }

    // A restrained volumetric shaft from the actual spotlight, separate from surface transmission.
    const beamDistance = 11.5
    const beamGeometry = new THREE.ConeGeometry(3.7, beamDistance, 48, 1, true)
    beamGeometry.translate(0, -beamDistance / 2, 0)
    const beamMaterial = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      uniforms: { uOpacity: { value: 0.016 } },
      vertexShader:
        'varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
      fragmentShader:
        'varying vec2 vUv; uniform float uOpacity; void main(){ float edge=pow(sin(vUv.x*3.14159265),2.0); gl_FragColor=vec4(0.79,0.83,0.92,uOpacity*edge*pow(vUv.y,1.8)); }',
    })
    const beam = new THREE.Mesh(beamGeometry, beamMaterial)
    beam.position.copy(LIGHT_POSITION)
    beam.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), lightDirection)
    beam.renderOrder = 4
    scene.add(beam)

    let width = 1
    let height = 1
    let needsRender = true
    const resize = () => {
      width = Math.max(1, host.clientWidth)
      height = Math.max(1, host.clientHeight)
      renderer.setSize(width, height, false)
      camera.aspect = width / height
      camera.updateProjectionMatrix()
      needsRender = true
    }
    const observer = new ResizeObserver(resize)
    observer.observe(host)
    resize()

    const pointerStart = new THREE.Vector2()
    const raycaster = new THREE.Raycaster()
    const pointer = new THREE.Vector2()
    const onPointerDown = (event: PointerEvent) => {
      pointerStart.set(event.clientX, event.clientY)
    }
    const onPointerUp = (event: PointerEvent) => {
      if (
        event.button !== 0 ||
        pointerStart.distanceTo(new THREE.Vector2(event.clientX, event.clientY)) > 5
      )
        return
      const bounds = renderer.domElement.getBoundingClientRect()
      pointer.set(
        ((event.clientX - bounds.left) / bounds.width) * 2 - 1,
        (-(event.clientY - bounds.top) / bounds.height) * 2 + 1,
      )
      raycaster.setFromCamera(pointer, camera)
      const hit = raycaster.intersectObjects(panelMeshes)[0]
      if (hit) latest.current.onSelect(hit.object.userData.elementId as string)
    }
    let contextLost = false
    const onContextLost = (event: Event) => {
      event.preventDefault()
      contextLost = true
      cancelAnimationFrame(frame)
      setFailed(true)
      latest.current.onReady?.(false)
    }
    renderer.domElement.addEventListener('pointerdown', onPointerDown)
    renderer.domElement.addEventListener('pointerup', onPointerUp)
    renderer.domElement.addEventListener('webglcontextlost', onContextLost)

    let frame = 0
    let lastTime = 0
    let disposed = false
    const axis = new THREE.Vector3()
    const animate = (time: number) => {
      if (disposed || contextLost) return
      frame = requestAnimationFrame(animate)
      const delta = Math.min((time - lastTime) / 1000 || 0, 0.05)
      lastTime = time
      if (document.hidden || !width || !height) return
      const { lighting, fabrication, elements, selectedId, viewMode, resetKey } = latest.current
      const controlsChanged = controls.update()
      const inputChanged =
        lighting !== lastLighting ||
        elements !== lastElements ||
        fabrication !== lastFabrication ||
        selectedId !== lastSelected ||
        viewMode !== lastView ||
        resetKey !== lastReset
      // Keep the lightweight control loop responsive, but submit no GPU work
      // while paused once camera damping and all pending changes have settled.
      if (!lighting.playing && !inputChanged && !controlsChanged && !needsRender) return
      const lightingOnlyUpdate = elements === lastElements && fabrication === lastFabrication
      const projectReplaced =
        lastElements !== undefined &&
        lastFabrication !== undefined &&
        elements !== lastElements &&
        fabrication !== lastFabrication
      const baseChanged =
        !lastFabrication ||
        fabrication.baseSize !== lastFabrication.baseSize ||
        fabrication.gridSize !== lastFabrication.gridSize ||
        fabrication.thickness !== lastFabrication.thickness ||
        fabrication.clearance !== lastFabrication.clearance
      if (baseChanged || elements !== lastElements) {
        rebuildKit()
      }
      lastElements = elements
      lastFabrication = fabrication
      lastLighting = lighting
      if (viewMode !== lastView || resetKey !== lastReset) {
        setCamera(viewMode)
        lastView = viewMode
        lastReset = resetKey
      }
      if (lastQuality !== lighting.quality) {
        renderer.setPixelRatio(
          Math.min(window.devicePixelRatio, lighting.quality === 'high' ? 2 : 1),
        )
        resize()
        lastQuality = lighting.quality
      }
      if (
        lastPlaying &&
        !lighting.playing &&
        lighting.rotation === lastRotation &&
        lightingOnlyUpdate
      ) {
        const pausedAngle = ((THREE.MathUtils.radToDeg(angle) % 360) + 360) % 360
        angle = THREE.MathUtils.degToRad(pausedAngle)
        latest.current.onRotationPause?.(pausedAngle)
      }
      lastPlaying = lighting.playing
      if (projectReplaced || lighting.rotation !== lastRotation) {
        angle = THREE.MathUtils.degToRad(lighting.rotation)
        lastRotation = lighting.rotation
      }
      if (lighting.playing) angle += (delta * lighting.speed * Math.PI * 2) / 60
      kit.rotation.y = angle
      kit.updateMatrixWorld(true)
      for (let i = 0; i < panelMeshes.length; i++) {
        const panel = panelMeshes[i]
        const element = elements[i]
        panel.getWorldPosition(uniforms.uOrigin.value[i])
        axis.set(1, 0, 0).transformDirection(panel.matrixWorld)
        uniforms.uAxis.value[i].copy(axis)
        uniforms.uColor.value[i].set(element.color)
        uniforms.uSizeShape.value[i].set(
          element.width * SCALE,
          element.height * SCALE,
          shapeIndex[element.shape],
        )
        if (selectedId !== lastSelected) {
          const edgeMaterial = panelEdges[i].material as THREE.LineBasicMaterial
          edgeMaterial.color.set(element.id === selectedId ? '#edffbc' : element.color)
          edgeMaterial.opacity = element.id === selectedId ? 1 : 0.75
        }
      }
      lastSelected = selectedId
      uniforms.uPower.value = (lighting.intensity / 100) * 1.4
      uniforms.uAmbient.value = lighting.ambient / 100
      uniforms.uCone.value = Math.cos(THREE.MathUtils.degToRad(lighting.beamAngle / 2))
      hemi.intensity = 0.55 + (lighting.ambient / 100) * 3
      rim.intensity = 0.6 + (lighting.intensity / 100) * 2.1
      fill.intensity = 4 + (lighting.ambient / 100) * 24
      key.intensity = (lighting.intensity / 100) * 95
      key.angle = THREE.MathUtils.degToRad(lighting.beamAngle / 2)
      beam.visible = lighting.showBeam && lighting.intensity > 0
      const beamScale = Math.tan(key.angle) / Math.tan(THREE.MathUtils.degToRad(21))
      beam.scale.set(beamScale, 1, beamScale)
      beamMaterial.uniforms.uOpacity.value = (lighting.intensity / 100) * 0.019
      renderer.render(scene, camera)
      needsRender = false
    }
    frame = requestAnimationFrame(animate)
    latest.current.onReady?.(true)

    return () => {
      disposed = true
      cancelAnimationFrame(frame)
      observer.disconnect()
      controls.dispose()
      renderer.domElement.removeEventListener('pointerdown', onPointerDown)
      renderer.domElement.removeEventListener('pointerup', onPointerUp)
      renderer.domElement.removeEventListener('webglcontextlost', onContextLost)
      disposeObject(scene)
      environment.dispose()
      renderer.dispose()
      renderer.domElement.remove()
    }
  }, [])

  return (
    <div
      ref={container}
      className="studio-canvas"
      style={{ width: '100%', height: '100%', position: 'relative', overflow: 'hidden' }}
    >
      {failed && (
        <div
          role="status"
          style={{
            position: 'absolute',
            inset: 0,
            display: 'grid',
            placeContent: 'center',
            textAlign: 'center',
            padding: 32,
            color: '#a7adb7',
            background: '#191d23',
          }}
        >
          <strong style={{ color: '#e3e8ef', marginBottom: 10 }}>The 3D preview needs WebGL</strong>
          <span>
            Enable hardware acceleration and reload to preview your light.
            <br />
            You can still design the kit and export your cut plan.
          </span>
        </div>
      )}
    </div>
  )
}

export default StudioScene

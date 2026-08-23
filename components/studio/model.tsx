"use client"

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react"
import { useFrame, useLoader } from "@react-three/fiber"
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js"
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js"
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js"
import {
  AnimationAction,
  AnimationClip,
  AnimationMixer,
  Box3,
  BufferGeometry,
  Color,
  Group,
  Material,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  Vector3,
} from "three"
import type { CaptureController } from "@/lib/studio/capture"
import type { ModelSource, StudioSettings } from "@/lib/studio/settings"

export interface ModelStats {
  triangles: number
  meshes: number
  clips: string[]
  fitScale: number
  /** True when the file's own transforms mirror the geometry — no rotation can undo that. */
  mirrored: boolean
}

const DEG = Math.PI / 180
const FIT_TARGET = 2.6

/** Rotation about X that brings the named model axis to +Y. */
const UP_AXIS_ROTATION: Record<string, number> = {
  y: 0,
  z: -Math.PI / 2,
  "-y": Math.PI,
  "-z": Math.PI / 2,
}

function configureLoader(loader: GLTFLoader) {
  const draco = new DRACOLoader()
  // Decoder is vendored into /public so a dropped Draco model works with no network.
  draco.setDecoderPath("/draco/")
  loader.setDRACOLoader(draco)
  loader.setMeshoptDecoder(MeshoptDecoder)
}

function measureContent(root: Object3D) {
  let triangles = 0
  let meshes = 0
  let mirrored = false
  root.updateMatrixWorld(true)
  root.traverse((obj) => {
    const mesh = obj as Mesh
    if (!(mesh as unknown as { isMesh?: boolean }).isMesh) return
    meshes++
    // A negative determinant means the file mirrors this mesh; the studio has to offer a
    // mirror to undo it, because reflections are not reachable by rotation.
    if (mesh.matrixWorld.determinant() < 0) mirrored = true
    const geo = mesh.geometry as BufferGeometry
    if (geo?.index) triangles += geo.index.count / 3
    else if (geo?.attributes?.position) triangles += geo.attributes.position.count / 3
  })
  return { triangles: Math.round(triangles), meshes, mirrored }
}

/** Centres on the bounding box so a 360 spin turns about the model, not about the origin. */
function fitObject(object: Object3D) {
  object.position.set(0, 0, 0)
  object.scale.setScalar(1)
  object.rotation.set(0, 0, 0)

  // Measure in this group's own frame. Box3 walks world matrices, so an ancestor already
  // carrying a tilt or a spin would be folded into the centring offset.
  const parent = object.parent
  const parentWorld = parent ? parent.matrixWorld.clone() : null
  if (parent) parent.matrixWorld.identity()
  object.updateMatrixWorld(true)
  const box = new Box3().setFromObject(object)
  if (parent && parentWorld) {
    parent.matrixWorld.copy(parentWorld)
    object.updateMatrixWorld(true)
  }

  if (box.isEmpty()) return { scale: 1, center: new Vector3() }
  const size = box.getSize(new Vector3())
  const center = box.getCenter(new Vector3())
  const maxDim = Math.max(size.x, size.y, size.z) || 1
  return { scale: FIT_TARGET / maxDim, center }
}

function PrimitiveGeometry({ shape }: { shape: string }) {
  switch (shape) {
    case "torus":
      return <torusGeometry args={[1, 0.38, 48, 128]} />
    case "icosahedron":
      return <icosahedronGeometry args={[1.2, 0]} />
    case "box":
      return <boxGeometry args={[1.6, 1.6, 1.6]} />
    case "sphere":
      return <sphereGeometry args={[1.2, 64, 48]} />
    case "cone":
      return <coneGeometry args={[1.1, 2.2, 64]} />
    default:
      return <torusKnotGeometry args={[0.9, 0.32, 220, 40]} />
  }
}

function GltfContent({ url, onContent }: { url: string; onContent: (o: Object3D, clips: AnimationClip[]) => void }) {
  const gltf = useLoader(GLTFLoader, url, configureLoader)
  useLayoutEffect(() => {
    onContent(gltf.scene, gltf.animations ?? [])
  }, [gltf, onContent])
  return <primitive object={gltf.scene} />
}

interface ModelStageProps {
  source: ModelSource
  settingsRef: React.RefObject<StudioSettings>
  controller: CaptureController
  onStats: (stats: ModelStats) => void
  /** Called when the preview spin is paused, to bake the angle reached into a saved value. */
  onCommitPhase: (phase: { phaseX: number; phaseY: number; phaseZ: number }) => void
}

export function ModelStage({ source, settingsRef, controller, onStats, onCommitPhase }: ModelStageProps) {
  const spinRef = useRef<Group>(null)
  const orientRef = useRef<Group>(null)
  const fitRef = useRef<Group>(null)
  // The live rotation phase, in radians. Authoritative for rendering; mirrored into
  // settings (in degrees) so it can be typed, saved and reloaded.
  const autoSpin = useRef({ x: 0, y: 0, z: 0 })
  const lastPhase = useRef({ x: 0, y: 0, z: 0 })
  const wasSpinning = useRef(false)
  const [content, setContent] = useState<{ object: Object3D; clips: AnimationClip[] } | null>(null)

  const fit = useRef({ scale: 1, center: new Vector3() })
  const mixerRef = useRef<AnimationMixer | null>(null)
  const actionRef = useRef<AnimationAction | null>(null)
  const clipsRef = useRef<AnimationClip[]>([])
  const originalMaterials = useRef(new Map<Mesh, Material | Material[]>())

  const overrideMaterial = useMemo(
    () => new MeshStandardMaterial({ color: "#917AFF", roughness: 0.12, metalness: 0, flatShading: false }),
    []
  )
  const materialSnapshot = useRef({ color: "", roughness: -1, metalness: -1, flatShading: false, override: null as boolean | null })
  const colorScratch = useMemo(() => new Color(), [])

  const handleContent = useMemo(
    () => (object: Object3D, clips: AnimationClip[]) => setContent({ object, clips }),
    []
  )

  // Re-fit and re-measure whenever the loaded object changes.
  useLayoutEffect(() => {
    const group = fitRef.current
    if (!group) return
    originalMaterials.current.clear()
    materialSnapshot.current.override = null

    const measured = fitObject(group)
    fit.current = measured

    const { triangles, meshes, mirrored } = measureContent(group)
    const clips = content?.clips ?? []
    clipsRef.current = clips

    mixerRef.current?.stopAllAction()
    actionRef.current = null
    mixerRef.current = clips.length > 0 && content ? new AnimationMixer(content.object) : null

    onStats({ triangles, meshes, mirrored, clips: clips.map((c) => c.name || "clip"), fitScale: measured.scale })
  }, [content, source, onStats])

  useEffect(() => () => overrideMaterial.dispose(), [overrideMaterial])

  const applyMaterial = (s: StudioSettings) => {
    const group = fitRef.current
    if (!group) return
    const snap = materialSnapshot.current
    const m = s.material

    if (snap.override !== m.override) {
      group.traverse((obj) => {
        const mesh = obj as Mesh
        if (!(mesh as unknown as { isMesh?: boolean }).isMesh) return
        if (m.override) {
          if (!originalMaterials.current.has(mesh)) originalMaterials.current.set(mesh, mesh.material)
          mesh.material = overrideMaterial
        } else {
          const original = originalMaterials.current.get(mesh)
          if (original) mesh.material = original
        }
      })
      snap.override = m.override
    }
    if (!m.override) return

    if (snap.color !== m.color) {
      colorScratch.set(m.color)
      overrideMaterial.color.copy(colorScratch)
      snap.color = m.color
    }
    if (snap.roughness !== m.roughness) {
      overrideMaterial.roughness = m.roughness
      snap.roughness = m.roughness
    }
    if (snap.metalness !== m.metalness) {
      overrideMaterial.metalness = m.metalness
      snap.metalness = m.metalness
    }
    if (snap.flatShading !== m.flatShading) {
      overrideMaterial.flatShading = m.flatShading
      overrideMaterial.needsUpdate = true
      snap.flatShading = m.flatShading
    }
  }

  /**
   * Makes sure the selected clip is the one playing, and returns it.
   * A mixer with no playing action does nothing at all, in either mode.
   */
  const playingClip = (s: StudioSettings) => {
    const mixer = mixerRef.current
    const clips = clipsRef.current
    if (!mixer || !s.animation.enabled || clips.length === 0) {
      if (actionRef.current) {
        actionRef.current.stop()
        actionRef.current = null
      }
      return null
    }
    const clip = clips[Math.min(s.animation.clip, clips.length - 1)]
    if (actionRef.current?.getClip() !== clip) {
      actionRef.current?.stop()
      actionRef.current = mixer.clipAction(clip)
      actionRef.current.reset().play()
    }
    return clip
  }

  // Priority -1: everything the composer is about to photograph is decided here.
  useFrame((_, delta) => {
    const s = settingsRef.current
    const spin = spinRef.current
    const orient = orientRef.current
    const group = fitRef.current
    if (!s || !spin || !orient || !group) return

    applyMaterial(s)

    const scale = fit.current.scale * s.transform.scale
    group.scale.setScalar(scale)
    group.position.set(
      -fit.current.center.x * scale,
      -fit.current.center.y * scale,
      -fit.current.center.z * scale
    )

    // Orientation sits between the centring and the spin: the correction turns a centred
    // model, and the export still spins about the corrected vertical axis. Offsets live
    // here too, so "up" keeps meaning up after a flip.
    orient.rotation.set(UP_AXIS_ROTATION[s.transform.upAxis] ?? 0, 0, 0)
    orient.scale.set(
      s.transform.mirrorX ? -1 : 1,
      s.transform.mirrorY ? -1 : 1,
      s.transform.mirrorZ ? -1 : 1
    )
    orient.position.set(s.transform.offsetX, s.transform.offsetY, 0)

    const tiltX = s.transform.tiltX * DEG
    const tiltY = s.transform.tiltY * DEG
    const tiltZ = s.transform.tiltZ * DEG

    // Adopt a phase typed into the panel (or loaded from a file) without fighting the ref.
    const typed = { x: s.transform.phaseX * DEG, y: s.transform.phaseY * DEG, z: s.transform.phaseZ * DEG }
    if (typed.x !== lastPhase.current.x || typed.y !== lastPhase.current.y || typed.z !== lastPhase.current.z) {
      autoSpin.current = { ...typed }
      lastPhase.current = { ...typed }
    }

    if (controller.capturing) {
      const pose = controller.pose
      // Start the loop from the angle the preview is showing. Without this the export
      // discards the framing the user chose and begins from an angle they never saw.
      spin.rotation.set(
        tiltX + autoSpin.current.x + pose.rotX,
        tiltY + autoSpin.current.y + pose.rotY,
        tiltZ + autoSpin.current.z + pose.rotZ
      )
      const clip = playingClip(s)
      if (clip && mixerRef.current) {
        // Absolute time, not a delta: the clip has to land on the same frame every run.
        mixerRef.current.setTime((pose.t * s.animation.loops * clip.duration) % clip.duration || 0)
      }
      controller.markPoseApplied()
      return
    }

    if (wasSpinning.current && !s.transform.spin) {
      // Pausing freezes the shot: bake the angle reached into a value that survives a reload.
      const deg = (rad: number) => Number((((rad / DEG) % 360) + 540).toFixed(1)) % 360 - 180
      lastPhase.current = { ...autoSpin.current }
      onCommitPhase({
        phaseX: deg(autoSpin.current.x),
        phaseY: deg(autoSpin.current.y),
        phaseZ: deg(autoSpin.current.z),
      })
    }
    wasSpinning.current = s.transform.spin

    if (s.transform.spin) {
      // The preview rehearses the export: it spins on whichever axes the loop will use.
      const { turnsX, turnsY, turnsZ } = s.output
      const total = Math.abs(turnsX) + Math.abs(turnsY) + Math.abs(turnsZ)
      const step = delta * s.transform.spinSpeed
      if (total === 0) {
        autoSpin.current.y += step
      } else {
        autoSpin.current.x += step * (turnsX / total)
        autoSpin.current.y += step * (turnsY / total)
        autoSpin.current.z += step * (turnsZ / total)
      }
    }
    spin.rotation.set(
      tiltX + autoSpin.current.x,
      tiltY + autoSpin.current.y,
      tiltZ + autoSpin.current.z
    )
    if (playingClip(s) && mixerRef.current) mixerRef.current.update(delta)
  }, -1)

  return (
    <group ref={spinRef}>
      <group ref={orientRef}>
        <group ref={fitRef}>
          {source.kind === "url" ? (
            <GltfContent url={source.url} onContent={handleContent} />
          ) : (
            <PrimitiveMesh shape={source.shape} onReady={handleContent} />
          )}
        </group>
      </group>
    </group>
  )
}

function PrimitiveMesh({ shape, onReady }: { shape: string; onReady: (o: Object3D, clips: AnimationClip[]) => void }) {
  const ref = useRef<Mesh>(null)
  useLayoutEffect(() => {
    if (ref.current) onReady(ref.current, [])
  }, [shape, onReady])
  return (
    <mesh ref={ref}>
      <PrimitiveGeometry shape={shape} />
      <meshStandardMaterial color="#917AFF" roughness={0.12} metalness={0} />
    </mesh>
  )
}

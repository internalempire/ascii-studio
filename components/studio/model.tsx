"use client"

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react"
import { useFrame, useLoader } from "@react-three/fiber"
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js"
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js"
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js"
import {
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
}

const DEG = Math.PI / 180
const FIT_TARGET = 2.6

function configureLoader(loader: GLTFLoader) {
  const draco = new DRACOLoader()
  // Decoder is vendored into /public so a dropped Draco model works with no network.
  draco.setDecoderPath("/draco/")
  loader.setDRACOLoader(draco)
  loader.setMeshoptDecoder(MeshoptDecoder)
}

function countTriangles(root: Object3D) {
  let triangles = 0
  let meshes = 0
  root.traverse((obj) => {
    const mesh = obj as Mesh
    if (!(mesh as unknown as { isMesh?: boolean }).isMesh) return
    meshes++
    const geo = mesh.geometry as BufferGeometry
    if (geo?.index) triangles += geo.index.count / 3
    else if (geo?.attributes?.position) triangles += geo.attributes.position.count / 3
  })
  return { triangles: Math.round(triangles), meshes }
}

/** Centres on the bounding box so a 360 spin turns about the model, not about the origin. */
function fitObject(object: Object3D) {
  object.position.set(0, 0, 0)
  object.scale.setScalar(1)
  object.updateMatrixWorld(true)
  const box = new Box3().setFromObject(object)
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
}

export function ModelStage({ source, settingsRef, controller, onStats }: ModelStageProps) {
  const spinRef = useRef<Group>(null)
  const fitRef = useRef<Group>(null)
  const autoSpin = useRef({ x: 0, y: 0, z: 0 })
  const [content, setContent] = useState<{ object: Object3D; clips: AnimationClip[] } | null>(null)

  const fit = useRef({ scale: 1, center: new Vector3() })
  const mixerRef = useRef<AnimationMixer | null>(null)
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

    const { triangles, meshes } = countTriangles(group)
    const clips = content?.clips ?? []
    clipsRef.current = clips

    mixerRef.current?.stopAllAction()
    mixerRef.current = clips.length > 0 && content ? new AnimationMixer(content.object) : null

    onStats({ triangles, meshes, clips: clips.map((c) => c.name || "clip"), fitScale: measured.scale })
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

  // Priority -1: everything the composer is about to photograph is decided here.
  useFrame((_, delta) => {
    const s = settingsRef.current
    const spin = spinRef.current
    const group = fitRef.current
    if (!s || !spin || !group) return

    applyMaterial(s)

    const scale = fit.current.scale * s.transform.scale
    group.scale.setScalar(scale)
    group.position.set(
      -fit.current.center.x * scale + s.transform.offsetX,
      -fit.current.center.y * scale + s.transform.offsetY,
      -fit.current.center.z * scale
    )

    const tiltX = s.transform.tiltX * DEG
    const tiltY = s.transform.tiltY * DEG
    const tiltZ = s.transform.tiltZ * DEG

    if (controller.capturing) {
      const pose = controller.pose
      spin.rotation.set(tiltX + pose.rotX, tiltY + pose.rotY, tiltZ + pose.rotZ)
      const mixer = mixerRef.current
      if (mixer && s.animation.enabled && clipsRef.current.length > 0) {
        const clip = clipsRef.current[Math.min(s.animation.clip, clipsRef.current.length - 1)]
        // Absolute time, not a delta: the clip has to land on the same frame every run.
        mixer.setTime((pose.t * s.animation.loops * clip.duration) % clip.duration || 0)
      }
      controller.markPoseApplied()
      return
    }

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
    if (mixerRef.current && s.animation.enabled) mixerRef.current.update(delta)
  }, -1)

  return (
    <group ref={spinRef}>
      <group ref={fitRef}>
        {source.kind === "url" ? (
          <GltfContent url={source.url} onContent={handleContent} />
        ) : (
          <PrimitiveMesh shape={source.shape} onReady={handleContent} />
        )}
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

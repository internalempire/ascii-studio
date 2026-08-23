"use client"

import { Suspense, memo, useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Canvas, useFrame, useThree } from "@react-three/fiber"
import { EffectComposer } from "@react-three/postprocessing"
import { Environment, Lightformer } from "@react-three/drei"
import { AmbientLight, DirectionalLight, PerspectiveCamera, Vector3, type WebGLRenderer } from "three"
import type { CaptureController } from "@/lib/studio/capture"
import type { ModelSource, StudioSettings } from "@/lib/studio/settings"
import { StudioAsciiEffect, type StudioAsciiEffectImpl } from "./ascii-effect-studio"
import { ModelStage, type ModelStats } from "./model"
import { ModelErrorBoundary } from "./error-boundary"

const DEG = Math.PI / 180

export interface RuntimeStats {
  fps: number
}

function Rig({
  settingsRef,
  statsRef,
}: {
  settingsRef: React.RefObject<StudioSettings>
  statsRef: React.MutableRefObject<RuntimeStats>
}) {
  const { camera, gl, scene } = useThree()
  const ambientRef = useRef<AmbientLight>(null)
  const keyRef = useRef<DirectionalLight>(null)
  const fillRef = useRef<DirectionalLight>(null)
  const rimRef = useRef<DirectionalLight>(null)
  const target = useMemo(() => new Vector3(0, 0, 0), [])
  const frames = useRef({ count: 0, since: performance.now() })

  useFrame(() => {
    const s = settingsRef.current
    if (!s) return
    const cam = camera as PerspectiveCamera
    const { cameraDistance, camAzimuth, camElevation, fov } = s.transform

    const az = camAzimuth * DEG
    const el = camElevation * DEG
    cam.position.set(
      cameraDistance * Math.cos(el) * Math.sin(az),
      cameraDistance * Math.sin(el),
      cameraDistance * Math.cos(el) * Math.cos(az)
    )
    cam.lookAt(target)
    if (cam.fov !== fov) {
      cam.fov = fov
      cam.updateProjectionMatrix()
    }

    gl.toneMappingExposure = s.light.exposure
    scene.environmentIntensity = s.light.envIntensity

    const keyAz = s.light.keyAzimuth * DEG
    const keyEl = s.light.keyElevation * DEG
    keyRef.current?.position.set(
      7 * Math.cos(keyEl) * Math.sin(keyAz),
      7 * Math.sin(keyEl),
      7 * Math.cos(keyEl) * Math.cos(keyAz)
    )
    if (ambientRef.current) ambientRef.current.intensity = s.light.ambient
    if (keyRef.current) keyRef.current.intensity = s.light.keyIntensity
    if (fillRef.current) fillRef.current.intensity = s.light.fillIntensity
    if (rimRef.current) rimRef.current.intensity = s.light.rimIntensity

    const now = performance.now()
    frames.current.count++
    if (now - frames.current.since >= 500) {
      statsRef.current.fps = Math.round((frames.current.count * 1000) / (now - frames.current.since))
      frames.current.count = 0
      frames.current.since = now
    }
  }, -3)

  return (
    <>
      <ambientLight ref={ambientRef} intensity={0.08} />
      <directionalLight ref={keyRef} position={[2, 3.5, 6]} intensity={6} />
      <directionalLight ref={fillRef} position={[-4, 1.5, 3]} intensity={0.35} />
      <directionalLight ref={rimRef} position={[0, 1, -6]} intensity={0} />
    </>
  )
}

/**
 * Reads the composited frame back.
 *
 * Priority 3 puts this after the effect composer (priority 1), so the drawing buffer
 * already holds the finished ASCII pass when we hand it to the exporter.
 */
function CaptureReader({ controller }: { controller: CaptureController }) {
  const { gl } = useThree()
  useEffect(() => {
    controller.attachCanvas(gl.domElement)
    return () => controller.attachCanvas(null)
  }, [controller, gl])
  useFrame(() => {
    controller.deliverFrame(gl.domElement)
  }, 3)
  return null
}

/** The composer touches the WebGL context directly, so give the context a couple of frames first. */
function DeferredComposer({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false)
  const count = useRef(0)
  useFrame(() => {
    if (ready) return
    count.current++
    if (count.current >= 2) setReady(true)
  })
  if (!ready) return null
  return (
    <EffectComposer multisampling={0} enableNormalPass={false}>
      {children as React.ReactElement}
    </EffectComposer>
  )
}

/** Built once and never re-rendered: a small studio softbox baked to a 64px env map. */
const StudioEnvironment = memo(function StudioEnvironment() {
  return (
    <Suspense fallback={null}>
      <Environment resolution={64} frames={1}>
        <Lightformer intensity={2.2} position={[0, 4, 2]} scale={[8, 4, 1]} rotation={[-Math.PI / 2.4, 0, 0]} />
        <Lightformer intensity={0.9} position={[-4, 1, 2]} scale={[4, 6, 1]} rotation={[0, Math.PI / 2.6, 0]} />
        <Lightformer intensity={0.7} position={[4, 0, -3]} scale={[4, 6, 1]} rotation={[0, -Math.PI / 2.2, 0]} />
        <Lightformer intensity={0.4} form="ring" position={[0, -3, 1]} scale={5} />
      </Environment>
    </Suspense>
  )
})

export interface StudioSceneProps {
  settingsRef: React.RefObject<StudioSettings>
  controller: CaptureController
  source: ModelSource
  chars: string[] | null
  cellAspect: number
  width: number
  height: number
  statsRef: React.MutableRefObject<RuntimeStats>
  effectRef: React.MutableRefObject<StudioAsciiEffectImpl | null>
  onModelStats: (stats: ModelStats) => void
  onModelError: (message: string) => void
  onCommitPhase: (phase: { phaseX: number; phaseY: number; phaseZ: number }) => void
}

export const StudioScene = memo(function StudioScene({
  settingsRef,
  controller,
  source,
  chars,
  cellAspect,
  width,
  height,
  statsRef,
  effectRef,
  onModelStats,
  onModelError,
  onCommitPhase,
}: StudioSceneProps) {
  const sourceKey = source.kind === "url" ? source.url : source.shape

  const handleCreated = useCallback(({ gl }: { gl: WebGLRenderer }) => {
    gl.domElement.addEventListener("webglcontextlost", (event: Event) => {
      event.preventDefault()
      console.warn("Contesto WebGL perso, ripristino in corso…")
    })
  }, [])

  return (
    <Canvas
      // Fixed at 1: the ASCII grid is measured in device pixels, so the preview must be
      // rendered at exactly the export resolution to be honest about the result.
      dpr={1}
      style={{ width, height, display: "block", background: "transparent" }}
      gl={{
        alpha: true,
        premultipliedAlpha: false,
        preserveDrawingBuffer: true,
        antialias: false,
      }}
      camera={{ position: [0, 0, 4.5], fov: 50, near: 0.1, far: 100 }}
      onCreated={handleCreated}
    >
      <Rig settingsRef={settingsRef} statsRef={statsRef} />
      <StudioEnvironment />
      <ModelErrorBoundary onError={onModelError} resetKey={sourceKey}>
        <Suspense fallback={null}>
          <ModelStage
            key={sourceKey}
            source={source}
            settingsRef={settingsRef}
            controller={controller}
            onStats={onModelStats}
            onCommitPhase={onCommitPhase}
          />
        </Suspense>
      </ModelErrorBoundary>
      <CaptureReader controller={controller} />
      <DeferredComposer>
        <StudioAsciiEffect settingsRef={settingsRef} chars={chars} cellAspect={cellAspect} effectRef={effectRef} />
      </DeferredComposer>
    </Canvas>
  )
})

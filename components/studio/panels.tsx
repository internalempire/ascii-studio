"use client"

import { memo } from "react"
import { Choice, ColorField, Flags, Param, Section, Seg, Stepper, Toggle } from "./ui"
import {
  CHARSETS,
  DEFAULT_SETTINGS,
  PRIMITIVES,
  type CharsetKey,
  UP_AXES,
  type ModelSource,
  type PrimitiveKey,
  type StudioSettings,
  type UpAxis,
} from "@/lib/studio/settings"
import type { ModelStats } from "./model"

type Patch<K extends keyof StudioSettings> = (values: Partial<StudioSettings[K]>) => void

const D = DEFAULT_SETTINGS

/* ---------------------------------------------------------------- source */

export const SourcePanel = memo(function SourcePanel({
  source,
  stats,
  error,
  onPickFiles,
  onPickPrimitive,
  onPickDemo,
}: {
  source: ModelSource
  stats: ModelStats | null
  error: string | null
  onPickFiles: () => void
  onPickPrimitive: (shape: PrimitiveKey) => void
  onPickDemo: () => void
}) {
  return (
    <Section id="source" title="Model">
      <button type="button" className="btn btn--wide btn--tall btn--primary" onClick={onPickFiles}>
        Load .glb / .gltf
      </button>
      <p className="hint">
        Or drop the file on the viewport. For a .gltf with external files, select them all together
        (.gltf + .bin + textures).
      </p>

      <Choice
        label="Test primitive"
        value={source.kind === "primitive" ? source.shape : ("" as PrimitiveKey)}
        options={[
          { value: "" as PrimitiveKey, label: source.kind === "primitive" ? "—" : "— none —" },
          ...(Object.keys(PRIMITIVES) as PrimitiveKey[]).map((k) => ({ value: k, label: PRIMITIVES[k] })),
        ]}
        onChange={(v) => v && onPickPrimitive(v)}
      />

      <button type="button" className="btn btn--wide" onClick={onPickDemo}>
        Reload the demo model
      </button>

      {error ? <p className="hint hint--error">{error}</p> : null}

      {stats ? (
        <p className="hint">
          {stats.meshes} {stats.meshes === 1 ? "mesh" : "meshes"} ·{" "}
          {stats.triangles.toLocaleString("en-US")} triangles · fit ×{stats.fitScale.toFixed(3)}
          {stats.clips.length > 0 ? ` · ${stats.clips.length} clip${stats.clips.length === 1 ? "" : "s"}` : ""}
        </p>
      ) : null}

      {stats?.mirrored ? (
        <p className="hint hint--warn">
          This file mirrors the geometry with a negative scale, so it renders flipped. Turn on the
          matching Mirror axis under Pose to straighten it.
        </p>
      ) : null}
    </Section>
  )
})

/* ------------------------------------------------------------- transform */

export const TransformPanel = memo(function TransformPanel({
  value,
  onChange,
}: {
  value: StudioSettings["transform"]
  onChange: Patch<"transform">
}) {
  return (
    <Section id="transform" title="Pose">
      <Choice
        label="Model up axis"
        value={value.upAxis}
        options={UP_AXES}
        onChange={(v: UpAxis) => onChange({ upAxis: v })}
      />
      <Flags
        label="Mirror"
        options={[
          { value: "mirrorX" as const, label: "X" },
          { value: "mirrorY" as const, label: "Y" },
          { value: "mirrorZ" as const, label: "Z" },
        ]}
        values={{ mirrorX: value.mirrorX, mirrorY: value.mirrorY, mirrorZ: value.mirrorZ }}
        onToggle={(k, next) => onChange({ [k]: next } as Partial<StudioSettings["transform"]>)}
      />
      <p className="hint">
        If the model comes out upside down, the up axis straightens it. If it comes out{" "}
        <em>mirrored</em>, use Mirror instead: a reflection cannot be undone by any rotation.
      </p>
      <Param label="Scale" value={value.scale} min={0.1} max={4} step={0.01} defaultValue={D.transform.scale} onChange={(v) => onChange({ scale: v })} />
      <Param label="Offset X" value={value.offsetX} min={-3} max={3} step={0.01} defaultValue={0} onChange={(v) => onChange({ offsetX: v })} />
      <Param label="Offset Y" value={value.offsetY} min={-3} max={3} step={0.01} defaultValue={0} onChange={(v) => onChange({ offsetY: v })} />
      <Param label="Tilt X" value={value.tiltX} min={-180} max={180} step={0.5} unit="°" defaultValue={D.transform.tiltX} onChange={(v) => onChange({ tiltX: v })} />
      <Param label="Tilt Y" value={value.tiltY} min={-180} max={180} step={0.5} unit="°" defaultValue={D.transform.tiltY} onChange={(v) => onChange({ tiltY: v })} />
      <Param label="Tilt Z" value={value.tiltZ} min={-180} max={180} step={0.5} unit="°" defaultValue={D.transform.tiltZ} onChange={(v) => onChange({ tiltZ: v })} />
      <Toggle label="Spin in preview" checked={value.spin} onChange={(v) => onChange({ spin: v })} />
      <Param label="Speed" value={value.spinSpeed} min={0} max={3} step={0.01} disabled={!value.spin} defaultValue={D.transform.spinSpeed} onChange={(v) => onChange({ spinSpeed: v })} />
      <p className="hint">The preview spins on the same axes the loop will use.</p>

      <Param label="Start angle X" value={value.phaseX} min={-180} max={180} step={0.5} unit="°" defaultValue={0} onChange={(v) => onChange({ phaseX: v })} />
      <Param label="Start angle Y" value={value.phaseY} min={-180} max={180} step={0.5} unit="°" defaultValue={0} onChange={(v) => onChange({ phaseY: v })} />
      <Param label="Start angle Z" value={value.phaseZ} min={-180} max={180} step={0.5} unit="°" defaultValue={0} onChange={(v) => onChange({ phaseZ: v })} />
      <p className="hint">
        The loop starts here. Pause the spin to lock the angle you are looking at: it gets written
        into these fields, and the GIF will begin exactly there.
      </p>
    </Section>
  )
})

/* ---------------------------------------------------------------- camera */

export const CameraPanel = memo(function CameraPanel({
  value,
  onChange,
}: {
  value: StudioSettings["transform"]
  onChange: Patch<"transform">
}) {
  return (
    <Section id="camera" title="Camera">
      <Param label="Distance" value={value.cameraDistance} min={1} max={20} step={0.05} defaultValue={D.transform.cameraDistance} onChange={(v) => onChange({ cameraDistance: v })} />
      <Param label="Azimuth" value={value.camAzimuth} min={-180} max={180} step={0.5} unit="°" defaultValue={0} onChange={(v) => onChange({ camAzimuth: v })} />
      <Param label="Elevation" value={value.camElevation} min={-89} max={89} step={0.5} unit="°" defaultValue={0} onChange={(v) => onChange({ camElevation: v })} />
      <Param label="Field of view" value={value.fov} min={10} max={110} step={1} unit="°" defaultValue={D.transform.fov} onChange={(v) => onChange({ fov: v })} />
      <p className="hint">Drag on the viewport to orbit, scroll to move closer.</p>
    </Section>
  )
})

/* ----------------------------------------------------------------- light */

export const LightPanel = memo(function LightPanel({
  value,
  onChange,
}: {
  value: StudioSettings["light"]
  onChange: Patch<"light">
}) {
  return (
    <Section id="light" title="Lights">
      <Param label="Exposure" value={value.exposure} min={0} max={3} step={0.01} defaultValue={D.light.exposure} onChange={(v) => onChange({ exposure: v })} />
      <Param label="Ambient" value={value.ambient} min={0} max={2} step={0.01} defaultValue={D.light.ambient} onChange={(v) => onChange({ ambient: v })} />
      <Param label="Env map" value={value.envIntensity} min={0} max={3} step={0.01} defaultValue={D.light.envIntensity} onChange={(v) => onChange({ envIntensity: v })} />
      <Param label="Key light" value={value.keyIntensity} min={0} max={20} step={0.1} defaultValue={D.light.keyIntensity} onChange={(v) => onChange({ keyIntensity: v })} />
      <Param label="Key azimuth" value={value.keyAzimuth} min={-180} max={180} step={1} unit="°" defaultValue={D.light.keyAzimuth} onChange={(v) => onChange({ keyAzimuth: v })} />
      <Param label="Key elevation" value={value.keyElevation} min={-89} max={89} step={1} unit="°" defaultValue={D.light.keyElevation} onChange={(v) => onChange({ keyElevation: v })} />
      <Param label="Fill" value={value.fillIntensity} min={0} max={5} step={0.01} defaultValue={D.light.fillIntensity} onChange={(v) => onChange({ fillIntensity: v })} />
      <Param label="Rim" value={value.rimIntensity} min={0} max={10} step={0.05} defaultValue={D.light.rimIntensity} onChange={(v) => onChange({ rimIntensity: v })} />
    </Section>
  )
})

/* -------------------------------------------------------------- material */

export const MaterialPanel = memo(function MaterialPanel({
  value,
  onChange,
}: {
  value: StudioSettings["material"]
  onChange: Patch<"material">
}) {
  return (
    <Section id="material" title="Material">
      <Toggle label="Override the material" checked={value.override} onChange={(v) => onChange({ override: v })} />
      <ColorField label="Color" value={value.color} disabled={!value.override} onChange={(v) => onChange({ color: v })} />
      <Param label="Roughness" value={value.roughness} min={0} max={1} step={0.01} disabled={!value.override} defaultValue={D.material.roughness} onChange={(v) => onChange({ roughness: v })} />
      <Param label="Metalness" value={value.metalness} min={0} max={1} step={0.01} disabled={!value.override} defaultValue={D.material.metalness} onChange={(v) => onChange({ metalness: v })} />
      <Toggle label="Flat shading" checked={value.flatShading} disabled={!value.override} onChange={(v) => onChange({ flatShading: v })} />
      <p className="hint">
        The shader turns surface luminance into characters, not its color: mid tones give the
        richest result, while pure white empties the drawing.
      </p>
    </Section>
  )
})

/* ------------------------------------------------------------- animation */

export const AnimationPanel = memo(function AnimationPanel({
  value,
  clips,
  onChange,
}: {
  value: StudioSettings["animation"]
  clips: string[]
  onChange: Patch<"animation">
}) {
  if (clips.length === 0) return null
  return (
    <Section id="animation" title="Animation" badge={`${clips.length}`}>
      <Toggle label="Play clip" checked={value.enabled} onChange={(v) => onChange({ enabled: v })} />
      <Choice
        label="Clip"
        value={String(Math.min(value.clip, clips.length - 1))}
        disabled={!value.enabled}
        options={clips.map((name, i) => ({ value: String(i), label: name }))}
        onChange={(v) => onChange({ clip: Number(v) })}
      />
      <Param label="Repeats in the loop" value={value.loops} min={1} max={8} step={1} disabled={!value.enabled} defaultValue={1} onChange={(v) => onChange({ loops: v })} />
      <p className="hint">The clip is sampled at absolute time, so the loop closes exactly.</p>
    </Section>
  )
})

/* ----------------------------------------------------------------- ascii */

export const AsciiPanel = memo(function AsciiPanel({
  value,
  onChange,
}: {
  value: StudioSettings["ascii"]
  onChange: Patch<"ascii">
}) {
  const ramp = value.charset === "custom" ? value.customChars : CHARSETS[value.charset].chars.join("")
  return (
    <Section id="ascii" title="ASCII">
      <Param label="Cell height" value={value.cellSize} min={2} max={40} step={0.5} unit="px" defaultValue={D.ascii.cellSize} onChange={(v) => onChange({ cellSize: v })} />
      <Param label="Cell ratio" value={value.cellAspect} min={0.3} max={2} step={0.01} defaultValue={D.ascii.cellAspect} onChange={(v) => onChange({ cellAspect: v })} />
      <p className="hint">
        Width-to-height ratio of the cell. 1.00 is the original square grid; around 0.55 the
        characters fill the cell the way they do in a terminal.
      </p>
      <Choice
        label="Character set"
        value={value.charset}
        options={(Object.keys(CHARSETS) as CharsetKey[]).map((k) => ({ value: k, label: CHARSETS[k].label }))}
        onChange={(v) => onChange({ charset: v })}
      />
      {value.charset === "custom" ? (
        <input
          className="text"
          value={value.customChars}
          aria-label="Custom characters, from sparsest to densest"
          onChange={(e) => onChange({ customChars: e.target.value })}
        />
      ) : null}
      {ramp && value.charset !== "procedural" ? (
        <p className="hint" style={{ letterSpacing: "0.28em", color: "var(--ink-2)", wordBreak: "break-all" }}>
          {ramp}
        </p>
      ) : null}
      <p className="hint">Ramp order: from the sparsest character to the densest.</p>

      <Toggle label="Invert luminance" checked={value.invert} onChange={(v) => onChange({ invert: v })} />
      <Toggle label="Color" checked={value.colorMode} onChange={(v) => onChange({ colorMode: v })} />
      <Toggle label="Single tint" checked={value.useTint} disabled={!value.colorMode} onChange={(v) => onChange({ useTint: v })} />
      <ColorField label="Tint" value={value.tintColor} disabled={!value.colorMode || !value.useTint} onChange={(v) => onChange({ tintColor: v })} />

      <Param label="Contrast" value={value.contrast} min={0.2} max={5} step={0.01} defaultValue={D.ascii.contrast} onChange={(v) => onChange({ contrast: v })} />
      <Param label="Brightness" value={value.brightness} min={-0.5} max={0.5} step={0.005} defaultValue={0} onChange={(v) => onChange({ brightness: v })} />
      <Toggle label="Volume shading" checked={value.volumeShading} onChange={(v) => onChange({ volumeShading: v })} />
      <Param label="Volume gain" value={value.volumeGain} min={0.5} max={4} step={0.01} disabled={!value.volumeShading} defaultValue={D.ascii.volumeGain} onChange={(v) => onChange({ volumeGain: v })} />
      <Param label="Ink threshold" value={value.inkThreshold} min={0} max={0.5} step={0.005} defaultValue={D.ascii.inkThreshold} onChange={(v) => onChange({ inkThreshold: v })} />
      <Param label="Background cut" value={value.backgroundCut} min={0} max={0.4} step={0.005} defaultValue={D.ascii.backgroundCut} onChange={(v) => onChange({ backgroundCut: v })} />
    </Section>
  )
})

/* -------------------------------------------------------------- effects */

const PALETTES = [
  { value: "0", label: "None" },
  { value: "1", label: "Green" },
  { value: "2", label: "Amber" },
  { value: "3", label: "Cyan" },
  { value: "4", label: "Blue" },
  { value: "5", label: "Black and white" },
]

export const EffectsPanel = memo(function EffectsPanel({
  value,
  onChange,
}: {
  value: StudioSettings["fx"]
  onChange: Patch<"fx">
}) {
  return (
    <Section id="fx" title="Effects" defaultOpen={false}>
      <Choice
        label="Forced palette"
        value={String(value.palette)}
        options={PALETTES}
        onChange={(v) => onChange({ palette: Number(v) })}
      />
      <Param label="Scanline" value={value.scanlineIntensity} min={0} max={1} step={0.01} defaultValue={0} onChange={(v) => onChange({ scanlineIntensity: v })} />
      <Param label="Scanline density" value={value.scanlineCount} min={20} max={800} step={5} disabled={value.scanlineIntensity === 0} defaultValue={D.fx.scanlineCount} onChange={(v) => onChange({ scanlineCount: v })} />
      <Param label="Vignette" value={value.vignetteIntensity} min={0} max={1} step={0.01} defaultValue={0} onChange={(v) => onChange({ vignetteIntensity: v })} />
      <Param label="Vignette radius" value={value.vignetteRadius} min={0.2} max={3} step={0.01} disabled={value.vignetteIntensity === 0} defaultValue={D.fx.vignetteRadius} onChange={(v) => onChange({ vignetteRadius: v })} />
      <Param label="Center glow" value={value.glowIntensity} min={0} max={2} step={0.01} defaultValue={0} onChange={(v) => onChange({ glowIntensity: v })} />
      <Param label="Glow radius" value={value.glowRadius} min={20} max={900} step={5} disabled={value.glowIntensity === 0} defaultValue={D.fx.glowRadius} onChange={(v) => onChange({ glowRadius: v })} />
      <Param label="Curvature" value={value.curvature} min={0} max={0.6} step={0.005} defaultValue={0} onChange={(v) => onChange({ curvature: v })} />
      <Param label="Aberration" value={value.aberration} min={0} max={0.02} step={0.0002} defaultValue={0} onChange={(v) => onChange({ aberration: v })} />
      <Param label="Grain" value={value.noiseIntensity} min={0} max={0.5} step={0.005} defaultValue={0} onChange={(v) => onChange({ noiseIntensity: v })} />
      <Param label="Grain scale" value={value.noiseScale} min={1} max={800} step={1} disabled={value.noiseIntensity === 0} defaultValue={D.fx.noiseScale} onChange={(v) => onChange({ noiseScale: v })} />
      <Param label="Grain speed" value={value.noiseSpeed} min={0} max={40} step={0.1} disabled={value.noiseIntensity === 0} defaultValue={D.fx.noiseSpeed} onChange={(v) => onChange({ noiseSpeed: v })} />
      <Param label="Wave" value={value.waveAmplitude} min={0} max={0.05} step={0.0005} defaultValue={0} onChange={(v) => onChange({ waveAmplitude: v })} />
      <Param label="Wave frequency" value={value.waveFrequency} min={1} max={80} step={0.5} disabled={value.waveAmplitude === 0} defaultValue={D.fx.waveFrequency} onChange={(v) => onChange({ waveFrequency: v })} />
      <Param label="Wave speed" value={value.waveSpeed} min={0} max={20} step={0.1} disabled={value.waveAmplitude === 0} defaultValue={D.fx.waveSpeed} onChange={(v) => onChange({ waveSpeed: v })} />
      <Param label="Glitch" value={value.glitchIntensity} min={0} max={1} step={0.01} defaultValue={0} onChange={(v) => onChange({ glitchIntensity: v })} />
      <Param label="Glitch frequency" value={value.glitchFrequency} min={0} max={60} step={0.5} disabled={value.glitchIntensity === 0} defaultValue={0} onChange={(v) => onChange({ glitchFrequency: v })} />
      <Param label="Cell jitter" value={value.jitterIntensity} min={0} max={3} step={0.01} defaultValue={0} onChange={(v) => onChange({ jitterIntensity: v })} />
      <Param label="Jitter speed" value={value.jitterSpeed} min={0} max={40} step={0.1} disabled={value.jitterIntensity === 0} defaultValue={D.fx.jitterSpeed} onChange={(v) => onChange({ jitterSpeed: v })} />
      <Param label="Steps per second" value={value.targetFPS} min={0} max={30} step={1} defaultValue={0} onChange={(v) => onChange({ targetFPS: v })} />
      <p className="hint">Steps at 0 means continuous time. Low values give a terminal&apos;s stepped cadence.</p>
    </Section>
  )
})

/* ----------------------------------------------------------- background */

export const BackgroundPanel = memo(function BackgroundPanel({
  value,
  format,
  onChange,
}: {
  value: StudioSettings["background"]
  format: StudioSettings["output"]["format"]
  onChange: Patch<"background">
}) {
  return (
    <Section id="background" title="Background">
      <Toggle label="Transparent" checked={value.transparent} onChange={(v) => onChange({ transparent: v })} />
      <ColorField label="Color" value={value.color} disabled={value.transparent} onChange={(v) => onChange({ color: v })} />
      {value.transparent && format === "webm" ? (
        <p className="hint hint--warn">
          Video carries no transparency, so the background color is used instead. For alpha, export a GIF.
        </p>
      ) : (
        <p className="hint">
          With a transparent background the GIF uses 1-bit alpha, so character edges become hard.
        </p>
      )}
    </Section>
  )
})

/* --------------------------------------------------------------- output */

const SIZE_PRESETS: [number, number][] = [
  [480, 480],
  [640, 640],
  [800, 600],
  [1080, 1080],
  [1280, 720],
]

export const OutputPanel = memo(function OutputPanel({
  value,
  cellSize,
  cellAspect,
  onChange,
}: {
  value: StudioSettings["output"]
  cellSize: number
  cellAspect: number
  onChange: Patch<"output">
}) {
  const snap = () => {
    const cellH = Math.max(1, cellSize)
    const cellW = Math.max(1, cellSize * cellAspect)
    onChange({
      width: Math.max(64, Math.round(Math.round(value.width / cellW) * cellW)),
      height: Math.max(64, Math.round(Math.round(value.height / cellH) * cellH)),
    })
  }

  return (
    <Section id="output" title="Output">
      <Seg
        label="File format"
        value={value.format}
        options={[
          { value: "gif", label: "GIF" },
          { value: "webm", label: "Video" },
        ]}
        onChange={(v) => onChange({ format: v })}
      />

      <Param label="Width" value={value.width} min={64} max={1920} step={2} unit="px" defaultValue={D.output.width} onChange={(v) => onChange({ width: Math.round(v) })} />
      <Param label="Height" value={value.height} min={64} max={1920} step={2} unit="px" defaultValue={D.output.height} onChange={(v) => onChange({ height: Math.round(v) })} />

      <div className="inline" style={{ flexWrap: "wrap", gap: 6 }}>
        {SIZE_PRESETS.map(([w, h]) => (
          <button
            key={`${w}x${h}`}
            type="button"
            className="btn"
            style={{ padding: "5px 7px", letterSpacing: "0.04em" }}
            onClick={() => onChange({ width: w, height: h })}
          >
            {w}×{h}
          </button>
        ))}
      </div>
      <button type="button" className="btn btn--wide" onClick={snap}>
        Snap to the cell grid
      </button>

      <Param label="Frames" value={value.frames} min={2} max={240} step={1} defaultValue={D.output.frames} onChange={(v) => onChange({ frames: Math.round(v) })} />
      <Param label="Frames per second" value={value.fps} min={5} max={50} step={1} defaultValue={D.output.fps} onChange={(v) => onChange({ fps: Math.round(v) })} />

      <div className="param__top" style={{ marginTop: 4 }}>
        <span className="param__label">Turns per axis</span>
      </div>
      <div className="axes">
        <Stepper label="X" value={value.turnsX} min={-4} max={4} active={value.turnsX !== 0} onChange={(v) => onChange({ turnsX: v })} />
        <Stepper label="Y" value={value.turnsY} min={-4} max={4} active={value.turnsY !== 0} onChange={(v) => onChange({ turnsY: v })} />
        <Stepper label="Z" value={value.turnsZ} min={-4} max={4} active={value.turnsZ !== 0} onChange={(v) => onChange({ turnsZ: v })} />
      </div>
      <p className="hint">
        Whole turns on several axes: the loop always closes. A negative value reverses the direction.
      </p>

      {value.format === "gif" ? (
        <Param label="Palette colors" value={value.colors} min={2} max={256} step={1} defaultValue={D.output.colors} onChange={(v) => onChange({ colors: Math.round(v) })} />
      ) : null}
    </Section>
  )
})

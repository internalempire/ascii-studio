"use client"

import { memo } from "react"
import { Choice, ColorField, Param, Section, Seg, Stepper, Toggle } from "./ui"
import {
  CHARSETS,
  DEFAULT_SETTINGS,
  PRIMITIVES,
  type CharsetKey,
  type ModelSource,
  type PrimitiveKey,
  type StudioSettings,
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
    <Section id="source" title="Modello">
      <button type="button" className="btn btn--wide btn--tall btn--primary" onClick={onPickFiles}>
        Carica .glb / .gltf
      </button>
      <p className="hint">
        Oppure trascina il file sul viewport. Per un .gltf con file esterni selezionali tutti insieme
        (.gltf + .bin + texture).
      </p>

      <Choice
        label="Primitiva di prova"
        value={source.kind === "primitive" ? source.shape : ("" as PrimitiveKey)}
        options={[
          { value: "" as PrimitiveKey, label: source.kind === "primitive" ? "—" : "— nessuna —" },
          ...(Object.keys(PRIMITIVES) as PrimitiveKey[]).map((k) => ({ value: k, label: PRIMITIVES[k] })),
        ]}
        onChange={(v) => v && onPickPrimitive(v)}
      />

      <button type="button" className="btn btn--wide" onClick={onPickDemo}>
        Ricarica il modello demo
      </button>

      {error ? <p className="hint hint--error">{error}</p> : null}

      {stats ? (
        <p className="hint">
          {stats.meshes} mesh · {stats.triangles.toLocaleString("it-IT")} triangoli · fit ×
          {stats.fitScale.toFixed(3)}
          {stats.clips.length > 0 ? ` · ${stats.clips.length} clip` : ""}
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
    <Section id="transform" title="Posa">
      <Param label="Scala" value={value.scale} min={0.1} max={4} step={0.01} defaultValue={D.transform.scale} onChange={(v) => onChange({ scale: v })} />
      <Param label="Offset X" value={value.offsetX} min={-3} max={3} step={0.01} defaultValue={0} onChange={(v) => onChange({ offsetX: v })} />
      <Param label="Offset Y" value={value.offsetY} min={-3} max={3} step={0.01} defaultValue={0} onChange={(v) => onChange({ offsetY: v })} />
      <Param label="Inclinazione X" value={value.tiltX} min={-180} max={180} step={0.5} unit="°" defaultValue={D.transform.tiltX} onChange={(v) => onChange({ tiltX: v })} />
      <Param label="Inclinazione Y" value={value.tiltY} min={-180} max={180} step={0.5} unit="°" defaultValue={D.transform.tiltY} onChange={(v) => onChange({ tiltY: v })} />
      <Param label="Inclinazione Z" value={value.tiltZ} min={-180} max={180} step={0.5} unit="°" defaultValue={D.transform.tiltZ} onChange={(v) => onChange({ tiltZ: v })} />
      <Toggle label="Rotazione in anteprima" checked={value.spin} onChange={(v) => onChange({ spin: v })} />
      <Param label="Velocità" value={value.spinSpeed} min={0} max={3} step={0.01} disabled={!value.spin} defaultValue={D.transform.spinSpeed} onChange={(v) => onChange({ spinSpeed: v })} />
      <p className="hint">L&apos;anteprima gira sugli stessi assi impostati per il loop.</p>
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
      <Param label="Distanza" value={value.cameraDistance} min={1} max={20} step={0.05} defaultValue={D.transform.cameraDistance} onChange={(v) => onChange({ cameraDistance: v })} />
      <Param label="Azimut" value={value.camAzimuth} min={-180} max={180} step={0.5} unit="°" defaultValue={0} onChange={(v) => onChange({ camAzimuth: v })} />
      <Param label="Elevazione" value={value.camElevation} min={-89} max={89} step={0.5} unit="°" defaultValue={0} onChange={(v) => onChange({ camElevation: v })} />
      <Param label="Campo visivo" value={value.fov} min={10} max={110} step={1} unit="°" defaultValue={D.transform.fov} onChange={(v) => onChange({ fov: v })} />
      <p className="hint">Trascina sul viewport per orbitare, rotella per avvicinarti.</p>
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
    <Section id="light" title="Luci">
      <Param label="Esposizione" value={value.exposure} min={0} max={3} step={0.01} defaultValue={D.light.exposure} onChange={(v) => onChange({ exposure: v })} />
      <Param label="Ambiente" value={value.ambient} min={0} max={2} step={0.01} defaultValue={D.light.ambient} onChange={(v) => onChange({ ambient: v })} />
      <Param label="Env map" value={value.envIntensity} min={0} max={3} step={0.01} defaultValue={D.light.envIntensity} onChange={(v) => onChange({ envIntensity: v })} />
      <Param label="Luce chiave" value={value.keyIntensity} min={0} max={20} step={0.1} defaultValue={D.light.keyIntensity} onChange={(v) => onChange({ keyIntensity: v })} />
      <Param label="Azimut chiave" value={value.keyAzimuth} min={-180} max={180} step={1} unit="°" defaultValue={D.light.keyAzimuth} onChange={(v) => onChange({ keyAzimuth: v })} />
      <Param label="Elevazione chiave" value={value.keyElevation} min={-89} max={89} step={1} unit="°" defaultValue={D.light.keyElevation} onChange={(v) => onChange({ keyElevation: v })} />
      <Param label="Riempimento" value={value.fillIntensity} min={0} max={5} step={0.01} defaultValue={D.light.fillIntensity} onChange={(v) => onChange({ fillIntensity: v })} />
      <Param label="Controluce" value={value.rimIntensity} min={0} max={10} step={0.05} defaultValue={D.light.rimIntensity} onChange={(v) => onChange({ rimIntensity: v })} />
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
    <Section id="material" title="Materiale">
      <Toggle label="Sostituisci il materiale" checked={value.override} onChange={(v) => onChange({ override: v })} />
      <ColorField label="Colore" value={value.color} disabled={!value.override} onChange={(v) => onChange({ color: v })} />
      <Param label="Ruvidità" value={value.roughness} min={0} max={1} step={0.01} disabled={!value.override} defaultValue={D.material.roughness} onChange={(v) => onChange({ roughness: v })} />
      <Param label="Metallicità" value={value.metalness} min={0} max={1} step={0.01} disabled={!value.override} defaultValue={D.material.metalness} onChange={(v) => onChange({ metalness: v })} />
      <Toggle label="Facce piatte" checked={value.flatShading} disabled={!value.override} onChange={(v) => onChange({ flatShading: v })} />
      <p className="hint">
        Lo shader traduce in caratteri la luminanza della superficie, non il suo colore: i toni
        medi danno la resa più ricca, il bianco pieno svuota il disegno.
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
    <Section id="animation" title="Animazione" badge={`${clips.length}`}>
      <Toggle label="Riproduci clip" checked={value.enabled} onChange={(v) => onChange({ enabled: v })} />
      <Choice
        label="Clip"
        value={String(Math.min(value.clip, clips.length - 1))}
        disabled={!value.enabled}
        options={clips.map((name, i) => ({ value: String(i), label: name }))}
        onChange={(v) => onChange({ clip: Number(v) })}
      />
      <Param label="Ripetizioni nel loop" value={value.loops} min={1} max={8} step={1} disabled={!value.enabled} defaultValue={1} onChange={(v) => onChange({ loops: v })} />
      <p className="hint">La clip viene campionata a tempo assoluto, così il loop si chiude esatto.</p>
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
      <Param label="Altezza cella" value={value.cellSize} min={2} max={40} step={0.5} unit="px" defaultValue={D.ascii.cellSize} onChange={(v) => onChange({ cellSize: v })} />
      <Param label="Rapporto cella" value={value.cellAspect} min={0.3} max={2} step={0.01} defaultValue={D.ascii.cellAspect} onChange={(v) => onChange({ cellAspect: v })} />
      <p className="hint">
        Rapporto larghezza/altezza della cella. 1.00 è la griglia quadrata originale; intorno a
        0.55 i caratteri riempiono la cella come in un terminale.
      </p>
      <Choice
        label="Set di caratteri"
        value={value.charset}
        options={(Object.keys(CHARSETS) as CharsetKey[]).map((k) => ({ value: k, label: CHARSETS[k].label }))}
        onChange={(v) => onChange({ charset: v })}
      />
      {value.charset === "custom" ? (
        <input
          className="text"
          value={value.customChars}
          aria-label="Caratteri personalizzati, dal più chiaro al più denso"
          onChange={(e) => onChange({ customChars: e.target.value })}
        />
      ) : null}
      {ramp && value.charset !== "procedural" ? (
        <p className="hint" style={{ letterSpacing: "0.28em", color: "var(--ink-2)", wordBreak: "break-all" }}>
          {ramp}
        </p>
      ) : null}
      <p className="hint">Ordine della rampa: dal carattere più rado al più denso.</p>

      <Toggle label="Inverti luminanza" checked={value.invert} onChange={(v) => onChange({ invert: v })} />
      <Toggle label="Colore" checked={value.colorMode} onChange={(v) => onChange({ colorMode: v })} />
      <Toggle label="Tinta unica" checked={value.useTint} disabled={!value.colorMode} onChange={(v) => onChange({ useTint: v })} />
      <ColorField label="Tinta" value={value.tintColor} disabled={!value.colorMode || !value.useTint} onChange={(v) => onChange({ tintColor: v })} />

      <Param label="Contrasto" value={value.contrast} min={0.2} max={5} step={0.01} defaultValue={D.ascii.contrast} onChange={(v) => onChange({ contrast: v })} />
      <Param label="Luminosità" value={value.brightness} min={-0.5} max={0.5} step={0.005} defaultValue={0} onChange={(v) => onChange({ brightness: v })} />
      <Toggle label="Resa volumetrica" checked={value.volumeShading} onChange={(v) => onChange({ volumeShading: v })} />
      <Param label="Guadagno volume" value={value.volumeGain} min={0.5} max={4} step={0.01} disabled={!value.volumeShading} defaultValue={D.ascii.volumeGain} onChange={(v) => onChange({ volumeGain: v })} />
      <Param label="Soglia inchiostro" value={value.inkThreshold} min={0} max={0.5} step={0.005} defaultValue={D.ascii.inkThreshold} onChange={(v) => onChange({ inkThreshold: v })} />
      <Param label="Taglio sfondo" value={value.backgroundCut} min={0} max={0.4} step={0.005} defaultValue={D.ascii.backgroundCut} onChange={(v) => onChange({ backgroundCut: v })} />
    </Section>
  )
})

/* -------------------------------------------------------------- effects */

const PALETTES = [
  { value: "0", label: "Nessuna" },
  { value: "1", label: "Verde" },
  { value: "2", label: "Ambra" },
  { value: "3", label: "Ciano" },
  { value: "4", label: "Blu" },
  { value: "5", label: "Bianco e nero" },
]

export const EffectsPanel = memo(function EffectsPanel({
  value,
  onChange,
}: {
  value: StudioSettings["fx"]
  onChange: Patch<"fx">
}) {
  return (
    <Section id="fx" title="Effetti" defaultOpen={false}>
      <Choice
        label="Palette forzata"
        value={String(value.palette)}
        options={PALETTES}
        onChange={(v) => onChange({ palette: Number(v) })}
      />
      <Param label="Scanline" value={value.scanlineIntensity} min={0} max={1} step={0.01} defaultValue={0} onChange={(v) => onChange({ scanlineIntensity: v })} />
      <Param label="Densità scanline" value={value.scanlineCount} min={20} max={800} step={5} disabled={value.scanlineIntensity === 0} defaultValue={D.fx.scanlineCount} onChange={(v) => onChange({ scanlineCount: v })} />
      <Param label="Vignettatura" value={value.vignetteIntensity} min={0} max={1} step={0.01} defaultValue={0} onChange={(v) => onChange({ vignetteIntensity: v })} />
      <Param label="Raggio vignetta" value={value.vignetteRadius} min={0.2} max={3} step={0.01} disabled={value.vignetteIntensity === 0} defaultValue={D.fx.vignetteRadius} onChange={(v) => onChange({ vignetteRadius: v })} />
      <Param label="Bagliore centrale" value={value.glowIntensity} min={0} max={2} step={0.01} defaultValue={0} onChange={(v) => onChange({ glowIntensity: v })} />
      <Param label="Raggio bagliore" value={value.glowRadius} min={20} max={900} step={5} disabled={value.glowIntensity === 0} defaultValue={D.fx.glowRadius} onChange={(v) => onChange({ glowRadius: v })} />
      <Param label="Curvatura" value={value.curvature} min={0} max={0.6} step={0.005} defaultValue={0} onChange={(v) => onChange({ curvature: v })} />
      <Param label="Aberrazione" value={value.aberration} min={0} max={0.02} step={0.0002} defaultValue={0} onChange={(v) => onChange({ aberration: v })} />
      <Param label="Grana" value={value.noiseIntensity} min={0} max={0.5} step={0.005} defaultValue={0} onChange={(v) => onChange({ noiseIntensity: v })} />
      <Param label="Scala grana" value={value.noiseScale} min={1} max={800} step={1} disabled={value.noiseIntensity === 0} defaultValue={D.fx.noiseScale} onChange={(v) => onChange({ noiseScale: v })} />
      <Param label="Velocità grana" value={value.noiseSpeed} min={0} max={40} step={0.1} disabled={value.noiseIntensity === 0} defaultValue={D.fx.noiseSpeed} onChange={(v) => onChange({ noiseSpeed: v })} />
      <Param label="Onda" value={value.waveAmplitude} min={0} max={0.05} step={0.0005} defaultValue={0} onChange={(v) => onChange({ waveAmplitude: v })} />
      <Param label="Frequenza onda" value={value.waveFrequency} min={1} max={80} step={0.5} disabled={value.waveAmplitude === 0} defaultValue={D.fx.waveFrequency} onChange={(v) => onChange({ waveFrequency: v })} />
      <Param label="Velocità onda" value={value.waveSpeed} min={0} max={20} step={0.1} disabled={value.waveAmplitude === 0} defaultValue={D.fx.waveSpeed} onChange={(v) => onChange({ waveSpeed: v })} />
      <Param label="Glitch" value={value.glitchIntensity} min={0} max={1} step={0.01} defaultValue={0} onChange={(v) => onChange({ glitchIntensity: v })} />
      <Param label="Frequenza glitch" value={value.glitchFrequency} min={0} max={60} step={0.5} disabled={value.glitchIntensity === 0} defaultValue={0} onChange={(v) => onChange({ glitchFrequency: v })} />
      <Param label="Tremolio celle" value={value.jitterIntensity} min={0} max={3} step={0.01} defaultValue={0} onChange={(v) => onChange({ jitterIntensity: v })} />
      <Param label="Velocità tremolio" value={value.jitterSpeed} min={0} max={40} step={0.1} disabled={value.jitterIntensity === 0} defaultValue={D.fx.jitterSpeed} onChange={(v) => onChange({ jitterSpeed: v })} />
      <Param label="Scatti al secondo" value={value.targetFPS} min={0} max={30} step={1} defaultValue={0} onChange={(v) => onChange({ targetFPS: v })} />
      <p className="hint">Scatti a 0 = tempo continuo. Valori bassi danno il passo a scatti del terminale.</p>
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
    <Section id="background" title="Sfondo">
      <Toggle label="Trasparente" checked={value.transparent} onChange={(v) => onChange({ transparent: v })} />
      <ColorField label="Colore" value={value.color} disabled={value.transparent} onChange={(v) => onChange({ color: v })} />
      {value.transparent && format === "webm" ? (
        <p className="hint hint--warn">
          Il video non trasporta trasparenza: verrà usato il colore di sfondo. Per l&apos;alpha esporta in GIF.
        </p>
      ) : (
        <p className="hint">
          Con lo sfondo trasparente la GIF usa l&apos;alpha a 1 bit: i bordi dei caratteri diventano netti.
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
    <Section id="output" title="Uscita">
      <Seg
        label="Formato del file"
        value={value.format}
        options={[
          { value: "gif", label: "GIF" },
          { value: "webm", label: "Video" },
        ]}
        onChange={(v) => onChange({ format: v })}
      />

      <Param label="Larghezza" value={value.width} min={64} max={1920} step={2} unit="px" defaultValue={D.output.width} onChange={(v) => onChange({ width: Math.round(v) })} />
      <Param label="Altezza" value={value.height} min={64} max={1920} step={2} unit="px" defaultValue={D.output.height} onChange={(v) => onChange({ height: Math.round(v) })} />

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
        Allinea alla griglia di celle
      </button>

      <Param label="Fotogrammi" value={value.frames} min={2} max={240} step={1} defaultValue={D.output.frames} onChange={(v) => onChange({ frames: Math.round(v) })} />
      <Param label="Fotogrammi al secondo" value={value.fps} min={5} max={50} step={1} defaultValue={D.output.fps} onChange={(v) => onChange({ fps: Math.round(v) })} />

      <div className="param__top" style={{ marginTop: 4 }}>
        <span className="param__label">Giri per asse</span>
      </div>
      <div className="axes">
        <Stepper label="X" value={value.turnsX} min={-4} max={4} active={value.turnsX !== 0} onChange={(v) => onChange({ turnsX: v })} />
        <Stepper label="Y" value={value.turnsY} min={-4} max={4} active={value.turnsY !== 0} onChange={(v) => onChange({ turnsY: v })} />
        <Stepper label="Z" value={value.turnsZ} min={-4} max={4} active={value.turnsZ !== 0} onChange={(v) => onChange({ turnsZ: v })} />
      </div>
      <p className="hint">
        Giri interi su più assi: il loop si richiude sempre. Un valore negativo inverte il senso.
      </p>

      {value.format === "gif" ? (
        <Param label="Colori nella palette" value={value.colors} min={2} max={256} step={1} defaultValue={D.output.colors} onChange={(v) => onChange({ colors: Math.round(v) })} />
      ) : null}
    </Section>
  )
})

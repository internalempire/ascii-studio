"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  DEFAULT_SETTINGS,
  DEMO_MODEL,
  PRESETS,
  mergeSettings,
  resolveChars,
  reviveSettings,
  CHARSETS,
  type ModelSource,
  type PrimitiveKey,
  type StudioSettings,
} from "@/lib/studio/settings"
import { CaptureController } from "@/lib/studio/capture"
import { registerModelFiles, releaseModelFiles } from "@/lib/studio/model-files"
import { runExport, type ExportProgress, type ExportResult } from "@/lib/studio/export-run"
import { copyText, downloadBlob, timestampSlug } from "@/lib/studio/download"
import { toJsxSnippet } from "@/lib/studio/code-snippet"
import { StudioScene, type RuntimeStats } from "./scene"
import type { StudioAsciiEffectImpl } from "./ascii-effect-studio"
import type { ModelStats } from "./model"
import { Viewport } from "./viewport"
import { LaunchBar, ProgressOverlay, ResultOverlay } from "./export-panel"
import { useFlash } from "./ui"
import {
  AnimationPanel,
  AsciiPanel,
  BackgroundPanel,
  CameraPanel,
  EffectsPanel,
  LightPanel,
  MaterialPanel,
  OutputPanel,
  SourcePanel,
  TransformPanel,
} from "./panels"

const STORE_KEY = "ascii-studio:settings:v1"
const IDLE: ExportProgress = { phase: "idle", current: 0, total: 0, message: "" }

function FpsCell({ statsRef }: { statsRef: React.MutableRefObject<RuntimeStats> }) {
  const [fps, setFps] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setFps(statsRef.current.fps), 500)
    return () => clearInterval(id)
  }, [statsRef])
  return (
    <span className="status__cell">
      <b>{fps || "—"}</b> fps
    </span>
  )
}

export function Studio() {
  const [settings, setSettings] = useState<StudioSettings>(DEFAULT_SETTINGS)
  const [source, setSource] = useState<ModelSource>(DEMO_MODEL)
  const [modelStats, setModelStats] = useState<ModelStats | null>(null)
  const [modelError, setModelError] = useState<string | null>(null)
  const [zoomMode, setZoomMode] = useState<"fit" | "one">("fit")
  const [zoomScale, setZoomScale] = useState(1)

  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState<ExportProgress>(IDLE)
  const [result, setResult] = useState<ExportResult | null>(null)
  const [resultUrl, setResultUrl] = useState<string | null>(null)
  const [exportError, setExportError] = useState<string | null>(null)
  const [snippet, setSnippet] = useState<string | null>(null)

  const { message: flashMessage, flash } = useFlash()

  const controller = useMemo(() => new CaptureController(), [])
  const effectRef = useRef<StudioAsciiEffectImpl | null>(null)
  const statsRef = useRef<RuntimeStats>({ fps: 0 })
  const fileInputRef = useRef<HTMLInputElement>(null)
  const jsonInputRef = useRef<HTMLInputElement>(null)

  // The render loop reads settings from a ref so a slider drag never re-renders the scene.
  const settingsRef = useRef<StudioSettings>(settings)
  settingsRef.current = settings
  const transformRef = useRef(settings.transform)
  transformRef.current = settings.transform

  /* ---------------------------------------------------------- persistence */

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORE_KEY)
      if (raw) setSettings(reviveSettings(JSON.parse(raw)))
    } catch {
      /* corrupt or blocked storage: defaults are fine */
    }
  }, [])

  useEffect(() => {
    const id = setTimeout(() => {
      try {
        window.localStorage.setItem(STORE_KEY, JSON.stringify(settings))
      } catch {
        /* quota or private mode */
      }
    }, 300)
    return () => clearTimeout(id)
  }, [settings])

  useEffect(() => () => releaseModelFiles(), [])
  useEffect(() => {
    return () => {
      if (resultUrl) URL.revokeObjectURL(resultUrl)
    }
  }, [resultUrl])

  /* -------------------------------------------------------------- patches */

  const makePatch = useCallback(
    <K extends keyof StudioSettings>(group: K) =>
      (values: Partial<StudioSettings[K]>) =>
        setSettings((prev) => ({ ...prev, [group]: { ...prev[group], ...values } })),
    []
  )

  const patchTransform = useMemo(() => makePatch("transform"), [makePatch])
  const patchLight = useMemo(() => makePatch("light"), [makePatch])
  const patchMaterial = useMemo(() => makePatch("material"), [makePatch])
  const patchAscii = useMemo(() => makePatch("ascii"), [makePatch])
  const patchFx = useMemo(() => makePatch("fx"), [makePatch])
  const patchBackground = useMemo(() => makePatch("background"), [makePatch])
  const patchOutput = useMemo(() => makePatch("output"), [makePatch])
  const patchAnimation = useMemo(() => makePatch("animation"), [makePatch])

  /* ---------------------------------------------------------------- model */

  const handleFiles = useCallback((files: File[]) => {
    try {
      const loaded = registerModelFiles(files)
      setModelError(null)
      setModelStats(null)
      setSource({ kind: "url", url: loaded.url, name: loaded.name })
    } catch (err) {
      setModelError(err instanceof Error ? err.message : "File non valido")
    }
  }, [])

  const pickPrimitive = useCallback((shape: PrimitiveKey) => {
    releaseModelFiles()
    setModelError(null)
    setModelStats(null)
    setSource({ kind: "primitive", shape, name: shape })
  }, [])

  const pickDemo = useCallback(() => {
    releaseModelFiles()
    setModelError(null)
    setModelStats(null)
    setSource(DEMO_MODEL)
  }, [])

  const handleModelStats = useCallback((stats: ModelStats) => {
    setModelStats(stats)
    setModelError(null)
  }, [])

  const handleModelError = useCallback((message: string) => {
    // Loader errors quote a blob URL and a parser message: useless to a person holding a file.
    const detail = /not valid JSON|Unexpected token|Unexpected end/i.test(message)
      ? "il file non sembra un GLB o un GLTF valido"
      : /404|Failed to fetch|Could not load/i.test(message)
        ? "manca un file collegato (.bin o una texture): selezionali tutti insieme"
        : message.replace(/blob:[^\s:]+:?/g, "").trim() || "formato non riconosciuto"
    setModelError(`Caricamento fallito: ${detail}.`)
  }, [])

  /* --------------------------------------------------------------- export */

  const startExport = useCallback(async () => {
    setExportError(null)
    setResult(null)
    setResultUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev)
      return null
    })
    setBusy(true)
    setProgress({ phase: "warmup", current: 0, total: settingsRef.current.output.frames, message: "Preparazione" })
    try {
      const produced = await runExport({
        controller,
        effect: effectRef.current,
        settings: settingsRef.current,
        modelName: `${source.name}-${timestampSlug()}`,
        onProgress: setProgress,
      })
      setResult(produced)
      setResultUrl(URL.createObjectURL(produced.blob))
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      if (message !== "aborted") setExportError(message)
    } finally {
      setBusy(false)
      setProgress(IDLE)
    }
  }, [controller, source.name])

  const cancelExport = useCallback(() => controller.abort(), [controller])

  const closeResult = useCallback(() => {
    setResult(null)
    setResultUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev)
      return null
    })
  }, [])

  /* ------------------------------------------------------------ look i/o */

  const applyPreset = useCallback((key: string) => {
    const preset = PRESETS[key]
    if (!preset) return
    setSettings((prev) => mergeSettings(prev, preset.patch))
  }, [])

  const copyJsx = useCallback(async () => {
    const jsx = toJsxSnippet(settingsRef.current)
    if (await copyText(jsx)) {
      flash("JSX copiato negli appunti")
      return
    }
    // Clipboard refused: put the text on screen so it is still reachable.
    setSnippet(jsx)
  }, [flash])

  const saveJson = useCallback(() => {
    const blob = new Blob([JSON.stringify(settingsRef.current, null, 2)], { type: "application/json" })
    downloadBlob(blob, `ascii-studio-${timestampSlug()}.json`)
  }, [])

  const loadJson = useCallback(async (file: File) => {
    try {
      setSettings(reviveSettings(JSON.parse(await file.text())))
      flash("Parametri caricati")
    } catch {
      flash("File di parametri non valido")
    }
  }, [flash])

  const resetAll = useCallback(() => {
    setSettings(structuredClone(DEFAULT_SETTINGS))
    flash("Parametri riportati ai valori iniziali")
  }, [flash])

  /* ----------------------------------------------------------------- view */

  const chars = useMemo(
    () => resolveChars(settings.ascii.charset, settings.ascii.customChars),
    [settings.ascii.charset, settings.ascii.customChars]
  )

  const accent = settings.ascii.useTint && settings.ascii.colorMode ? settings.ascii.tintColor : settings.material.color
  const cols = Math.floor(
    settings.output.width / Math.max(1, settings.ascii.cellSize * settings.ascii.cellAspect)
  )
  const rows = Math.floor(settings.output.height / Math.max(1, settings.ascii.cellSize))

  const overlayOpen = busy || (!!result && !!resultUrl) || !!snippet || !!exportError

  const overlay = busy ? (
    <ProgressOverlay progress={progress} onCancel={cancelExport} />
  ) : result && resultUrl ? (
    <ResultOverlay
      result={result}
      url={resultUrl}
      onClose={closeResult}
      onDownload={() => downloadBlob(result.blob, result.filename)}
    />
  ) : snippet ? (
    <div className="overlay">
      <div className="result" style={{ width: "min(760px, 100%)" }}>
        <div className="result__head">
          <span>Configurazione JSX</span>
          <span className="spacer" />
          <span style={{ color: "var(--ink-3)" }}>appunti non disponibili — selezionala e copiala</span>
        </div>
        <textarea
          className="text"
          readOnly
          value={snippet}
          aria-label="Configurazione JSX generata"
          style={{ minHeight: "42vh", border: 0, resize: "none", lineHeight: 1.55, fontSize: 11 }}
          onFocus={(e) => e.currentTarget.select()}
          autoFocus
        />
        <div className="result__foot">
          <span className="spacer" />
          <button type="button" className="btn btn--primary" onClick={() => setSnippet(null)}>
            Chiudi
          </button>
        </div>
      </div>
    </div>
  ) : exportError ? (
    <div className="overlay">
      <div className="empty">
        <p className="overlay__title">Export interrotto</p>
        <p className="empty__body">{exportError}</p>
        <div style={{ marginTop: 16 }}>
          <button type="button" className="btn" onClick={() => setExportError(null)}>
            Chiudi
          </button>
        </div>
      </div>
    </div>
  ) : null

  return (
    <div className="app" style={{ ["--accent" as string]: accent }}>
      <header className="head">
        <div className="head__mark">
          <span className="head__dot" aria-hidden="true" />
          ASCII Studio
        </div>
        <div className="head__file">
          <span className="head__filename" title={source.name}>
            {source.name}
          </span>
          {modelStats ? <span>{modelStats.triangles.toLocaleString("it-IT")} tri</span> : null}
        </div>
        <div className="head__spacer">
          {flashMessage ? (
            <span className="hint" style={{ lineHeight: "var(--head)", paddingLeft: 14 }} role="status">
              {flashMessage}
            </span>
          ) : null}
        </div>
        <div className="head__tools">
          <select
            className="select"
            style={{ width: 150 }}
            value=""
            aria-label="Applica un preset di resa"
            onChange={(e) => {
              applyPreset(e.target.value)
              e.target.value = ""
            }}
          >
            <option value="">Preset…</option>
            {Object.entries(PRESETS).map(([key, preset]) => (
              <option key={key} value={key} title={preset.note}>
                {preset.label}
              </option>
            ))}
          </select>
          <button type="button" className="btn" onClick={copyJsx} title="Copia la configurazione come JSX per il componente originale">
            Copia JSX
          </button>
          <button type="button" className="btn" onClick={saveJson}>
            Salva
          </button>
          <button type="button" className="btn" onClick={() => jsonInputRef.current?.click()}>
            Apri
          </button>
          <button type="button" className="btn" onClick={resetAll}>
            Reset
          </button>
          <a className="btn" href="/hero" title="La pagina hero originale del progetto">
            Hero
          </a>
        </div>
      </header>

      <div className="main">
        <aside className="rail rail--left" aria-label="Scena">
          <div className="rail__scroll">
            <SourcePanel
              source={source}
              stats={modelStats}
              error={modelError}
              onPickFiles={() => fileInputRef.current?.click()}
              onPickPrimitive={pickPrimitive}
              onPickDemo={pickDemo}
            />
            <TransformPanel value={settings.transform} onChange={patchTransform} />
            <CameraPanel value={settings.transform} onChange={patchTransform} />
            <AnimationPanel
              value={settings.animation}
              clips={modelStats?.clips ?? []}
              onChange={patchAnimation}
            />
            <LightPanel value={settings.light} onChange={patchLight} />
            <MaterialPanel value={settings.material} onChange={patchMaterial} />
          </div>
        </aside>

        <section className="stage">
          <Viewport
            width={settings.output.width}
            height={settings.output.height}
            background={settings.background.color}
            transparent={settings.background.transparent}
            zoomMode={zoomMode}
            onZoom={setZoomScale}
            onOrbit={patchTransform}
            transformRef={transformRef}
            onFiles={handleFiles}
            interactive={!overlayOpen}
            overlay={overlay}
          >
            <StudioScene
              settingsRef={settingsRef}
              controller={controller}
              source={source}
              chars={chars}
              cellAspect={settings.ascii.cellAspect}
              width={settings.output.width}
              height={settings.output.height}
              statsRef={statsRef}
              effectRef={effectRef}
              onModelStats={handleModelStats}
              onModelError={handleModelError}
            />
          </Viewport>

          <div className="status">
            <span className="status__cell">
              Griglia <b>{cols}×{rows}</b>
            </span>
            <span className="status__cell">
              Cella <b>{settings.ascii.cellSize}px</b>
            </span>
            <span className="status__cell">
              Set <b>{CHARSETS[settings.ascii.charset].label}</b>
            </span>
            <FpsCell statsRef={statsRef} />
            <span className="status__cell status__cell--grow">
              {modelError ? <span style={{ color: "var(--rec)" }}>{modelError}</span> : null}
            </span>
            <button
              type="button"
              className="status__cell status__zoom"
              style={{ background: "transparent", border: 0, borderLeft: "1px solid var(--rule)", color: "inherit", font: "inherit", cursor: "pointer" }}
              onClick={() => setZoomMode((z) => (z === "fit" ? "one" : "fit"))}
            >
              Zoom <b>{Math.round(zoomScale * 100)}%</b> · {zoomMode === "fit" ? "adatta" : "1:1"}
            </button>
          </div>
        </section>

        <aside className="rail rail--right" aria-label="Resa ed export">
          <div className="rail__scroll">
            <OutputPanel
              value={settings.output}
              cellSize={settings.ascii.cellSize}
              cellAspect={settings.ascii.cellAspect}
              onChange={patchOutput}
            />
            <AsciiPanel value={settings.ascii} onChange={patchAscii} />
            <BackgroundPanel
              value={settings.background}
              format={settings.output.format}
              onChange={patchBackground}
            />
            <EffectsPanel value={settings.fx} onChange={patchFx} />
          </div>
          <LaunchBar settings={settings} busy={busy} onRender={startExport} />
        </aside>
      </div>

      <input
        ref={fileInputRef}
        className="sr-only"
        type="file"
        multiple
        accept=".glb,.gltf,.bin,image/*"
        onChange={(e) => {
          const files = Array.from(e.target.files ?? [])
          if (files.length > 0) handleFiles(files)
          e.target.value = ""
        }}
      />
      <input
        ref={jsonInputRef}
        className="sr-only"
        type="file"
        accept="application/json,.json"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) loadJson(file)
          e.target.value = ""
        }}
      />
    </div>
  )
}

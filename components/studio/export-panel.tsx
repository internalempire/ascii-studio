"use client"

import { memo } from "react"
import { formatBytes } from "@/lib/studio/download"
import { videoExportAvailable } from "@/lib/studio/video"
import { estimateMemoryBytes, loopSummary, type ExportProgress, type ExportResult } from "@/lib/studio/export-run"
import type { StudioSettings } from "@/lib/studio/settings"

export const LaunchBar = memo(function LaunchBar({
  settings,
  busy,
  onRender,
}: {
  settings: StudioSettings
  busy: boolean
  onRender: () => void
}) {
  const loop = loopSummary(settings)
  const memory = estimateMemoryBytes(settings)
  const heavy = settings.output.format === "gif" && memory > 500 * 1024 * 1024
  const noTurns =
    settings.output.turnsX === 0 && settings.output.turnsY === 0 && settings.output.turnsZ === 0
  const videoUnsupported = settings.output.format === "webm" && !videoExportAvailable()

  return (
    <div className="launch">
      <div className="launch__meta">
        <span>
          Loop <b>{loop.seconds.toFixed(2)} s</b>
        </span>
        <span>
          <b>{settings.output.frames}</b> fotogrammi
        </span>
        <span>
          <b>{loop.actualFps.toFixed(loop.rounded ? 1 : 0)}</b> fps
        </span>
      </div>

      {loop.rounded ? (
        <p className="hint">
          La GIF misura i tempi in centesimi di secondo: {settings.output.fps} fps diventano{" "}
          {loop.actualFps.toFixed(1)}.
        </p>
      ) : null}

      {noTurns ? (
        <p className="hint hint--warn">Nessun asse di rotazione attivo: il loop sarà immobile.</p>
      ) : null}

      {heavy ? (
        <p className="hint hint--warn">
          Servono circa {formatBytes(memory)} di memoria per i fotogrammi. Riduci risoluzione o
          numero di fotogrammi se il browser si blocca.
        </p>
      ) : null}

      {videoUnsupported ? (
        <p className="hint hint--error">
          Questo browser non sa codificare video. Esporta in GIF oppure apri lo studio in Chrome.
        </p>
      ) : null}

      <button
        type="button"
        className="btn btn--primary btn--wide btn--tall"
        onClick={onRender}
        disabled={busy || videoUnsupported}
      >
        {busy ? "Render in corso…" : settings.output.format === "gif" ? "Genera la GIF" : "Genera il video"}
      </button>
    </div>
  )
})

export function ProgressOverlay({
  progress,
  onCancel,
}: {
  progress: ExportProgress
  onCancel: () => void
}) {
  const pct = progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0
  return (
    <div className="progress">
      <span className="progress__label">{progress.message}</span>
      <span className="progress__count">
        {progress.current} / {progress.total}
      </span>
      <div
        className="progress__bar"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
        aria-label={progress.message}
      >
        <div className="progress__fill" style={{ transform: `scaleX(${pct / 100})` }} />
      </div>
      <span className="progress__pct">{pct}%</span>
      <button type="button" className="btn btn--danger" onClick={onCancel}>
        Annulla
      </button>
    </div>
  )
}

export function ResultOverlay({
  result,
  url,
  onClose,
  onDownload,
}: {
  result: ExportResult
  url: string
  onClose: () => void
  onDownload: () => void
}) {
  return (
    <div className="overlay">
      <div className="result">
        <div className="result__head">
          <span>{result.format === "gif" ? "GIF pronta" : "Video pronto"}</span>
          <span className="spacer" />
          <span style={{ color: "var(--ink-3)" }}>{result.filename}</span>
        </div>
        <div className="result__media">
          {result.format === "gif" ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={url} alt={`Anteprima di ${result.filename}`} />
          ) : (
            <video src={url} autoPlay loop muted playsInline />
          )}
        </div>
        <div className="result__foot">
          <span className="hint">
            {formatBytes(result.blob.size)} · {result.frames} fotogrammi ·{" "}
            {(result.durationMs / 1000).toFixed(1)} s di lavoro
          </span>
          <span className="spacer" />
          <button type="button" className="btn" onClick={onClose}>
            Chiudi
          </button>
          <a className="btn" href={url} target="_blank" rel="noreferrer">
            Apri
          </a>
          <button type="button" className="btn btn--primary" onClick={onDownload}>
            Scarica
          </button>
        </div>
      </div>
    </div>
  )
}

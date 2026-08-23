import { CaptureController, poseForFrame } from "./capture"
import { encodeGif } from "./gif"
import { createVideoSink, type FrameSink } from "./video"
import { gifTiming, type StudioSettings } from "./settings"
import type { StudioAsciiEffectImpl } from "@/components/studio/ascii-effect-studio"

export type ExportPhase = "idle" | "warmup" | "render" | "encode" | "done" | "error" | "cancelled"

export interface ExportProgress {
  phase: ExportPhase
  current: number
  total: number
  message: string
}

export interface ExportResult {
  blob: Blob
  filename: string
  format: "gif" | "webm"
  frames: number
  durationMs: number
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

function safeSlug(name: string) {
  return (
    name
      .replace(/\.[^.]+$/, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 40) || "model"
  )
}

export function estimateMemoryBytes(s: StudioSettings) {
  return s.output.width * s.output.height * 4 * s.output.frames
}

export async function runExport(options: {
  controller: CaptureController
  effect: StudioAsciiEffectImpl | null
  settings: StudioSettings
  modelName: string
  onProgress: (p: ExportProgress) => void
}): Promise<ExportResult> {
  const { controller, effect, settings, modelName, onProgress } = options
  const { width, height, frames, fps, turnsX, turnsY, turnsZ, colors, format } = settings.output
  const transparent = settings.background.transparent
  const started = performance.now()

  const composite = document.createElement("canvas")
  composite.width = width
  composite.height = height
  const ctx = composite.getContext("2d", { willReadFrequently: format === "gif", alpha: true })
  if (!ctx) throw new Error("Canvas 2D non disponibile")

  let sink: FrameSink | null = format === "webm" ? await createVideoSink(composite, fps) : null

  controller.reset()
  controller.capturing = true
  if (effect) effect.timeMode = "manual"

  // Browsers stop requestAnimationFrame in a hidden tab, which stalls the capture loop.
  let wentHidden = document.hidden
  const watchVisibility = () => {
    if (document.hidden) wentHidden = true
  }
  document.addEventListener("visibilitychange", watchVisibility)

  const rgbaFrames: Uint8ClampedArray[] = []

  try {
    onProgress({ phase: "warmup", current: 0, total: frames, message: "Preparazione della scena" })
    // Let the material swap, the env map and the first composited pass settle.
    await controller.settle(4)

    onProgress({ phase: "render", current: 0, total: frames, message: "Render dei fotogrammi" })
    sink?.start()

    const frameInterval = 1000 / fps
    let deadline = performance.now()

    for (let i = 0; i < frames; i++) {
      if (controller.isAborted) throw new Error("aborted")

      const pose = poseForFrame(i, frames, { x: turnsX, y: turnsY, z: turnsZ })
      pose.time = i / fps
      controller.pose = pose
      if (effect) effect.manualTime = pose.time

      const source = await controller.nextFrame()

      ctx.clearRect(0, 0, width, height)
      if (!transparent) {
        ctx.fillStyle = settings.background.color
        ctx.fillRect(0, 0, width, height)
      }
      ctx.drawImage(source, 0, 0, width, height)

      if (sink) {
        if (sink.realtime) {
          // The fallback encoder timestamps by wall clock, so play the loop at real speed.
          deadline += frameInterval
          const wait = deadline - performance.now()
          if (wait > 0) await sleep(wait)
        }
        await sink.addFrame(i)
      } else {
        rgbaFrames.push(ctx.getImageData(0, 0, width, height).data)
      }

      onProgress({ phase: "render", current: i + 1, total: frames, message: "Render dei fotogrammi" })
    }

    const slug = safeSlug(modelName)

    if (sink) {
      onProgress({ phase: "encode", current: frames, total: frames, message: "Chiusura del file video" })
      // The realtime encoder needs the last frame to live out its full duration.
      if (sink.realtime) await sleep(frameInterval)
      const extension = sink.extension
      const blob = await sink.finish()
      sink = null
      return {
        blob,
        filename: `ascii-${slug}.${extension}`,
        format: "webm",
        frames,
        durationMs: performance.now() - started,
      }
    }

    onProgress({ phase: "encode", current: 0, total: frames, message: "Codifica GIF" })
    const blob = await encodeGif(rgbaFrames, {
      width,
      height,
      fps,
      colors,
      transparent,
      shouldAbort: () => controller.isAborted,
      onProgress: (done, total) =>
        onProgress({ phase: "encode", current: done, total, message: "Codifica GIF" }),
    })

    return {
      blob,
      filename: `ascii-${slug}.gif`,
      format: "gif",
      frames,
      durationMs: performance.now() - started,
    }
  } catch (err) {
    if (err instanceof Error && err.message === "FRAME_TIMEOUT") {
      throw new Error(
        wentHidden
          ? "Il render si è fermato perché la scheda è passata in secondo piano. Il browser sospende l'animazione: tieni questa scheda in primo piano per tutta la durata dell'export."
          : "Il render non ha prodotto un fotogramma entro 20 secondi. Prova con una risoluzione più bassa o un modello più leggero."
      )
    }
    throw err
  } finally {
    document.removeEventListener("visibilitychange", watchVisibility)
    sink?.cancel()
    controller.capturing = false
    controller.reset()
    if (effect) effect.timeMode = "auto"
    rgbaFrames.length = 0
  }
}

export function loopSummary(s: StudioSettings) {
  const { frames, fps, format } = s.output
  if (format === "webm") {
    return { seconds: frames / fps, actualFps: fps, rounded: false }
  }
  const { actualFps } = gifTiming(fps)
  return { seconds: frames / actualFps, actualFps, rounded: Math.abs(actualFps - fps) > 0.05 }
}

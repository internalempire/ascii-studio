import { GIFEncoder, quantize, applyPalette, type Palette } from "gifenc"
import { gifTiming } from "./settings"

export interface GifEncodeOptions {
  width: number
  height: number
  fps: number
  colors: number
  transparent: boolean
  onProgress?: (done: number, total: number) => void
  shouldAbort?: () => boolean
}

const nextTick = () => new Promise<void>((r) => setTimeout(r, 0))

/**
 * One palette for the whole animation, sampled across the loop.
 *
 * Per-frame palettes make ASCII output shimmer — the same glyph gets a slightly different
 * colour every frame — and cost a quantise pass each time. Sampling a handful of frames
 * gives a stable palette and a smaller file.
 */
function buildGlobalPalette(frames: Uint8ClampedArray[], colors: number, transparent: boolean): Palette {
  const sampleCount = Math.min(frames.length, 8)
  const step = Math.max(1, Math.floor(frames.length / sampleCount))
  const picked: Uint8ClampedArray[] = []
  for (let i = 0; i < frames.length; i += step) picked.push(frames[i])

  // Every 3rd pixel is plenty for a colour histogram and keeps the sample buffer small.
  const stride = 3
  const perFrame = Math.ceil(picked[0].length / 4 / stride)
  const sample = new Uint8ClampedArray(picked.length * perFrame * 4)
  let w = 0
  for (const frame of picked) {
    for (let p = 0; p < frame.length; p += 4 * stride) {
      sample[w++] = frame[p]
      sample[w++] = frame[p + 1]
      sample[w++] = frame[p + 2]
      sample[w++] = frame[p + 3]
    }
  }

  const format = transparent ? "rgba4444" : "rgb565"
  const palette = quantize(sample.subarray(0, w), colors, {
    format,
    oneBitAlpha: transparent,
    clearAlpha: transparent,
    clearAlphaThreshold: 0,
  })

  if (transparent && !palette.some((c) => c[3] === 0)) {
    // Guarantee a hole to punch: the encoder needs an index that means "show through".
    if (palette.length < colors) palette.push([0, 0, 0, 0])
    else palette[palette.length - 1] = [0, 0, 0, 0]
  }
  return palette
}

/** Collapses antialiased glyph edges to GIF's single bit of alpha. */
function binarizeAlpha(rgba: Uint8ClampedArray, threshold = 110) {
  for (let p = 3; p < rgba.length; p += 4) {
    if (rgba[p] < threshold) {
      rgba[p - 3] = 0
      rgba[p - 2] = 0
      rgba[p - 1] = 0
      rgba[p] = 0
    } else {
      rgba[p] = 255
    }
  }
}

export async function encodeGif(frames: Uint8ClampedArray[], opts: GifEncodeOptions): Promise<Blob> {
  const { width, height, fps, colors, transparent, onProgress, shouldAbort } = opts
  if (frames.length === 0) throw new Error("No frames to encode")

  if (transparent) for (const frame of frames) binarizeAlpha(frame)

  const palette = buildGlobalPalette(frames, Math.max(2, Math.min(256, colors)), transparent)
  const transparentIndex = transparent ? palette.findIndex((c) => c[3] === 0) : 0
  const format = transparent ? "rgba4444" : "rgb565"
  const { delayMs } = gifTiming(fps)

  const gif = GIFEncoder()
  for (let i = 0; i < frames.length; i++) {
    if (shouldAbort?.()) throw new Error("aborted")
    const index = applyPalette(frames[i], palette, format)
    gif.writeFrame(index, width, height, {
      palette: i === 0 ? palette : undefined,
      delay: delayMs,
      repeat: 0,
      transparent,
      transparentIndex: transparentIndex < 0 ? 0 : transparentIndex,
      // Transparent frames must clear before the next one draws, or holes fill with history.
      dispose: transparent ? 2 : -1,
    })
    onProgress?.(i + 1, frames.length)
    // Encoding is synchronous and long; yield so the progress readout actually moves.
    if (i % 2 === 1) await nextTick()
  }
  gif.finish()
  const bytes = gif.bytes()
  return new Blob([bytes as unknown as BlobPart], { type: "image/gif" })
}

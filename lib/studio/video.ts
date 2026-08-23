import { Muxer, ArrayBufferTarget } from "webm-muxer"

/**
 * Video export with two engines.
 *
 * WebCodecs is the one we want: it takes a frame plus an exact timestamp, so the loop can
 * run as fast as the GPU allows and every frame still lands on its true position in time.
 * MediaRecorder is the fallback for browsers without it — there the frame's position comes
 * from the wall clock, so the export loop has to play back in real time while recording.
 */

export interface FrameSink {
  /** When true the caller must pace the capture loop to real time. */
  readonly realtime: boolean
  readonly label: string
  readonly extension: string
  start(): void
  addFrame(index: number): Promise<void>
  finish(): Promise<Blob>
  cancel(): void
}

const VP9 = { webcodecs: "vp09.00.10.08", matroska: "V_VP9" }
const VP8 = { webcodecs: "vp8", matroska: "V_VP8" }

function bitrateFor(width: number, height: number, fps: number) {
  // ASCII output is all hard edges, which eats bits; be generous rather than blocky.
  return Math.min(40_000_000, Math.max(3_000_000, Math.round(width * height * fps * 0.35)))
}

async function pickCodec(width: number, height: number, fps: number) {
  if (typeof VideoEncoder === "undefined") return null
  for (const codec of [VP9, VP8]) {
    try {
      const support = await VideoEncoder.isConfigSupported({
        codec: codec.webcodecs,
        width,
        height,
        bitrate: bitrateFor(width, height, fps),
        framerate: fps,
      })
      if (support.supported) return codec
    } catch {
      /* unsupported config throws in some builds */
    }
  }
  return null
}

class WebCodecsSink implements FrameSink {
  readonly realtime = false
  readonly extension = "webm"
  readonly label: string

  private muxer: Muxer<ArrayBufferTarget>
  private encoder: VideoEncoder
  private failure: Error | null = null

  constructor(
    private canvas: HTMLCanvasElement,
    private fps: number,
    codec: { webcodecs: string; matroska: string }
  ) {
    this.label = codec === VP9 ? "VP9 · WebCodecs" : "VP8 · WebCodecs"
    this.muxer = new Muxer({
      target: new ArrayBufferTarget(),
      video: { codec: codec.matroska, width: canvas.width, height: canvas.height, frameRate: fps },
    })
    this.encoder = new VideoEncoder({
      output: (chunk, meta) => this.muxer.addVideoChunk(chunk, meta),
      error: (err) => {
        this.failure = err instanceof Error ? err : new Error(String(err))
      },
    })
    this.encoder.configure({
      codec: codec.webcodecs,
      width: canvas.width,
      height: canvas.height,
      bitrate: bitrateFor(canvas.width, canvas.height, fps),
      framerate: fps,
      latencyMode: "quality",
    })
  }

  start() {}

  async addFrame(index: number) {
    if (this.failure) throw this.failure
    const micros = 1_000_000 / this.fps
    const frame = new VideoFrame(this.canvas, {
      timestamp: Math.round(index * micros),
      duration: Math.round(micros),
    })
    // A keyframe every couple of seconds keeps players able to loop cleanly.
    this.encoder.encode(frame, { keyFrame: index % Math.max(1, Math.round(this.fps * 2)) === 0 })
    frame.close()

    // Don't outrun the encoder: an unbounded queue eats memory on long loops.
    while (this.encoder.encodeQueueSize > 8) {
      await new Promise<void>((r) => setTimeout(r, 4))
      if (this.failure) throw this.failure
    }
  }

  async finish(): Promise<Blob> {
    await this.encoder.flush()
    if (this.failure) throw this.failure
    this.muxer.finalize()
    const { buffer } = this.muxer.target
    return new Blob([buffer], { type: "video/webm" })
  }

  cancel() {
    try {
      if (this.encoder.state !== "closed") this.encoder.close()
    } catch {
      /* already torn down */
    }
  }
}

const RECORDER_MIMES = [
  "video/webm;codecs=vp9",
  "video/webm;codecs=vp8",
  "video/webm",
  "video/mp4;codecs=avc1.42E01E",
  "video/mp4",
]

interface CanvasCaptureMediaStreamTrack extends MediaStreamTrack {
  requestFrame(): void
}

class RecorderSink implements FrameSink {
  readonly realtime = true
  readonly label: string
  readonly extension: string

  private recorder: MediaRecorder
  private track: CanvasCaptureMediaStreamTrack
  private chunks: BlobPart[] = []
  private mime: string

  constructor(canvas: HTMLCanvasElement, fps: number, mime: string) {
    this.mime = mime
    this.extension = mime.startsWith("video/mp4") ? "mp4" : "webm"
    this.label = `${mime.replace("video/", "").replace(";codecs=", " · ")} · MediaRecorder`
    const stream = canvas.captureStream(0)
    this.track = stream.getVideoTracks()[0] as CanvasCaptureMediaStreamTrack
    this.recorder = new MediaRecorder(stream, {
      mimeType: mime,
      videoBitsPerSecond: bitrateFor(canvas.width, canvas.height, fps),
    })
    this.recorder.ondataavailable = (e) => {
      if (e.data.size > 0) this.chunks.push(e.data)
    }
  }

  start() {
    this.recorder.start()
  }

  async addFrame() {
    this.track.requestFrame()
  }

  finish(): Promise<Blob> {
    return new Promise((resolve, reject) => {
      this.recorder.onerror = () => reject(new Error("Video recording failed"))
      this.recorder.onstop = () => resolve(new Blob(this.chunks, { type: this.mime }))
      this.recorder.requestData()
      this.recorder.stop()
    })
  }

  cancel() {
    if (this.recorder.state !== "inactive") this.recorder.stop()
  }
}

export async function createVideoSink(canvas: HTMLCanvasElement, fps: number): Promise<FrameSink> {
  const codec = await pickCodec(canvas.width, canvas.height, fps)
  if (codec) return new WebCodecsSink(canvas, fps, codec)

  if (typeof MediaRecorder !== "undefined") {
    const mime = RECORDER_MIMES.find((m) => MediaRecorder.isTypeSupported(m))
    if (mime) return new RecorderSink(canvas, fps, mime)
  }

  throw new Error("This browser cannot encode video — export a GIF instead")
}

/** Whether the browser can encode video at all — used to warn before a long render. */
export function videoExportAvailable() {
  if (typeof window === "undefined") return true
  if (typeof VideoEncoder !== "undefined") return true
  return typeof MediaRecorder !== "undefined" && RECORDER_MIMES.some((m) => MediaRecorder.isTypeSupported(m))
}

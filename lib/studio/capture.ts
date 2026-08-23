/**
 * Hand-off between the async export routine (React land) and the render loop (R3F land).
 *
 * Frame accuracy is the whole point: the exporter sets an exact pose, then waits for the
 * one composited frame that used it. Two callbacks inside the Canvas cooperate —
 * the pose applier runs before the effect composer, the reader runs after it.
 */

export interface CapturePose {
  /** 0..1 position in the loop. Drives rotation, shader time and any model animation clip. */
  t: number
  rotX: number
  rotY: number
  rotZ: number
  /** Seconds fed to the shader, so time-based fx advance exactly one output frame at a time. */
  time: number
}

type Pending = {
  resolve: (canvas: HTMLCanvasElement) => void
  reject: (err: Error) => void
}

export class CaptureController {
  /** In capture mode the scene stops following the clock and obeys `pose` instead. */
  capturing = false
  pose: CapturePose = { t: 0, rotX: 0, rotY: 0, rotZ: 0, time: 0 }

  private pending: Pending | null = null
  /** Set by the pose applier, cleared on request: proves the pending frame used the new pose. */
  private armed = false
  private canvas: HTMLCanvasElement | null = null
  private aborted = false

  attachCanvas(canvas: HTMLCanvasElement | null) {
    this.canvas = canvas
  }

  abort() {
    this.aborted = true
    this.pending?.reject(new Error("aborted"))
    this.pending = null
  }

  reset() {
    this.aborted = false
    this.pending = null
    this.armed = false
  }

  get isAborted() {
    return this.aborted
  }

  /** Called from useFrame *before* the composer renders. */
  markPoseApplied() {
    if (this.pending) this.armed = true
  }

  /** Called from useFrame *after* the composer rendered into the drawing buffer. */
  deliverFrame(canvas: HTMLCanvasElement) {
    if (!this.pending || !this.armed) return
    const { resolve } = this.pending
    this.pending = null
    this.armed = false
    resolve(canvas)
  }

  /**
   * Resolves with the canvas holding exactly one composited frame.
   *
   * `requirePose` guards against a race: if the request lands after this frame's pose
   * applier already ran, the frame in flight still shows the previous pose, so the
   * reader must skip it and deliver the next one.
   */
  nextFrame(timeoutMs = 20000, requirePose = true): Promise<HTMLCanvasElement> {
    if (this.aborted) return Promise.reject(new Error("aborted"))
    return new Promise<HTMLCanvasElement>((resolve, reject) => {
      const timer = setTimeout(() => {
        if (this.pending) {
          this.pending = null
          this.armed = false
          reject(new Error("FRAME_TIMEOUT"))
        }
      }, timeoutMs)
      this.pending = {
        resolve: (c) => {
          clearTimeout(timer)
          resolve(c)
        },
        reject: (e) => {
          clearTimeout(timer)
          reject(e)
        },
      }
      this.armed = !requirePose
    })
  }

  /** Renders and discards frames — used to let a resize or a material swap settle. */
  async settle(frames = 3) {
    for (let i = 0; i < frames; i++) await this.nextFrame(20000, false)
  }

  get sourceCanvas() {
    return this.canvas
  }
}

export function poseForFrame(
  index: number,
  frames: number,
  turns: { x: number; y: number; z: number }
): CapturePose {
  const t = frames > 0 ? index / frames : 0
  const TAU = Math.PI * 2
  return {
    t,
    rotX: turns.x * TAU * t,
    rotY: turns.y * TAU * t,
    rotZ: turns.z * TAU * t,
    time: 0,
  }
}

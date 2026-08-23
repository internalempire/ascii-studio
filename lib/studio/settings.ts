/**
 * Single source of truth for every knob in the studio.
 *
 * The whole app reads and writes one plain object. That keeps three things cheap:
 * serialising a look to localStorage, emitting it as JSX for the hero component,
 * and mirroring it into a ref the render loop can read every frame without
 * re-rendering React.
 */

export type CharsetKey =
  | "terminal"
  | "ascii"
  | "minimal"
  | "blocks"
  | "hatching"
  | "geometric"
  | "katakana"
  | "dots"
  | "binary"
  | "custom"
  | "procedural"

export const CHARSETS: Record<CharsetKey, { label: string; chars: string[] }> = {
  // Ordered sparse -> dense. The shader picks a tile by brightness, so the order is the ramp.
  terminal: { label: "Terminal", chars: [".", ":", "-", "=", "+", "*", "#", "%", "@", "0", "O", "N", "M", "W", "B", "X"] },
  ascii: { label: "ASCII classic", chars: [".", ",", ":", ";", "!", "*", "o", "e", "&", "8", "#", "%", "@"] },
  minimal: { label: "Minimal", chars: [".", "+", "#"] },
  blocks: { label: "Blocks", chars: ["░", "▒", "▓", "█"] },
  hatching: { label: "Hatching", chars: ["/", "\\", "|", "-", "+", "x", "X", "#"] },
  geometric: { label: "Geometric", chars: ["◦", "◇", "◈", "◆", "▣", "■"] },
  katakana: { label: "Katakana", chars: ["ｦ", "ｱ", "ｳ", "ｴ", "ｵ", "ｶ", "ｷ", "ｹ", "ｺ", "ｻ", "ｼ", "ｽ", "ｾ", "ｿ", "ﾀ", "ﾂ"] },
  dots: { label: "Dots", chars: ["·", "∘", "•", "●", "⬤"] },
  binary: { label: "Binary", chars: ["0", "1"] },
  custom: { label: "Custom…", chars: [] },
  procedural: { label: "Procedural (no glyphs)", chars: [] },
}

/** Which model axis points up. Fixes files exported from a Z-up tool, or upside down. */
export type UpAxis = "y" | "z" | "-y" | "-z"

export const UP_AXES: { value: UpAxis; label: string }[] = [
  { value: "y", label: "Y (standard glTF)" },
  { value: "z", label: "Z is up" },
  { value: "-y", label: "−Y (upside down)" },
  { value: "-z", label: "−Z" },
]

export type PrimitiveKey = "torusknot" | "torus" | "icosahedron" | "box" | "sphere" | "cone"

export const PRIMITIVES: Record<PrimitiveKey, string> = {
  torusknot: "Torus knot",
  torus: "Torus",
  icosahedron: "Icosahedron",
  box: "Cube",
  sphere: "Sphere",
  cone: "Cone",
}

export type ModelSource =
  | { kind: "url"; url: string; name: string }
  | { kind: "primitive"; shape: PrimitiveKey; name: string }

export const DEMO_MODEL: ModelSource = { kind: "url", url: "/models/user-model.glb", name: "user-model.glb" }

export interface StudioSettings {
  transform: {
    scale: number
    upAxis: UpAxis
    mirrorX: boolean
    mirrorY: boolean
    mirrorZ: boolean
    offsetX: number
    offsetY: number
    tiltX: number
    tiltY: number
    tiltZ: number
    phaseX: number
    phaseY: number
    phaseZ: number
    cameraDistance: number
    camAzimuth: number
    camElevation: number
    fov: number
    spin: boolean
    spinSpeed: number
  }
  light: {
    exposure: number
    ambient: number
    keyIntensity: number
    keyAzimuth: number
    keyElevation: number
    fillIntensity: number
    rimIntensity: number
    envIntensity: number
  }
  material: {
    override: boolean
    color: string
    roughness: number
    metalness: number
    flatShading: boolean
  }
  ascii: {
    cellSize: number
    cellAspect: number
    charset: CharsetKey
    customChars: string
    invert: boolean
    colorMode: boolean
    useTint: boolean
    tintColor: string
    volumeShading: boolean
    volumeGain: number
    contrast: number
    brightness: number
    inkThreshold: number
    backgroundCut: number
  }
  fx: {
    palette: number
    scanlineIntensity: number
    scanlineCount: number
    vignetteIntensity: number
    vignetteRadius: number
    glowIntensity: number
    glowRadius: number
    curvature: number
    aberration: number
    noiseIntensity: number
    noiseScale: number
    noiseSpeed: number
    waveAmplitude: number
    waveFrequency: number
    waveSpeed: number
    glitchIntensity: number
    glitchFrequency: number
    jitterIntensity: number
    jitterSpeed: number
    targetFPS: number
  }
  background: {
    transparent: boolean
    color: string
  }
  animation: {
    enabled: boolean
    clip: number
    loops: number
  }
  output: {
    width: number
    height: number
    frames: number
    fps: number
    turnsX: number
    turnsY: number
    turnsZ: number
    colors: number
    format: "gif" | "webm"
  }
}

export const DEFAULT_SETTINGS: StudioSettings = {
  transform: {
    scale: 1,
    upAxis: "y",
    mirrorX: false,
    mirrorY: false,
    mirrorZ: false,
    offsetX: 0,
    offsetY: 0,
    tiltX: 17,
    tiltY: 0,
    tiltZ: -4.5,
    phaseX: 0,
    phaseY: 0,
    phaseZ: 0,
    cameraDistance: 4.5,
    camAzimuth: 0,
    camElevation: 0,
    fov: 50,
    spin: true,
    spinSpeed: 0.4,
  },
  light: {
    exposure: 0.6,
    ambient: 0.08,
    keyIntensity: 6,
    keyAzimuth: 20,
    keyElevation: 30,
    fillIntensity: 0.35,
    rimIntensity: 0,
    envIntensity: 0.6,
  },
  material: {
    override: true,
    color: "#917AFF",
    roughness: 0.12,
    metalness: 0,
    flatShading: false,
  },
  ascii: {
    cellSize: 9,
    cellAspect: 1,
    charset: "terminal",
    customChars: ".:-=+*#%@",
    invert: true,
    colorMode: true,
    useTint: true,
    tintColor: "#917AFF",
    volumeShading: true,
    volumeGain: 1.6,
    contrast: 1.8,
    brightness: 0,
    inkThreshold: 0.04,
    backgroundCut: 0.06,
  },
  fx: {
    palette: 0,
    scanlineIntensity: 0,
    scanlineCount: 200,
    vignetteIntensity: 0,
    vignetteRadius: 0.8,
    glowIntensity: 0,
    glowRadius: 200,
    curvature: 0,
    aberration: 0,
    noiseIntensity: 0,
    noiseScale: 1,
    noiseSpeed: 1,
    waveAmplitude: 0,
    waveFrequency: 10,
    waveSpeed: 1,
    glitchIntensity: 0,
    glitchFrequency: 0,
    jitterIntensity: 0,
    jitterSpeed: 1,
    targetFPS: 0,
  },
  background: {
    transparent: false,
    color: "#000000",
  },
  animation: {
    enabled: true,
    clip: 0,
    loops: 1,
  },
  output: {
    width: 640,
    height: 640,
    frames: 48,
    fps: 25,
    turnsX: 0,
    turnsY: 1,
    turnsZ: 0,
    colors: 128,
    format: "gif",
  },
}

/** Presets only carry the look. Camera, model and output stay where the user put them. */
export type Preset = {
  label: string
  note: string
  patch: DeepPartial<StudioSettings>
}

export type DeepPartial<T> = { [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K] }

export const PRESETS: Record<string, Preset> = {
  hero: {
    label: "Hero purple",
    note: "The look shipped with the original component",
    patch: {
      material: { color: "#917AFF", roughness: 0.12, metalness: 0 },
      ascii: { charset: "terminal", useTint: true, tintColor: "#917AFF", cellSize: 9, cellAspect: 1, contrast: 1.8, volumeShading: true, colorMode: true, invert: true },
      fx: { palette: 0, scanlineIntensity: 0, vignetteIntensity: 0, curvature: 0, aberration: 0, noiseIntensity: 0, glitchIntensity: 0, jitterIntensity: 0 },
    },
  },
  phosphor: {
    label: "Green phosphor",
    note: "VT220 tube: scanlines, curvature, gentle vignette",
    patch: {
      material: { color: "#8a8a8a", roughness: 0.35, metalness: 0 },
      ascii: { charset: "ascii", useTint: true, tintColor: "#4AF626", cellSize: 10, cellAspect: 0.55, contrast: 2, volumeShading: true, colorMode: true, invert: true },
      fx: { palette: 0, scanlineIntensity: 0.35, scanlineCount: 320, vignetteIntensity: 0.55, vignetteRadius: 1.1, curvature: 0.08, aberration: 0, noiseIntensity: 0.04, noiseScale: 400, noiseSpeed: 12, glitchIntensity: 0, jitterIntensity: 0 },
    },
  },
  amber: {
    label: "Amber CRT",
    note: "Warm monitor glass with a slow drift",
    patch: {
      material: { color: "#8f8a80", roughness: 0.28, metalness: 0.1 },
      ascii: { charset: "terminal", useTint: true, tintColor: "#FFB000", cellSize: 10, cellAspect: 1, contrast: 1.9, volumeShading: true, colorMode: true, invert: true },
      fx: { palette: 0, scanlineIntensity: 0.25, scanlineCount: 220, vignetteIntensity: 0.4, vignetteRadius: 1.2, curvature: 0.12, aberration: 0.0015, noiseIntensity: 0.03, noiseScale: 300, noiseSpeed: 8, glitchIntensity: 0, jitterIntensity: 0 },
    },
  },
  matrix: {
    label: "Katakana rain",
    note: "Half-width kana, tight cells, jittering columns",
    patch: {
      material: { color: "#7d7d7d", roughness: 0.4, metalness: 0 },
      ascii: { charset: "katakana", useTint: true, tintColor: "#00FF6A", cellSize: 13, cellAspect: 0.62, contrast: 2.2, volumeShading: true, colorMode: true, invert: true },
      fx: { palette: 0, scanlineIntensity: 0.15, scanlineCount: 400, vignetteIntensity: 0.5, vignetteRadius: 1.0, curvature: 0, aberration: 0, noiseIntensity: 0, jitterIntensity: 0.6, jitterSpeed: 8, glitchIntensity: 0 },
    },
  },
  blueprint: {
    label: "Blueprint",
    note: "Cyan hatching on a flat ground, drafting-table feel",
    patch: {
      material: { color: "#909090", roughness: 0.6, metalness: 0 },
      ascii: { charset: "hatching", useTint: true, tintColor: "#39C0ED", cellSize: 11, cellAspect: 1, contrast: 2.4, volumeShading: true, volumeGain: 2, colorMode: true, invert: true },
      fx: { palette: 0, scanlineIntensity: 0, vignetteIntensity: 0.25, vignetteRadius: 1.4, curvature: 0, aberration: 0, noiseIntensity: 0, glitchIntensity: 0, jitterIntensity: 0 },
    },
  },
  xerox: {
    label: "Xerox",
    note: "No colour at all, maximum contrast, chunky blocks",
    patch: {
      material: { color: "#8a8a8a", roughness: 0.5, metalness: 0 },
      ascii: { charset: "blocks", useTint: true, tintColor: "#FFFFFF", cellSize: 14, cellAspect: 0.55, contrast: 2.8, brightness: -0.05, volumeShading: true, volumeGain: 2.4, colorMode: true, invert: true },
      fx: { palette: 0, scanlineIntensity: 0, vignetteIntensity: 0, curvature: 0, aberration: 0, noiseIntensity: 0.06, noiseScale: 600, noiseSpeed: 20, glitchIntensity: 0, jitterIntensity: 0 },
    },
  },
  malfunction: {
    label: "Malfunction",
    note: "Torn signal: RGB tearing, wave warp, heavy grain",
    patch: {
      material: { color: "#ff5f5f", roughness: 0.2, metalness: 0.2 },
      ascii: { charset: "terminal", useTint: false, cellSize: 9, cellAspect: 1, contrast: 2, volumeShading: true, colorMode: true, invert: true },
      fx: { palette: 0, scanlineIntensity: 0.3, scanlineCount: 260, vignetteIntensity: 0.5, vignetteRadius: 1.1, curvature: 0.06, aberration: 0.004, noiseIntensity: 0.08, noiseScale: 250, noiseSpeed: 14, waveAmplitude: 0.002, waveFrequency: 24, waveSpeed: 3, glitchIntensity: 0.12, glitchFrequency: 12, jitterIntensity: 0.2, jitterSpeed: 10 },
    },
  },
}

export function mergeSettings(base: StudioSettings, patch: DeepPartial<StudioSettings>): StudioSettings {
  const out = structuredClone(base) as StudioSettings
  for (const key of Object.keys(patch) as (keyof StudioSettings)[]) {
    const group = patch[key]
    if (group && typeof group === "object") {
      Object.assign(out[key] as object, group)
    }
  }
  return out
}

/** Tolerates settings saved by an older build: unknown keys are dropped, missing ones fall back. */
export function reviveSettings(raw: unknown): StudioSettings {
  if (!raw || typeof raw !== "object") return structuredClone(DEFAULT_SETTINGS)
  return mergeSettings(DEFAULT_SETTINGS, raw as DeepPartial<StudioSettings>)
}

export function resolveChars(charset: CharsetKey, customChars: string): string[] | null {
  if (charset === "procedural") return null
  if (charset === "custom") {
    const chars = Array.from(customChars).filter((c) => c.trim().length > 0)
    return chars.length > 0 ? chars : null
  }
  return CHARSETS[charset].chars
}

/** GIF stores frame delays in centiseconds, so not every fps survives the round trip. */
export function gifTiming(fps: number) {
  const delayCs = Math.max(2, Math.round(100 / fps))
  return { delayMs: delayCs * 10, actualFps: 100 / delayCs }
}

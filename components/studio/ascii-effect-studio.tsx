"use client"

import { useEffect, useMemo, useRef } from "react"
import { Effect, BlendFunction } from "postprocessing"
import { useFrame } from "@react-three/fiber"
import {
  CanvasTexture,
  ClampToEdgeWrapping,
  Color,
  LinearFilter,
  Uniform,
  Vector2,
  Vector3,
  WebGLRenderer,
  WebGLRenderTarget,
  Texture,
} from "three"
import type { StudioSettings } from "@/lib/studio/settings"

const GLYPH_FONT_STACK = `ui-monospace, "Geist Mono", "SF Mono", Menlo, Consolas, monospace`

/**
 * Packs the character ramp into one strip texture, sparse glyph on the left.
 * The shader picks a tile by brightness, so index order *is* the tonal ramp.
 */
export function createGlyphTexture(characters: string[], aspect = 1, height = 72): CanvasTexture | null {
  if (characters.length === 0) return null
  // Tiles carry the same aspect as the screen cell, so glyphs land undistorted whatever
  // shape the user gives the grid — square cells keep the original look, narrow ones
  // reproduce real terminal proportions.
  const tileW = Math.max(4, Math.round(height * aspect))
  const canvas = document.createElement("canvas")
  canvas.width = tileW * characters.length
  canvas.height = height
  const ctx = canvas.getContext("2d")
  if (!ctx) return null
  ctx.fillStyle = "#000"
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.fillStyle = "#fff"
  ctx.font = `${Math.round(height * 0.88)}px ${GLYPH_FONT_STACK}`
  ctx.textAlign = "center"
  ctx.textBaseline = "middle"
  for (let i = 0; i < characters.length; i++) {
    ctx.fillText(characters[i], i * tileW + tileW / 2, height / 2)
  }
  const texture = new CanvasTexture(canvas)
  texture.needsUpdate = true
  texture.minFilter = LinearFilter
  texture.magFilter = LinearFilter
  texture.wrapS = ClampToEdgeWrapping
  texture.wrapT = ClampToEdgeWrapping
  return texture
}

const fragmentShader = /* glsl */ `
uniform float cellSize;
uniform float cellAspect;
uniform bool invert;
uniform bool colorMode;

uniform float time;
uniform vec2 resolution;
uniform vec2 glowPos;
uniform float scanlineIntensity;
uniform float scanlineCount;
uniform float targetFPS;
uniform float jitterIntensity;
uniform float jitterSpeed;
uniform float glowRadius;
uniform float glowIntensity;
uniform float vignetteIntensity;
uniform float vignetteRadius;
uniform int colorPalette;
uniform float curvature;
uniform float aberrationStrength;
uniform float noiseIntensity;
uniform float noiseScale;
uniform float noiseSpeed;
uniform float waveAmplitude;
uniform float waveFrequency;
uniform float waveSpeed;
uniform float glitchIntensity;
uniform float glitchFrequency;
uniform float brightnessAdjust;
uniform float contrastAdjust;
uniform sampler2D glyphAtlas;
uniform float glyphTiles;
uniform bool useGlyphAtlas;
uniform bool volumeShading;
uniform float volumeGain;
uniform float inkThreshold;
uniform float backgroundCut;
uniform bool useTintColor;
uniform vec3 tintColor;

float random(vec2 st) {
  return fract(sin(dot(st.xy, vec2(12.9898, 78.233))) * 43758.5453123);
}

float noise(vec2 st) {
  vec2 i = floor(st);
  vec2 f = fract(st);
  float a = random(i);
  float b = random(i + vec2(1.0, 0.0));
  float c = random(i + vec2(0.0, 1.0));
  float d = random(i + vec2(1.0, 1.0));
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
}

vec3 applyColorPalette(vec3 color, int palette) {
  float lum = dot(color, vec3(0.299, 0.587, 0.114));
  if (palette == 1) return vec3(0.1, lum * 0.9, 0.1);
  if (palette == 2) return vec3(lum, lum * 0.6, lum * 0.2);
  if (palette == 3) return vec3(0.0, lum * 0.8, lum);
  if (palette == 4) return vec3(0.1, 0.2, lum);
  if (palette == 5) return vec3(lum);
  return color;
}

/** Procedural fallback ramp for when no glyph atlas is bound. */
float getChar(float brightness, vec2 p) {
  if (brightness < 0.01) return 0.0;
  vec2 grid = floor(p * 4.0);
  float dotP = (grid.x == 1.0 && grid.y == 1.0) ? 1.0 : 0.0;
  float block2 = (grid.x == 1.0 || grid.x == 2.0) && (grid.y == 1.0 || grid.y == 2.0) ? 1.0 : 0.0;
  float barH = (grid.y == 1.0 || grid.y == 2.0) ? 1.0 : 0.0;
  float barH2 = (grid.y == 0.0 || grid.y == 3.0) ? 1.0 : (grid.y == 1.0 || grid.y == 2.0) ? 0.5 : 0.0;
  float edge = (grid.x == 0.0 || grid.x == 2.0 || grid.y == 0.0 || grid.y == 2.0) ? 1.0 : 0.3;
  float t0 = 1.0 - smoothstep(0.0, 0.15, brightness);
  float t1 = smoothstep(0.08, 0.22, brightness) * (1.0 - smoothstep(0.22, 0.35, brightness));
  float t2 = smoothstep(0.20, 0.38, brightness) * (1.0 - smoothstep(0.38, 0.50, brightness));
  float t3 = smoothstep(0.35, 0.52, brightness) * (1.0 - smoothstep(0.52, 0.65, brightness));
  float t4 = smoothstep(0.50, 0.70, brightness) * (1.0 - smoothstep(0.70, 0.82, brightness));
  float t5 = smoothstep(0.68, 1.0, brightness);
  return clamp(dotP * t0 * 0.5 + block2 * t1 + barH * t2 + barH2 * t3 + edge * t4 + t5, 0.0, 1.0);
}

void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
  vec2 workUV = uv;

  if (curvature > 0.0) {
    vec2 centered = workUV * 2.0 - 1.0;
    centered *= 1.0 + curvature * dot(centered, centered);
    workUV = centered * 0.5 + 0.5;
    if (workUV.x < 0.0 || workUV.x > 1.0 || workUV.y < 0.0 || workUV.y > 1.0) {
      outputColor = vec4(0.0);
      return;
    }
  }

  if (waveAmplitude > 0.0) {
    workUV.x += sin(workUV.y * waveFrequency + time * waveSpeed) * waveAmplitude;
    workUV.y += cos(workUV.x * waveFrequency + time * waveSpeed) * waveAmplitude;
  }

  vec2 cellCount = resolution / vec2(max(1.0, cellSize * cellAspect), max(1.0, cellSize));
  vec2 cellCoord = floor(workUV * cellCount);

  if (jitterIntensity > 0.0) {
    float jitterTime = time * jitterSpeed;
    float jitterX = (random(vec2(cellCoord.y, floor(jitterTime))) - 0.5) * jitterIntensity * 2.0;
    float jitterY = (random(vec2(cellCoord.x, floor(jitterTime + 1000.0))) - 0.5) * jitterIntensity * 2.0;
    cellCoord += vec2(jitterX, jitterY);
  }

  if (glitchIntensity > 0.0 && glitchFrequency > 0.0) {
    float glitchTime = floor(time * glitchFrequency);
    float glitchRand = random(vec2(glitchTime, cellCoord.y));
    if (glitchRand < glitchIntensity) {
      cellCoord.x += (random(vec2(glitchTime + 1.0, cellCoord.y)) - 0.5) * 20.0;
    }
  }

  vec2 cellUV = (cellCoord + 0.5) / cellCount;

  vec4 cellColor;
  if (aberrationStrength > 0.0) {
    float o = aberrationStrength;
    cellColor = vec4(
      texture(inputBuffer, cellUV + vec2(o, 0.0)).r,
      texture(inputBuffer, cellUV).g,
      texture(inputBuffer, cellUV - vec2(o, 0.0)).b,
      texture(inputBuffer, cellUV).a
    );
  } else {
    cellColor = texture(inputBuffer, cellUV);
  }

  if (noiseIntensity > 0.0) {
    float noiseVal = noise(cellUV * noiseScale + time * noiseSpeed);
    cellColor.rgb += (noiseVal - 0.5) * noiseIntensity;
  }

  // Raw luminance decides what counts as empty space, before contrast pushes it around.
  float rawLuminance = dot(cellColor.rgb, vec3(0.299, 0.587, 0.114));
  cellColor.rgb = (cellColor.rgb - 0.5) * contrastAdjust + 0.5 + brightnessAdjust;
  float brightness = dot(cellColor.rgb, vec3(0.299, 0.587, 0.114));
  if (invert) brightness = 1.0 - brightness;

  float brightnessForGlyph = brightness;
  if (volumeShading) {
    brightnessForGlyph = clamp((brightness - 0.5) * volumeGain + 0.5, 0.0, 1.0);
  }

  vec2 localUV = fract(workUV * cellCount);
  float charValue;
  bool isBackground = rawLuminance < backgroundCut;
  if (isBackground || brightness < inkThreshold) {
    charValue = 0.0;
  } else if (useGlyphAtlas && glyphTiles > 0.0) {
    float tile = clamp(floor(brightnessForGlyph * glyphTiles), 0.0, glyphTiles - 1.0);
    float inset = 0.02;
    vec2 inner = inset + localUV * (1.0 - 2.0 * inset);
    charValue = texture(glyphAtlas, vec2((tile + inner.x) / glyphTiles, inner.y)).r;
  } else {
    charValue = getChar(brightnessForGlyph, localUV);
  }

  vec3 finalColor;
  if (colorMode) {
    finalColor = (useTintColor ? tintColor : cellColor.rgb) * charValue;
  } else {
    finalColor = vec3(brightness * charValue);
  }

  finalColor = applyColorPalette(finalColor, colorPalette);

  if (glowIntensity > 0.0) {
    float dist = length(uv * resolution - glowPos);
    finalColor += exp(-dist / max(glowRadius, 1.0)) * glowIntensity;
  }

  if (scanlineIntensity > 0.0) {
    float scanline = sin(uv.y * scanlineCount * 3.14159) * 0.5 + 0.5;
    finalColor *= 1.0 - (scanline * scanlineIntensity);
  }

  if (vignetteIntensity > 0.0) {
    vec2 centered = uv * 2.0 - 1.0;
    float vignette = 1.0 - dot(centered, centered) / vignetteRadius;
    finalColor *= mix(1.0, vignette, vignetteIntensity);
  }

  // Straight (non-premultiplied) alpha: the glyph carves its own silhouette so the page
  // colour behind the canvas — or nothing at all, on a transparent export — shows through.
  float coverage = clamp(max(charValue, dot(finalColor, vec3(0.2126, 0.7152, 0.0722))), 0.0, 1.0);
  outputColor = vec4(finalColor, coverage);
}
`

export class StudioAsciiEffectImpl extends Effect {
  /** In "manual" the exporter owns the clock, so time-based fx step one output frame at a time. */
  timeMode: "auto" | "manual" = "auto"
  manualTime = 0

  private clock = 0
  private accumulator = 0
  private tint = new Vector3(1, 1, 1)
  private colorScratch = new Color()

  constructor() {
    super("StudioAsciiEffect", fragmentShader, {
      blendFunction: BlendFunction.NORMAL,
      uniforms: new Map<string, Uniform>([
        ["cellSize", new Uniform(9)],
        ["cellAspect", new Uniform(1)],
        ["invert", new Uniform(true)],
        ["colorMode", new Uniform(true)],
        ["time", new Uniform(0)],
        ["resolution", new Uniform(new Vector2(1920, 1080))],
        ["glowPos", new Uniform(new Vector2(0, 0))],
        ["glyphAtlas", new Uniform(null)],
        ["glyphTiles", new Uniform(0)],
        ["useGlyphAtlas", new Uniform(false)],
        ["volumeShading", new Uniform(true)],
        ["volumeGain", new Uniform(1.6)],
        ["inkThreshold", new Uniform(0.04)],
        ["backgroundCut", new Uniform(0.06)],
        ["useTintColor", new Uniform(true)],
        ["tintColor", new Uniform(new Vector3(1, 1, 1))],
        ["scanlineIntensity", new Uniform(0)],
        ["scanlineCount", new Uniform(200)],
        ["targetFPS", new Uniform(0)],
        ["jitterIntensity", new Uniform(0)],
        ["jitterSpeed", new Uniform(1)],
        ["glowRadius", new Uniform(200)],
        ["glowIntensity", new Uniform(0)],
        ["vignetteIntensity", new Uniform(0)],
        ["vignetteRadius", new Uniform(0.8)],
        ["colorPalette", new Uniform(0)],
        ["curvature", new Uniform(0)],
        ["aberrationStrength", new Uniform(0)],
        ["noiseIntensity", new Uniform(0)],
        ["noiseScale", new Uniform(1)],
        ["noiseSpeed", new Uniform(1)],
        ["waveAmplitude", new Uniform(0)],
        ["waveFrequency", new Uniform(10)],
        ["waveSpeed", new Uniform(1)],
        ["glitchIntensity", new Uniform(0)],
        ["glitchFrequency", new Uniform(0)],
        ["brightnessAdjust", new Uniform(0)],
        ["contrastAdjust", new Uniform(1)],
      ]) as Map<string, Uniform>,
    })
  }

  private set(name: string, value: unknown) {
    const uniform = this.uniforms.get(name)
    if (uniform) uniform.value = value
  }

  /** postprocessing calls this whenever the composer resizes; the grid is measured in pixels. */
  setSize(width: number, height: number) {
    this.setResolution(width, height)
  }

  setResolution(width: number, height: number) {
    const res = this.uniforms.get("resolution")!.value as Vector2
    res.set(width, height)
    // The glow sits dead centre so a still export matches what the preview showed.
    ;(this.uniforms.get("glowPos")!.value as Vector2).set(width / 2, height / 2)
  }

  setGlyphAtlas(texture: Texture | null, tiles: number) {
    this.set("glyphAtlas", texture)
    this.set("glyphTiles", tiles)
    this.set("useGlyphAtlas", !!texture && tiles > 0)
  }

  /** Cheap enough to run every frame, which keeps the panel and the render in lockstep. */
  applySettings(s: StudioSettings) {
    const a = s.ascii
    const fx = s.fx
    this.set("cellSize", Math.max(1, a.cellSize))
    this.set("cellAspect", Math.max(0.05, a.cellAspect))
    this.set("invert", a.invert)
    this.set("colorMode", a.colorMode)
    this.set("volumeShading", a.volumeShading)
    this.set("volumeGain", a.volumeGain)
    this.set("inkThreshold", a.inkThreshold)
    this.set("backgroundCut", a.backgroundCut)
    this.set("contrastAdjust", a.contrast)
    this.set("brightnessAdjust", a.brightness)
    this.set("useTintColor", a.useTint)
    if (a.useTint) {
      this.colorScratch.set(a.tintColor)
      this.tint.set(this.colorScratch.r, this.colorScratch.g, this.colorScratch.b)
      this.set("tintColor", this.tint)
    }
    this.set("colorPalette", fx.palette)
    this.set("scanlineIntensity", fx.scanlineIntensity)
    this.set("scanlineCount", fx.scanlineCount)
    this.set("vignetteIntensity", fx.vignetteIntensity)
    this.set("vignetteRadius", fx.vignetteRadius)
    this.set("glowIntensity", fx.glowIntensity)
    this.set("glowRadius", fx.glowRadius)
    this.set("curvature", fx.curvature)
    this.set("aberrationStrength", fx.aberration)
    this.set("noiseIntensity", fx.noiseIntensity)
    this.set("noiseScale", fx.noiseScale)
    this.set("noiseSpeed", fx.noiseSpeed)
    this.set("waveAmplitude", fx.waveAmplitude)
    this.set("waveFrequency", fx.waveFrequency)
    this.set("waveSpeed", fx.waveSpeed)
    this.set("glitchIntensity", fx.glitchIntensity)
    this.set("glitchFrequency", fx.glitchFrequency)
    this.set("jitterIntensity", fx.jitterIntensity)
    this.set("jitterSpeed", fx.jitterSpeed)
    this.set("targetFPS", fx.targetFPS)
  }

  update(renderer: WebGLRenderer, _inputBuffer: WebGLRenderTarget, deltaTime?: number) {
    const context = renderer.getContext()
    if (!context || (context as WebGLRenderingContext).isContextLost?.()) return

    if (this.timeMode === "manual") {
      this.set("time", this.manualTime)
      return
    }

    const targetFPS = this.uniforms.get("targetFPS")!.value as number
    const dt = deltaTime ?? 0
    if (targetFPS > 0) {
      const frameDuration = 1 / targetFPS
      this.accumulator += dt
      if (this.accumulator >= frameDuration) {
        this.clock += frameDuration
        this.accumulator = this.accumulator % frameDuration
      }
    } else {
      this.clock += dt
    }
    this.set("time", this.clock)
  }
}

interface StudioAsciiEffectProps {
  settingsRef: React.RefObject<StudioSettings>
  chars: string[] | null
  cellAspect: number
  effectRef?: React.MutableRefObject<StudioAsciiEffectImpl | null>
}

export function StudioAsciiEffect({ settingsRef, chars, cellAspect, effectRef }: StudioAsciiEffectProps) {
  // Built once and kept: swapping uniforms avoids a shader recompile on every slider move.
  const effect = useMemo(() => new StudioAsciiEffectImpl(), [])
  const atlasRef = useRef<CanvasTexture | null>(null)

  useEffect(() => {
    if (effectRef) effectRef.current = effect
    return () => {
      if (effectRef) effectRef.current = null
    }
  }, [effect, effectRef])

  useEffect(() => {
    const next = chars && chars.length > 0 ? createGlyphTexture(chars, cellAspect) : null
    effect.setGlyphAtlas(next, chars?.length ?? 0)
    atlasRef.current?.dispose()
    atlasRef.current = next
    return () => {
      next?.dispose()
      if (atlasRef.current === next) atlasRef.current = null
    }
  }, [chars, cellAspect, effect])

  useFrame(() => {
    if (settingsRef.current) effect.applySettings(settingsRef.current)
  }, -2)

  return <primitive object={effect} dispose={null} />
}

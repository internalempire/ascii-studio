"use client"

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react"
import type { StudioSettings } from "@/lib/studio/settings"

interface ViewportProps {
  width: number
  height: number
  background: string
  transparent: boolean
  children: React.ReactNode
  overlay?: React.ReactNode
  zoomMode: "fit" | "one"
  onZoom: (scale: number) => void
  onOrbit: (patch: Partial<StudioSettings["transform"]>) => void
  transformRef: React.RefObject<StudioSettings["transform"]>
  onFiles: (files: File[]) => void
  interactive: boolean
}

const CHECKER = "repeating-conic-gradient(#141417 0% 25%, #0a0a0c 0% 50%) 0 0 / 16px 16px"

/**
 * Orbiting captures the pointer on the stage, which would retarget the click away from any
 * control sitting on top of it — the buttons in the result panel would receive pointerdown
 * and never fire. Anything inside an overlay owns its own pointer.
 */
function isOverlayTarget(target: EventTarget | null) {
  return target instanceof Element && target.closest(".overlay, .progress") !== null
}

export function Viewport({
  width,
  height,
  background,
  transparent,
  children,
  overlay,
  zoomMode,
  onZoom,
  onOrbit,
  transformRef,
  onFiles,
  interactive,
}: ViewportProps) {
  const areaRef = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(1)
  const [dragging, setDragging] = useState(false)
  const [dropping, setDropping] = useState(false)
  const dragDepth = useRef(0)
  const last = useRef({ x: 0, y: 0 })

  // Fit the output frame into whatever room the rails leave.
  useLayoutEffect(() => {
    const area = areaRef.current
    if (!area) return
    const measure = () => {
      if (zoomMode === "one") {
        setScale(1)
        onZoom(1)
        return
      }
      const box = area.getBoundingClientRect()
      const pad = 68
      const next = Math.min(1, (box.width - pad) / width, (box.height - pad) / height)
      const clamped = Number.isFinite(next) && next > 0 ? next : 1
      setScale(clamped)
      onZoom(clamped)
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(area)
    return () => ro.disconnect()
  }, [width, height, zoomMode, onZoom])

  // Wheel needs a non-passive listener to stop the page from scrolling under the drag.
  useEffect(() => {
    const area = areaRef.current
    if (!area || !interactive) return
    const onWheel = (e: WheelEvent) => {
      if (isOverlayTarget(e.target)) return
      e.preventDefault()
      const current = transformRef.current?.cameraDistance ?? 4.5
      const next = Math.min(20, Math.max(1, current * (1 + e.deltaY * 0.0012)))
      onOrbit({ cameraDistance: next })
    }
    area.addEventListener("wheel", onWheel, { passive: false })
    return () => area.removeEventListener("wheel", onWheel)
  }, [onOrbit, transformRef, interactive])

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (!interactive || e.button !== 0 || isOverlayTarget(e.target)) return
      ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
      last.current = { x: e.clientX, y: e.clientY }
      setDragging(true)
    },
    [interactive]
  )

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!dragging) return
      const dx = e.clientX - last.current.x
      const dy = e.clientY - last.current.y
      last.current = { x: e.clientX, y: e.clientY }
      const t = transformRef.current
      if (!t) return
      onOrbit({
        camAzimuth: ((t.camAzimuth - dx * 0.35 + 180) % 360 + 360) % 360 - 180,
        camElevation: Math.min(89, Math.max(-89, t.camElevation + dy * 0.3)),
      })
    },
    [dragging, onOrbit, transformRef]
  )

  const endDrag = useCallback((e: React.PointerEvent) => {
    if ((e.currentTarget as HTMLElement).hasPointerCapture?.(e.pointerId)) {
      ;(e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId)
    }
    setDragging(false)
  }, [])

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      dragDepth.current = 0
      setDropping(false)
      const files = Array.from(e.dataTransfer?.files ?? [])
      if (files.length > 0) onFiles(files)
    },
    [onFiles]
  )

  return (
    <div
      ref={areaRef}
      className="stage__area"
      style={{ cursor: interactive ? (dragging ? "grabbing" : "grab") : "default" }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onDragEnter={(e) => {
        e.preventDefault()
        dragDepth.current++
        setDropping(true)
      }}
      onDragOver={(e) => e.preventDefault()}
      onDragLeave={() => {
        dragDepth.current = Math.max(0, dragDepth.current - 1)
        if (dragDepth.current === 0) setDropping(false)
      }}
      onDrop={handleDrop}
    >
      <div
        className="stage__frame"
        style={{ width, height, transform: `scale(${scale})` }}
      >
        <div
          className="stage__canvas"
          style={{
            width,
            height,
            background: transparent ? CHECKER : background,
            imageRendering: scale > 1 ? "pixelated" : "auto",
          }}
        >
          {children}
        </div>
        <span className="crop crop--tl" />
        <span className="crop crop--tr" />
        <span className="crop crop--bl" />
        <span className="crop crop--br" />
        <span className="stage__caption">
          {width} × {height} · {Math.round(scale * 100)}%
        </span>
      </div>

      {dropping ? (
        <div className="overlay overlay--drop">
          <div>
            <p className="overlay__title">Drop the model here</p>
            <p className="overlay__sub">.glb, or .gltf together with its companion files</p>
          </div>
        </div>
      ) : null}

      {overlay}
    </div>
  )
}

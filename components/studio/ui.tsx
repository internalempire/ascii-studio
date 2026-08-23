"use client"

import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react"

/* ---------- section ---------- */

const OPEN_STORE = "ascii-studio:sections:v1"

function readOpenState(): Record<string, boolean> {
  if (typeof window === "undefined") return {}
  try {
    return JSON.parse(window.localStorage.getItem(OPEN_STORE) ?? "{}")
  } catch {
    return {}
  }
}

export function Section({
  id,
  title,
  badge,
  defaultOpen = true,
  children,
}: {
  id: string
  title: string
  badge?: ReactNode
  defaultOpen?: boolean
  children: ReactNode
}) {
  // Client-only tree (see studio-client.tsx), so reading storage during init is safe.
  const [open, setOpen] = useState(() => {
    const stored = readOpenState()[id]
    return typeof stored === "boolean" ? stored : defaultOpen
  })
  const bodyId = useId()

  const toggle = () => {
    setOpen((prev) => {
      const next = !prev
      try {
        window.localStorage.setItem(OPEN_STORE, JSON.stringify({ ...readOpenState(), [id]: next }))
      } catch {
        /* private mode: the section state just won't persist */
      }
      return next
    })
  }

  return (
    <div className="sect">
      <button type="button" className="sect__head" onClick={toggle} aria-expanded={open} aria-controls={bodyId}>
        <span className="sect__sign" aria-hidden="true">
          {open ? "−" : "+"}
        </span>
        <span className="sect__title">{title}</span>
        {badge ? <span className="sect__badge">{badge}</span> : null}
      </button>
      {open ? (
        <div className="sect__body" id={bodyId}>
          {children}
        </div>
      ) : null}
    </div>
  )
}

/* ---------- parameter ---------- */

function decimalsFor(step: number) {
  if (step >= 1) return 0
  if (step >= 0.1) return 1
  if (step >= 0.01) return 2
  if (step >= 0.001) return 3
  return 4
}

export function Param({
  label,
  value,
  min,
  max,
  step = 0.01,
  unit,
  defaultValue,
  disabled,
  onChange,
}: {
  label: string
  value: number
  min: number
  max: number
  step?: number
  unit?: string
  defaultValue?: number
  disabled?: boolean
  onChange: (value: number) => void
}) {
  const decimals = decimalsFor(step)
  const [draft, setDraft] = useState<string | null>(null)
  const id = useId()
  const fill = max === min ? 0 : ((value - min) / (max - min)) * 100

  const commit = (raw: string) => {
    const parsed = Number(raw.replace(",", "."))
    setDraft(null)
    if (!Number.isFinite(parsed)) return
    onChange(Math.min(max, Math.max(min, parsed)))
  }

  return (
    <div className={`param${disabled ? " param--off" : ""}`}>
      <div className="param__top">
        <label
          className="param__label"
          htmlFor={id}
          onDoubleClick={() => defaultValue !== undefined && onChange(defaultValue)}
          title={defaultValue !== undefined ? `${label} — doppio clic per tornare a ${defaultValue}` : label}
        >
          {label}
        </label>
        <input
          className="param__value"
          type="text"
          inputMode="decimal"
          disabled={disabled}
          aria-label={`${label}, valore numerico`}
          value={draft ?? value.toFixed(decimals)}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={(e) => commit(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") commit((e.target as HTMLInputElement).value)
            if (e.key === "Escape") setDraft(null)
          }}
        />
        <span className="param__unit" aria-hidden="true">
          {unit ?? ""}
        </span>
      </div>
      <input
        id={id}
        className="param__rail"
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        aria-label={label}
        style={{ ["--fill" as string]: `${fill}%` }}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </div>
  )
}

/* ---------- toggle ---------- */

export function Toggle({
  label,
  checked,
  onChange,
  disabled,
}: {
  label: string
  checked: boolean
  onChange: (checked: boolean) => void
  disabled?: boolean
}) {
  const id = useId()
  return (
    <div className="row">
      <label className="row__label" htmlFor={id}>
        {label}
      </label>
      <input
        id={id}
        className="check"
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
    </div>
  )
}

/* ---------- select ---------- */

export function Choice<T extends string>({
  label,
  value,
  options,
  onChange,
  disabled,
}: {
  label?: string
  value: T
  options: { value: T; label: string }[]
  onChange: (value: T) => void
  disabled?: boolean
}) {
  const id = useId()
  return (
    <div className="param">
      {label ? (
        <div className="param__top">
          <label className="param__label" htmlFor={id}>
            {label}
          </label>
        </div>
      ) : null}
      <select
        id={id}
        className="select"
        value={value}
        disabled={disabled}
        aria-label={label}
        onChange={(e) => onChange(e.target.value as T)}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  )
}

/* ---------- colour ---------- */

const HEX = /^#?[0-9a-f]{6}$/i

export function ColorField({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  disabled?: boolean
}) {
  const [draft, setDraft] = useState<string | null>(null)
  const id = useId()

  const commit = (raw: string) => {
    setDraft(null)
    if (!HEX.test(raw.trim())) return
    const hex = raw.trim().startsWith("#") ? raw.trim() : `#${raw.trim()}`
    onChange(hex.toLowerCase())
  }

  return (
    <div className="row">
      <label className="row__label" htmlFor={id}>
        {label}
      </label>
      <input
        className="hex"
        value={draft ?? value.toUpperCase()}
        disabled={disabled}
        aria-label={`${label}, codice esadecimale`}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={(e) => commit(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit((e.target as HTMLInputElement).value)
          if (e.key === "Escape") setDraft(null)
        }}
      />
      <span className="swatch" style={{ background: value }}>
        <input
          id={id}
          type="color"
          value={value}
          disabled={disabled}
          aria-label={label}
          onChange={(e) => onChange(e.target.value)}
        />
      </span>
    </div>
  )
}

/* ---------- stepper ---------- */

export function Stepper({
  label,
  value,
  min,
  max,
  onChange,
  active,
}: {
  label: string
  value: number
  min: number
  max: number
  onChange: (value: number) => void
  active?: boolean
}) {
  return (
    <div className={`axis${active ? " axis--active" : ""}`}>
      <span className="axis__name">{label}</span>
      <div className="stepper">
        <button
          type="button"
          className="stepper__btn"
          onClick={() => onChange(Math.max(min, value - 1))}
          disabled={value <= min}
          aria-label={`${label}: un giro in meno`}
        >
          −
        </button>
        <span className="stepper__value" aria-live="off">
          {value > 0 ? `+${value}` : value}
        </span>
        <button
          type="button"
          className="stepper__btn"
          onClick={() => onChange(Math.min(max, value + 1))}
          disabled={value >= max}
          aria-label={`${label}: un giro in più`}
        >
          +
        </button>
      </div>
    </div>
  )
}

/* ---------- segmented ---------- */

export function Seg<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T
  options: { value: T; label: string }[]
  onChange: (value: T) => void
  label: string
}) {
  return (
    <div className="seg" role="group" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          className="seg__item"
          aria-pressed={value === o.value}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

/* ---------- transient status line ---------- */

export function useFlash(timeout = 2000) {
  const [message, setMessage] = useState<string | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const flash = useMemo(
    () => (text: string) => {
      setMessage(text)
      if (timer.current) clearTimeout(timer.current)
      timer.current = setTimeout(() => setMessage(null), timeout)
    },
    [timeout]
  )

  useEffect(() => () => void (timer.current && clearTimeout(timer.current)), [])
  return { message, flash }
}

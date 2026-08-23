"use client"

import dynamic from "next/dynamic"

/**
 * The studio is a WebGL instrument: nothing about it is meaningful on the server, and
 * skipping SSR lets the panel restore its persisted state without a hydration mismatch.
 */
const Studio = dynamic(() => import("./studio").then((m) => m.Studio), {
  ssr: false,
  loading: () => (
    <div className="app">
      <div style={{ display: "grid", placeItems: "center", height: "100dvh" }}>
        <p className="overlay__title" style={{ fontFamily: "var(--mono)" }}>
          Avvio dello studio…
        </p>
      </div>
    </div>
  ),
})

export function StudioClient() {
  return <Studio />
}

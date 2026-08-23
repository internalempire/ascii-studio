# ASCII Studio

A local studio for turning a 3D model into animated ASCII art. Load a model, tune every
parameter of the shader while watching the result, and export a full 360° rotation as an
animated GIF or a video.

Everything runs in the browser on your own machine. There is no account, no service and no
upload: models are read straight from disk, and the Draco decoder is vendored, so the studio
works with the network switched off.

Built on top of [egorshest/webgl-ascii-hero](https://github.com/egorshest/webgl-ascii-hero).
The original hero demo is preserved at `/hero`.

---

## Requirements

- **Node.js 20.9 or newer** (Next.js 16 requires it) — `node --version`
- npm, which ships with Node
- A browser with WebGL2. Chrome is recommended: video export uses WebCodecs there, and falls
  back to `MediaRecorder` elsewhere.

## Rebuilding from this repository

Dependencies are **not** committed — `node_modules` is roughly 600 MB and is fully described by
`package.json` and `package-lock.json`. The lockfile pins the exact version of every package, so
`npm ci` reconstructs the identical tree on any machine.

```bash
git clone https://github.com/internalempire/webgl-ascii-hero-gui.git
```

```bash
cd webgl-ascii-hero-gui && npm ci
```

Then either run the dev server:

```bash
npm run dev
```

…or build and serve the production bundle:

```bash
npm run build && npm start
```

Both listen on <http://localhost:3000>. The studio is the home page; `/hero` is the original
demo. Use `PORT=3100 npm start` to serve somewhere else.

`npm ci` takes a few seconds and needs no configuration: there are no environment variables, no
API keys and no external services. If you prefer `npm install` it works too, but `npm ci` is the
one that guarantees the lockfile is honoured exactly.

### What is committed, and why

| Committed | Not committed |
| --- | --- |
| Source, `package.json`, `package-lock.json` | `node_modules/` — rebuilt by `npm ci` |
| `public/draco/` (≈750 KB) | `.next/` — rebuilt by `npm run build` |
| `public/models/user-model.glb` (demo model) | `.claude/` — local tooling config |

`public/draco/` is the one exception to "no dependencies in the repository". It is not an npm
package but a **runtime asset served to the browser**: the decoder that opens Draco-compressed
models. Without it in the repo the app would have to fetch it from a Google CDN on every load,
and would fail with no network. See `public/draco/README.md`.

---

## Using the studio

Full documentation is in **[STUDIO.md](STUDIO.md)**. The short version:

- **Load a model** — drop a `.glb` on the viewport, or pick a `.gltf` together with its `.bin`
  and textures. Draco and Meshopt compression are supported. Six built-in primitives let you try
  a look with no file at hand.
- **Tune it** — around fifty live controls across nine sections. Seven presets, JSON save/load,
  and a *Copy JSX* action that emits the current look as props for the original hero component.
- **Export a loop** — whole turns per axis on X, Y and Z, so the loop always closes. The preview
  renders at the export resolution, and the loop starts from the angle the preview is showing:
  pause the spin to lock the shot. GIF output can carry 1-bit transparency; video goes through
  WebCodecs for exact frame timing.

Keep the tab in the foreground while exporting — browsers suspend animation in background tabs,
which stalls the capture.

## Layout

```
app/page.tsx                  the studio
app/hero/page.tsx             the original hero demo
components/studio/
  studio.tsx                  state, header, layout
  scene.tsx                   R3F canvas, lights, camera, frame readback
  model.tsx                   loading, fitting, orientation, materials, animation
  ascii-effect-studio.tsx     shader and glyph atlas, hot-updated uniforms
  panels.tsx · ui.tsx         panels and controls
  viewport.tsx                framing, orbit, drop target
  export-panel.tsx            launch bar, progress, result
lib/studio/
  settings.ts                 parameters, presets, character sets
  capture.ts                  frame-exact handoff between render loop and exporter
  export-run.ts               the capture sequence
  gif.ts · video.ts           GIF and video encoding
  code-snippet.ts             JSX emitter
```

## Licence

MIT, inherited from the original project — see [LICENSE](LICENSE).

The demo model in `public/models/` comes from the upstream repository, where it is marked as
being for demonstration only. Replace it with your own before using this anywhere public.

# Draco decoder

The glTF Draco decoder, copied from `three/examples/jsm/libs/draco/gltf/` (three.js r182).

It lives here rather than on a CDN because ASCII Studio has to open a Draco-compressed model
with no network: `components/studio/model.tsx` points `DRACOLoader` at `/draco/`.

When you upgrade three.js, refresh these files:

```bash
cp node_modules/three/examples/jsm/libs/draco/gltf/{draco_decoder.js,draco_decoder.wasm,draco_wasm_wrapper.js} public/draco/
```

Google Draco — Apache 2.0 licence. <https://github.com/google/draco>

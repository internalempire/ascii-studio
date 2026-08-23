# Draco decoder

Decoder Draco per glTF, copiato da `three/examples/jsm/libs/draco/gltf/` (three.js r182).

Sta qui, e non su un CDN, perché ASCII Studio deve poter aprire un modello compresso con Draco
anche senza rete: `components/studio/model.tsx` punta `DRACOLoader` a `/draco/`.

Se aggiorni three.js, riallinea questi file:

```bash
cp node_modules/three/examples/jsm/libs/draco/gltf/{draco_decoder.js,draco_decoder.wasm,draco_wasm_wrapper.js} public/draco/
```

Google Draco — licenza Apache 2.0. <https://github.com/google/draco>

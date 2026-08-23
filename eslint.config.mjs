import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    // React Three Fiber drives the renderer imperatively: useFrame callbacks run outside
    // React's render phase, where mutating the renderer, camera and materials is the
    // documented API. The compiler's purity/immutability rules can't see that boundary.
    files: ["components/studio/scene.tsx", "components/studio/model.tsx", "components/studio/ascii-effect-studio.tsx"],
    rules: {
      "react-hooks/immutability": "off",
      "react-hooks/purity": "off",
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;

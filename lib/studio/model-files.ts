import { DefaultLoadingManager } from "three"

/**
 * Lets the loaders resolve a dropped .gltf's siblings (.bin, textures) out of memory.
 *
 * A .gltf references its buddies by relative path. Blob URLs have no directory, so we
 * rewrite every request down to its file name and look it up in what the user dropped.
 */

let activeUrls: string[] = []

export interface LoadedModelFiles {
  url: string
  name: string
  extras: number
}

function basename(path: string) {
  return decodeURIComponent(path.split("?")[0].split("/").pop() ?? path)
}

export function releaseModelFiles() {
  for (const url of activeUrls) URL.revokeObjectURL(url)
  activeUrls = []
  DefaultLoadingManager.setURLModifier((url) => url)
}

export function registerModelFiles(files: File[]): LoadedModelFiles {
  const entry = files.find((f) => /\.(glb|gltf)$/i.test(f.name))
  if (!entry) {
    throw new Error("No .glb or .gltf file in the selection")
  }

  releaseModelFiles()

  const byName = new Map<string, string>()
  for (const file of files) {
    const url = URL.createObjectURL(file)
    activeUrls.push(url)
    byName.set(file.name.toLowerCase(), url)
  }

  DefaultLoadingManager.setURLModifier((url) => {
    if (url.startsWith("blob:") || url.startsWith("data:")) return url
    const hit = byName.get(basename(url).toLowerCase())
    return hit ?? url
  })

  return {
    url: byName.get(entry.name.toLowerCase())!,
    name: entry.name,
    extras: files.length - 1,
  }
}

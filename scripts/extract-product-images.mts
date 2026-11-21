import { existsSync } from "node:fs"
import { readFile, readdir, writeFile } from "node:fs/promises"
import path from "node:path"
import { pathToFileURL } from "node:url"

const CACHE_DIR = "/tmp/ikea-us/html-cache"

const OUTPUT_FILE = path.resolve(
  import.meta.dirname,
  "../catalog-sources/us/images.json"
)

const IMAGE_HOST_PREFIX = "https://www.ikea.com/"

export function extractOgImage(html: string): string | null {
  const match = html.match(
    /<meta[^>]+property="og:image"[^>]+content="([^"]+)"/i
  )
  const url = match?.[1]?.trim()

  return url?.startsWith(IMAGE_HOST_PREFIX) ? url : null
}

export async function main(): Promise<void> {
  if (!existsSync(CACHE_DIR)) {
    console.error(`No html cache at ${CACHE_DIR}. Run collect-ikea first.`)
    process.exitCode = 1
    return
  }

  const files = (await readdir(CACHE_DIR)).filter((file) => file.endsWith(".html"))
  const images: Record<string, string> = {}
  let missing = 0

  for (const file of files.sort()) {
    const url = extractOgImage(await readFile(path.join(CACHE_DIR, file), "utf8"))

    if (url) {
      images[file.replace(/\.html$/, "")] = url
    } else {
      missing += 1
    }
  }

  await writeFile(OUTPUT_FILE, `${JSON.stringify(images, null, 2)}\n`)
  console.log(`pages: ${files.length}, images found: ${Object.keys(images).length}, without image: ${missing}`)
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main()
}

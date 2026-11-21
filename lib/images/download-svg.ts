const INLINED_STYLE_PROPERTIES = [
  "fill",
  "fill-opacity",
  "stroke",
  "stroke-width",
  "stroke-opacity",
  "stroke-dasharray",
  "opacity",
  "color",
  "font-family",
  "font-size",
  "font-weight",
] as const

const EXPORT_SCALE = 2
const BACKGROUND_COLOR = "#FFFFFF"

function inlineComputedStyles(source: Element, target: Element) {
  const computed = getComputedStyle(source)
  if (target instanceof SVGElement) {
    for (const property of INLINED_STYLE_PROPERTIES) {
      target.style.setProperty(property, computed.getPropertyValue(property))
    }
  }
  Array.from(source.children).forEach((child, index) => {
    const targetChild = target.children.item(index)
    if (targetChild) inlineComputedStyles(child, targetChild)
  })
}

async function toDataUrl(url: string): Promise<string> {
  const blob = await (await fetch(url)).blob()
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => (typeof reader.result === "string" ? resolve(reader.result) : reject(new Error("Could not read the image")))
    reader.onerror = () => reject(new Error("Could not read the image"))
    reader.readAsDataURL(blob)
  })
}

async function embedImages(svg: SVGSVGElement) {
  const images = Array.from(svg.querySelectorAll("image"))
  await Promise.all(
    images.map(async (image) => {
      const href = image.getAttribute("href")
      if (href && !href.startsWith("data:")) image.setAttribute("href", await toDataUrl(href))
    }),
  )
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error("Could not render the plan"))
    image.src = url
  })
}

function saveBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = fileName
  link.click()
  URL.revokeObjectURL(url)
}

export async function downloadSvgAsPng(svg: SVGSVGElement, fileName: string): Promise<void> {
  const clone = svg.cloneNode(true)
  if (!(clone instanceof SVGSVGElement)) throw new Error("Could not copy the plan")

  const { width, height } = svg.viewBox.baseVal
  inlineComputedStyles(svg, clone)
  await embedImages(clone)
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg")
  clone.setAttribute("width", String(width))
  clone.setAttribute("height", String(height))

  const svgBlob = new Blob([new XMLSerializer().serializeToString(clone)], { type: "image/svg+xml" })
  const svgUrl = URL.createObjectURL(svgBlob)
  try {
    const image = await loadImage(svgUrl)
    const canvas = document.createElement("canvas")
    canvas.width = width * EXPORT_SCALE
    canvas.height = height * EXPORT_SCALE
    const context = canvas.getContext("2d")
    if (!context) throw new Error("Could not render the plan")
    context.fillStyle = BACKGROUND_COLOR
    context.fillRect(0, 0, canvas.width, canvas.height)
    context.drawImage(image, 0, 0, canvas.width, canvas.height)

    const pngBlob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"))
    if (!pngBlob) throw new Error("Could not render the plan")
    saveBlob(pngBlob, fileName)
  } finally {
    URL.revokeObjectURL(svgUrl)
  }
}

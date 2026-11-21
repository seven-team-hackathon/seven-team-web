import type { Product } from "@/lib/catalog/product"

export type PromptProduct = Pick<
  Product,
  "name" | "colors" | "material" | "widthCm" | "depthCm" | "heightCm"
>

export function describeProduct(product: PromptProduct): string {
  const name = product.name.replace(/\s+/g, " ").trim()
  const lowerName = name.toLowerCase()
  const colors = product.colors.filter(
    (color) => !lowerName.includes(color.toLowerCase())
  )
  const parts = [`a ${name}`]

  if (colors.length > 0) {
    parts.push(`in ${colors.join(" and ")}`)
  }

  if (product.material) {
    parts.push(`made of ${product.material}`)
  }

  parts.push(
    `real size: ${Math.round(product.widthCm)} cm wide, ${Math.round(product.depthCm)} cm deep, ${Math.round(product.heightCm)} cm high`
  )

  return parts.join(", ")
}

export type PromptSubject = {
  readonly description: string
  readonly hasImage: boolean
}

export function buildVisualizationPrompt(input: {
  readonly subjects: readonly PromptSubject[]
}): string {
  let imageNumber = 1
  const lines = input.subjects.map((subject, index) => {
    if (!subject.hasImage) {
      return `${index + 1}. ${subject.description}.`
    }

    imageNumber += 1

    return `${index + 1}. ${subject.description} (product photo: image ${imageNumber}).`
  })
  const hasImages = imageNumber > 1
  const intro = hasImages
    ? "The first image is a photo of a room. The other images are product photos of furniture. Edit the room photo: add exactly this furniture, each piece looking exactly like its product photo (same shape, color, fabric and details):"
    : "Edit this photo of a room: add this furniture:"

  return [
    intro,
    ...lines,
    "Arrange the pieces naturally where they fit best in the room, the way a designer would: along free walls, not blocking doors or windows, and not overlapping each other.",
    "Keep the room exactly as it is: same walls, floor, windows, lighting, camera angle and every other object. Change only by adding the furniture.",
    "Each piece must have a realistic size for its stated real dimensions compared with doors, windows, outlets and other objects in the photo. Do not make it larger or smaller than its real size.",
    "Photorealistic, natural lighting that matches the room, correct perspective and soft contact shadows on the floor.",
  ].join(" ")
}

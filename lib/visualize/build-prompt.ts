import type { Product } from "@/lib/catalog/product"
import type { WallPosition } from "@/lib/contracts/visualization"

export type PromptProduct = Pick<
  Product,
  "name" | "colors" | "material" | "widthCm" | "depthCm" | "heightCm"
>

const POSITION_PHRASES: Readonly<Record<WallPosition, string>> = {
  left: "against the back wall, on its left part",
  center: "against the back wall, in the middle of it",
  right: "against the back wall, on its right part",
}

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

export function buildVisualizationPrompt(input: {
  readonly subject: string
  readonly position: WallPosition
  readonly hasProductImage: boolean
}): string {
  const placement = POSITION_PHRASES[input.position]
  const intro = input.hasProductImage
    ? `The first image is a photo of a room and the second image is a product photo of a piece of furniture. Edit the room photo: add exactly this furniture from the second image (${input.subject}) ${placement}. Keep the furniture's shape, color, fabric and details exactly as in the product photo.`
    : `Edit this photo of a room: add ${input.subject} ${placement}.`

  return [
    intro,
    "Keep the room exactly as it is: same walls, floor, windows, lighting, camera angle and every other object. Change only by adding the furniture.",
    "The furniture must have a realistic size for its stated real dimensions compared with doors, windows, outlets and other objects in the photo. Do not make it larger or smaller than its real size.",
    "Photorealistic, natural lighting that matches the room, correct perspective and a soft contact shadow on the floor.",
  ].join(" ")
}

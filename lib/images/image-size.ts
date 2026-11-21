export type ImageSize = {
  readonly width: number
  readonly height: number
}

export type ImageRef = ImageSize & {
  readonly url: string
}

export async function getImageSize(file: File): Promise<ImageSize> {
  const bitmap = await createImageBitmap(file)
  const size = { width: bitmap.width, height: bitmap.height }
  bitmap.close()
  return size
}

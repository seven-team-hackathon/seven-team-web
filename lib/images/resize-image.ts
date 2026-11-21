const MAX_LONG_SIDE_PX = 1600
const IMAGE_QUALITY = 0.9

function canvasToBlob(canvas: HTMLCanvasElement, type: string): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, IMAGE_QUALITY))
}

export async function resizeImage(file: File): Promise<File> {
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, MAX_LONG_SIDE_PX / Math.max(bitmap.width, bitmap.height))

  if (scale === 1) {
    bitmap.close()
    return file
  }

  const canvas = document.createElement("canvas")
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()

  const blob = await canvasToBlob(canvas, file.type)
  return blob ? new File([blob], file.name, { type: blob.type }) : file
}

export const photoMediaTypes = ["image/jpeg", "image/png", "image/webp"] as const

export type PhotoMediaType = (typeof photoMediaTypes)[number]

export function toPhotoMediaType(type: string): PhotoMediaType | null {
  return photoMediaTypes.find((mediaType) => mediaType === type) ?? null
}

import { allowedSpaceUploadTypes, maxSpaceUploadBytes } from "@/lib/api/space-upload-rules"

export const SPACE_FILE_ACCEPT = allowedSpaceUploadTypes.join(",")
export const MAX_SPACE_FILE_SIZE_MB = maxSpaceUploadBytes / (1024 * 1024)

const acceptedTypes = new Set<string>(allowedSpaceUploadTypes)

export function validateSpaceFileType(file: File): string | null {
  return acceptedTypes.has(file.type) ? null : "Use a JPG, PNG or WebP image"
}

export function validateSpaceFileSize(file: File): string | null {
  return file.size > maxSpaceUploadBytes ? `The image must be ${MAX_SPACE_FILE_SIZE_MB} MB or smaller` : null
}

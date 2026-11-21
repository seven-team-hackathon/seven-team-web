import type { ZodError } from "zod"

export function describeValidationError(error: ZodError): string {
  const issue = error.issues[0]

  if (!issue) {
    return "Invalid request."
  }

  const path = issue.path.map(String).join(".")

  return path ? `${path}: ${issue.message}` : issue.message
}

export function isMockApiEnabled(): boolean {
  return process.env.MOCK_API === "true"
}

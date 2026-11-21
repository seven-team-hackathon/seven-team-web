export const pipelineNotReadyMessage =
  "The real pipeline is not implemented yet. Set MOCK_API=true to receive fixture responses."

export function isMockApiEnabled(): boolean {
  return process.env.MOCK_API === "true"
}

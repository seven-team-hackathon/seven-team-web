import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import { RoomVisualization } from "@/components/planner/room-visualization"
import type { WallItem } from "@/lib/planner/wall-layout"

const item: WallItem = { id: "00575451", category: "sofa", widthCm: 126, heightCm: 61, x: 200 }
const wall = { widthCm: 300, heightCm: 250 }
const photo = new File([new Uint8Array([1])], "room.jpg", { type: "image/jpeg" })

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe("RoomVisualization", () => {
  it("disables the button until a piece of furniture is selected", () => {
    render(<RoomVisualization photo={photo} item={null} wall={wall} />)

    expect(screen.getByRole("button", { name: "Generate photo" })).toBeDisabled()
  })

  it("sends the photo, the article and the wall position and shows the result", async () => {
    const sent: FormData[] = []

    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init?: RequestInit) => {
        sent.push(init?.body as FormData)

        return new Response(
          JSON.stringify({ mediaType: "image/png", imageBase64: "AAAA", model: "m" }),
          { headers: { "content-type": "application/json" } }
        )
      })
    )
    render(<RoomVisualization photo={photo} item={item} wall={wall} />)

    fireEvent.click(screen.getByRole("button", { name: "Generate photo" }))

    expect(await screen.findByAltText(/AI-generated photo of your room with a sofa/)).toBeInTheDocument()
    expect(sent[0]?.get("articleNo")).toBe("00575451")
    expect(sent[0]?.get("position")).toBe("right")
    expect(screen.getByRole("button", { name: "Generate again" })).toBeEnabled()
    expect(screen.getByText(/may differ from the real product/)).toBeInTheDocument()
  })

  it("shows a friendly message when the api returns an error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(JSON.stringify({ error: { code: "rate_limited", message: "x" } }), {
            status: 429,
            headers: { "content-type": "application/json" },
          })
      )
    )
    render(<RoomVisualization photo={photo} item={item} wall={wall} />)

    fireEvent.click(screen.getByRole("button", { name: "Generate photo" }))

    expect(await screen.findByRole("alert")).toHaveTextContent("Too many requests")
  })

  it("does not show raw errors when the response is not json", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("<html>Request Entity Too Large</html>", { status: 413 })))
    render(<RoomVisualization photo={photo} item={item} wall={wall} />)

    fireEvent.click(screen.getByRole("button", { name: "Generate photo" }))

    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("We could not generate the photo"))
  })
})

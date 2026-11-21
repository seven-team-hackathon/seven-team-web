import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import { RoomPreviewStep } from "@/components/planner/room-preview-step"

const photo = new File([new Uint8Array([1])], "room.jpg", { type: "image/jpeg" })
const products = [
  { articleNo: "00575451", label: "Sofa" },
  { articleNo: "00395252", label: "Coffee table" },
]

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } })
}

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe("RoomPreviewStep", () => {
  it("generates on open, sends the photo and every article, and shows the result", async () => {
    const sent: FormData[] = []
    const onPreview = vi.fn()

    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init?: RequestInit) => {
        sent.push(init?.body as FormData)
        return jsonResponse({ mediaType: "image/png", imageBase64: "AAAA", model: "m" })
      })
    )
    render(<RoomPreviewStep photo={photo} products={products} initialPreview={null} onPreview={onPreview} />)

    expect(await screen.findByRole("img")).toHaveAttribute("src", "data:image/png;base64,AAAA")
    expect(sent).toHaveLength(1)
    expect(sent[0]?.getAll("articleNo")).toEqual(["00575451", "00395252"])
    expect(sent[0]?.get("file")).toBeInstanceOf(File)
    expect(onPreview).toHaveBeenCalledWith({
      src: "data:image/png;base64,AAAA",
      labels: ["Sofa", "Coffee table"],
    })
  })

  it("shows a saved result without a new request", () => {
    const fetchMock = vi.fn()

    vi.stubGlobal("fetch", fetchMock)
    render(
      <RoomPreviewStep
        photo={photo}
        products={products}
        initialPreview={{ src: "data:image/png;base64,BBBB", labels: ["Sofa"] }}
        onPreview={vi.fn()}
      />
    )

    expect(screen.getByRole("img")).toHaveAttribute("src", "data:image/png;base64,BBBB")
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("shows the error and lets the user try again", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ error: { code: "timeout", message: "slow" } }, 504))
      .mockResolvedValueOnce(jsonResponse({ mediaType: "image/png", imageBase64: "AAAA", model: "m" }))

    vi.stubGlobal("fetch", fetchMock)
    render(<RoomPreviewStep photo={photo} products={products} initialPreview={null} onPreview={vi.fn()} />)

    expect(await screen.findByRole("alert")).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Try again" }))
    await waitFor(() => expect(screen.getByRole("img")).toBeInTheDocument())
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })
})

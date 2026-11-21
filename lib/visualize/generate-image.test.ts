import { afterEach, describe, expect, it, vi } from "vitest"

import {
  generateWithOpenRouter,
  loadProductImage,
  toMediaType,
} from "@/lib/visualize/generate-image"

afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  })
}

describe("toMediaType", () => {
  it("keeps jpeg and webp and defaults to png", () => {
    expect(toMediaType("image/jpeg")).toBe("image/jpeg")
    expect(toMediaType("image/webp")).toBe("image/webp")
    expect(toMediaType(undefined)).toBe("image/png")
    expect(toMediaType("image/gif")).toBe("image/png")
  })
})

describe("loadProductImage", () => {
  it("embeds an ikea image as a data url", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(new Uint8Array([1, 2, 3]), { headers: { "content-type": "image/jpeg" } }))
    )

    expect(await loadProductImage("https://www.ikea.com/a.jpg")).toBe("data:image/jpeg;base64,AQID")
  })

  it("falls back to the url when the download fails", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("x", { status: 404 })))

    expect(await loadProductImage("https://www.ikea.com/a.jpg")).toBe("https://www.ikea.com/a.jpg")
  })

  it("never downloads from another host", async () => {
    const fetchMock = vi.fn()

    vi.stubGlobal("fetch", fetchMock)

    expect(await loadProductImage("https://evil.example/a.jpg")).toBe("https://evil.example/a.jpg")
    expect(fetchMock).not.toHaveBeenCalled()
  })
})

describe("generateWithOpenRouter", () => {
  it("returns the generated image with its cost", async () => {
    vi.stubEnv("OPENROUTER_API_KEY", "test-key")
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        jsonResponse({ data: [{ b64_json: "AAAA", media_type: "image/jpeg" }], usage: { cost: 0.05 } })
      )
    )

    const outcome = await generateWithOpenRouter({ prompt: "p", roomImageDataUrl: "data:image/jpeg;base64,AA" })

    expect(outcome.kind === "ok" && outcome.image).toMatchObject({
      mediaType: "image/jpeg",
      imageBase64: "AAAA",
      costUsd: 0.05,
    })
  })

  it("sends the room and the product photo as references", async () => {
    vi.stubEnv("OPENROUTER_API_KEY", "test-key")
    const sentBodies: string[] = []

    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
        if (String(url).includes("openrouter")) {
          sentBodies.push(String(init?.body))

          return jsonResponse({ data: [{ b64_json: "AAAA" }] })
        }

        return new Response(new Uint8Array([9]), { headers: { "content-type": "image/jpeg" } })
      })
    )

    await generateWithOpenRouter({
      prompt: "p",
      roomImageDataUrl: "data:image/jpeg;base64,AA",
      productImageUrl: "https://www.ikea.com/a.jpg",
    })

    const body = JSON.parse(sentBodies[0] ?? "{}")

    expect(body.input_references).toHaveLength(2)
    expect(body.input_references[1].image_url.url).toBe("data:image/jpeg;base64,CQ==")
  })

  it("reports an upstream failure without leaking details", async () => {
    vi.stubEnv("OPENROUTER_API_KEY", "test-key")
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({ error: { message: "Insufficient credits" } }, 402)))

    const outcome = await generateWithOpenRouter({ prompt: "p", roomImageDataUrl: "data:image/jpeg;base64,AA" })

    expect(outcome).toEqual({ kind: "failed", reason: "upstream", message: "The image generation failed." })
  })

  it("reports an unexpected response shape", async () => {
    vi.stubEnv("OPENROUTER_API_KEY", "test-key")
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({ data: [] })))

    const outcome = await generateWithOpenRouter({ prompt: "p", roomImageDataUrl: "data:image/jpeg;base64,AA" })

    expect(outcome.kind).toBe("failed")
  })

  it("maps a timeout", async () => {
    vi.stubEnv("OPENROUTER_API_KEY", "test-key")
    vi.stubGlobal("fetch", vi.fn(async () => {
      throw new DOMException("timed out", "TimeoutError")
    }))

    const outcome = await generateWithOpenRouter({ prompt: "p", roomImageDataUrl: "data:image/jpeg;base64,AA" })

    expect(outcome).toMatchObject({ kind: "failed", reason: "timeout" })
  })
})

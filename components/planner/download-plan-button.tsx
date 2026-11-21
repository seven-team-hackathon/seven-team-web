"use client"

import { DownloadIcon, LoaderCircleIcon } from "lucide-react"
import { useState, type RefObject } from "react"
import { toast } from "sonner"
import { downloadSvgAsPng } from "@/lib/images/download-svg"
import { Button } from "@/components/ui/button"

type DownloadPlanButtonProps = {
  svgRef: RefObject<SVGSVGElement | null>
  fileName: string
}

export function DownloadPlanButton({ svgRef, fileName }: DownloadPlanButtonProps) {
  const [isDownloading, setIsDownloading] = useState(false)

  async function handleDownload() {
    const svg = svgRef.current
    if (!svg) return

    setIsDownloading(true)
    try {
      await downloadSvgAsPng(svg, fileName)
    } catch {
      toast.error("Could not save the plan. Please try again.")
    } finally {
      setIsDownloading(false)
    }
  }

  return (
    <Button variant="outline" size="lg" disabled={isDownloading} onClick={handleDownload}>
      {isDownloading && (
        <LoaderCircleIcon data-icon="inline-start" aria-hidden className="animate-spin motion-reduce:animate-none" />
      )}
      {!isDownloading && <DownloadIcon data-icon="inline-start" aria-hidden />}
      Download
    </Button>
  )
}

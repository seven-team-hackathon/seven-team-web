"use client"

import { ArrowRightIcon, CameraIcon, MapIcon, RulerIcon, UploadIcon } from "lucide-react"
import { useRef, useState, type ChangeEvent, type DragEvent } from "react"
import { cn } from "@/lib/utils"
import { spaceKindSchema, type SpaceKind } from "@/lib/contracts/space"
import { SPACE_FILE_ACCEPT, validateSpaceFileType } from "@/lib/planner/space-file"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card"
import { ChoiceGroup, type ChoiceOption } from "@/components/planner/choice-group"
import type { SpaceUpload } from "@/components/planner/analyzing-step"

const KIND_OPTIONS: readonly ChoiceOption[] = [
  { value: "photo", label: "Room photo", hint: "tell us what you want next", icon: CameraIcon },
  { value: "plan", label: "Floor plan", hint: "choose your room on it next", icon: MapIcon },
]

const SAMPLE_LABELS: Readonly<Record<SpaceKind, string>> = {
  photo: "Try a sample photo",
  plan: "Try a sample plan",
}

type UploadStepProps = {
  onSubmit: (upload: SpaceUpload) => void
}

export function UploadStep({ onSubmit }: UploadStepProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [kind, setKind] = useState<SpaceKind>("photo")
  const [file, setFile] = useState<File | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [fileError, setFileError] = useState<string | null>(null)

  function selectFile(nextFile: File) {
    const error = validateSpaceFileType(nextFile)
    setFileError(error)
    setFile(error ? null : nextFile)
  }

  function handleDragOver(event: DragEvent<HTMLDivElement>) {
    event.preventDefault()
    setIsDragging(true)
  }

  function handleDragLeave() {
    setIsDragging(false)
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault()
    setIsDragging(false)
    const droppedFile = event.dataTransfer.files.item(0)
    if (droppedFile) selectFile(droppedFile)
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const pickedFile = event.target.files?.item(0)
    if (pickedFile) selectFile(pickedFile)
    event.target.value = ""
  }

  function handlePickFile() {
    inputRef.current?.click()
  }

  function handleSubmit() {
    onSubmit({ kind, file })
  }

  return (
    <Card className="gap-6 [--card-spacing:--spacing(6)] sm:gap-8 sm:[--card-spacing:--spacing(10)]">
      <CardHeader className="justify-items-center gap-3 text-center">
        <h1 className="text-2xl font-bold tracking-tight sm:text-4xl">Will it fit? Check before you buy.</h1>
        <CardDescription className="max-w-2xl text-base leading-relaxed">
          Upload a floor plan or a photo of your room. We read the size, doors and windows and pick real furniture that
          fits.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-5">
        <div className="mx-auto w-full max-w-md">
          <ChoiceGroup
            name="kind"
            legend="What are you uploading?"
            options={KIND_OPTIONS}
            value={kind}
            onValueChange={(value) => setKind(spaceKindSchema.parse(value))}
            columnsClassName="grid-cols-2"
            isLegendHidden
          />
        </div>
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={cn(
            "flex flex-1 flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-wood-soft bg-background px-4 py-10 text-center sm:py-16",
            isDragging && "border-primary bg-primary/10",
          )}
        >
          <RulerIcon aria-hidden className="size-10 text-wood" />
          <p className="font-bold">{file?.name ?? "Drop an image here"}</p>
          <p className="text-xs text-muted-foreground">JPG, PNG or WebP</p>
          {fileError && (
            <p role="alert" className="text-sm font-medium text-destructive">
              {fileError}
            </p>
          )}
          <div className="mt-3 flex w-full flex-col-reverse gap-2 sm:w-auto sm:flex-row sm:justify-center">
            <Button variant="outline" size="lg" onClick={handlePickFile}>
              <UploadIcon data-icon="inline-start" aria-hidden />
              Choose image
            </Button>
            <Button size="lg" onClick={handleSubmit}>
              {file ? "Analyze" : SAMPLE_LABELS[kind]}
              <ArrowRightIcon data-icon="inline-end" aria-hidden />
            </Button>
          </div>
          <input
            ref={inputRef}
            type="file"
            accept={SPACE_FILE_ACCEPT}
            aria-label="Floor plan or room photo"
            className="hidden"
            onChange={handleFileChange}
          />
        </div>
      </CardContent>
    </Card>
  )
}

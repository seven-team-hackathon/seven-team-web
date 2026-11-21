"use client"

import { ArrowRightIcon, BabyIcon, LoaderCircleIcon, PawPrintIcon } from "lucide-react"
import { useId, useState, type FormEvent } from "react"
import { getThrownErrorMessage, getUserErrorMessage } from "@/lib/api/user-error-message"
import { furnitureCategorySchema, type FurnitureCategory } from "@/lib/contracts/furniture-category"
import { preferencesSchema, styleSchema, type FurnitureStyle, type Preferences } from "@/lib/contracts/preferences"
import { recommendationResponseSchema, type RecommendationResponse } from "@/lib/contracts/recommendation"
import { roomTypeSchema, type RoomType } from "@/lib/contracts/room-type"
import { confirmedSpaceSchema, type ConfirmedSpace, type SpaceKind } from "@/lib/contracts/space"
import { matchCategories } from "@/lib/planner/match-categories"
import { CATEGORY_META, DEFAULT_BUDGET_USD, DEFAULT_CATEGORIES, ROOM_TYPE_META, STYLE_META } from "@/lib/planner/options"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { CheckboxGroup } from "@/components/planner/checkbox-group"
import { ChoiceGroup, type ChoiceOption } from "@/components/planner/choice-group"
import { NumberField } from "@/components/planner/number-field"
import { SuggestionChips } from "@/components/planner/suggestion-chips"

const RECOMMEND_ERROR_MESSAGE = "We could not pick furniture right now. Please try again."
const NOTE_MAX_LENGTH = 500

export type SpaceInput = Omit<ConfirmedSpace, "roomType"> & {
  readonly roomType: RoomType | null
}

type HouseholdMember = "children" | "pets"

const STYLE_OPTIONS: readonly ChoiceOption[] = styleSchema.options.map((style) => ({
  value: style,
  label: STYLE_META[style].label,
  hint: STYLE_META[style].hint,
}))

const ROOM_TYPE_OPTIONS: readonly ChoiceOption[] = roomTypeSchema.options.map((roomType) => ({
  value: roomType,
  label: ROOM_TYPE_META[roomType].label,
  icon: ROOM_TYPE_META[roomType].icon,
}))

const HOUSEHOLD_OPTIONS: readonly ChoiceOption[] = [
  { value: "children", label: "Kids at home", icon: BabyIcon },
  { value: "pets", label: "Pets at home", icon: PawPrintIcon },
]

const CATEGORY_OPTIONS: readonly ChoiceOption[] = furnitureCategorySchema.options.map((category) => ({
  value: category,
  label: CATEGORY_META[category].label,
  icon: CATEGORY_META[category].icon,
}))

function getInitialHousehold(preferences: Preferences | null): HouseholdMember[] {
  const members: HouseholdMember[] = []
  if (preferences?.household.hasChildren) members.push("children")
  if (preferences?.household.hasPets) members.push("pets")
  return members
}

function getSuggestedCategories(roomType: RoomType | null): FurnitureCategory[] {
  const suggested = roomType ? DEFAULT_CATEGORIES[roomType] : []
  return [...suggested, ...furnitureCategorySchema.options.filter((category) => !suggested.includes(category))]
}

function getInitialCategories(variant: SpaceKind, roomType: RoomType | null, preferences: Preferences | null): string[] {
  if (preferences) return [...preferences.categories]
  if (variant === "photo" || !roomType) return []
  return [...DEFAULT_CATEGORIES[roomType]]
}

async function requestRecommendation(space: ConfirmedSpace, preferences: Preferences): Promise<RecommendationResponse> {
  const response = await fetch("/api/recommend", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ space, preferences }),
  })
  const body: unknown = await response.json()
  if (!response.ok) throw new Error(getUserErrorMessage(body, RECOMMEND_ERROR_MESSAGE))
  return recommendationResponseSchema.parse(body)
}

type PreferencesStepProps = {
  space: SpaceInput
  variant: SpaceKind
  initialPreferences: Preferences | null
  onRecommended: (space: ConfirmedSpace, preferences: Preferences, recommendation: RecommendationResponse) => void
}

export function PreferencesStep({ space, variant, initialPreferences, onRecommended }: PreferencesStepProps) {
  const noteId = useId()
  const isPhoto = variant === "photo"
  const [roomType, setRoomType] = useState<RoomType | null>(space.roomType ?? initialPreferences?.roomType ?? null)
  const [style, setStyle] = useState<FurnitureStyle | null>(initialPreferences?.style ?? null)
  const [household, setHousehold] = useState<string[]>(getInitialHousehold(initialPreferences))
  const [budget, setBudget] = useState(String(initialPreferences?.budget ?? DEFAULT_BUDGET_USD))
  const [categories, setCategories] = useState<string[]>(getInitialCategories(variant, roomType, initialPreferences))
  const [note, setNote] = useState(initialPreferences?.note ?? "")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const requestedCategories = isPhoto ? [...new Set([...categories, ...matchCategories(note)])] : categories
  const parsedSpace = confirmedSpaceSchema.safeParse({ ...space, roomType })
  const parsedPreferences = preferencesSchema.safeParse({
    market: "us",
    roomType,
    style,
    household: { hasChildren: household.includes("children"), hasPets: household.includes("pets") },
    budget: Number(budget),
    categories: requestedCategories,
    note: note.trim() || undefined,
  })

  function handleCategoryToggle(category: FurnitureCategory) {
    setCategories((current) =>
      current.includes(category) ? current.filter((value) => value !== category) : [...current, category],
    )
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!parsedSpace.success || !parsedPreferences.success) {
      setErrorMessage(
        isPhoto
          ? "Tell us what you are looking for, then choose a style and a budget above zero."
          : "Choose a style, at least one type of furniture and a budget above zero.",
      )
      return
    }

    setIsSubmitting(true)
    setErrorMessage(null)
    try {
      const recommendation = await requestRecommendation(parsedSpace.data, parsedPreferences.data)
      onRecommended(parsedSpace.data, parsedPreferences.data, recommendation)
    } catch (error) {
      setErrorMessage(getThrownErrorMessage(error, RECOMMEND_ERROR_MESSAGE))
      setIsSubmitting(false)
    }
  }

  return (
    <Card className="gap-6 [--card-spacing:--spacing(6)] sm:gap-8 sm:[--card-spacing:--spacing(10)]">
      <CardHeader className="justify-items-center gap-3 text-center">
        <CardTitle className="text-2xl font-bold tracking-tight sm:text-3xl">
          {isPhoto ? "What would you like to add?" : "A few questions to match your taste"}
        </CardTitle>
        <CardDescription className="text-base">
          {roomType && <b className="text-foreground">{ROOM_TYPE_META[roomType].label} · </b>}
          {space.dimensions.widthCm}×{space.dimensions.lengthCm} cm
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="mx-auto flex w-full max-w-3xl flex-col gap-7">
          {!space.roomType && (
            <ChoiceGroup
              name="room-type"
              legend="Room type"
              options={ROOM_TYPE_OPTIONS}
              value={roomType}
              onValueChange={(value) => setRoomType(roomTypeSchema.parse(value))}
              columnsClassName="grid-cols-2 sm:grid-cols-3"
            />
          )}
          {isPhoto && (
            <div className="flex flex-col gap-3">
              <Label htmlFor={noteId} className="text-base font-bold">
                Describe what you want
              </Label>
              <Textarea
                id={noteId}
                value={note}
                maxLength={NOTE_MAX_LENGTH}
                placeholder="A tall wardrobe in light wood next to the window"
                onChange={(event) => setNote(event.target.value)}
                className="min-h-28 text-base"
              />
              <SuggestionChips
                categories={getSuggestedCategories(roomType)}
                selected={new Set(requestedCategories)}
                onToggle={handleCategoryToggle}
              />
            </div>
          )}
          {!isPhoto && (
            <CheckboxGroup
              legend="Furniture to pick"
              options={CATEGORY_OPTIONS}
              values={categories}
              onValuesChange={setCategories}
            />
          )}
          <ChoiceGroup
            name="style"
            legend="Style"
            options={STYLE_OPTIONS}
            value={style}
            onValueChange={(value) => setStyle(styleSchema.parse(value))}
            columnsClassName="grid-cols-2 sm:grid-cols-3"
          />
          <CheckboxGroup
            legend="Who lives here"
            options={HOUSEHOLD_OPTIONS}
            values={household}
            onValuesChange={setHousehold}
            columnsClassName="grid-cols-2"
          />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <NumberField label="Budget" unit="USD" value={budget} onValueChange={setBudget} min={1} isRequired />
            {!isPhoto && (
              <div className="flex flex-col gap-2">
                <Label htmlFor={noteId}>Anything else? (optional)</Label>
                <Textarea
                  id={noteId}
                  value={note}
                  maxLength={NOTE_MAX_LENGTH}
                  placeholder="Light colors, we have a cat"
                  onChange={(event) => setNote(event.target.value)}
                />
              </div>
            )}
          </div>
          {errorMessage && (
            <p role="alert" className="text-sm text-destructive">
              {errorMessage}
            </p>
          )}
          <Button type="submit" size="lg" disabled={isSubmitting} className="w-full sm:w-auto sm:self-center">
            {isSubmitting && (
              <LoaderCircleIcon data-icon="inline-start" aria-hidden className="animate-spin motion-reduce:animate-none" />
            )}
            Find furniture
            <ArrowRightIcon data-icon="inline-end" aria-hidden />
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}

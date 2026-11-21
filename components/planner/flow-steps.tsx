import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

export type FlowStep = "upload" | "analyzing" | "room" | "preferences" | "results" | "preview"

type FlowStepItem = { readonly id: FlowStep; readonly label: string; readonly isTransient: boolean }

const FLOW_STEPS: readonly FlowStepItem[] = [
  { id: "upload", label: "Upload", isTransient: false },
  { id: "analyzing", label: "Recognition", isTransient: true },
  { id: "room", label: "Room", isTransient: false },
  { id: "preferences", label: "Preferences", isTransient: false },
  { id: "results", label: "Results", isTransient: false },
  { id: "preview", label: "Preview", isTransient: false },
]

function getStepOrder(step: FlowStep): number {
  return FLOW_STEPS.findIndex(({ id }) => id === step)
}

export function getFurtherStep(first: FlowStep, second: FlowStep): FlowStep {
  return getStepOrder(first) >= getStepOrder(second) ? first : second
}

function isReachable(step: FlowStepItem, furthestStep: FlowStep, skippedSteps: readonly FlowStep[]): boolean {
  return getStepOrder(step.id) <= getStepOrder(furthestStep) && !step.isTransient && !skippedSteps.includes(step.id)
}

function findSelectableStep(
  steps: readonly FlowStepItem[],
  fromIndex: number,
  direction: 1 | -1,
  furthestStep: FlowStep,
  skippedSteps: readonly FlowStep[],
): FlowStep | null {
  for (let index = fromIndex + direction; index >= 0 && index < steps.length; index += direction) {
    if (isReachable(steps[index], furthestStep, skippedSteps)) return steps[index].id
  }
  return null
}

type FlowStepsProps = {
  currentStep: FlowStep
  furthestStep: FlowStep
  skippedSteps: readonly FlowStep[]
  onStepSelect: (step: FlowStep) => void
}

function MobileFlowSteps({ currentStep, furthestStep, skippedSteps, onStepSelect }: FlowStepsProps) {
  const steps = FLOW_STEPS
  const currentIndex = steps.findIndex(({ id }) => id === currentStep)
  const previousStep = findSelectableStep(steps, currentIndex, -1, furthestStep, skippedSteps)
  const nextStep = findSelectableStep(steps, currentIndex, 1, furthestStep, skippedSteps)

  return (
    <div className="flex flex-col gap-2 sm:hidden">
      <div className="flex items-center justify-between gap-2">
        <Button
          variant="ghost"
          size="icon"
          aria-label="Previous step"
          disabled={!previousStep}
          onClick={() => previousStep && onStepSelect(previousStep)}
          className="-ml-2.5 size-11"
        >
          <ChevronLeftIcon aria-hidden className="size-5" />
        </Button>
        <p className="flex flex-col items-center">
          <span className="font-bold">{steps[currentIndex].label}</span>
          <span className="text-xs font-semibold text-muted-foreground">
            Step {currentIndex + 1} of {steps.length}
          </span>
        </p>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Next step"
          disabled={!nextStep}
          onClick={() => nextStep && onStepSelect(nextStep)}
          className="-mr-2.5 size-11"
        >
          <ChevronRightIcon aria-hidden className="size-5" />
        </Button>
      </div>
      <div aria-hidden className="flex gap-1">
        {steps.map((step, index) => (
          <span
            key={step.id}
            className={cn("h-1 flex-1 rounded-full bg-secondary", index <= currentIndex && "bg-primary")}
          />
        ))}
      </div>
    </div>
  )
}

export function FlowSteps({ currentStep, furthestStep, skippedSteps, onStepSelect }: FlowStepsProps) {
  return (
    <>
      <MobileFlowSteps
        currentStep={currentStep}
        furthestStep={furthestStep}
        skippedSteps={skippedSteps}
        onStepSelect={onStepSelect}
      />
      <ol aria-label="Steps" className="hidden flex-wrap justify-center gap-1.5 sm:flex">
        {FLOW_STEPS.map((step) => {
          const isCurrent = step.id === currentStep
          const isSelectable = isReachable(step, furthestStep, skippedSteps) && !isCurrent
          return (
            <li key={step.id}>
              <Button
                variant="secondary"
                size="sm"
                aria-current={isCurrent && "step"}
                disabled={!isSelectable && !isCurrent}
                onClick={() => isSelectable && onStepSelect(step.id)}
                className={cn(
                  "rounded-full border border-primary/30 bg-muted text-xs font-semibold text-foreground hover:bg-muted hover:text-foreground",
                  isCurrent && "border-primary bg-transparent text-primary hover:bg-transparent hover:text-primary",
                )}
              >
                {step.label}
              </Button>
            </li>
          )
        })}
      </ol>
    </>
  )
}

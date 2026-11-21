"use client"

import { MoonIcon, SunIcon } from "lucide-react"
import { useTheme } from "next-themes"
import { Button } from "@/components/ui/button"

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme()

  function handleToggle() {
    setTheme(resolvedTheme === "dark" ? "light" : "dark")
  }

  return (
    <Button variant="ghost" size="icon" aria-label="Toggle theme" onClick={handleToggle} className="size-11 sm:size-12">
      <SunIcon aria-hidden className="hidden size-5 sm:size-6 dark:block" />
      <MoonIcon aria-hidden className="size-5 sm:size-6 dark:hidden" />
    </Button>
  )
}

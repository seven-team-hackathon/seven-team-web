import { Logo } from "@/components/site/logo"
import { ThemeToggle } from "@/components/theme-toggle"

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b bg-background/90 supports-backdrop-filter:bg-background/75 supports-backdrop-filter:backdrop-blur">
      <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between gap-3 px-4 sm:h-16 sm:px-5">
        <Logo />
        <div className="-mr-2.5 flex items-center sm:-mr-3">
          <ThemeToggle />
        </div>
      </div>
    </header>
  )
}

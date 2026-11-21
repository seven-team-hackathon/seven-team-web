import Link from "next/link"
import { SITE_TITLE } from "@/lib/site-config"

export function Logo() {
  return (
    <Link href="/" className="rounded-md text-xl font-extrabold tracking-tight outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
      {SITE_TITLE}
    </Link>
  )
}

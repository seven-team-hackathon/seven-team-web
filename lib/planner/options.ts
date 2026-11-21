import type { LucideIcon } from "lucide-react"
import {
  ArchiveIcon,
  ArmchairIcon,
  BedDoubleIcon,
  BookOpenIcon,
  CoffeeIcon,
  DoorOpenIcon,
  LampIcon,
  LaptopIcon,
  MonitorIcon,
  ShirtIcon,
  SofaIcon,
  ToyBrickIcon,
  TvIcon,
  UtensilsIcon,
} from "lucide-react"
import type { FurnitureCategory } from "@/lib/contracts/furniture-category"
import type { FurnitureStyle } from "@/lib/contracts/preferences"
import type { RoomType } from "@/lib/contracts/room-type"

type Labeled = {
  readonly label: string
  readonly icon: LucideIcon
}

export type CategoryTone = "sage" | "terracotta" | "wood" | "plant"

type CategoryMeta = Labeled & {
  readonly tone: CategoryTone
}

type ToneClassNames = {
  readonly tint: string
  readonly fill: string
  readonly content: string
}

export const TONE_CLASS_NAMES: Readonly<Record<CategoryTone, ToneClassNames>> = {
  sage: {
    tint: "bg-primary/15 text-primary",
    fill: "fill-primary",
    content: "fill-primary-foreground text-primary-foreground",
  },
  terracotta: {
    tint: "bg-terracotta/15 text-terracotta",
    fill: "fill-terracotta",
    content: "fill-terracotta-foreground text-terracotta-foreground",
  },
  wood: {
    tint: "bg-wood/20 text-wood",
    fill: "fill-wood",
    content: "fill-wood-foreground text-wood-foreground",
  },
  plant: {
    tint: "bg-plant/25 text-primary",
    fill: "fill-plant",
    content: "fill-foreground text-foreground",
  },
}

export const FREE_CATEGORY_COUNT = 2

export const ROOM_TYPE_META: Readonly<Record<RoomType, Labeled>> = {
  "living-room": { label: "Living room", icon: SofaIcon },
  bedroom: { label: "Bedroom", icon: BedDoubleIcon },
  "home-office": { label: "Home office", icon: LaptopIcon },
  "dining-room": { label: "Dining room", icon: UtensilsIcon },
  "kids-room": { label: "Kids' room", icon: ToyBrickIcon },
  hallway: { label: "Hallway", icon: DoorOpenIcon },
}

export const STYLE_META: Readonly<Record<FurnitureStyle, { readonly label: string; readonly hint: string }>> = {
  scandinavian: { label: "Scandinavian", hint: "light wood, white" },
  modern: { label: "Modern", hint: "clean lines, bold accents" },
  minimal: { label: "Minimal", hint: "nothing extra" },
  cozy: { label: "Cozy", hint: "soft textiles, warm tones" },
  industrial: { label: "Industrial", hint: "metal, dark wood" },
  classic: { label: "Classic", hint: "timeless shapes" },
}

export const CATEGORY_META: Readonly<Record<FurnitureCategory, CategoryMeta>> = {
  sofa: { label: "Sofa", icon: SofaIcon, tone: "sage" },
  armchair: { label: "Armchair", icon: ArmchairIcon, tone: "terracotta" },
  "coffee-table": { label: "Coffee table", icon: CoffeeIcon, tone: "wood" },
  "side-table": { label: "Side table", icon: LampIcon, tone: "plant" },
  "tv-unit": { label: "TV unit", icon: TvIcon, tone: "plant" },
  bed: { label: "Bed", icon: BedDoubleIcon, tone: "sage" },
  wardrobe: { label: "Wardrobe", icon: ShirtIcon, tone: "wood" },
  nightstand: { label: "Nightstand", icon: LampIcon, tone: "terracotta" },
  desk: { label: "Desk", icon: MonitorIcon, tone: "wood" },
  "office-chair": { label: "Office chair", icon: ArmchairIcon, tone: "sage" },
  bookshelf: { label: "Bookshelf", icon: BookOpenIcon, tone: "plant" },
  "dining-table": { label: "Dining table", icon: UtensilsIcon, tone: "wood" },
  "dining-chair": { label: "Dining chair", icon: ArmchairIcon, tone: "terracotta" },
  storage: { label: "Storage", icon: ArchiveIcon, tone: "plant" },
}

export const DEFAULT_CATEGORIES: Readonly<Record<RoomType, readonly FurnitureCategory[]>> = {
  "living-room": ["sofa", "coffee-table", "tv-unit"],
  bedroom: ["bed", "wardrobe", "nightstand"],
  "home-office": ["desk", "office-chair", "bookshelf"],
  "dining-room": ["dining-table", "dining-chair"],
  "kids-room": ["bed", "desk", "storage"],
  hallway: ["storage"],
}

export const DEFAULT_BUDGET_USD = 1500

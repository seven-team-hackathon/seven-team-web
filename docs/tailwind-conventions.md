# Tailwind conventions 

- Use Tailwind CSS and reuse existing design tokens and shared values before introducing new ones.
- Use shadcn/ui components whenever applicable; if the required component is not available, let me know and I will add it.
- Build layouts mobile-first, then add responsive variants for larger breakpoints.
  - Base classes describe the phone layout (from 320 px wide); `sm:`, `md:`, `lg:` only adjust it for wider screens.
  - Main actions are full width and stacked on phones (`w-full sm:w-auto`, `flex-col sm:flex-row`), with the primary action on top on phones and on the right on wider screens: put it last in the DOM and use `flex-col-reverse sm:flex-row`.
  - Text buttons use `size="lg"` for comfortable touch targets.
  - Never block page scrolling on large areas: put `touch-none` only on the elements that are dragged, not on their container.
- Text wraps nicely: headings use `text-balance`, paragraphs and descriptions use `text-pretty`. Both are applied globally in `app/globals.css` (`h1`–`h6`, `p`, `li`, card and dialog descriptions), so add them by hand only to other text containers such as a `div` or `span` holding running text.
- Order Tailwind classes in className from base/mobile styles → responsive breakpoints → states and interaction variants → effects and animations.
- Prefer Flexbox and Grid for layout instead of fixed positioning.
- Prefer responsive and relative units through Tailwind utilities; use fixed values only where appropriate.
- Provide visible focus-visible styles for interactive elements and never remove focus indicators without an accessible replacement.
- Ensure hover-only information is also accessible to keyboard and touch users.
- Respect prefers-reduced-motion for nonessential animations.
- Maintain sufficient text and control contrast in both light and dark themes.
- Keep transitions restrained and limit them to properties that do not cause unnecessary layout shifts.
- Never hardcode a hex value in a className. If the colour is missing, add it to `@theme inline` first.
- Conditional classes go through `cn()` with `&&` or a single `?:`, never string concatenation: `cn(base, isActive ? 'text-primary' : 'text-muted-foreground', className)`.

## Colour palette

The Roomfit palette is warm and natural: linen, sage, terracotta and walnut. Tokens live in `app/globals.css` with light (`:root`) and dark (`.dark`) values. Use tokens only, never raw colours.

| Token | Colour | Use for |
| --- | --- | --- |
| `background` / `foreground` | linen / graphite | page background and body text |
| `card`, `popover` | warm white | cards, menus, dialogs |
| `primary` | deep sage | main actions, active states, focus ring |
| `secondary` | sand | secondary buttons, surfaces |
| `muted` / `muted-foreground` | light sand / warm grey | subtle surfaces, captions, dimensions |
| `accent` | soft sand | hover and highlighted rows (shadcn) |
| `border`, `input` | light sand | borders, inputs, room grid lines |
| `terracotta` | terracotta | AI features and suggestions, highlights, badges |
| `wood` | walnut | furniture on the room plan, decorative accents |
| `success` | green | "fits the room" |
| `warning` | ochre | "tight fit, little space to walk through" |
| `destructive` | brick red | "does not fit", delete actions |
| `chart-1`…`chart-5` | sage, terracotta, walnut, ochre, light green | charts and furniture categories |

- Every colour has a `-foreground` pair for text on that background: `bg-terracotta text-terracotta-foreground`.
- For soft tinted backgrounds use opacity and the base colour for text: `bg-success/15 text-success`.
- Do not use `terracotta` for main actions; that is `primary`. Keep terracotta for what the AI suggests.
- Icon-only controls get `aria-label`, decorative icons get `aria-hidden`.
- Icon-only buttons have no border or background, just the icon: use `<Button variant="ghost" size="icon">`, never `variant="outline"`.
- Icon-only buttons have a touch target of at least 44×44 px with a 20 px icon on phones, and 48×48 px with a 24 px icon from `sm` up: `className="size-11 sm:size-12"` on the button, `className="size-5 sm:size-6"` on the icon.
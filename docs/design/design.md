---
version: alpha
name: Gigs Pass - Neo-Brutalism Design System
description: A neo-brutalist, anti-design, festival-culture visual language for the Gigs Pass ticketing platform. Anchors on cream canvas (#FFFAF0), pure black (#0A0A0A), thick hard-edged black borders, offset solid shadows, oversized uppercase typography, rotation, overlap, and marquee strips. Intentionally loud and expressive on the surface, extremely intentional and usable underneath — "anti-design visually, extremely intentional UX". Source of truth: the Figma export under docs/design/figma-export/ (see src/index.css + src/App.tsx).
---

# Gigs Pass — Neo-Brutalism Design System

## 1. Visual Identity

Neo-brutalism + anti-design + festival culture.

- Bold, rebellious, youthful, energetic, playful, slightly chaotic, memorable.
- NOT a generic SaaS dashboard. Avoid: corporate SaaS aesthetics, gradients, glassmorphism, soft shadows, excessive rounded cards, symmetrical grids everywhere, empty whitespace with no purpose, polished minimalism.
- Use instead: thick black borders, hard edges, offset positioning, asymmetric composition, oversized typography, intentionally awkward scale relationships, overlapping elements, unexpected alignment, occasional rotation, large solid color blocks, strong contrast, editorial poster-like compositions, playful UI interruptions.
- **Critical balance (UX rule):** this is a real ticketing product. ~70% functional product UI / ~30% experimental visual expression. Still needs: clear hierarchy, obvious CTAs, readable information, predictable interaction, strong accessibility.
- Composition should feel intentionally designed, never randomly generated — coherent system underneath the chaos.

## 2. Color System

Foundation:
- **Background / canvas:** `#FFFAF0` (cream)
- **Foreground / primary / border:** `#0A0A0A` (pure black)

Accent colors (the "gigs" set):
| Token | Hex | Usage |
|---|---|---|
| `gigs-pink` | `#FF4D8B` | hero accent, primary CTA blocks, marquee strip, footer |
| `gigs-purple` | `#B8A4ED` | solid feature/event card fill, header login button |
| `gigs-orange` | `#FFB084` | secondary accents, oversized punctuation, hover fills |
| `gigs-yellow` | `#E8B94A` | corner tapes, photo frames, action stickers, hover fills |
| `gigs-teal` | `#A4D4C5` | event card accents, LOCATION meta chips, hover fills |
| `gigs-dark` | `#1A3A3A` | dark photo panel / dark event card fill, text background |

Functional:
- `error` / coral `#FF6B5A` (in export `--color-coral`) — RESERVE for critical states: "SOLD OUT" badges, errors, cancellation.

Rules:
- Use accent colors boldly, do NOT distribute evenly. Some sections stay almost entirely cream + black; others become loud with one dominant accent. Avoid rainbow gradients; solid color fields + strong contrast only.
- Cream-throughout is a system contract — the footer is a loud color block (`gigs-pink`), not a dark-navy footer.

## 3. Typography

- Font: **Inter**. Weights available: 400, 500, 600, 700, 800 **(black, default headline weight)**, 900.
- Headlines: oversized, **uppercase**, `font-black` (800/900), tight leading (`leading-[0.82]`–`[1.1]`), `tracking-tighter`. Occasionally break across lines, interact with other elements, unusual-but-intentional alignment.
- Body stays highly readable (16–20px, 700 for emphasis copy, 400 for long text).

Scale (deviations from tailwind default, applied via utilities):
| Role | Example size | Weight | Case/Tracking |
|---|---|---|---|
| Hero headline | `text-[2.75rem]`–`lg:text-[5.5rem]` | 900 | uppercase, `tracking-tighter`, `leading-[0.85]` |
| Section headline | `text-5xl`–`text-7xl` | 900 | uppercase, `tracking-tighter` |
| Card title | `text-2xl`–`text-3xl` | 900 | uppercase |
| Meta / location | `text-sm` | 700 | `text-foreground/80` |
| Labels / stickers | `text-xs`–`text-sm` | 800 | uppercase, `tracking-widest` |
| Body copy | `text-lg`–`text-xl` | 700 (hero sub) / 400 | normal |

Use typography variation to create rhythm — not every headline gets the same treatment.

## 4. Borders / Shadows / Shapes

- **Borders:** thick solid black, prefer 2px / 3px / 4px. Never subtle 1px gray borders. Utilities:
  - `.brut-border` = 3px solid `#0A0A0A`
  - `.brut-border-2` = 2px solid `#0A0A0A`
  - `.brut-border-4` = 4px solid `#0A0A0A`
- **Shadows:** hard offset, no blur. `.brut-shadow` = `6px 6px 0 #0A0A0A`; `.brut-shadow-sm` = `4px 4px 0 #0A0A0A`.
- **Radius:** default **square** (sharp corners). Rectangular or slightly-rounded acceptable, never uniform pills. Ship CTAs as hard rectangles.
- Buttons feel physical and tactile: press down + shadow collapses.

## 5. Motion & Interaction

Defined in the Figma export (`src/index.css`) — do not improvise timings:

- **Marquee strip** (`@keyframes marquee`): translateX `0 → -50%`, `20s linear infinite`, `width: max-content`, content duplicated to loop seamlessly. Used for corner tapes + running headlines.
- **`.brut-button`**: `transition: all .1s ease`; hover `translate(-2px,-2px)` + `box-shadow 6px 6px 0`; active `translate(2px,2px)` + `box-shadow 2px 2px 0`.
- **`.brut-card-hover`**: `transition: all .2s ease`; hover `translate(-4px,-4px)` + `box-shadow 10px 10px 0`.
- Micro-motion (utility-driven): `transition-colors` for hover color shifts (`.hover:text-gigs-pink`, `hover:bg-gigs-yellow`, etc.), `transition-transform` for decorative rotations (`.hover:rotate-0`, `.hover:rotate-2`), image desaturation→color (`grayscale` → `grayscale-0`).
- Keep motions short (0.1–0.3s) and purposeful — they reinforce the tactile physicality.

## 6. Composition & Layout

- Max content width ~`1280px`, container `max-w-[1280px] mx-auto`, horizontal padding `p-4 md:px-8`.
- Desktop frame 1440px; mobile frame 390px. On mobile: preserve oversized typography, stack overlapped layouts into controlled stacking, avoid horizontal overflow, keep primary CTA reachable — never just scale down.
- Embrace: overlapping event cards, large typography, floating category labels, event posters, oversized date blocks, offset CTAs, visual interruptions, irregular card sizes, rotated tapes/stickers.
- Keep the page easy to scan — tension between typography/imagery/color/controls must be intentional.

## 7. UI Components

### 7.1 Header (TopNav)
- Sticky top, `bg-background` with `border-b-4 border-foreground` (brut-border-4, top/left/right none).
- Brand: oversized `font-black tracking-tighter` — "GIGS" in an inverted black box (bg foreground, text background, slight `-rotate-2`), "PASS" + pink dot ("PASS.") — `text-3xl md:text-5xl`.
- Nav (desktop): Discover / Events — `font-bold text-lg uppercase tracking-tight`, hover color per accent; "Discover" carries a tiny rotated yellow `LIVE` badge above it (`brut-border-2 rotate-6 bg-gigs-yellow text-[10px]`).
- Right: Search / My Orders as square bordered buttons (`brut-border-2 brut-button bg-background`, hover fills accent), Login as solid `bg-gigs-purple` bordered button.

### 7.2 Buttons
- Hard rectangle, thick border (`brut-border-2`/`brut-border-4`), `font-black uppercase`, optional `.brut-shadow`/`.brut-shadow-sm`.
- Primary CTA: solid accent fill + shadow, compact padding `px-6 py-3` (`text-lg`), hover `translate(1,1)` + shadow collapse. Secondary: background fill, compact padding `px-5 py-3` (`text-base`), hover accent bg.
- Default hover behaviors: `hover:translate-y-1 hover:translate-x-1 hover:shadow-none` OR `.brut-button` translate + shadow-grow. Pick one consistent pattern per button.

### 7.3 Badges / Stickers
- Square-cornered chips with `brut-border-2`, uppercase `font-black text-xs`, small padding. Fill variants: `bg-gigs-pink`, `bg-gigs-yellow`, `bg-gigs-teal` (text foreground), inverse black box (bg foreground, text background).
- Slightly rotated for character (`rotate-6`, `-rotate-3`). Used for: "LIVE", "TONIGHT", "SOLD OUT", "SELLING FAST", "LIMITED", "NO. 01".

### 7.4 Event Cards (variety within one system)
See home page for 4 expression variants; all share the system tokens:
1. **Light card:** `bg-background brut-border-4 p-4 brut-shadow brut-card-hover` — image box `bg-gigs-dark brut-border-2 aspect-[4/3]` (grayscale → color on group-hover), title `font-black uppercase group-hover:text-gigs-pink`, MapPin/Calendar meta rows, price block "FROM / Rp 250K" + `border-t-2 border-dashed` divider, "BUY" solid black button.
2. **Purple fill card:** `bg-gigs-purple brut-border-4 brut-shadow brut-card-hover`, image `mix-blend-multiply`, white inner block (`bg-background p-3 brut-border-2`) carrying title + meta, arrow (`ArrowRight`) that slides right on hover; offset vertically (`md:mt-8`).
3. **Teal accent card:** cream card with teal "LIMITED" headstrip (`bg-gigs-teal brut-border-2 font-black tracking-widest`), teal price/GET footer block.
4. **Dark card:** `bg-gigs-dark text-background`, oversized pink asterisk watermark, `bg-gigs-yellow` on title, image `mix-blend-screen opacity-70 → 100`.
- Ranked sticker: absolute circle `-top-3 -right-3 bg-gigs-pink w-8 h-8 rounded-full brut-border-2 font-black`, `group-hover:scale-125`.

### 7.5 Category Blocks (BROWSE VIBES)
- Not pills — oversized text blocks `text-5xl md:text-7xl font-black uppercase tracking-tighter`.
- Variations: plain accent-color text with hover color shift + slight rotate; inverted black box (`bg-foreground text-background`), bordered box (`border-4 border-foreground`, hover purple fill), underlined accent decoration (e.g. `decoration-gigs-teal decoration-8`).

### 7.6 Coming Up List (COMING UP)
- Deliberately structured contrast to the chaotic hero: full-width `bg-foreground text-background` band, `border-t-4`.
- Grid header row (DATE / EVENT / LOCATION / PRICE / ACTION, uppercase `tracking-widest text-background/50`).
- Rows: `grid grid-cols-12`, thick `border-b-2 border-background/20`, hover `bg-background/10`; date `text-xl font-bold` (accent on hot rows), title `text-3xl font-black uppercase` (hover accent), action "TICKETS" button `brut-border-2` hidden → visible on group-hover.

### 7.7 Corner Tapes
- Absolute-positioned rotated strips (`rotate-30`, `-rotate-25`, `rotate-40`, etc.), `bg-gigs-yellow border-y-4 border-foreground font-black uppercase`, containing `animate-marquee` text ("/// SOLD OUT", "/// SELLING FAST", "/// ALL ACCESS", etc.). `pointer-events-none select-none`, z-index above content, partially off-screen for a taped-on look.

### 7.8 Footer
- Loud block: `bg-gigs-pink border-t-4 border-foreground`, uppercase black text throughout. Four columns: brand (oversized GIGS PASS.), Explore / Support links (`hover:underline`), "For Organizers" CTA (`bg-background brut-border-4 brut-shadow`, hover `bg-gigs-yellow`). Bottom bar `border-t-4 border-foreground` with copyright + Terms/Privacy.

### 7.9 Forms, Inputs & Data Tables (to be built on checkout + dashboards — apply same rules)
- Rectangular inputs with 2–4px black border, cream bg, `font-bold` label uppercase. Focus: keep border, add offset shadow (no ring blur).
- Data tables: reuse COMING UP list pattern (thick row borders, uppercase header labels, hover accent).

## 8. Micro-Interactions / Visual Details

Add sparingly — they enhance identity, not noise:
- arrows (`.ArrowRight` slide on hover), oversized punctuation (`✸`, `*` at huge sizes, low opacity), numbered labels, rotated text, small stickers, date stamps, unconventional dividers (`border-t-2 border-dashed border-foreground/30`), offset labels, tiny "LIVE" indicators.

## 9. Accessibility & UX Guardrails

- Do NOT sacrifice usability for anti-design: obvious CTAs, readable info, predictable patterns, strong contrast (cream/black + saturated accents).
- Hover-feedback must not be color-only where motion matters to non-sighted users; also shift position/shadow so state is visible without color.
- 70/30 rule enforced on every page.

## 10. Implementation Notes (frontend mapping)

- Fonts: import Inter with weights 400–900 (`@fontsource-variable/inter` covers variable weights).
- Utilities live in `src/index.css`: `.brut-border`, `.brut-border-2`, `.brut-border-4`, `.brut-shadow`, `.brut-shadow-sm`, `.brut-button`, `.brut-card-hover`, `@keyframes marquee`, `.animate-marquee`, `--color-gigs-*` theme tokens.
- Colors in Tailwind: `background #FFFAF0`, `foreground #0A0A0A`, `gigs-pink #FF4D8B`, `gigs-purple #B8A4ED`, `gigs-orange #FFB084`, `gigs-yellow #E8B94A`, `gigs-teal #A4D4C5`, `gigs-dark #1A3A3A`.
- Components: `Button`, `Card`, `Badge`, `FeatureCard`, `TopNav`, `Footer` in `src/components/`. The previous rounded/hairline "pop" styling is retired; replace hover `scale` + soft shadows with brutal translate + offset shadows.

## 11. Iteration Guide

1. Reference this doc + the Figma export (`docs/design/figma-export/src/App.tsx`, `index.css`) as source of truth.
2. Every color/shadow/border change flows through tokens — never inline hex in components.
3. New components must follow one of the card/label/button patterns above; variety is allowed but must reuse the token set.
4. Do not bring back soft shadows, hairline borders, pill radii, or uniform 6-color card grids.

## 12. Known Gaps

- Only the HOME/DISCOVER page is designed in the Figma export. Detail event, waiting room, checkout, and order history screens are derived from this system (rule-driven, not reference-matched).
- No formal 3D/illustration assets in scope; poster art uses photo placeholders (Unsplash in the reference).
- Form validation states beyond focus/shadow are not extracted — define them when the checkout forms are built, following section 7.9.
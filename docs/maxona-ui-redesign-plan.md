# MerchPress Queue → Maxona-family UI Redesign Plan

## Context

MerchPress Queue is a stable, deployed React 19 + Vite + Supabase PWA used at busy event booths
on tablets (3 cashier stations, 1 central press tablet for 2 operators). It works today; the goal
is **visual-only**: make it feel like a sibling product to **Maxona** (a Next.js + Tailwind training
app) by extracting Maxona's *reusable design principles* — surface hierarchy, zinc-style neutrals,
semantic color chips, radii, soft elevation, subtle motion, calm typographic rhythm — and adapting
them to a fast, touch-first, glove-friendly operations UI.

**Confirmed user decisions:**
1. **Dark, Maxona-tuned theme** using a **Hyrox-inspired palette** (near-black surfaces + signature
   lime-yellow accent) for a corporate-friendly look. We keep Maxona's *structure* (token system,
   card/chip/nav patterns, motion timing) but render it dark and re-accented.
2. **CSS-only motion** — replicate Maxona's feel (fade+slide entrances ~150–280ms, ease
   `cubic-bezier(.4,0,.2,1)`) with plain CSS. No `motion`/Framer dependency.
3. **Keep PIN** for Cashier/Press/Admin (backend unchanged). Add "Continue as last user" and an
   **env-gated dev-only quick-login that fails closed in production**.

**Hard boundaries (unchanged):** Maxona is read-only reference. No changes to Supabase schema,
migrations, RLS, RPCs, data, env vars, Vercel config, realtime logic, or business workflows. No
component-framework migration (no Tailwind/MUI/Chakra/shadcn). Smallest maintainable solution.

---

## 1. Executive Summary

The app already has a clean separation: a thin presentation layer (12 components, 6 pages, one
global `index.css`) over a small, well-isolated logic core (hooks, `lib/*`, Supabase RPCs). This
makes a **token-driven restyle low-risk**: we introduce a CSS custom-property **token layer** in the
existing `index.css` (no architecture change, no new deps), rebuild shared primitives to consume
tokens, then restyle pages phase-by-phase. Realtime, sound, dedupe, and RPC logic stays unchanged.

**Authentication boundary:** Supabase `verify_pin`, production PIN requirements, session semantics,
and production authentication behavior remain **unchanged**. Only *controlled UI-level conveniences*
are added: remembered last user, "Continue as…", and a development-only quick login. The dev quick
login must use the existing `login(user)` flow, be gated **only** by `import.meta.env.DEV`, still
call `unlockAudio()` from the user's button click (so notification audio keeps working), and must
never exist in the production bundle.

**Preserved order/product semantics (no UI redesign may change these):** strict **FIFO** Press
queue ordering by creation time; **compatible-color selection rules** (advisory only — see below);
own-order ready-notification behavior; order status transitions; and event-specific design
filtering.

The visual target is **"Hyrox-corporate dark"**: near-black layered surfaces, zinc-style neutral
text ramp, a single high-energy lime-yellow accent reserved for primary actions and new-order
urgency, restrained semantic status chips, 16px/12px radii, subtle borders + soft shadows, and
calm CSS entrance/stagger motion — all while *scaling touch targets up* (≥56–72px) rather than
adopting Maxona's compact 10–14px density on action surfaces.

---

## 2. Current MerchPress UI/UX Audit

**Stack:** React 19.2, Vite 8, react-router 7, `@supabase/supabase-js`, `vite-plugin-pwa`. Plain CSS
with a handful of CSS variables in `src/index.css`. No UI framework. Lean and healthy.

| Dimension | Finding | Risk |
|---|---|---|
| Visual hierarchy | Flat; cards/buttons share similar weight; little surface layering | Med |
| Typography | Single system stack, ad-hoc sizes (13–64px); no scale | Med |
| Spacing | Implicit (12/14/16/18/22px) hardcoded per component; no scale | Med |
| Color | 9 globals + scattered status colors in `lib/colors.ts`, `config.ts`, `WaitTimer.tsx` | High (fragmented) |
| Layout consistency | `.content` max-width differs per page (820 vs 980); no shared shell | Med |
| Component consistency | Good — 12 reusable components already exist | Low |
| Navigation | `TopBar` with inline nav buttons; admin tabs ad-hoc | Med |
| Forms | Functional, large inputs; no unified field/label/error pattern | Med |
| Touch targets | Good baseline (btn 56px, btn-lg 72px); pills small (~28px) | Low/Med |
| Queue readability | Press grid `minmax(320px)`; status conveyed but new vs in-progress weakly differentiated | High |
| Order-card readability | Dense; design thumbs + specs + status; highlight border for own orders | Med |
| Status communication | Color badges OK but palette collides (new=green, ready=blue, ok=green) | Med |
| Admin usability | Works; visually plainest area; tables unstyled | Med |
| Responsive | Implicit via flex-wrap + grid auto-fill; no breakpoints; no landscape tuning | Med |
| Accessibility | No focus-visible styling, sparse ARIA, emoji-as-icon, contrast unverified | High |
| Visual noise | Low (good) but also low brand identity | — |
| Missing feedback states | Inline toasts only; no unified loading/empty/error/skeleton; no double-tap guard | High |

**Existing assets to reuse (do not rebuild):** `RoleSelect`, `PinPad`, `TopBar`, `OrderCard`,
`AlertOverlay`, `ColorPicker`, `SizePicker`, `DesignPicker`, `StatusBadge`, `WaitTimer`,
`OfflineBanner`. All are presentation; restyle in place.

---

## 3. Maxona Design-System Inventory (extracted from implementation)

- **Stack:** Next 15 + React 19 + **Tailwind 3.4**; custom components (no UI lib); **`motion`** for
  animation; **no icon library** (text labels + colored chips); **system fonts**.
- **Surfaces:** page `#f8f8f7` warm off-white + two fixed ultra-low-opacity radial gradients
  (indigo 5.5%, emerald 4%); cards `bg-white` + `border-zinc-100` + `shadow-card`; inner blocks
  `bg-zinc-50`. Glass (`bg-white/70 backdrop-blur`) only on nav/hero.
- **Neutrals:** **zinc** ramp exclusively (900→300) for text/dividers.
- **Semantic palette:** emerald (easy/good), amber (moderate/caution), red (hard/risk), indigo
  (AI/coach/primary), orange (issues), each as `bg-{c}-50 / text-{c}-700 / border-{c}-100`. Left-edge
  `border-l-[3px]` intensity accent on session cards.
- **Type scale:** 10px → 26px. Page title 26 bold zinc-900; card heading `text-sm`
  semibold zinc-800; body `text-sm` medium zinc-700; secondary `text-xs` zinc-500; labels
  `text-[10px]` semibold **uppercase tracking-widest** zinc-400. `tabular-nums` for metrics.
- **Spacing:** 4px base; card padding `p-4` (16) / compact `px-3 py-2.5`; section gaps `space-y-3` (12).
- **Radii:** cards `rounded-2xl` (16px), inner `rounded-xl` (12px), chips `rounded-full`.
- **Shadows:** `shadow-card 0 1px 4px rgba(0,0,0,.06)`; hover `0 4px 12px rgba(0,0,0,.09)`. Subtle.
- **Buttons:** primary `bg-zinc-900 text-white rounded-xl px-4 py-2 text-sm`; secondary tinted
  (`bg-indigo-50 text-indigo-700 border-indigo-200`); text/link buttons for destructive.
- **Fields:** `rounded-xl border-zinc-200 bg-zinc-50 px-3 py-2 text-sm focus:ring-1 ring-zinc-300`;
  label `text-xs font-medium text-zinc-500`. Toggle chips: selected `bg-black text-white`.
- **Chips/badges:** `rounded-full px-2 py-0.5 text-[10px] font-semibold` tinted by intent.
- **Nav:** mobile bottom bar (text labels, animated `layoutId` indicator); desktop floating glass
  pill, active item `bg-white/80 shadow-sm`.
- **Layout shell:** `DashboardShell` desktop grid `[minmax(0,1fr)_360px] gap-6 items-start`; mobile
  single column; containers `max-w-md` mobile → `max-w-6xl/7xl` desktop.
- **Motion:** ease `[0.4,0,0.2,1]` everywhere; page enter 280ms fade+`y:8`; stagger 220ms children
  60ms apart; hover lift `y:-1` 150ms; nav indicator 220ms. No spring/bounce/infinite.
- **States:** loading = disabled + "…" text; empty = dashed `border-zinc-100` + `text-zinc-300`
  centered; error = `text-xs text-red-500`; success = emerald text / filled emerald button.

---

## 4. Design-Token Specification (Hyrox-tuned dark)

Implemented as CSS custom properties on `:root` in `src/index.css`. **The conceptual map = Maxona's;
the values = dark + Hyrox.** No Tailwind, no JSON build step.

### Surfaces (Maxona's white→zinc hierarchy, inverted to dark)
```
--surface-page:    #0B0C0E   /* near-black booth base (Hyrox) */
--surface-card:    #15171B   /* elevated card (= Maxona bg-white) */
--surface-raised:  #1E2127   /* inner block (= Maxona bg-zinc-50) */
--surface-overlay: rgba(11,12,14,0.96)  /* alert/modal scrim */
--border-subtle:   #2A2E36   /* = border-zinc-100 */
--border-strong:   #3A3F4A   /* dividers/inputs */
/* optional ambient: two fixed radial gradients, lime 4% + sky 3%, like Maxona */
```

### Neutral text ramp (zinc-equivalent, light-on-dark)
```
--text-primary:   #F4F5F7   --text-secondary: #B4BAC4
--text-muted:     #7C828E   --text-faint:     #545A64  /* empty-state text */
```

### Accent — Hyrox lime (reserved: primary actions + new-order urgency)
```
--accent:        #C5FF00    --accent-hover: #D4FF33
--accent-press:  #AEE000    --accent-ink:   #0B0C0E   /* black text on lime */
--accent-soft:   rgba(197,255,0,0.14)  /* tinted bg / focus ring */
```

### Semantic status (distinct from accent; black ink on bright fills for contrast)
```
--status-new-bg:      #C5FF00  --status-new-ink:      #0B0C0E  /* lime = grab attention */
--status-progress-bg: #F59E0B  --status-progress-ink: #0B0C0E  /* amber */
--status-ready-bg:    #38BDF8  --status-ready-ink:    #0B0C0E  /* sky = pickup */
--status-done-bg:     #3A3F4A  --status-done-ink:     #C7CCD4  /* muted zinc */
--danger:  #EF4444   --warn: #F59E0B   --ok: #34D399
```

### Wait-timer escalation (replaces hardcoded values in WaitTimer.tsx)
```
normal: --text-muted   warn(≥7m): --warn   overdue(≥15m): --danger (+ subtle pulse)
```

### Typography (Maxona scale, sizes bumped on action surfaces for touch)
```
--font: system-ui,-apple-system,'Segoe UI',Roboto,sans-serif
--fs-display:34  --fs-h1:26  --fs-h2:20  --fs-body:16  --fs-sm:14  --fs-xs:12  --fs-label:11
--fw-regular:400 --fw-medium:500 --fw-semibold:600 --fw-bold:700
labels: uppercase, letter-spacing .08em, --text-muted (Maxona section-heading idiom)
action text (buttons/queue numbers): 18–22px, tabular-nums for order #s and timers
```

### Spacing (4px base, Maxona scale)
```
--sp-1:4 --sp-2:8 --sp-3:12 --sp-4:16 --sp-5:20 --sp-6:24 --sp-8:32
card pad: var(--sp-4); section gap: var(--sp-3)
```

### Radii / elevation / motion
```
--r-card:16 --r-inner:12 --r-control:12 --r-pill:999
--shadow-card: 0 1px 3px rgba(0,0,0,.45)        --shadow-raised: 0 6px 20px rgba(0,0,0,.5)
--ring-focus: 0 0 0 3px var(--accent-soft)
--ease: cubic-bezier(.4,0,.2,1)  --dur-fast:150ms --dur:220ms --dur-slow:280ms
--touch-min:56px --touch-lg:72px
```

### Motion keyframes (CSS, replacing Maxona's `motion`)
```
@keyframes enter { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:none} }
.stagger > * { animation: enter var(--dur) var(--ease) both;
               animation-delay: calc(var(--i,0) * 60ms); }  /* --i set inline per item */
@media (prefers-reduced-motion: reduce){ * { animation:none!important; transition:none!important } }
```

---

## 5. Component Mapping Table (Maxona → MerchPress)

| Maxona pattern | MerchPress target | Adaptation for booth | Reuse concept / don't copy literally |
|---|---|---|---|
| `SurfaceCard` (white, rounded-2xl, shadow-card) | new `Card` primitive; `OrderCard` shell | dark surface, larger pad, ≥16px radius | Reuse layering/elevation; not white bg |
| Section heading (10px uppercase tracking-widest zinc-400) | section labels across pages | bump to 11–12px for legibility | Reuse the quiet-label idiom |
| Status/Intensity chip (`bg-c-50 text-c-700`) | `StatusBadge`, `WaitTimer`, color/size chips | bright-fill + black ink (dark needs more contrast) | Reuse chip shape; invert tint model |
| Primary btn `bg-zinc-900 text-white` | `.btn-primary` | **Hyrox lime bg + black ink**, ≥56px | Reuse weight/role; swap color |
| Secondary tinted btn | `.btn-secondary` | dark surface + border + lime text | Reuse hierarchy |
| Text/link destructive btn | delete/logout actions | keep but ≥44px hit area | Reuse restraint |
| Field (`rounded-xl bg-zinc-50 ring on focus`) | inputs, client-name, admin forms | dark field, 16px text (no iOS zoom), bigger pad | Reuse focus-ring pattern |
| Toggle chip (selected `bg-black text-white`) | `ColorPicker`/`SizePicker` selected state | selected = lime ring/fill; ≥56px tiles | Reuse selected affordance |
| Bottom/desktop nav + animated indicator | `TopBar` nav + admin tabs | CSS-transition underline (no `motion`) | Reuse indicator concept |
| `DashboardShell` 2-col grid | Cashier (form ⟂ ready), Admin shell | tablet-first; stack on portrait | Reuse responsive shell |
| `PageWrapper`/`StaggerList` (motion) | `.page-enter`, `.stagger` CSS classes | CSS keyframes only | Reuse timing/feel |
| Empty (dashed border, faint text) | all empty states | dark dashed + `--text-faint` | Reuse pattern |
| Loading (disabled + "…") | all async buttons | add spinner + double-tap guard | Reuse + strengthen |
| Ambient radial gradients | app background | lime/sky at ~3–4% | Reuse atmosphere subtly |

---

## 6. Page-by-Page Redesign Specification

> Logic untouched in every case. Only JSX structure/classes and token usage change.

- **Role selection** (`RoleSelect`): three large role cards (lime accent on focus), Maxona section
  label "Select role". Add **"Continue as <last user>"** card at top when a remembered user exists.
- **User selection:** staff list as large tappable rows/cards (≥64px), name + role chip, alpha order.
- **PIN entry** (`PinPad`): centered card, 4 dot indicators, 3×4 keypad keys ≥72px, lime active key
  press, shake+`--danger` on error. **Dev-only quick-login** button rendered *only* when
  `import.meta.env.DEV` (see §7) — absent from production bundle.
- **Cashier screen** (`CashierPage`): two-zone shell — left "New order" form, right "Ready for
  pickup". On portrait tablet, stack. Cashier identity pill always visible (ownership).
- **New-order form:** vertical step rhythm with section labels (Color / Size / Front / Back / Name);
  sticky primary "Send to press →" (lime); success toast → confetti-free, just lime check + auto
  reset; **double-tap guard** disables button during submit.
- **Color selection** (`ColorPicker`): swatch tiles ≥56px, lime selected ring; show color label
  under swatch. **`compatible_colors` is advisory, not a restriction** — incompatible colors may be
  visually dimmed and/or show a warning, but **remain fully selectable** (do not change this product
  behavior).
- **Size selection** (`SizePicker`): segmented large buttons, selected = lime fill/ring.
  Selecting an incompatible color must still submit successfully.
- **Design image selection** (`DesignPicker`): image tiles `minmax(120px)`, selected lime border,
  `--text-faint` placeholder + initials when image missing (**image fallback**), lazy-load.
- **Ready-order section:** own orders first (lime "yours" tag), big order # (tabular-nums), "✓ Picked
  up" confirm button; `AlertOverlay` retains full-screen but re-skinned (see alerts).
- **Press queue** (`PressPage`): scannable grid in **strict FIFO order by creation time (unchanged)**.
  **New vs in-progress visually distinct** — new cards get lime left-edge `border-l-[4px]` + subtle
  glow; in-progress get amber edge. Large order #, client, specs, `WaitTimer`. Overdue (≥15m)
  escalates **visually only** (red edge, overdue label, timer, reduced-motion-safe pulse) — it is
  **never re-sorted to the top**; queue position remains FIFO.
- **Order cards** (`OrderCard`): card primitive; design thumbs row, color/size chips, cashier name,
  status badge; `highlight` = lime ring.
- **Waiting-time indicator** (`WaitTimer`): token-driven escalation muted→amber→red(+pulse).
- **Claim/Ready actions:** primary lime "Claim — start printing"; "✓ Ready" as success-styled;
  both ≥72px; disabled during RPC (double-tap guard).
- **Admin shell** (`AdminPage`): Maxona-style tab nav with CSS-underline indicator; consistent
  `max-w` container.
- **Events management** (`AdminEventsPage`): create-event card form; event list rows with active
  state badge (lime "Active") + activate button.
- **Designs management** (`AdminDesignsPage`): upload card form (front/back drop zones with preview),
  catalog grid `minmax(180px)` with thumb/name/type/colors/delete; delete = confirm.
- **Stats dashboard** (`StatsPage`): KPI cards row (tabular-nums, section labels), breakdown tables
  styled as zebra/quiet rows; empty = dashed.
- **CSV export:** secondary button with download affordance; loading + success microcopy.
- **Alert overlays** (`AlertOverlay`): keep full-screen + pulse; re-skin to dark scrim + lime accent
  ring for "ready"; text scaled, "Tap to dismiss".
- **Offline/reconnect banner** (`OfflineBanner`/`TopBar`): `--warn` (amber) banner, not pure red, so
  it reads as "degraded" not "error"; sticky top.
- **Loading & empty states:** shared `Skeleton`/`EmptyState`/`Spinner` primitives; consistent copy.

---

## 7. Proposed UX Improvements (no product-model change)

- **Remember last role+user:** persist `{role,userId,name}` in `localStorage` (`mpq.lastUser`),
  separate from auth session `mpq.session`. Drives "Continue as <name>".
- **"Continue as <name>":** one-tap returns to the user/PIN step pre-filled (still requires PIN in
  prod) — speeds re-login after logout/refresh.
- **Dev-only quick-login (fail-closed):** render a "Dev login" shortcut behind `import.meta.env.DEV`
  **only** (Vite statically replaces this; production build = `false`, so the branch is
  dead-code-eliminated and the button/path cannot exist in the prod bundle). It must **use the
  existing `login(user)` flow** (not a parallel auth path) and must **call `unlockAudio()` from the
  user's button click** so notification audio stays functional. No env var, no runtime flag, no way
  to toggle on in prod. Document this in the file.
- **PIN stays** for all three roles (per decision) — no weakening of access model.
- **Clearer cashier ownership:** persistent cashier pill in TopBar; "yours" tag on own ready orders.
- **Faster one-handed entry:** single-column step flow, sticky submit, large tap zones, sensible
  defaults (size M preselected? — open question, default no).
- **Selection reset after submit:** already resets; add visible lime confirmation + focus returns to
  first field.
- **Double-tap protection:** disable action buttons while RPC in flight (Cashier send, Press
  claim/ready, pickup, admin create/upload/delete). Pure UI guard; no logic change.
- **Press queue scanability:** big numbers, edge-color coding, consistent card rhythm.
- **New vs in-progress distinction:** lime vs amber left edge + label.
- **Overdue escalation (visual only):** ≥15m red edge, overdue label, timer, and
  reduced-motion-safe pulse. **No re-sorting** — the queue stays strictly FIFO by creation time.
- **Confirmation/error feedback:** unified toast + inline error tokens; destructive actions confirm.
- **Image fallback:** initials/placeholder tile when `photo_*` missing or fails to load (`onError`).
- **Touch targets:** enforce `--touch-min`/`--touch-lg`; pills bumped to ≥40px hit area.
- **Tablet orientation:** test landscape + portrait; Cashier two-zone collapses to stacked portrait.
- **Keyboard for client-name:** `inputmode="text"`, `enterkeyhint="done"`, `autocomplete="off"`,
  16px font to prevent iOS zoom; dismiss-on-submit.
- **Accessibility/contrast:** `:focus-visible` lime ring everywhere; verify AA on lime
  (`#C5FF00` on `#0B0C0E` ≈ very high; black ink on lime ≈ very high); ARIA labels on icon-only
  controls; `prefers-reduced-motion` honored; live-region for new-order/ready announcements.

---

## 8. Explicit Non-Goals

- **No UI redesign may change these order/product semantics** (presentation only, behavior frozen):
  - **FIFO ordering** of the Press queue by creation time.
  - **Compatible-color selection rules** — `compatible_colors` stays advisory; incompatible colors
    remain selectable and submittable.
  - **Own-order notification behavior** (creating cashier alerted once on ready).
  - **Order status transitions** (`new → in_progress → ready → completed`).
  - **Event-specific design filtering.**
- No Supabase schema/migration/RLS/RPC/data changes. No env var or Vercel changes.
- No realtime/sound/dedupe/business-workflow logic changes.
- No new component framework (Tailwind/MUI/Chakra/shadcn) and no `motion`/Framer.
- No product-architecture or information-architecture redesign; same roles, same flows.
- No replacement of working libraries without demonstrated need (none demonstrated).
- No light theme, no theme toggle (dark only, per decision).
- No changes to any file under the Maxona project.

---

## 9. Files Expected to Change

**New (token layer + shared primitives + dev gate):**
- `docs/maxona-ui-redesign-plan.md` (this document — created Phase 0)
- `src/styles/tokens.css` *(or a `:root` block appended to `src/index.css`)* — all tokens/§4
- `src/components/ui/Card.tsx`, `Button.tsx`, `Field.tsx`, `Chip.tsx`, `EmptyState.tsx`,
  `Skeleton.tsx`, `Spinner.tsx`, `Toast.tsx` *(thin, presentation-only)*
- `src/lib/devAuth.ts` *(exports `DEV_LOGIN = import.meta.env.DEV`; single source of truth)*
- `src/lib/lastUser.ts` *(remember last role/user in localStorage)*

**Restyled (presentation only):**
- `src/index.css` (global base on tokens)
- `src/components/*.tsx` — all 12 components (logic-free or logic preserved)
- `src/pages/CashierPage.tsx`, `PressPage.tsx`, `AdminPage.tsx`, `AdminEventsPage.tsx`,
  `AdminDesignsPage.tsx`, `StatsPage.tsx` *(JSX/classes only; callbacks/RPCs untouched)*
- `src/App.tsx` / `src/main.tsx` *(only if app-shell wrapper added)*
- `vite.config.ts` — PWA **manifest colors/theme** only (`theme_color`/`background_color` →
  `#0B0C0E`); **workbox/runtime caching untouched**.

---

## 10. Files That Must NOT Change

- `supabase/migrations/0001_init.sql`, `0002_storage.sql` (schema, RPCs `verify_pin`,
  `create_order`, `set_order_status`, `order_stats_v`, RLS).
- `src/lib/supabase.ts` (client init), `src/lib/realtime.ts`, `src/lib/notify.ts`
  (audio/vibration/`SeenSet` dedupe), `src/lib/csv.ts`.
- `src/hooks/useOrders.ts`, `useEvents.ts`, `useDesigns.ts`, `useWakeLock.ts`.
- `src/context/SessionContext.tsx` (auth/session/active-event — *may add* `lastUser` read, but
  must not alter existing auth behavior; prefer separate `lib/lastUser.ts`).
- `src/types/db.ts`, `.env`/`.env.example`, Vercel config, `vite.config.ts` workbox section.
- **Anything** inside the Maxona project (read-only reference).
- Logic regions inside mixed files (callbacks, `useOrders` wiring, `supabase.rpc(...)` calls,
  status-transition calls, dedupe seeding) — restyle around them, never through them.

---

## 11. Phased Implementation Plan

> **Git workflow:** all phases land on a **single dedicated branch `feature/maxona-ui-redesign`**,
> with **one focused commit per phase** (no per-phase branches). Logic unchanged throughout.

### Phase 0 — Baseline & safety
- **Scope:** **first copy the approved plan into `docs/maxona-ui-redesign-plan.md`** (verbatim);
  capture baseline screenshots of every screen (login, cashier, press, admin×3) in
  landscape+portrait; confirm clean `git status`; create the single feature branch
  `feature/maxona-ui-redesign`; record baseline `npm run build` + `npm run lint` pass; document
  rollback.
- **Files:** docs only.
- **Unchanged:** everything functional.
- **Acceptance:** `docs/maxona-ui-redesign-plan.md` committed; baseline build+lint green; screenshots
  stored under `docs/baseline/`.
- **Manual test:** app runs identically (`npm run dev`).
- **Commit:** `docs: add Maxona UI redesign plan and capture baseline`

### Phase 1 — Tokens, global styles, primitives, app shell
- **Scope:** add token layer (§4) to `index.css`/`tokens.css`; base element styles; CSS motion
  classes + reduced-motion; build `Card/Button/Field/Chip/EmptyState/Skeleton/Spinner/Toast`;
  introduce app-shell wrapper + ambient background; restyle `TopBar`/`OfflineBanner`.
- **Files:** `src/index.css`, `src/styles/tokens.css`, `src/components/ui/*`, `TopBar`,
  `OfflineBanner`, maybe `App.tsx`/`main.tsx`.
- **Unchanged:** all routing/logic; component public props of existing components.
- **Acceptance:** tokens render; primitives match §4; build+lint green; no visual regressions in
  unrestyled pages beyond inherited base.
- **Manual test:** load each route — no console errors; offline banner shows amber on disconnect.
- **Commit:** `feat(ui): add Hyrox-tuned token layer, CSS motion, and shared primitives`

### Phase 2 — Auth: role/user/PIN, remember, dev login, states
- **Scope:** restyle `RoleSelect`+`PinPad`; add `lib/lastUser.ts` + "Continue as <name>"; add
  `lib/devAuth.ts` and `import.meta.env.DEV`-gated quick-login that **reuses the existing
  `login(user)` flow and calls `unlockAudio()` from the button click**; wire shared
  loading/error/empty states into login.
- **Files:** `RoleSelect.tsx`, `PinPad.tsx`, `lib/lastUser.ts`, `lib/devAuth.ts`; read-only touch of
  `SessionContext` for last-user (no auth-behavior change).
- **Unchanged:** `verify_pin` RPC call, production PIN requirements, session semantics, `unlockAudio()`
  on first gesture, session persistence keys.
- **Acceptance:** PIN works prod-identical; "Continue as" appears only with remembered user; dev login
  goes through `login(user)` and unlocks audio; **prod build contains no dev-login code** (verify via
  build output grep); dev-login works in `npm run dev`.
- **Manual test:** login each role; logout→Continue as; `npm run build && npx serve dist` → no dev
  button; reduced-motion respected.
- **Commit:** `feat(auth-ui): restyle login, add remembered user and DEV-gated quick login`

### Phase 3 — Cashier screen
- **Scope:** two-zone shell, new-order form rhythm, `ColorPicker`/`SizePicker`/`DesignPicker`
  restyle, image fallback, double-tap guard, ready-pickup zone, ownership pill, success/reset.
- **Files:** `CashierPage.tsx` (JSX only), `ColorPicker`, `SizePicker`, `DesignPicker`, `OrderCard`,
  `AlertOverlay`, `WaitTimer`.
- **Unchanged:** `useOrders` wiring, `onReady`/`seenReady` dedupe, `create_order`/`complete` RPCs,
  ready sorting (own-first), compatible-color selection rules (advisory — incompatible stays
  selectable).
- **Acceptance:** create order → press receives realtime; own-order ready alert fires once (sound +
  overlay); incompatible colors dimmed **but still selectable and submittable**; double-tap can't
  double-submit; build+lint green.
- **Manual test:** two-device cashier↔press flow; submit, watch number, reset, pickup.
- **Commit:** `feat(cashier-ui): restyle order entry and ready-pickup with token system`

### Phase 4 — Press screen
- **Scope:** queue grid scanability, new-vs-in-progress edge coding, **visual-only** overdue
  escalation, big numbers, claim/ready buttons, double-tap guard, sound-unlock unaffected.
- **Files:** `PressPage.tsx` (JSX only), `OrderCard`, `WaitTimer`, `StatusBadge`.
- **Unchanged:** `onNew`/`seenNew` dedupe, **strict FIFO queue filter/sort by creation time**,
  `set_order_status` transitions, sound.
- **Acceptance:** new order plays sound once + lime edge; claim→in_progress (amber); ready→leaves
  queue + cashier alerted; overdue gets red edge/label/pulse **without changing FIFO position**;
  build+lint green.
- **Manual test:** generate orders, claim/ready across statuses; verify timers escalate.
- **Commit:** `feat(press-ui): restyle realtime queue with status edge-coding and escalation`

### Phase 5 — Admin: Events & Designs
- **Scope:** admin tab nav with CSS indicator; event create/list/activate styling; design upload
  form with previews + image fallback; catalog grid; confirm-on-delete.
- **Files:** `AdminPage.tsx`, `AdminEventsPage.tsx`, `AdminDesignsPage.tsx` (JSX only).
- **Unchanged:** `useEvents`/`useDesigns`, activate flow, Storage upload path/bucket logic.
- **Acceptance:** create+activate event; upload design (front/back) → appears in cashier picker for
  that event; delete confirms; build+lint green.
- **Manual test:** full admin CRUD; switch active event; verify per-event catalog.
- **Commit:** `feat(admin-ui): restyle events and designs management`

### Phase 6 — Stats & CSV
- **Scope:** KPI cards (tabular-nums, section labels), breakdown tables, CSV button + states.
- **Files:** `StatsPage.tsx` (JSX only); `lib/colors.ts` status tokens may align to §4.
- **Unchanged:** `order_stats_v` query, client aggregation, `toCsv`/`downloadCsv`.
- **Acceptance:** KPIs match data; CSV downloads identical columns/values to baseline; build+lint.
- **Manual test:** export CSV, diff columns vs baseline export.
- **Commit:** `feat(stats-ui): restyle KPI dashboard and CSV export`

### Phase 7 — Tablet/PWA polish, a11y, final regression
- **Scope:** landscape+portrait passes, focus-visible everywhere, ARIA + live regions, contrast
  audit, reduced-motion, manifest theme color to `#0B0C0E`, install/standalone verification, full
  regression checklist (§13), final build/lint, Vercel preview check.
- **Files:** `vite.config.ts` (manifest colors only), minor component a11y tweaks, `index.css`.
- **Unchanged:** workbox/runtime caching, all logic.
- **Acceptance:** all §13–§15 checklists pass; Lighthouse PWA installable; Vercel preview builds.
- **Manual test:** install PWA on tablet, run a full booth rehearsal.
- **Commit:** `feat(ui): tablet/PWA polish, accessibility, and final redesign pass`

---

## 12. Acceptance Criteria (per phase) — see each phase above

Cross-cutting gate for **every** phase: `npm run build` and `npm run lint` pass; no console errors;
no diff in any §10 file's logic; baseline realtime + sound + dedupe behavior reproduced on a
two-device test.

---

## 13. Regression-Test Checklist (run before each merge; full run in Phase 7)

- [ ] Cashier creates order → appears on Press in realtime (<2s).
- [ ] Status transitions: new → in_progress (claim) → ready → completed (pickup).
- [ ] Own-order ready notification fires for the creating cashier only, **once**.
- [ ] New-order sound fires on Press **once** per order (dedupe via `SeenSet`).
- [ ] Sound unlock works after first gesture (login) on iPad Safari.
- [ ] Duplicate-alert prevention holds across refresh/reconnect (sessionStorage seeds).
- [ ] Reconnect refetch restores queue after network drop; offline banner shows/hides.
- [ ] Event-specific designs: only active-event designs in cashier picker.
- [ ] Admin upload (front/back) → public URL renders; image fallback on missing.
- [ ] Event create + activate (exactly one active).
- [ ] Stats KPIs match underlying orders; averages present.
- [ ] CSV export columns/values identical to baseline.
- [ ] Event-local order numbering continues correctly (no gaps, per-event).
- [ ] Double-tap cannot create duplicate orders / double-transition.
- [ ] PWA build installs; standalone mode; wake-lock keeps screen on.
- [ ] Vercel production build succeeds.
- [ ] **Prod bundle has zero dev-login code** (`grep` dist for the dev-login marker → none).

## 14. Accessibility Checklist
- [ ] `:focus-visible` lime ring on all interactive elements.
- [ ] Contrast AA+: text ramp on surfaces; black ink on lime/amber/sky chips.
- [ ] ARIA labels on icon/emoji-only controls; buttons have discernible text.
- [ ] Live region announces new orders (Press) and ready (Cashier).
- [ ] `prefers-reduced-motion` disables entrance/stagger/pulse.
- [ ] Touch targets ≥44px (controls) / ≥56–72px (primary actions).
- [ ] Inputs 16px to avoid iOS zoom; correct `inputmode`/`enterkeyhint`.
- [ ] Color is never the *only* status signal (chip text/label accompanies).

## 15. Tablet/PWA Checklist
- [ ] Landscape and portrait layouts verified on iPad-class tablet.
- [ ] Cashier two-zone collapses cleanly to stacked portrait.
- [ ] Press queue grid reflows; numbers legible at arm's length.
- [ ] Installed PWA: standalone, status bar, safe-area insets respected.
- [ ] Wake-lock active during event; re-acquires on visibility change.
- [ ] Manifest theme/background `#0B0C0E`; icons intact.
- [ ] Offline/reconnect banner visible in standalone mode.

## 16. Risks & Rollback
- **Risk:** restyle accidentally edits a logic line in a mixed file (Cashier/Press/RoleSelect).
  **Mitigation:** per-phase diff review limited to JSX/className; logic regions flagged; two-device
  regression before merge. **Rollback:** revert that phase's single commit on
  `feature/maxona-ui-redesign` (one focused commit per phase keeps reverts atomic).
- **Risk:** dev-login leaks to prod. **Mitigation:** single `import.meta.env.DEV` gate + Phase 2/7
  grep of `dist`; fail-closed by construction (Vite dead-code-elimination).
- **Risk:** contrast/legibility regression on dark+lime at a bright booth. **Mitigation:** contrast
  audit, on-device rehearsal in Phase 7; lime reserved for high-contrast pairings only.
- **Risk:** PWA cache serves stale shell after restyle. **Mitigation:** `autoUpdate` already set;
  verify update on reload; bump nothing in workbox.
- **Risk:** scope creep into product/IA. **Mitigation:** §8 non-goals enforced in review.
- **Global rollback:** all work is on the single branch `feature/maxona-ui-redesign`; revert the
  relevant phase commit(s), or abandon the branch entirely, to restore prior visual state with zero
  logic impact. `main` is never touched until final merge.

## 17. Open Questions (only if blocking)
None blocking. Minor defaults assumed (override anytime): (a) no size pre-selection on new-order
form; (b) ambient gradient kept very subtle (~3–4%); (c) `lib/lastUser.ts` kept separate from
`SessionContext` to avoid touching auth. These are reversible and not gating.

## 18. Recommended First Implementation Phase
**Phase 0 then Phase 1 (two commits on the same branch):** first copy the approved plan into
`docs/maxona-ui-redesign-plan.md` + capture baseline, then land the token layer, CSS motion, shared
primitives, and restyled app shell (`TopBar`/`OfflineBanner`). This establishes the entire
Hyrox-tuned visual foundation with **zero logic risk** and makes every subsequent page phase a thin,
low-risk restyle. All work on branch `feature/maxona-ui-redesign`.

---

## Verification (how implementation will be proven)
1. `npm run dev` — manual two-device walkthrough (cashier ↔ press) per phase against §13.
2. `npm run build && npm run lint` — green gate every phase; `grep` `dist/` confirms no dev-login.
3. Compare CSV export and Stats KPIs against Phase-0 baseline.
4. Install PWA on a tablet; rehearse a full booth session (login, orders, claim/ready, pickup,
   admin, stats, offline drop/reconnect) before final merge.
5. Vercel preview build per phase; production deploy only after Phase 7 full regression.

# Kalima — Brand & Design Guide

**كلمة · JLPT mock exam practice, N5 to N1.**

This is the single source of truth for Kalima's UI: colors, typography, spacing, components,
and design tokens. Keep it current whenever a visual decision changes. **Where this file and
the built CSS disagree, fix the CSS to match this file.**

> **How to use this doc (for an AI coding agent).** Rules are written as imperatives —
> "always", "never", "use", "cap". Token names (`--navy`, `--text-lg`, `--space-4`) are
> exact and copy-pasteable; use them verbatim, never hard-code a raw hex or pixel value that
> a token already covers. When a section gives a table, treat the left column as the only
> allowed set — do not invent new variants. Start from §0, then build against §8 (checklist)
> and §11 (tokens).

---

## 0. Quick reference — the rules that matter most

These are non-negotiable. Everything else in this doc elaborates on them.

1. **Mobile-first, Android-tall canvas.** The **primary device is a Nothing Phone 3a**
   (6.77″ AMOLED, ~412 × 915 CSS px, 120 Hz) — design and test here *first*. **6.1″
   (402 × 874 CSS px) is the support floor**: nothing may break or clip down to it, but the
   target canvas is the taller, slightly wider Android viewport. Larger phones, tablets, and
   desktop are additive: **cap content width at `--maxw-read`, center, never stretch.**
   Because the screen is AMOLED, the dark theme (§7) genuinely saves power and glare — treat
   it as the default for long evening sessions, not an afterthought.
2. **Built for long sittings (30+ min).** Prioritise low glare and low eye fatigue over
   visual punch: soft off-white surfaces, generous line-height, calm motion. **Ship a dark
   theme (§7) — it is a comfort feature, not a nicety.**
3. **Touch targets ≥ 48 × 48 px** (we exceed the 44 px floor for accuracy when tired), with
   **≥ 12 px (`--space-3`) between adjacent answer options** to prevent mis-taps.
4. **Type scale and spacing scale are tokenised (§4, §11).** Use the tokens. Body text never
   below `--text-base` (16 px); JLPT question text uses `--text-lg`/`--text-xl`.
5. **Never white text on gold or sky** — they fail contrast. Use `--navy` or `--ink`.
6. **Functional color (green/amber/red) is for answer state only — never decoration.**
7. **Respect `prefers-reduced-motion` and `prefers-color-scheme`.**

---

## 1. Personality & voice

Kalima is a **calm, confident study companion** — the senior who aced the JLPT and is now
coaching you through it. Serious about preparation, relaxed about mistakes. We never
catastrophize a wrong answer; we explain it and move on.

| Trait | What it means in the UI |
|-------|--------------------------|
| **Focused** | Clean layout, no decorative noise. Every screen does one thing: read the question, choose the answer. |
| **Encouraging** | Frame wrong answers as "here's why" moments, not failures. Tone is coach, not examiner. |
| **Precise** | JLPT vocabulary is the content. Every label, hint, and piece of copy must be accurate — no hand-wavy glosses. |
| **Bilingual** | Japanese leads in question context; English supports in explanations and UI chrome. |
| **Unhurried** | The app is used for long stretches. Nothing flashes, pulses, or demands attention. Calm reads as trustworthy. |

**Microcopy:** direct, short, lightly bilingual. Use the JLPT register — formal enough to
match the exam context, never cold. Celebrate a correct run ("全問正解！ Perfect round") and
acknowledge a wrong answer without drama ("惜しい · Almost — here's the reading.").

---

## 2. Mascot — Bun (ブン)

A small hardcover book, named after 文 (bun — writing, literature, character). Bun is the
study partner: opens wide for a new lesson, props itself upright for a timed exam, slumps
a little when the session ends.

Built from simple geometry: **navy hard covers** with a **gold spine and corner guards**,
**cream pages** (slightly fanned), a **gold ribbon bookmark** as the tail, and two round
eyes set into the front cover.

**Expressions** — a fixed cast. Reuse these; do not invent new poses. Each is the same
silhouette with only the **eyes and page state** changing.

| Mood | When to show it |
|------|-----------------|
| **Open** (pages spread, eyes bright) | Default / home / new session |
| **Focused** (standing upright, pages neat, eyes narrowed) | Timed exam in progress |
| **Correct** (bookmark bouncing up, cover flushed gold) | Right answer / full round complete |
| **Ruffled** (pages slightly bent, eyes apologetic) | Wrong answer / session expired |
| **Sleepy** (cover half-closed, drooping eyes) | Idle / no recent activity |

**Do:** keep Bun upright and full-color. **Don't:** rotate, desaturate, recolor, or use
a pose for the wrong emotional context. **Don't** animate Bun on a loop during a question —
movement in the periphery is fatiguing over a long session. Bun reacts once, then settles.

---

## 3. Color

A composed, academic palette. **Navy anchors** every screen with authority; **gold marks
achievement**; cool sky tints keep surfaces light and readable. The functional traffic-light
set (green / amber / red) handles answer feedback cleanly without clashing with the brand.

> **Long-session note.** App surfaces are intentionally **off-white, never pure `#ffffff`
> full-bleed**, and the page background is a soft blue-grey (`--paper`). Large pure-white
> fields raise glare and eye fatigue across a 30-minute sitting; the slight tint reads as
> "paper", not "screen". Card surfaces may be white, but they sit *on* `--paper` and stay
> bounded — never edge-to-edge.

### Hero palette
| Token | Hex | Name | Role |
|-------|-----|------|------|
| `--navy` | `#1e3a5f` | Scholar Navy | Brand identity — covers, headers, primary fills |
| `--cerulean` | `#2d7dd2` | Focus Blue | Interactive elements, selected state, links |
| `--gold` | `#f4a22d` | Achievement Gold | Rewards, streaks, correct-answer glow, Bun's spine |
| `--sky` | `#bfdbfe` | Reading Sky | Soft support — tinted surfaces, question card accents |

### Ramps (100 → 700)
- **Navy:** `#dde6f2` `#baccde` `#8aaac5` `#5b89b0` `#2d6898` **`#1e3a5f`** `#112036`
- **Gold:** `#fef3dc` `#fce4a8` `#f9d070` **`#f4a22d`** `#c97e14` `#9a5e08` `#6b3e03`
- **Cerulean:** `#dbeafe` `#bfdbfe` `#93c5fd` `#60a5fa` **`#2d7dd2`** `#1d4ed8` `#1e3a8a`

### Action & neutrals (light theme)
| Token | Hex | Use |
|-------|-----|-----|
| `--navy-edge` | `#112036` | Primary button bottom "lip" |
| `--ink` | `#0f1c2e` | All body text |
| `--ink-soft` | `#4a6080` | Secondary text, question stems |
| `--ink-faint` | `#8da0b8` | Disabled / hints / timer idle |
| `--paper` | `#f5f7fc` | App background (soft, low-glare) |
| `--surface` | `#ffffff` | Cards, question panels (bounded, never full-bleed) |
| `--surface-cool` | `#eef2ff` | Inset surfaces (answer explanation box) |
| `--line` | `#d9e4f0` | Borders / dividers |

### N1 "endgame" accent
`--imperial` `#2d1b69` (deep indigo — reserved for the N1 level chip, echoing the rarity
and prestige of the highest JLPT tier) + `--gold` `#f4a22d`. The pairing reads as distinct
from the cerulean ramp, signalling that N1 is a different category of challenge.

### Functional (system states only — never decoration)
| State | Token (light) | Token (dark) | JP |
|-------|---------------|--------------|----|
| **Correct** | `--good` `#16a34a` | `#4ade80` | 正解 |
| **Almost / partial** | `--warn` `#d97706` | `#fbbf24` | 惜しい |
| **Incorrect** | `--bad` `#dc2626` | `#f87171` | 不正解 |
| **Selected / focus** | `--select` `#2d7dd2` | `#60a5fa` | — |

> Feedback fills use a **10 % tint background + full-strength border/text**, not a saturated
> flood. A full-screen saturated green/red flash is jarring and tiring on repeat; the tint
> is unambiguous without shouting.

### Contrast — the rules that bite
- **Never** put white text on gold or sky — both fail contrast. Use `--navy` or `--ink`.
- **Always** meet WCAG AA: ≥ 4.5 : 1 for body text, ≥ 3 : 1 for large text (≥ `--text-xl`
  bold) and for the answer-state borders.
- In the dark theme, **functional colors switch to the lighter variants** above — the light
  `--good`/`--bad` are too dark to read on a dark surface.

| Pairing | Ratio | Use |
|---------|-------|-----|
| White on Navy | 13 : 1 | Primary buttons, chips |
| Ink on Gold | 8.5 : 1 | Achievement badges |
| Ink on Paper | 18 : 1 | All body text |
| White on Cerulean | AA | Selected state labels |

---

## 4. Typography

| Role | Family | Token | Notes |
|------|--------|-------|-------|
| Display / UI labels | **Outfit** (600/700) | `--f-display` | Headings, buttons, chips, timer. Clean modern letterforms. |
| Body | **Source Sans 3** (400/600) | `--f-body` | Question stems, answer options, explanations. Optimised for dense reading. |
| Japanese | **Noto Sans JP** (500/700) | `--f-jp` | All kana/kanji — comprehensive JLPT coverage. Fallback `"Hiragino Sans"`. |

Japanese content (vocabulary words, readings, example sentences) **always** uses `--f-jp`,
even inline within English explanations.

### Type scale (use the tokens — §11)
Sized for reading at arm's length on a 6.7″ phone, with comfortable line-height for sustained
reading. Each token pairs a size with a default line-height.

| Token | Size / line-height | Use |
|-------|--------------------|-----|
| `--text-xs` | 12 / 1.4 | Timestamps, fine print, table meta |
| `--text-sm` | 14 / 1.5 | Secondary labels, chips, hints |
| `--text-base` | 16 / 1.6 | **Body floor — never go smaller for reading text** |
| `--text-lg` | 18 / 1.6 | Answer options, explanation body |
| `--text-xl` | 20 / 1.5 | **JLPT question stem** — larger to cut misreads |
| `--text-2xl` | 24 / 1.4 | Section headings |
| `--text-3xl` | 30 / 1.3 | Page titles |
| `--text-4xl` | 36 / 1.2 | Score / results hero |
| `--text-5xl` | 48 / 1.1 | Wordmark, target-word focus screens |

### Reading comfort (the long-session rules)
- **Body line-height ≥ 1.6.** Japanese blocks (example sentences, multi-line stems) use
  **`--text-lg`/1.8** — dense glyphs need more leading than Latin text.
- **Cap measure (line length) at ~38–42 Japanese / ~66 Latin characters.** Use `--maxw-read`
  on text containers; long lines are the top driver of reading fatigue.
- **JLPT question text uses `--text-xl` (20 px).** Answer options use `--text-lg` (18 px).
  These are floors on the question screen, not suggestions.
- **Letter-spacing:** default (0) for Japanese; never track Japanese tighter. Display labels
  (Outfit, uppercase chips) may use `+0.04em`.
- **Weight, not size, for emphasis** inside body — bump to 600, don't enlarge, to avoid
  ragged vertical rhythm.

---

## 5. Iconography

Solid, minimal, single-weight — drawn on a **24 px grid** with modest corner radii. Navy
at rest; cerulean when active; gold for reward moments. Prioritise recognisability at small
sizes — JLPT question categories (vocabulary, grammar, reading comprehension) each get a
dedicated icon that must read at 20 px.

Core set: `book-open` (vocabulary), `pencil` (writing), `document-text` (grammar),
`paragraph` (reading comp), `clock` (timer/timed mode), `check-circle` (correct),
`x-circle` (incorrect), `flame` (streak), `star` (score), `chart-bar` (stats).

Interactive icons sit inside a **≥ 48 px hit area** even when the glyph is 20–24 px (§0 rule 3).

---

## 6. App icon & favicon

- **App icon:** Bun's cover centered on a **navy tile** with a gold spine stripe visible
  along the right edge. The eyes are visible at 64 px+; omit them at favicon size.
- **Favicon:** Bun's cover on a **gold tile** — navy-on-gold stays legible in a 16 px
  browser tab where a navy-on-navy tile would disappear.
- **Minimum sizes:** app 64 px · UI 40 px · favicon 24 px.
- **Clear space:** keep a margin equal to the height of Bun's eye on all sides.

---

## 7. Themes — light & dark

Kalima ships **two themes**. Light is the default; dark is a first-class comfort feature for
evening and low-light study, when 30-minute sessions are most fatiguing.

**Switching:** honor `prefers-color-scheme` on first load; let the user override and persist
the choice. Apply the theme by setting `data-theme="light" | "dark"` on `<html>`; all tokens
are theme-scoped (§11) so component code never branches on theme.

### Dark theme rules
- **No pure black background and no pure-white text.** Background is a deep navy-charcoal
  (`--paper` → `#0f1829`); body text is a soft off-white (`--ink` → `#e6edf6`). Pure
  `#000`/`#fff` create harsh halation on OLED and tire the eyes faster than the contrast
  saves.
- **Elevation is by lightness, not shadow.** Cards (`--surface`) are *lighter* than the
  background in dark mode; drop shadows mostly disappear, so a card reads as elevated by being
  a step brighter, with a subtle `--line` border.
- **Functional colors use the lighter variants** (§3) — the light `--good`/`--bad` go muddy
  on dark surfaces.
- **Gold and cerulean stay** as accents but at slightly reduced saturation to avoid glow.
- Re-verify AA contrast in dark mode; soft off-white on `#0f1829` clears it comfortably
  (~14 : 1), but check every accent-on-surface pairing.

The exact dark token values are in §11.

---

## 8. Build checklist (run this for every screen)

1. **Container:** content sits on `--paper`; text and cards capped at `--maxw-read` /
   `--maxw`, centered, with `--space-4` side gutters at the phone baseline (~412 px).
2. **Type:** question stem `--text-xl`, options `--text-lg`, body never below `--text-base`;
   Japanese in `--f-jp`; line-height ≥ 1.6 (1.8 for JP blocks).
3. **Touch:** every interactive element ≥ 48 px tall; ≥ `--space-3` between answer options;
   the **primary action sits in the bottom third** for one-handed thumb reach on a tall phone.
4. **Color:** brand + neutrals from §3 only; functional color reserved for answer state;
   no white-on-gold/sky.
5. **Spacing:** use the `--space-*` scale (§11) — no arbitrary pixel margins.
6. **Motion:** transitions ≤ 150 ms, ease-out, no loops; wrap anything animated in a
   `prefers-reduced-motion: reduce` guard that disables transforms.
7. **Themes:** verify in both light and dark; never hard-code a hex — read the token.
8. **Contrast:** spot-check AA on the primary text and on the answer-state borders.

---

## 9. Components

Components are **clean, rectangular, and exam-paper legible** — no candy brightness. The
primary interaction feel is a subtle **press depth**: primary buttons carry a
`0 4px 0 <edge>` bottom shadow that collapses to `0 1px 0` on `:active` with
`translateY(3px)`. Less springy than a game UI; enough tactility to feel intentional.
**Respect `prefers-reduced-motion`** (drop the translate, keep a color change).

| Button | Fill | Text | Lip | Use |
|--------|------|------|-----|-----|
| **Primary** | `--navy` | white | `--navy-edge` | Submit / Continue / Start exam |
| **Secondary** | `--sky` | navy | `--line` | Skip / Review later |
| **Answer option** | `--surface` | ink | `--line` | Default answer choice |
| **Answer — selected** | `--surface-cool` | cerulean | `--select` | Chosen before reveal |
| **Answer — correct** | `--good` (10 % tint bg) | good | `--good` | Post-reveal correct |
| **Answer — incorrect** | `--bad` (10 % tint bg) | bad | `--bad` | Post-reveal wrong |

- **Answer options:** full-width, ≥ 56 px tall, left-aligned text that **wraps (never
  truncates)** — 用法/synonym options are full sentences. Stack with `--space-3` gaps.
- **JLPT level chips:** N5 → N1 ramps from calm green through navy to imperial purple + gold
  at the top. Pill-shaped, Outfit 700, white text on N3+, ink on lighter N5/N4 chips.
- **Question card:** `--surface`, `--r-lg` radius, `--shadow` elevation (light theme),
  cerulean 3 px left-edge accent stripe. Question number in `--ink-faint`; stem in `--ink`
  at `--text-xl`; vocabulary target word in `--f-jp` 700 at `--text-2xl`+.
- **Timer bar:** thin (4 px) track spanning the top of the question card. Fills full
  cerulean → amber (`--warn`) → red (`--bad`) as time runs out. A **slow, continuous** drain,
  never a per-second flash. Disappears between questions.
- **Explanation panel:** `--surface-cool` inset box below the answer reveal. Noto Sans JP for
  the target reading; Source Sans 3 for the English gloss and usage note; body line-height
  1.6+.
- **Progress / score:** rounded track (`--sky`), navy fill, percentage label in Outfit 700.

---

## 10. Layout & breakpoints

The Nothing Phone 3a (~412 × 915 CSS px) is the design canvas; the 6.1″ phone (402 px wide)
is the floor that must not clip; everything above is a cap-and-center adjustment.

| Breakpoint | Width | Behavior |
|-----------|-------|----------|
| **Base (phone)** | < 640 px | Single column, `--space-4` side gutters, full-width controls. Design here first. |
| **sm (large phone)** | ≥ 640 px | Same single column; let cards breathe with a touch more padding. |
| **md (tablet)** | ≥ 768 px | Cap reading width at `--maxw-read`, center. Do not introduce multi-column question flows. |
| **lg (desktop)** | ≥ 1024 px | Cap the shell at `--maxw`, center. Generous side whitespace is correct, not wasted. |

- **One question is one column, always.** Never split a question and its options across
  columns, even on desktop — it breaks the exam-paper reading model.
- **Thumb zone:** on tall phones, keep the primary action reachable in the lower third;
  avoid top-anchored "Submit" buttons.
- **Safe areas:** pad for notch / home indicator with `env(safe-area-inset-*)`.

---

## 11. Design tokens (CSS custom properties)

Drop-in blocks. Use these verbatim. Theme-scoped tokens live under `[data-theme=…]`;
structural tokens (scale, radius, type) are theme-independent.

```css
:root {
  /* ── hero palette (theme-independent brand) ── */
  --navy: #1e3a5f;
  --cerulean: #2d7dd2;
  --gold: #f4a22d;
  --sky: #bfdbfe;

  /* ── ramps ── */
  --navy-100: #dde6f2; --navy-200: #baccde; --navy-300: #8aaac5;
  --navy-400: #5b89b0; --navy-500: #2d6898; --navy-600: #1e3a5f; --navy-700: #112036;

  --gold-100: #fef3dc; --gold-200: #fce4a8; --gold-300: #f9d070;
  --gold-400: #f4a22d; --gold-500: #c97e14; --gold-600: #9a5e08; --gold-700: #6b3e03;

  --cer-100: #dbeafe; --cer-200: #bfdbfe; --cer-300: #93c5fd;
  --cer-400: #60a5fa; --cer-500: #2d7dd2; --cer-600: #1d4ed8; --cer-700: #1e3a8a;

  --imperial: #2d1b69;   /* N1 accent */
  --navy-edge: #112036;  /* primary button lip */

  /* ── type scale (size / line-height) ── */
  --text-xs:   0.75rem;  --lh-xs:   1.4;
  --text-sm:   0.875rem; --lh-sm:   1.5;
  --text-base: 1rem;     --lh-base: 1.6;
  --text-lg:   1.125rem; --lh-lg:   1.6;
  --text-xl:   1.25rem;  --lh-xl:   1.5;
  --text-2xl:  1.5rem;   --lh-2xl:  1.4;
  --text-3xl:  1.875rem; --lh-3xl:  1.3;
  --text-4xl:  2.25rem;  --lh-4xl:  1.2;
  --text-5xl:  3rem;     --lh-5xl:  1.1;
  --lh-jp: 1.8;          /* multi-line Japanese blocks */

  /* ── spacing scale (4px base) ── */
  --space-1: 0.25rem; --space-2: 0.5rem;  --space-3: 0.75rem; --space-4: 1rem;
  --space-5: 1.25rem; --space-6: 1.5rem;  --space-8: 2rem;    --space-10: 2.5rem;
  --space-12: 3rem;   --space-16: 4rem;

  /* ── shape ── */
  --r-lg: 16px; --r-md: 10px; --r-sm: 6px;
  --maxw: 1120px;       /* desktop shell cap */
  --maxw-read: 42rem;   /* reading-measure cap for text + question columns */
  --tap-min: 48px;      /* minimum interactive target */

  /* ── fonts ── */
  --f-display: "Outfit", system-ui, sans-serif;
  --f-body: "Source Sans 3", system-ui, sans-serif;
  --f-jp: "Noto Sans JP", "Hiragino Sans", sans-serif;
}

/* ── LIGHT THEME ── */
:root,
[data-theme="light"] {
  --ink: #0f1c2e; --ink-soft: #4a6080; --ink-faint: #8da0b8;
  --paper: #f5f7fc; --surface: #ffffff; --surface-cool: #eef2ff; --line: #d9e4f0;

  --good: #16a34a; --good-edge: #15803d;
  --warn: #d97706;
  --bad: #dc2626;
  --select: #2d7dd2;

  --shadow: 0 8px 24px -8px rgba(15, 28, 46, 0.18);
}

/* ── DARK THEME (evening / low-light comfort) ── */
[data-theme="dark"] {
  --ink: #e6edf6; --ink-soft: #a7b8d0; --ink-faint: #6b7d99;
  --paper: #0f1829;      /* deep navy-charcoal, not black */
  --surface: #182438;    /* one step lighter than paper = elevated */
  --surface-cool: #1e2c44;
  --line: #2a3a54;

  /* lighter functional variants for legibility on dark surfaces */
  --good: #4ade80; --good-edge: #22c55e;
  --warn: #fbbf24;
  --bad: #f87171;
  --select: #60a5fa;

  /* elevation reads via lightness, so shadow is minimal */
  --shadow: 0 8px 24px -10px rgba(0, 0, 0, 0.5);
}

/* ── motion safety ── */
@media (prefers-reduced-motion: reduce) {
  * { animation: none !important; transition-duration: 0.01ms !important; }
}
```

Fonts load from Google Fonts: `Outfit` (400–700), `Source Sans 3` (400–700),
`Noto Sans JP` (400–700). Preload the JP subset used by the active level to avoid a
first-paint glyph swap mid-question.

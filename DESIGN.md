---
name: مِيزان (Mizan)
description: Sharia-compliance review of bank contracts, issued as a numbered, security-printed instrument.
colors:
  paper: "#ecebe8"
  paper-bright: "#f4f4f0"
  violet: "#3a2b8c"
  violet-deep: "#2c1f73"
  violet-soft: "#8a7ec2"
  ink: "#14194a"
  ink-soft: "#3d4270"
  seal: "#c4302b"
typography:
  display:
    fontFamily: "Readex Pro, system-ui, sans-serif"
    fontSize: "clamp(2.1rem, 1.3rem + 2.9vw, 4.2rem)"
    fontWeight: 500
    lineHeight: 1.14
    letterSpacing: "-0.015em"
  headline:
    fontFamily: "Readex Pro, system-ui, sans-serif"
    fontSize: "clamp(1.9rem, 1.4rem + 1.6vw, 2.8rem)"
    fontWeight: 500
    lineHeight: 1.15
  principle:
    fontFamily: "Readex Pro, system-ui, sans-serif"
    fontSize: "clamp(1.4rem, 1.1rem + 0.8vw, 1.9rem)"
    fontWeight: 500
    lineHeight: 1.45
  document:
    fontFamily: "Markazi Text, serif"
    fontSize: "clamp(1.6rem, 1.2rem + 1vw, 2.1rem)"
    fontWeight: 400
    lineHeight: 1.62
  document-row:
    fontFamily: "Markazi Text, serif"
    fontSize: "1.32rem"
    fontWeight: 400
    lineHeight: 1.6
  title:
    fontFamily: "Readex Pro, system-ui, sans-serif"
    fontSize: "1.45rem"
    fontWeight: 600
    lineHeight: 1.3
  body:
    fontFamily: "Readex Pro, system-ui, sans-serif"
    fontSize: "1.2rem"
    fontWeight: 400
    lineHeight: 1.8
  label:
    fontFamily: "Readex Pro, system-ui, sans-serif"
    fontSize: "0.88rem"
    fontWeight: 600
    lineHeight: 1.5
  serial:
    fontFamily: "Readex Pro, system-ui, sans-serif"
    fontSize: "0.9rem"
    fontWeight: 400
    lineHeight: 1
    letterSpacing: "0.08em"
    fontFeature: "tnum"
rounded:
  none: "0"
  hairline: "2px"
  pill: "999px"
  seal: "50%"
spacing:
  gutter: "clamp(20px, 5vw, 88px)"
  section-block: "clamp(64px, 8vw, 120px)"
  split-gap: "clamp(40px, 6vw, 112px)"
  grid-gap: "clamp(24px, 3vw, 48px)"
  slip-pad: "clamp(24px, 3vw, 40px)"
  row-pad: "18px 22px"
  row-gap: "12px"
  container: "1360px"
components:
  stub-button:
    backgroundColor: "{colors.violet}"
    textColor: "{colors.paper-bright}"
    rounded: "{rounded.none}"
    typography: "{typography.title}"
    padding: "0 44px"
    height: "60px"
  stub-button-paper:
    backgroundColor: "{colors.paper-bright}"
    textColor: "{colors.violet}"
    rounded: "{rounded.none}"
    padding: "0 22px"
    height: "48px"
  instrument-slip:
    backgroundColor: "{colors.paper-bright}"
    textColor: "{colors.ink}"
    rounded: "{rounded.none}"
    padding: "{spacing.slip-pad}"
  clause-row:
    backgroundColor: "{colors.paper-bright}"
    textColor: "{colors.ink}"
    rounded: "{rounded.none}"
    padding: "{spacing.row-pad}"
  filter:
    textColor: "{colors.ink}"
    rounded: "{rounded.none}"
    padding: "0 14px"
    height: "44px"
  filter-active:
    textColor: "{colors.ink}"
    rounded: "{rounded.none}"
    height: "44px"
  link-button:
    textColor: "{colors.violet}"
    padding: "8px 4px"
  pending-mark:
    textColor: "{colors.violet}"
    rounded: "{rounded.pill}"
    padding: "6px 16px"
  header-strip:
    backgroundColor: "{colors.violet}"
    textColor: "{colors.paper-bright}"
    padding: "14px clamp(16px, 4vw, 48px) 20px"
---

# Design System: مِيزان (Mizan)

## Overview

**Creative North Star: "The Sealed Instrument"**

Every screen is an official instrument that has been security-printed and then stamped: a sheet of cool security paper, a drenched stamp-violet field engraved with guilloche, perforated slips carrying serials, and rubber-stamp impressions that carry the verdict. The system draws on two real material worlds, the Sharia committee's decision instrument and a bank's security printing, and takes both literally. Paper has fibre (a tiled raster ground). Violet fields have engraving. Slips have notched ends. Stamps have ink grain and a slight rotation. Words inside a stamp are live text inked through a noise mask, never baked into the image.

The landing (Persuade) uses the full expression: a banknote-face hero measured one-to-one from the approved comp, drenched violet sections, one orchestrated print-in sequence. The review app (Operate) is the same world, quieter. It has a violet header strip with a perforation rule, paper slips in a register, stamp-typed filters and no spectacle, so that the register can be scanned quickly. Arabic is the primary reading direction. English mirrors the same instrument through logical properties, not a second layout.

Depth is physical and shallow. Paper slips lift off the page with a soft, low, ink-tinted shadow. Instruments carry a double hairline rule inset in violet. The palette is restrained: violet carries the brand and all marks, blue-black intaglio ink carries the text, and one red exists only for one verdict.

**Key Characteristics:**
- Cool security paper (never cream) with a tiled fibre raster; violet fields tiled with their own engraved raster.
- Verdict states are marks (shapes of stamp), not hues. Red belongs to one state only.
- Perforation and notched-edge masks form the shape language. Corners are square.
- Two faces: Readex Pro for the interface voice, Markazi Text for anything quoted from a document.
- A single exponential ease-out drives all motion. The stamp press is the one moment of impact.
- RTL-first, mirrored by logical properties. Serials and ids are isolated with `bdi`.

## Colors

The palette is cool paper plus two inks and a reserved seal red. Opacity steps of violet (on paper) supply every rule, tint and highlight.

### Primary
- **Stamp Violet** (`violet`): the brand ink. It fills drenched fields (hero band, inversion section, review header, the primary stub button) under the violet-ground raster. It is also the ink of every stamp except the non-compliant one, and of serials, labels, links, focus rings, selection and the scrollbar thumb. At low alpha on paper it gives hairlines (0.16 to 0.35), tints (0.06 to 0.12) and highlighter bands (0.16 to 0.22).
- **Deep Violet** (`violet-deep`): pressed and active text only (active sort segment, a highlighted matched passage).
- **Guilloche Violet** (`violet-soft`): the line tint for engraving drawn on paper. On violet fields, the guilloche is drawn in paper-white at 0.27 alpha (lines) and 0.34 alpha (micro-text).

### Tertiary
- **Seal Red** (`seal`): the ink of the «يُرجَّح عدم مطابقته» stamp. The same state also uses it for its active filter (red 0.08 fill, 2px red inset) and for error messages (text plus a 1px red inset at 0.5 alpha).

### Neutral
- **Security Paper** (`paper`): the page ground, always under the paper-ground raster at 512px.
- **Bright Paper** (`paper-bright`): slips, instruments, stub buttons on violet, reversed text on violet, and the selection text colour.
- **Intaglio Ink** (`ink`): running text and document quotes. Punched register holes use it at 0.72 alpha, and every shadow is tinted with it.
- **Soft Ink** (`ink-soft`): secondary body text, notes, legends, metric explanations and placeholder states.

### Named Rules
**The One Red Rule.** Seal red means «يُرجَّح عدم مطابقته» and nothing else. It may mark that stamp, its filter and a true error, and it is never used for decoration, emphasis or brand. Every other state is violet.

**The Marks Not Hues Rule.** A state is read from the shape of its stamp: struck red frame for likely non-compliant, open bracket for needs human review, empty dashed seal for no sufficient basis, round seal for compliant. Never add a colour-coded chip or badge next to a stamp.

**The Never Cream Rule.** Paper is cool and neutral. Do not warm the ground toward ivory or beige.

## Typography

**Display / UI Font:** Readex Pro (Arabic and Latin; with system-ui, sans-serif fallback)
**Document Font:** Markazi Text (Arabic and Latin; with serif fallback)

**Character:** Readex is the voice of the instrument: its labels, headings and verdict words. Markazi is the voice of the document under review: contract clauses, committee decisions and suggested wording. The switch between the two faces tells the reader whether they are reading Mizan or reading the source. Numerals are tabular everywhere, and Arabic pages use Arabic-Indic digits.

### Hierarchy
- **Wordmark**: not type. It is a raster plate (square-Kufic «مِيزان»), placed as an image inside the h1 with the name as alt text.
- **Display** (500, clamp 2.1 to 4.2rem, 1.14; letter-spacing -0.015em, balanced, max 18ch or 24ch wide): section headings.
- **Headline** (500, clamp 1.9 to 2.8rem, 1.15): app screen titles such as the intake card.
- **Principle** (500, clamp 1.4 to 1.9rem, 1.45, violet, 22ch): a single stated doctrine inside a section.
- **Document** (Markazi 400, clamp 1.6 to 2.1rem, 1.62): a quoted clause in an instrument. Citations and quotes use 1.35 to 1.9rem at 1.7 to 1.75.
- **Document row** (Markazi 400, 1.32rem, 1.6; 1.2rem on narrow screens): clause text in the review register.
- **Title** (600, 1.45rem): pipeline step titles and stub-button labels (1.2rem in the app).
- **Body** (400, 1.2rem, 1.8, soft ink, max 62ch; lead 1.32rem): explanatory prose. Notes use 0.98rem at 1.7, 70ch.
- **Label** (500 to 600, 0.88 to 0.98rem, violet): instrument headers, detail labels, disclosure summaries, provenance tickets.
- **Serial** (400, 0.88 to 0.95rem, letter-spacing 0.04 to 0.08em, violet, set LTR in `bdi`): slip and document numbers such as 0004.
- **Stamp word** (600, set per stamp; id line at 0.78em, 500): verdict text inked inside a stamp plate.

### Named Rules
**The Harakat Headroom Rule.** When `html[lang="ar"]`, display line-height rises to 1.42, principle line-height to 1.6 and the intake headline to 1.4, so that a damma or shadda never touches the line above. Latin keeps the tight value.

**The Two Voices Rule.** Text quoted from a contract or committee decision is always set in Markazi. Anything Mizan says in its own voice is set in Readex. Never mix them within one run.

## Layout

Two spatial models run side by side.

**The hero is a measured plate.** It is written in comp pixels. A single unit `--px = max(min(100cqw / 1536, 100svh / 940), 100cqw / 1536 * 0.72)` (container query units on the hero) scales the 1536×1024 composition, so the whole instrument stays in the first viewport and never shrinks below 72% of width-fit. Navigation chrome uses a pure width unit (`100cqw / 1536`) so it stays pinned to the page edges. Every box is `calc(N * var(--px))` and every horizontal offset uses `inset-inline-start`, so English mirrors the plate. At 820px and below the plate dissolves into flow: the violet field becomes a padded block (124px 20px 40px), the rosette drops behind the text at 0.55 opacity, and the stubs stack in a 16px-gap grid.

**Sections are document flow.** Each section takes at least 100svh and is centred vertically, with block padding `section-block` and a 1360px container with `gutter` inline padding. A 5:7 split (`split-gap`) pairs copy (34rem) with evidence. Twin-column grids use `grid-gap`. Everything collapses to one column at 900px, where sections drop their min-height. The review workspace is a 300px sticky summary column beside a fluid register (max 1400px), and collapses at 900px.

**The Mirror Rule.** Direction is flipped by `dir`, never by duplicated layouts. Use `inset-inline-*`, `margin-inline-*`, `padding-inline-*`, `text-align: start/end` and `max-inline-size`. The only permitted physical overrides are direction-aware ones keyed on `[dir="ltr"]`: the stub slide origin, the engrave wipe, the tear-line side and the flip of the back-arrow icon. Serials and ids are wrapped in `bdi` with an explicit direction.

**The Presenter Rule.** Every full section carries `data-section`, so that arrow and Page keys step through the page as a projector sequence (smooth unless reduced motion is requested).

## Elevation & Depth

Depth is paper on paper: soft, low, ink-tinted and never glowing. Slips lift slightly. Instruments are framed by inset hairlines rather than raised further. Drenched violet sections cast a deeper shadow under the paper chain they carry.

### Shadow Vocabulary
- **Slip lift** (`0 1px 2px rgb(20 25 74 / 0.05), 0 14px 28px -22px rgb(20 25 74 / 0.3)`): review register rows.
- **Instrument** (`0 1px 2px rgb(20 25 74 / 0.06), 0 24px 48px -28px rgb(20 25 74 / 0.28)`): document slips and the loupe panel.
- **Intake card** (`0 28px 60px -34px rgb(20 25 74 / 0.35)`): the one floating card of the app.
- **Hero stub** (`drop-shadow` 1/1.5px at 0.08 plus 10/18px at 0.07, in comp px): follows the notched mask.
- **Chain on violet** (`drop-shadow(0 18px 30px rgb(10 6 40 / 0.35))`).
- **Double rule** (`inset 0 0 0 1px violet/0.28, inset 0 0 0 6px paper-bright, inset 0 0 0 7px violet/0.16`): the engraved border of instruments and the intake card.
- **Embossed text** (`text-shadow 0 1px 0 rgb(255 255 255 / 0.9)`): only beside the blind dry seal.

### Named Rules
**The Filter Shadow Rule.** Any masked (notched or perforated) shape takes its shadow from `filter: drop-shadow` on a parent, never from `box-shadow`, which the mask would clip.

## Shapes

Corners are square (0). The form language comes from print finishing, not radii.

- **Notched stub edge**: a pair of `radial-gradient` masks (`--notch` radius, `--pitch` repeat, split at 51%) punch half-circle notches down both inline ends of a slip or button. Hero slips 6/22 comp px, hero CTA 4/9, app demo button 6/15, closing stub 7/18. The pipeline chain notches its block edges instead (6/20) and drops the mask on narrow screens.
- **Perforation strip**: a repeated radial dot (45% to 50% stop) in paper-white along the top of the violet field (16.25 comp px pitch) and under the app header (12px pitch, 0.8 alpha).
- **Tear line**: a 2×9px dotted violet (0.45) rule between adjacent stubs, which turns horizontal when they stack.
- **Dashed inner rule**: a 1px dashed violet (0.45) rule inset inside the paper CTA. Dashed violet borders also mark the drop zone, the disclosure seams in the register and the provenance ticket.
- **Bracket frame**: a 1.5px violet inset whose top and bottom centres are cut out by a mask, so that only corner brackets remain (suggested wording).
- **Circles**: only for seals, the loupe ring and punched-out register holes (`seal`). **Pill**: only for the rotated (-3deg) dashed «pending» mark. **Hairline radius**: 2px on focus rings and highlighter marks.

## Components

### Stub Buttons (primary action)
Tactile tickets, never rounded pills.
- **Shape:** square with notched inline ends (see Shapes). There is no border.
- **Violet stub:** violet raster fill, bright-paper 600 text, 60px tall with 44px inline padding in the app. The closing stub uses 26px 64px padding and clamp 1.3 to 1.7rem text.
- **Paper stub (hero CTA on violet):** bright-paper raster fill, violet 600 text and a dashed inner rule. It sizes to its label in English.
- **Hover / Active:** lifts 1 to 2px (`translateY`) over 160 to 180ms ease-out. Press is `scale(0.97 to 0.98)` at 80ms. Focus uses the global 2px violet outline at a 3px offset.

### Text Buttons and Links
Violet 600 text with an underline offset of 0.3em (links 0.25em). Hit area is at least 44px in the app bar. The language toggle is a bare label that underlines on hover.

### Instrument Slips (cards)
- **Corner Style:** square.
- **Background:** bright paper over the fibre raster.
- **Shadow Strategy:** double rule plus the instrument shadow.
- **Header:** a label row with the serial on the far side, then a 1px violet (0.22) rule.
- **Internal Padding:** `slip-pad`.

### Review Register Row
Clause stub in a 64px / fluid / 176px grid (serial, Markazi text, stamp). It carries the slip-lift shadow and a 1px violet (0.18) inset. A dashed seam opens a `details` panel (reason, quote, suggested wording in the bracket frame). The quote block uses a violet 0.06 tint, and matched spans get a 55% highlighter band at violet 0.22.

### Filters (stamp types)
Rows at least 44px tall with a 1px violet (0.2) inset and a small stamp plate as the leading mark, plus a tabular count. Hover adds a violet 0.06 tint. The pressed state adds a violet 0.1 tint and a 2px violet inset, and the non-compliant filter swaps both to seal red. Disabled filters drop to 0.45 opacity. Sort is a two-segment inset toggle (active segment violet 0.12, violet-deep 600).

### Inputs / Drop Zone
A 1.5px dashed violet (0.45) field with an authored upload icon. While dragging, it tints violet 0.07 and the border turns solid violet (160ms). Errors are seal-red text in a 1px red inset.

### Navigation / Header Strip
The app bar is a violet raster strip with a paper perforation rule 7px from its bottom edge. It has three parts: the wordmark plate (38px tall), the title (hidden below 900px) and links. In the hero, chrome is part of the plate: the perforation strip, the language toggle and the paper stub CTA.

### Stamp (signature)
A verdict impression. The plate is a transparent raster of the frame only (stamp-red, stamp-bracket, stamp-dashed, stamp-round). The verdict word and the cited unit id are live text, rotated -4 to -8deg to match the plate and inked through the `ink-grain` noise mask. The cited id appears only on the non-compliant stamp. Size is set by `--stamp-w` and `--stamp-font`.
- **Press:** `0% opacity 0, scale 1.45–1.5, blur 2px → 62% opacity 1, scale 0.97 → 100% scale 1`, 480 to 520ms, exponential ease-out. Stamps below the fold are armed by script and pressed when they scroll into view (staggered 120ms per index, with a 12s fallback that presses everything). Without script they simply stay visible.

### Verification Loupe (signature)
A circular lens (radius 92px, magnification 2.35) over a panel of engraved decision text (Markazi 12.5px at violet 0.5). Inside the lens, a magnified layer clipped by `circle()` shows the same text in full ink, with the matched term in 700 violet and a 2px underline. The lens follows the pointer on a critically damped spring (stiffness 260, damping 32, mass 0.9) and glides to rest on the matched term on load and when the pointer leaves. Hovering a matched passage in the clause lights its pair in the decision (violet-deep on a 0.22 tint, 180ms). The ring is a 2px violet stroke with a white inner hairline and a soft ink shadow. Under reduced motion the spring becomes instant.

### Guilloche Field
An SVG of sine waves (19px gap, 340px wavelength, 11px amplitude, phase drift 0.35 per line) drawn in paper-white 0.27 at 0.85px. Every other line carries Arabic micro-text on a `textPath` (8px, 0.34). The micro-text runs with `direction="ltr"` so that the RTL run renders, and the word keeps its Arabic shaping. Rosette, wordmark, dry seal and grounds are raster plates with embedded provenance in `public/assets/plates/*.json`.

### Motion Grammar
One curve: `--ease-out: cubic-bezier(0.16, 1, 0.3, 1)`. The hero prints itself once. The wordmark is engraved by a clip wipe from the reading start (1100ms). The tagline rises. Slips stream in from the reading side, 56 comp px, staggered 160ms. Then each stamp is pressed (180ms apart). App rows slide up 8px (420ms) and a scanning placeholder breathes. All content is visible by default. Animation runs only under `prefers-reduced-motion: no-preference`, and reduced motion gives instant final states.

## Do's and Don'ts

### Do:
- **Do** put the paper-ground raster (512px) under every paper surface and the violet-ground raster (640px) under every violet field; flat fills alone read as a web app.
- **Do** express each verdict with its stamp plate and live inked text, rotated to match the plate.
- **Do** reserve seal red for «يُرجَّح عدم مطابقته», its filter and true errors.
- **Do** set document text in Markazi and interface text in Readex, with tabular numerals.
- **Do** raise Arabic line-height for display (1.42) and principle (1.6) text so harakat clear the line above.
- **Do** write horizontal positions with logical properties and isolate serials and ids in `bdi`.
- **Do** shape primary actions as notched stubs and shadow masked shapes with `filter: drop-shadow`.
- **Do** use the single exponential ease-out and gate every animation behind `prefers-reduced-motion: no-preference`, with content visible by default.
- **Do** keep hero geometry in comp units (`calc(N * var(--px))`) when extending the first viewport.

### Don't:
- **Don't** use seal red for any state other than likely non-compliant, or as an accent.
- **Don't** add colour-coded chips, badges or dots for verdict states; the stamp shape is the state.
- **Don't** warm the paper toward cream or ivory.
- **Don't** round the corners of slips, instruments, buttons or filters.
- **Don't** bake verdict words or ids into stamp images; the plates are frames only.
- **Don't** use box-shadow on notched or perforated shapes.
- **Don't** add glow or glassy backdrop blur; depth is paper-soft and ink-tinted, and gradients appear only as print devices (notch and perforation masks, highlighter bands, tear lines).
- **Don't** mirror the page with duplicated RTL/LTR layouts or physical `left`/`right` offsets outside the direction-aware overrides.

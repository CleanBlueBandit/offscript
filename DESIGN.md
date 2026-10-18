---
name: Offscript
description: A light, restrained workspace for exploring and developing ideas.
colors:
  primary: "#2864d8"
  primary-hover: "#1c52bc"
  primary-soft: "#edf3ff"
  canvas: "#faf9f6"
  surface: "#ffffff"
  surface-subtle: "#f2f1ed"
  sidebar: "#f0efeb"
  tray: "#f5f4f0"
  border: "#e5e4df"
  text: "#242729"
  muted: "#6e706f"
  success: "#39835c"
typography:
  display:
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
    fontSize: "36px"
    fontWeight: 600
    lineHeight: 1.15
    letterSpacing: "-1.2px"
  headline:
    fontSize: "18px"
    fontWeight: 600
    letterSpacing: "-0.35px"
  title:
    fontSize: "17px"
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: "-0.3px"
  body:
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.5
  control:
    fontSize: "13px"
    fontWeight: 500
  supporting:
    fontSize: "12px"
    fontWeight: 400
    lineHeight: 1.65
  label:
    fontSize: "11px"
    fontWeight: 450
  compact:
    fontSize: "10px"
    fontWeight: 400
rounded:
  badge: "5px"
  compact: "7px"
  control: "8px"
  workspace: "10px"
  icon: "11px"
  item: "12px"
  panel: "14px"
spacing:
  tight: "4px"
  small: "8px"
  medium: "12px"
  control: "14px"
  content: "16px"
  card: "20px"
  section: "24px"
  panel: "28px"
  gutter: "36px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.surface}"
    typography: "{typography.control}"
    rounded: "{rounded.control}"
    padding: "9px 14px"
  button-primary-hover:
    backgroundColor: "{colors.primary-hover}"
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    typography: "{typography.control}"
    rounded: "{rounded.control}"
    padding: "9px 14px"
  search-field:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    rounded: "{rounded.control}"
    padding: "0 11px"
  perspective-card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    rounded: "{rounded.panel}"
    padding: "21px 20px 12px"
  ingredient-selected:
    backgroundColor: "{colors.primary-soft}"
    rounded: "{rounded.compact}"
    padding: "14px 34px 15px 8px"
---

# Design System: Offscript

## Overview

**Creative North Star: "Light Apple-style workspace"**

Warm white surfaces, generous spacing, and restrained color express the direction selected by the user. The interface is a working environment: readable ideas and clear actions take precedence over decoration. System typography and familiar controls make the workspace feel calm and direct.

One reusable system covers the briefing forms, perspectives, idea canvas, evaluation panels, settings, and invitations. The page heading introduces the current task without decorative orbit artwork or a separate promotional hero.


**Key Characteristics:**
- Warm surfaces and dark, readable type.
- Blue for primary actions, focus, and selection.
- Spacious cards with simple ingredient rows.
- Familiar controls and restrained, accessible motion.

## Colors

The palette combines warm neutral surfaces with one clear action color. The frontmatter records the normative values extracted from `app/globals.css`.

### Primary

Action blue identifies the main next step. Its deeper variant supplies hover feedback; the pale blue surface marks collected ingredients. Blue checks and outlines reinforce selection without relying on the background alone.

### Neutral

Warm canvas, white content surfaces, and subtly darker sidebar and tray surfaces establish structure. Primary text carries reading content; muted text carries supporting explanation and metadata. Fine neutral borders separate neighboring regions.

Small category icons and dots retain their muted family colors. Green is available for positive status; these semantic accents do not replace the primary action color.

## Typography

The system font stack uses the platform's native face, with optical sizing enabled. Medium and semibold weights create hierarchy without adding another font family. Large headings tighten tracking; body copy keeps natural spacing.

Page headings use the display role and reduce to 32px or 30px on smaller layouts. Section headings use the headline role. Perspective titles use the title role; ingredient text is 14px with 1.6 leading. Supporting explanation is generally 12–14px; compact metadata is 11px. Controls use sentence case and a readable 13px default.

## Layout

At a 1440px desktop viewport, the workspace has a 216px navigation rail, a 302px synthesis tray, and two perspective columns. The main region has 36px horizontal gutters; cards use a 20px gap. The top bar is 68px tall. The tray remains available beside the exploration content and keeps its primary action at the bottom.

At 1650px and above, the perspective grid expands to three columns, the tray becomes 320px, and main padding grows. At 1249px and below, the grid becomes one column and the side regions narrow. At 999px and below, navigation moves behind a menu control. At 700px and below, the tray follows the content, the workspace uses 20px gutters, and a fixed collection shortcut provides access to the next step. Forms and evaluation grids stack on smaller screens.

Preserve the hierarchy of page heading, brief context, toolbar, filters, and working content. Use the shared spacing and components across all four stages.

## Elevation & Depth

Tonal separation and fine borders provide most of the depth. Perspective cards remain flat at rest. Small collected items and canvas controls receive a subtle shadow; dialogs, drawers, and mobile floating controls use stronger shadows because they overlap content. Do not add glass or floating effects to ordinary panels.

## Shapes

Controls have softly curved corners; panels use the larger panel radius. Ingredient rows sit inside their parent card with quiet dividers, not a second layer of raised boxes. Round checks communicate collection state. Rounded shapes remain functional rather than ornamental.

## Components

### Buttons

Primary buttons use action blue with white text. Secondary buttons use white surfaces and neutral borders. Standard buttons have a 40px minimum height; compact variants use 34px, icon buttons use 36px, and the tray action uses 43px. Press feedback is immediate. Keyboard focus uses a visible blue outline with space around the control.

### Inputs / Fields

Search fields use a white surface, quiet border, and an accent focus treatment. Form fields use a nearly white surface, generous internal padding, and readable body text. Keep labels visible; placeholders supplement them.

### Navigation / Chips

Navigation combines a concise label and a small icon. The active stage uses a pale blue fill and stronger text. Category filters use a quiet neutral selected fill; small colored dots identify categories. Horizontal category scrolling preserves readable labels on narrow screens.

### Cards / Containers

Perspective cards pair a compact family icon with a clear title, then an explanatory axiom and three ingredient rows. Hover slightly changes the border. Collected ingredients receive the pale blue surface and a filled check. Star controls become visible on hover or keyboard focus and remain visible on touch devices. Reuse the same panel language for briefing and evaluation.

### Synthesis Tray / Idea Canvas

The tray uses a warm inset surface and white collected items. The selection count, source attribution, removal control, and next action remain easy to scan. The canvas uses light React Flow controls, a neutral dot grid and edges, blue selection, and a legible minimap. Dragging and node positions remain direct and persistent. Connection handles use 22px circles with expanded hit areas and a 36px snapping radius. An inline canvas hint explains drag-or-click linking; manual lines use blue arrowed paths and expose a removal action when selected. Manual connections persist independently from mutation ancestry.

### Motion / Accessibility

Default color and border feedback takes 160ms with ease-out. Perspective reroll feedback uses a short 180ms opacity transition. Canvas fitting takes 300ms and becomes instant when reduced motion is requested; animated edges also stop. Global reduced-motion styles suppress decorative animation, reduced-transparency styles simplify overlays, and increased-contrast styles strengthen text and borders. Preserve keyboard focus and existing dialog focus management.

## Do's and Don'ts

### Do:
- **Do** keep the same warm surfaces, system typography, and blue action language across every stage.
- **Do** use space, type weight, and clear grouping before adding more borders.
- **Do** preserve visible keyboard focus, touch-accessible controls, and reduced-motion behavior.
- **Do** keep category colors secondary to reading and selection.

### Don't:
- **Don't** restore decorative orbit illustrations or promotional hero artwork to the workspace.
- **Don't** shrink idea text to make more columns fit.
- **Don't** nest raised cards around each ingredient row.
- **Don't** use saturated color across large resting surfaces.

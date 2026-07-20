---
name: Industrial Precision
colors:
  surface: '#f7f9fb'
  surface-dim: '#d8dadc'
  surface-bright: '#f7f9fb'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f2f4f6'
  surface-container: '#eceef0'
  surface-container-high: '#e6e8ea'
  surface-container-highest: '#e0e3e5'
  on-surface: '#191c1e'
  on-surface-variant: '#45474c'
  inverse-surface: '#2d3133'
  inverse-on-surface: '#eff1f3'
  outline: '#75777d'
  outline-variant: '#c5c6cd'
  surface-tint: '#545f73'
  primary: '#091426'
  on-primary: '#ffffff'
  primary-container: '#1e293b'
  on-primary-container: '#8590a6'
  inverse-primary: '#bcc7de'
  secondary: '#006c49'
  on-secondary: '#ffffff'
  secondary-container: '#6cf8bb'
  on-secondary-container: '#00714d'
  tertiary: '#041528'
  on-tertiary: '#ffffff'
  tertiary-container: '#1a2a3e'
  on-tertiary-container: '#8191a9'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#d8e3fb'
  primary-fixed-dim: '#bcc7de'
  on-primary-fixed: '#111c2d'
  on-primary-fixed-variant: '#3c475a'
  secondary-fixed: '#6ffbbe'
  secondary-fixed-dim: '#4edea3'
  on-secondary-fixed: '#002113'
  on-secondary-fixed-variant: '#005236'
  tertiary-fixed: '#d3e4fe'
  tertiary-fixed-dim: '#b7c8e1'
  on-tertiary-fixed: '#0b1c30'
  on-tertiary-fixed-variant: '#38485d'
  background: '#f7f9fb'
  on-background: '#191c1e'
  surface-variant: '#e0e3e5'
typography:
  display-lg:
    fontFamily: Inter
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 40px
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
    letterSpacing: -0.01em
  headline-sm:
    fontFamily: Inter
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
  body-lg:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  body-sm:
    fontFamily: Inter
    fontSize: 13px
    fontWeight: '400'
    lineHeight: 18px
  label-md:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.05em
  label-sm:
    fontFamily: Inter
    fontSize: 11px
    fontWeight: '500'
    lineHeight: 14px
  mono-data:
    fontFamily: JetBrains Mono
    fontSize: 13px
    fontWeight: '450'
    lineHeight: 20px
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  base: 4px
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 32px
  container-max: 1440px
  gutter: 20px
---

## Brand & Style

The design system is engineered for high-density data environments, specifically tailored for the complexities of clothing manufacturing and wholesale. The brand personality is rooted in **precision, efficiency, and industrial reliability**. It aims to evoke a sense of absolute control over the supply chain, transforming chaotic manufacturing data into structured, actionable insights.

The design style follows a **Modern Corporate Minimalism** approach. It prioritizes data clarity through a rigorous grid, generous whitespace to reduce cognitive load, and a restrained use of color. UI elements are functional rather than decorative, utilizing subtle depth and crisp borders to define the workspace without distracting the user from their primary tasks.

## Colors

This design system utilizes a sophisticated, high-contrast palette to distinguish between structural UI and dynamic data.

- **Primary (Professional Navy):** Used for navigation, headers, and primary actions. It provides a grounded, authoritative foundation.
- **Secondary (Sage Green):** Reserved exclusively for positive growth, profit margins, and successful status indicators (e.g., "In Stock", "Shipped").
- **Tertiary (Slate):** Used for secondary text, icons, and non-critical UI elements to maintain a clear hierarchy.
- **Background (Soft Gray):** A cool-toned neutral that minimizes eye strain during long working sessions.
- **Accent/Warning:** A muted Amber (#F59E0B) should be used sparingly for pending tasks or low-stock alerts.

## Typography

The typography system relies on **Inter** for its exceptional legibility in data-heavy interfaces. It uses a tight scale to maximize the information visible on screen without sacrificing clarity.

- **Headlines:** Use Bold and Semi-Bold weights to anchor page sections.
- **Body Text:** Standardized at 14px for optimal balance between density and readability.
- **Labels:** Small caps or bolded 12px type are used for table headers and metadata categories.
- **Data Mono:** For SKU numbers, batch IDs, and financial figures, a monospaced font is permitted to ensure vertical alignment in tables.

## Layout & Spacing

This design system employs a **Fluid Grid with Fixed Constraints**. The layout is organized around a 12-column grid for the main content area, with a fixed 240px left-hand navigation rail.

- **Desktop:** 12-column grid, 20px gutters, 32px outer margins.
- **Tablet:** 8-column grid, 16px gutters, 24px outer margins. Sidebar collapses into an icon-only rail.
- **Mobile:** 4-column grid, 16px gutters, 16px outer margins. Navigation moves to a bottom bar or hamburger menu.

Spacing follows a strict 4px base unit. Internal card padding should be 20px or 24px to provide "breathing room" for dense data tables and charts.

## Elevation & Depth

To maintain a clean, professional aesthetic, this design system uses **Tonal Layers** combined with **Low-Contrast Outlines**.

- **Level 0 (Background):** Soft Gray (#F8FAFC).
- **Level 1 (Cards/Surface):** Pure White (#FFFFFF) with a 1px border in #E2E8F0.
- **Level 2 (Dropdowns/Modals):** Pure White with a soft, ambient shadow (Offset: 0, 4px; Blur: 12px; Color: rgba(30, 41, 59, 0.08)).

Avoid heavy shadows or "floating" elements. Depth should feel structural, like layers of paper or fabric on a cutting table. Surfaces should appear flat and aligned with the grid.

## Shapes

The shape language is **Soft and Precise**. A consistent 4px (0.25rem) radius is applied to almost all UI elements including buttons, input fields, and cards. This slight rounding softens the "industrial" feel just enough to appear modern and accessible without losing the professional, geometric rigour required for an ERP. 

Larger containers like modals may use 8px (0.5rem) to distinguish them from standard page elements. Interactive elements should never be fully circular (pill-shaped) unless they are status tags or badges.

## Components

- **Buttons:** Primary buttons use the Navy (#1E293B) background with white text. Secondary buttons use a white background with a 1px border. Success actions (e.g., "Approve Order") use the Sage Green (#10B981).
- **Input Fields:** Use a 1px border in #CBD5E1. On focus, the border changes to Navy with a subtle 2px outer glow.
- **Data Tables:** The core of the ERP. Use zebra-striping (Soft Gray) for long lists. Headers are sticky, using a Slate (#64748B) text color and a subtle bottom border.
- **Status Chips:** Small, low-saturation backgrounds with high-saturation text. For example, "Completed" uses a light mint background with Sage Green text.
- **Inventory Cards:** Use a thumbnail image of the garment on the left, with SKU, Stock Level, and Status aligned in a rigid grid on the right.
- **Progress Trackers:** Linear, thin 4px bars used to show manufacturing stages (Cutting, Sewing, Finishing, QC). Use Sage Green for completed steps and Slate for pending.
- **Cloud Sync Status:** High-visibility status indicator in the Sidebar footer. Uses a small pulsing status dot:
  - Connected: Sage Green (`#34d399`)
  - Syncing/Connecting: Amber (`#fbbf24`)
  - Error: Light Red (`#f87171`)
  - Disabled: Muted Slate (`#6b7280`)
   accompanied by matching Lucide icons (`Cloud` / `CloudOff`).
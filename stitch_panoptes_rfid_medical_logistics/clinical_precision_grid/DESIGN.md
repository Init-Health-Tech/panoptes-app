---
name: Clinical Precision Grid
colors:
  surface: '#f9f9f9'
  surface-dim: '#dadad9'
  surface-bright: '#f9f9f9'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f4f3f3'
  surface-container: '#eeeeed'
  surface-container-high: '#e8e8e7'
  surface-container-highest: '#e2e2e2'
  on-surface: '#1a1c1c'
  on-surface-variant: '#40493e'
  inverse-surface: '#2f3131'
  inverse-on-surface: '#f1f1f0'
  outline: '#707a6d'
  outline-variant: '#c0c9bb'
  surface-tint: '#206c2f'
  primary: '#19662a'
  on-primary: '#ffffff'
  primary-container: '#368040'
  on-primary-container: '#e3ffde'
  inverse-primary: '#8bd88e'
  secondary: '#2b6b35'
  on-secondary: '#ffffff'
  secondary-container: '#aef3af'
  on-secondary-container: '#32713b'
  tertiary: '#246262'
  on-tertiary: '#ffffff'
  tertiary-container: '#3f7b7b'
  on-tertiary-container: '#d9fffe'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#a6f5a8'
  primary-fixed-dim: '#8bd88e'
  on-primary-fixed: '#002106'
  on-primary-fixed-variant: '#00531b'
  secondary-fixed: '#aef3af'
  secondary-fixed-dim: '#93d695'
  on-secondary-fixed: '#002107'
  on-secondary-fixed-variant: '#0e5220'
  tertiary-fixed: '#b1eeed'
  tertiary-fixed-dim: '#95d1d1'
  on-tertiary-fixed: '#002020'
  on-tertiary-fixed-variant: '#074f4f'
  background: '#f9f9f9'
  on-background: '#1a1c1c'
  surface-variant: '#e2e2e2'
typography:
  display-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 48px
    fontWeight: '700'
    lineHeight: 56px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 32px
    fontWeight: '600'
    lineHeight: 40px
    letterSpacing: -0.01em
  headline-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
  headline-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
  body-lg:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '400'
    lineHeight: 28px
  body-md:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-sm:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  label-md:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.05em
  data-mono:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '500'
    lineHeight: 20px
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  unit: 4px
  container-padding: 24px
  gutter: 16px
  stack-sm: 8px
  stack-md: 16px
  stack-lg: 32px
---

## Brand & Style

The design system is engineered for high-stakes healthcare logistics, balancing clinical authority with technical precision. It targets hospital administrators and logistics coordinators who require immediate, glanceable data accuracy.

The aesthetic follows a **Modern Corporate** style with **Minimalist** influences. It prioritizes information density without sacrificing clarity, utilizing high-contrast typography and a rigid structural grid. The emotional response is one of reliability, sterility, and real-time control. Visual interest is generated through "radar-style" motion accents and precise data visualizations rather than decorative elements.

## Colors

The palette is anchored in "Deep Forest Green" to evoke growth and health, contrasted against "Deep Charcoal" for authoritative typography. 

- **Primary & Secondary:** Used for brand presence, primary actions, and active navigation states.
- **Accent (Teal/Aqua):** Reserved for technical indicators, RFID signal data, and secondary data visualizations.
- **Amber (#FFB74D):** Strictly for warnings, low-stock alerts, and urgent logistics notifications.
- **Foundation:** The background utilizes a cool-toned white (#F8FAFC) to reduce eye strain during long shifts, while the charcoal text ensures AA/AAA accessibility compliance.

## Typography

This design system utilizes a dual-font strategy. **Plus Jakarta Sans** provides a modern, approachable yet professional feel for headings and brand moments. **Inter** is used for all functional UI, body text, and data tables due to its exceptional legibility and tall x-height.

For data-heavy views, use the `data-mono` role which enables tabular num settings, ensuring that columns of numbers align perfectly for rapid scanning. Headlines on mobile should scale down by one tier (e.g., `headline-lg` becomes `headline-md`).

## Layout & Spacing

The system uses a **Fluid Grid** with a base 4px unit. 

- **Desktop (1280px+):** 12-column grid, 24px margins, 16px gutters.
- **Tablet (768px - 1279px):** 8-column grid, 16px margins, 16px gutters.
- **Mobile (<768px):** 4-column grid, 16px margins, 12px gutters.

The layout philosophy emphasizes "Information Zoning." The left sidebar is fixed, while the main content area utilizes cards to group related data. In "Logistics Mode," the grid tightens to maximize horizontal space for expansive tables.

## Elevation & Depth

Hierarchy is established through **Tonal Layers** and **Subtle Ambient Shadows**. 

1.  **Level 0 (Canvas):** #F8FAFC - The base background.
2.  **Level 1 (Cards/Surface):** #FFFFFF - Primary containers for data and lists. Uses a very soft shadow: `0px 1px 3px rgba(15, 17, 17, 0.05), 0px 10px 15px -3px rgba(15, 17, 17, 0.05)`.
3.  **Level 2 (Popovers/Modals):** High-contrast white with a defined border (#E2E8F0) and a deep shadow for focus.

Avoid heavy blurs. The goal is to make elements appear "seated" on the grid rather than floating far above it.

## Shapes

The design system uses a **Rounded** shape language to soften the industrial nature of logistics data.

- **Standard Cards:** 12px (`rounded-lg`)
- **Buttons & Inputs:** 8px (`rounded`)
- **Status Badges/Chips:** Full pill-shape for distinct visual separation from data fields.
- **Radar Indicators:** Circular elements with concentric, pulsing borders to represent active scanning fields.

## Components

### Buttons & Controls
- **Primary:** Deep Forest Green background, White text. High-contrast.
- **Secondary:** Transparent background, Deep Forest Green border and text.
- **Logistics/Clinical Toggle:** A segmented control at the top of the sidebar. Logistics mode uses a Teal accent, Clinical mode uses the Primary Green.

### Status Badges
- **In Stock:** Subtle Green background, Deep Green text.
- **In Transit:** Subtle Info (Blue) background, Dark Blue text.
- **In Use:** Subtle Teal background, Dark Teal text.
- **Low Stock:** Subtle Amber background, Deep Amber text.

### KPI Cards
Each KPI card must feature a primary metric (`headline-md`) and a secondary sparkline or progress ring. Progress rings use the secondary accent color (#6AAB6E) for the active track.

### Data Tables
- **Header:** #F1F5F9 background, `label-md` charcoal text.
- **Rows:** 48px minimum height, 1px subtle gray bottom border.
- **Selection:** Soft Green tint (#F0FDF4) on row hover.

### Sidebar Navigation
- **Clinical Mode:** Focuses on medical kit (maletas) icons and patient-room locations.
- **Logistics Mode:** Focuses on warehouse zones, pallet IDs, and signal strength indicators.
- **Active State:** Solid primary color vertical bar (4px) on the left edge of the menu item.
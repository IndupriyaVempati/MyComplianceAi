# Surtn Design System — Developer Knowledge Transfer

> **Purpose:** This document is the single source of truth for the Surtn (`surtn.co.za`) design system as implemented in the ComplianceRAG web app. Paste this into any new AI chat session to instantly transfer design context. The authoritative source is `/surtn_Design_Guide_Complete.html` at the project root.
>
> **Stack:** React + TypeScript + Tailwind CSS (with custom CSS variables) · Frontend at `frontend/src/` · Backend at `backend/app/`

---

## 1. Colour Palette

All colours are defined as CSS custom properties in `frontend/src/index.css` `:root {}`.

### Core Colours

| Token | Hex | Usage |
|---|---|---|
| `--color-primary` | `#00386B` | Deep Navy Blue — headings, navigation, sidebar, footers, primary UI structure |
| `--color-secondary` | `#2B93D1` | Sky Blue — secondary buttons, links, active states, supporting visuals |
| `--color-neutral` | `#CFECFB` | Light Blue — section backgrounds, card fills, subtle highlights. **Never use for text.** |

### Accent Colours

| Token | Hex | Usage |
|---|---|---|
| `--color-accent-primary` | `#FFC20E` | Yellow Gold — **primary CTAs, most critical action per page**, important badges. WCAG: AAA on navy, **FAIL on white** (use as background only, never as text colour on white) |
| `--color-accent-secondary` | `#059669` | Emerald Green — success states, verification, positive indicators, secondary CTAs |

### Text Colours

| Token | Hex | Usage |
|---|---|---|
| `--color-text-dark` | `#1E293B` | Primary body text (14.63:1 on white — AAA) |
| `--color-text-mid` | `#334155` | Secondary text, meta (10.35:1 on white — AAA) |
| `--color-text-light` | `#64748B` | Captions, hints, placeholders (4.54:1 on white — AA) |

### Background Colours

| Token | Hex | Usage |
|---|---|---|
| `--color-bg-page` | `#F0F4F8` | Page/app background |
| `--color-bg-card` | `#FFFFFF` | Card surfaces, modal panels |
| `--color-bg-subtle` | `#F8FAFC` | Dashboard inner panels |

### Status Colours

| Token | Hex | Usage |
|---|---|---|
| `--color-status-green` | `#16A34A` | Active / Operational |
| `--color-status-amber` | `#D97706` | Pending / Warning |
| `--color-status-red` | `#DC2626` | Inactive / Error |

---

## 2. Typography

**Font:** `Poppins` (Google Fonts). Loaded in `index.css` via `@import`.

```css
--font-primary: 'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
```

| Style | Size | Weight | Line-height | Notes |
|---|---|---|---|---|
| Display / Hero | 56px / 3.5rem | 700 | 1.1 | Letter-spacing: -0.02em |
| Heading 1 | 48px / 3rem | 700 | 1.2 | Page titles |
| Heading 2 | 36px / 2.25rem | 600 | 1.3 | Section titles |
| Heading 3 | 24px / 1.5rem | 600 | 1.4 | Subsections |
| Heading 4 | 20px / 1.25rem | 500 | 1.4 | Card titles |
| Body Large | 18px | 400 | 1.6 | Lead paragraphs |
| Body Default | 16px | 400 | 1.6 | General content |
| Body Small | 14px | 400 | 1.5 | Tables, secondary info |
| Caption / Label | 12px | 500 | — | Letter-spacing: 0.02em |

**Available Poppins weights:** 300, 400, 500, 600, 700, 800, 900. Load only what is needed in production.

---

## 3. Buttons

The base button uses `border-radius: var(--radius-md)` = `10px`, `padding: 12px 24px`, `font-size: 14px`, `font-weight: 600`, `border: 2px solid transparent`, `transition: all 0.2s ease`.

> **Rule: Use `btn-accent` (yellow `#FFC20E`) for the single most critical CTA per page.** Every other page should use this sparingly.

### Button Variants

| Variant | Background | Text | Hover bg | Hover border |
|---|---|---|---|---|
| **`btn-accent`** ⭐ Primary CTA | `#FFC20E` | `#00386B` (navy) | `#E6AE00` | `#E6AE00` |
| `btn-primary` | `#00386B` | `#ffffff` | `#00295A` | `#00295A` |
| `btn-secondary` | `#2B93D1` | `#ffffff` | `#2278AD` | `#2278AD` |
| `btn-success` | `#059669` | `#ffffff` | `#047857` | `#047857` |
| `btn-outline-primary` | `transparent` | `#00386B` | `#00386B` bg + `#fff` text | `#00386B` |
| `btn-ghost` | `transparent` | default | `#F1F5F9` bg | — |

### Button Sizes

| Size | Padding | Font-size | Border-radius |
|---|---|---|---|
| Small (`btn-sm`) | `8px 16px` | `13px` | `--radius-md` (10px) |
| Default | `12px 24px` | `14px` | `--radius-md` (10px) |
| Large (`btn-lg`) | `16px 32px` | `16px` | `--radius-lg` (16px) |
| Disabled | — | — | `opacity: 0.45; cursor: not-allowed` |

### React Implementation Pattern (inline style for one-off buttons)

```tsx
<button
  style={{ backgroundColor: '#FFC20E', color: '#00386B' }}
  onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#E6AE00')}
  onMouseLeave={e => (e.currentTarget.style.backgroundColor = '#FFC20E')}
  className="py-3 px-6 rounded-[10px] text-sm font-semibold shadow-sm transition-colors focus:outline-none"
>
  Buy a Subscription
</button>
```

The shared `Button` component is at `frontend/src/components/Button.tsx`. Its `primary` variant currently uses `bg-indigo-600` — **do not use `variant="primary"` for the accent CTA**; use inline styles or add a `variant="accent"` to that component.

---

## 4. Spacing & Radius

```css
--space-xs:  4px;   --space-sm:  8px;   --space-md: 16px;
--space-lg: 24px;   --space-xl: 40px;   --space-2xl: 64px;

--radius-sm:   6px;
--radius-md:  10px;   /* default buttons, inputs, small cards */
--radius-lg:  16px;   /* cards, modals */
--radius-xl:  24px;   /* hero sections, large panels */
--radius-full: 9999px; /* pills, badges */
```

---

## 5. Shadows

```css
--shadow-sm: 0 1px 3px rgba(0,0,0,0.08);
--shadow-md: 0 4px 12px rgba(0,0,0,0.10);
--shadow-lg: 0 8px 24px rgba(0,0,0,0.12);
```

---

## 6. Form Elements

```css
/* Input base */
border: 2px solid #CBD5E1;
border-radius: var(--radius-md);  /* 10px */
padding: 11px 14px;
font-size: 14px;
color: var(--color-text-dark);
background: #fff;

/* Focus state */
border-color: var(--color-secondary);     /* #2B93D1 */
box-shadow: 0 0 0 3px rgba(43,147,209,0.15);

/* Error state */
border-color: var(--color-status-red);    /* #DC2626 */

/* Success state */
border-color: var(--color-accent-secondary); /* #059669 */
```

---

## 7. Cards

```css
/* Standard card */
background: var(--color-bg-card);       /* #FFFFFF */
border-radius: var(--radius-lg);        /* 16px */
box-shadow: var(--shadow-md);

/* Card with navy header bar (common pattern) */
.card-header-bar {
  background: var(--color-primary);     /* #00386B */
  padding: 20px 24px;
  color: #fff;
}
```

---

## 8. Badges & Labels

| Badge | Background | Text |
|---|---|---|
| Primary | `#DBEAFE` | `#00386B` (navy) |
| Accent | `#FEF3C7` | `#92400E` |
| Active | `#DCFCE7` | `#166534` |
| Pending | `#FEF3C7` | `#92400E` |
| Inactive | `#F1F5F9` | `#64748B` |

Badge shape: `border-radius: var(--radius-full)` (pill).

---

## 9. Banners & Alerts

| Type | Background | Left border | Text colour |
|---|---|---|---|
| Brand | `#00386B` | `#FFC20E` | Title: `#FFC20E`, Body: `rgba(255,255,255,0.85)` |
| Info | `#EFF6FF` | `#2B93D1` | `#1E40AF` |
| Success | `#ECFDF5` | `#059669` | `#065F46` |
| Warning | `#FFFBEB` | `#D97706` | `#92400E` |
| Error | `#FEF2F2` | `#DC2626` | `#991B1B` |

---

## 10. Status Indicators (Traffic Light)

```
● #16A34A — Active / Operational   (glow: box-shadow 0 0 8px rgba(22,163,74,0.4))
● #D97706 — Pending / Warning      (glow: box-shadow 0 0 8px rgba(217,119,6,0.4))
● #DC2626 — Inactive / Error       (glow: box-shadow 0 0 8px rgba(220,38,38,0.4))
```

---

## 11. Email Templates (`backend/app/email_utils.py`)

All HTML emails follow this layout pattern. **No CSS variables in email** — use raw hex values.

```html
<!-- Shell -->
<div style="font-family:sans-serif;max-width:520px;margin:0 auto;background:#F0F4F8;border-radius:12px;overflow:hidden;">
  
  <!-- Header stripe (always navy + gold brand name) -->
  <div style="background:#00386B;padding:20px 32px;">
    <span style="color:#FFC20E;font-size:18px;font-weight:700;">APP NAME</span>
  </div>

  <!-- Body -->
  <div style="padding:32px;">
    <h2 style="color:#00386B;font-size:22px;font-weight:700;">Title</h2>
    <p style="color:#64748B;">Body text...</p>

    <!-- Primary CTA → always accent yellow -->
    <a href="..."
       style="display:inline-block;padding:12px 28px;
              background:#FFC20E;color:#00386B;
              border-radius:10px;text-decoration:none;font-weight:700;">
      Action Label
    </a>

    <!-- Footer note -->
    <p style="margin-top:28px;font-size:12px;color:#94a3b8;">Fine print...</p>
  </div>
</div>
```

### Email Colour Tokens (inline, no variables)

| Element | Colour |
|---|---|
| Page bg | `#F0F4F8` |
| Header stripe | `#00386B` |
| Brand name in header | `#FFC20E` |
| Title text | `#00386B` |
| Body text | `#64748B` |
| CTA button bg | `#FFC20E` |
| CTA button text | `#00386B` |
| CTA border-radius | `10px` |
| OTP/code block bg | `#dce8f0` |
| OTP/code block border | `2px solid #2B93D1` |
| OTP text | `#00386B` |
| Footer note text | `#94a3b8` |

---

## 12. Dark Mode

The app supports dark mode via the `dark` class on `<html>`. Key overrides in `index.css`:

```css
html.dark body { background: #212121; color: #ececec; }
```

Tailwind dark mode is used in components: `dark:bg-[#1a1a1a]`, `dark:text-[#ececec]`, `dark:border-[#3a3a3a]`.

---

## 13. Navigation / Sidebar

The left sidebar (`frontend/src/`) uses:

- Background: `#00386B` (primary navy)  
- Brand accent (logo text): `#FFC20E`  
- Links: `rgba(255,255,255,0.75)`, active: `#ffffff`  
- Width: ~210px

---

## 14. Key Files Reference

| File | Purpose |
|---|---|
| `frontend/src/index.css` | CSS custom properties (all design tokens), global resets, dark mode, scrollbar |
| `frontend/src/components/Button.tsx` | Shared `<Button>` component — note: `primary` variant = indigo (not yet updated to navy) |
| `frontend/src/components/TrialModal.tsx` | Trial expiry modal — uses themed colours & accent CTA |
| `backend/app/email_utils.py` | All email HTML templates (invite + OTP + PDF) |
| `surtn_Design_Guide_Complete.html` | Client's authoritative design guide (project root) |

---

## 15. Common Pitfalls & Rules

1. **Never use `bg-indigo-*` or `#4f46e5`** — these are Tailwind defaults, not the Surtn palette.
2. **Yellow (`#FFC20E`) on white fails WCAG** — use it only as a background, never as text colour on a white/light surface.
3. **"Buy a subscription" / "Join your team" / any primary conversion CTA** → always `btn-accent` (yellow `#FFC20E`, navy text, hover `#E6AE00`).
4. **"Save Changes" / "Confirm"** → `btn-success` (`#059669`).
5. **"Learn More" / secondary navigation actions** → `btn-primary` (navy `#00386B`, hover `#00295A`).
6. **Links and active states** → `#2B93D1` (secondary blue).
7. **The `Button` component's `primary` variant** currently maps to indigo — for accent CTAs, use inline styles or a native `<button>` until the component is updated.
8. **Email templates cannot use CSS variables** — always inline raw hex values.

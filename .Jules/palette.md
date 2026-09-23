# Palette's Journal - Critical UX & Accessibility Learnings

## 2025-02-20 - Interactive Tag Removal and Icon-Only Buttons
**Learning:** Clickable `<span>` elements used as tag remove triggers are inaccessible to keyboard users and screen readers. Icon-only buttons (such as `↑`, `↓`, `×`) lack context without explicit ARIA labels.
**Action:** Always use native `<button type="button">` with explicit `aria-label` for interactive icons/tags and reset default button styling in CSS.

# Palette's Journal - Critical Learnings

## 2025-05-18 - Form Field Accessibility in JDInput
**Learning:** Textareas with helper counts (e.g. word count feedback) benefit significantly from `htmlFor` association on the `<label>`, explicit `aria-describedby` links, and `aria-live="polite"` on dynamic counter elements so screen reader users are properly notified and connected to inputs.
**Action:** Always verify `<label htmlFor="...">` matches input/textarea `id`, and bind dynamic helper text using `aria-describedby` and `aria-live`.

## 2025-02-17 - LaTeX Injection via Unescaped Profile Social URLs
**Vulnerability:** The `linkedin` and `github` fields in `backend/main.py` and `backend/pdf_generator.py` were passed unescaped directly into LaTeX Jinja2 templates under the assumption that URLs should remain raw for `\href`. An attacker could inject closing braces and TeX commands (e.g. `\write18`, `\input`) to execute arbitrary commands or read sensitive local files.
**Learning:** Never bypass LaTeX string escaping for user inputs in templates, even for URLs. `_escape_latex()` properly escapes TeX special characters (`}`, `{`, `\`, `%`, etc.) while keeping the link target safe.
**Prevention:** Sanitize all user-provided fields through `_escape_latex()` before rendering LaTeX templates.

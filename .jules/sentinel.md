## 2025-02-23 - LaTeX Injection via Unescaped Hyperlink Parameters
**Vulnerability:** User profile URL parameters (`linkedin`, `github`) were rendered raw into LaTeX templates inside `\href{URL}{text}`, allowing attackers to inject TeX parameter closing braces `}` and arbitrary LaTeX commands (e.g. `\input`, `\write18`).
**Learning:** Sequential string `replace()` calls for TeX escaping can introduce double-escaping bugs when introduced backslashes (e.g. `\%`) are later escaped as `\textbackslash{}`.
**Prevention:** Use a single-pass regex replacement (`re.sub`) for TeX control characters (`\`, `%`, `#`, `{`, `}`) and validate template names against an explicit whitelist.

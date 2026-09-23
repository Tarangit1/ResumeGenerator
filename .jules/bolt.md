## 2026-09-23 - LaTeX String Escaping Regex Pre-compilation
**Learning:** In Python PDF generation workflows, recursive dict string sanitization (`_escape_dict`) calls `_escape_latex` dozens of times per resume rendering. In-function regex compilation (`re.sub(...)`) and list construction in tight string-processing hot paths add unnecessary function call overhead.
**Action:** Pre-compile regexes (`re.compile`) and elevate static tuples at module scope for string escaping functions called recursively across nested data structures.

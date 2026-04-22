import os
import subprocess
import tempfile
from jinja2 import Environment, FileSystemLoader


# Jinja2 env for LaTeX — custom delimiters to avoid clashing with TeX braces
_tex_env = Environment(
    loader=FileSystemLoader(os.path.join(os.path.dirname(__file__), "templates")),
    block_start_string="{% ",
    block_end_string=" %}",
    variable_start_string="{{ ",
    variable_end_string=" }}",
    comment_start_string="{# ",
    comment_end_string=" #}",
)


def _escape_latex(text: str) -> str:
    """Escape special LaTeX characters in user-provided text."""
    if not isinstance(text, str):
        return text
    replacements = [
        ("\\", r"\textbackslash{}"),
        ("&", r"\&"),
        ("%", r"\%"),
        ("$", r"\$"),
        ("#", r"\#"),
        ("_", r"\_"),
        ("{", r"\{"),
        ("}", r"\}"),
        ("~", r"\textasciitilde{}"),
        ("^", r"\textasciicircum{}"),
    ]
    for old, new in replacements:
        text = text.replace(old, new)
    return text


def _escape_dict(data):
    """Recursively escape all string values in a dict/list structure."""
    if isinstance(data, str):
        return _escape_latex(data)
    if isinstance(data, list):
        return [_escape_dict(item) for item in data]
    if isinstance(data, dict):
        return {k: _escape_dict(v) for k, v in data.items()}
    return data


def generate_pdf(
    resume_data: dict,
    profile_name: str = "",
    profile_email: str = "",
    profile_phone: str = "",
    profile_linkedin: str = "",
    template_name: str = "resume.tex.j2",
) -> bytes:
    """Render LaTeX template then compile to PDF with pdflatex. Returns PDF bytes."""

    # Escape all user strings so LaTeX doesn't choke
    safe_resume = _escape_dict(resume_data)
    safe_name = _escape_latex(profile_name)
    safe_email = _escape_latex(profile_email)
    safe_phone = _escape_latex(profile_phone)
    safe_linkedin = profile_linkedin  # URLs: keep raw for \href

    # Render .tex from Jinja2 template
    template = _tex_env.get_template(template_name)
    tex_source = template.render(
        name=safe_name,
        email=safe_email,
        phone=safe_phone,
        linkedin=safe_linkedin,
        **safe_resume,
    )

    # Compile in a temp dir
    with tempfile.TemporaryDirectory() as tmpdir:
        tex_path = os.path.join(tmpdir, "resume.tex")
        pdf_path = os.path.join(tmpdir, "resume.pdf")

        with open(tex_path, "w", encoding="utf-8") as f:
            f.write(tex_source)

        # Run pdflatex twice (resolves references/links)
        for _ in range(2):
            result = subprocess.run(
                [
                    "pdflatex",
                    "-interaction=nonstopmode",
                    "-halt-on-error",
                    "-output-directory", tmpdir,
                    tex_path,
                ],
                capture_output=True,
                text=True,
                timeout=30,
            )

            if result.returncode != 0:
                # Grab the log for debugging
                log_path = os.path.join(tmpdir, "resume.log")
                log_content = ""
                if os.path.exists(log_path):
                    with open(log_path, "r", encoding="utf-8", errors="replace") as lf:
                        log_content = lf.read()[-2000:]  # last 2000 chars
                raise RuntimeError(
                    f"pdflatex failed (exit {result.returncode}).\n"
                    f"STDOUT: {result.stdout[-500:]}\n"
                    f"STDERR: {result.stderr[-500:]}\n"
                    f"LOG (tail): {log_content}"
                )

        if not os.path.exists(pdf_path):
            raise RuntimeError("pdflatex ran but no PDF produced")

        with open(pdf_path, "rb") as pf:
            return pf.read()


import os
import sys

# Add current dir to path to import pdf_generator
sys.path.append(os.path.dirname(__file__))

from pdf_generator import _tex_env

def test_rendering():
    data = {
        "summary": "Me good dev.",
        "skills": {
            "programming_languages": ["Python", "JS"]
        }
    }
    hide_keywords = ["keyword1", "keyword_2"]
    
    template = _tex_env.get_template("resume.tex.j2")
    rendered = template.render(
        name="John Doe",
        email="john@example.com",
        phone="123",
        linkedin="li.com/johndoe",
        hide_keywords=hide_keywords,
        **data
    )
    
    print("--- Rendered Output Snippets ---")
    # Check category replacement
    if "Programming Languages" in rendered:
        print("PASS: category 'programming_languages' replaced with 'Programming Languages'")
    else:
        print("FAIL: category replacement failed")
        
    # Check skills join
    if "Python, JS" in rendered:
        print("PASS: skills joined correctly")
    else:
        print("FAIL: skills join failed")

    # Check hidden keywords
    if "keyword1, keyword_2" in rendered:
        print("PASS: hide_keywords rendered correctly")
    else:
        print("FAIL: hide_keywords missing")
        
    # Check white tiny font for keywords
    if "\\color{white}\\tiny \\noindent keyword1, keyword_2" in rendered:
        print("PASS: keywords have white tiny font")
    else:
        print("FAIL: keywords font formatting missing")

    # Check for raw Jinja tags
    if "{{" in rendered or "{%" in rendered:
        print("FAIL: Raw Jinja tags remain in output")
    else:
        print("PASS: No raw Jinja tags found")

if __name__ == "__main__":
    try:
        test_rendering()
    except Exception as e:
        print(f"Error during testing: {e}")

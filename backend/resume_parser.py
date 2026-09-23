import json
import re
import fitz  # pymupdf
import asyncio
from google import genai
from google.genai import types

MODEL_ID = "gemini-1.5-flash"

PARSE_PROMPT = """You are a resume parser. Extract structured profile data from the following resume content.

Return ONLY valid JSON (no markdown, no code fences) with this exact structure:
{
  "skills": ["Python", "React", "..."],
  "experience": [
    {
      "title": "Job Title",
      "company": "Company Name",
      "start": "MMM YYYY",
      "end": "MMM YYYY or Present",
      "bullets": ["What they did 1", "What they did 2"]
    }
  ],
  "education": [
    {
      "degree": "B.Tech CS",
      "school": "University Name",
      "year": "2024"
    }
  ],
  "projects": [
    {
      "name": "Project Name",
      "description": "Honest, simple description of what the project actually does",
      "tech": ["Tech1", "Tech2"]
    }
  ]
}

IMPORTANT: For projects, write HONEST simple descriptions (strip any inflation/buzzwords).
If a field is not found, use empty string or empty array.
"""


def extract_text_from_pdf(pdf_bytes: bytes) -> str:
    """Extract text from PDF bytes using pymupdf."""
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    text = ""
    for page in doc:
        text += page.get_text()
    doc.close()
    return text


def extract_basic_contact_info(content: str) -> dict:
    """Use regex to extract basic contact info to reduce Gemini payload."""
    contact_info = {
        "name": "",
        "email": "",
        "phone": "",
        "linkedin": "",
        "github": ""
    }

    email_match = re.search(r"[\w\.-]+@[\w\.-]+\.\w+", content)
    if email_match:
        contact_info["email"] = email_match.group(0)

    phone_match = re.search(r"\+?\d{1,3}?[-.\s]?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}", content)
    if phone_match:
        contact_info["phone"] = phone_match.group(0)

    linkedin_match = re.search(r"linkedin\.com/in/[\w-]+", content)
    if linkedin_match:
        contact_info["linkedin"] = "https://www." + linkedin_match.group(0)

    github_match = re.search(r"github\.com/[\w-]+", content)
    if github_match:
        contact_info["github"] = "https://" + github_match.group(0)

    lines = [line.strip() for line in content.split("\n") if line.strip()]
    if lines:
        contact_info["name"] = lines[0][:50]

    return contact_info

async def parse_resume(content: str, api_key: str) -> dict:
    """Use Hybrid approach (Regex + Gemini) to parse resume text/LaTeX."""
    client = genai.Client(api_key=api_key)

    contact_info = extract_basic_contact_info(content)

    user_prompt = f"""
## RESUME CONTENT:
{content}

Parse this resume and extract the structured profile data for skills, experience, education, and projects. Return ONLY valid JSON.
"""

    max_retries = 3
    base_delay = 2

    parsed_json = {}
    for attempt in range(max_retries):
        try:
            response = await client.aio.models.generate_content(
                model=MODEL_ID,
                contents=[PARSE_PROMPT, user_prompt],
                config=types.GenerateContentConfig(
                    temperature=0.2,
                    response_mime_type="application/json",
                ),
            )

            text = response.text.strip()
            if text.startswith("```"):
                text = text.split("\n", 1)[1]
                if text.endswith("```"):
                    text = text[:-3]
                text = text.strip()
            if text.startswith("json"):
                text = text[4:]

            parsed_json = json.loads(text)
            break
        except Exception as e:
            if attempt == max_retries - 1:
                raise e
            await asyncio.sleep(base_delay * (2 ** attempt))

    result = {**contact_info, **parsed_json}

    for key in ["skills", "experience", "education", "projects"]:
        if key not in result:
            result[key] = []

    return result

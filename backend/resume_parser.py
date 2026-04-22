import json
import fitz  # pymupdf
from google import genai
from google.genai import types
import os

api_key = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")
client = genai.Client(api_key=api_key)
MODEL_ID = "gemini-2.5-flash"

PARSE_PROMPT = """You are a resume parser. Extract structured profile data from the following resume content.

Return ONLY valid JSON (no markdown, no code fences) with this exact structure:
{
  "name": "Full Name",
  "email": "email@example.com",
  "phone": "+1 234 567 8900",
  "linkedin": "https://linkedin.com/in/...",
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


async def parse_resume(content: str) -> dict:
    """Use Gemini to parse resume text/LaTeX into structured profile data."""
    user_prompt = f"""
## RESUME CONTENT:
{content}

Parse this resume and extract the structured profile data. Return ONLY valid JSON.
"""
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

    return json.loads(text)

import json
import os
import fitz  # pymupdf
from openai import AsyncOpenAI

NVIDIA_BASE_URL = "https://integrate.api.nvidia.com/v1"
DEFAULT_MODEL_ID = "meta/llama-3.2-11b-vision-instruct"

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


async def parse_resume(content: str, model_id: str | None = None) -> dict:
    """Use NVIDIA NIM to parse resume text/LaTeX into structured profile data."""
    api_key = os.environ["NVIDIA_API_KEY"]
    model = model_id or os.environ.get("NVIDIA_MODEL_ID", DEFAULT_MODEL_ID)
    client = AsyncOpenAI(base_url=NVIDIA_BASE_URL, api_key=api_key)

    user_prompt = f"""
## RESUME CONTENT:
{content}

Parse this resume and extract the structured profile data. Return ONLY valid JSON.
"""
    try:
        response = await client.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": PARSE_PROMPT},
                {"role": "user", "content": user_prompt},
            ],
            temperature=0.2,
            max_tokens=2048,
            response_format={"type": "json_object"},
        )
    except Exception as rf_err:
        if "response_format" in str(rf_err).lower() or "400" in str(rf_err):
            response = await client.chat.completions.create(
                model=model,
                messages=[
                    {"role": "system", "content": PARSE_PROMPT},
                    {"role": "user", "content": user_prompt},
                ],
                temperature=0.2,
                max_tokens=2048,
            )
        else:
            raise rf_err

    text = response.choices[0].message.content.strip()
    brace_start = text.find("{")
    brace_end = text.rfind("}")
    if brace_start != -1 and brace_end != -1 and brace_end > brace_start:
        text = text[brace_start:brace_end + 1]

    return json.loads(text, strict=False)

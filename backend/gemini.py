import asyncio
import json
from google import genai
from google.genai import types
from google.genai.errors import APIError


MODEL_ID = "gemini-3.5-flash-lite"

SYSTEM_PROMPT = """You are an elite technical resume writer. Your goal is to make candidates irresistible to ATS systems and hiring managers.

Given the candidate's profile and a target job description, you must:

## 1. STRATEGIC ENHANCEMENT
Take each project and experience bullet and rewrite it impactfully:
- Use strong, varied action verbs (e.g., Architected, Engineered, Spearheaded, Orchestrated, Deployed). DO NOT repeat the same verbs.
- ABSOLUTELY AVOID vague, cliché buzzwords (e.g., ambitious, passionate, dynamic, driven, enthusiastic, synergy, proactive).
- Keep language highly professional, concise, and natural. Avoid awkward repetition of phrases or adjectives.
- Add realistic, quantifiable metrics where logical (e.g., "reducing API latency by 78ms", "processing 10K+ concurrent sessions", "99.9% uptime").

## 2. ATS OPTIMIZATION
- Extract ONLY the highly critical technical skills, tools, frameworks, and methodologies from the JD.
- Mirror these exact keywords naturally throughout the summary, experience, and projects.
- Use ONLY standard section headings: "Professional Summary", "Work Experience", "Projects", "Technical Skills", "Education".
- Quantify EVERY achievement with numbers, percentages, or metrics.

## 3. TAILOR CONTENT
- Rewrite the professional summary to be a sharp, metric-driven snapshot directly addressing the JD requirements, devoid of fluff.
- Reorder skills to put JD-matched technical skills first.
- Reorder experience bullets to highlight work relevant to the JD.
- SELECT ONLY the top 1 to 4 most highly relevant projects that best match the JD requirements. Order them by relevance to the JD.
- CRITICAL: Retain exact dates (start/end), locations, CGPA, and project URLs (github_url, demo_url) exactly as they are in the candidate profile. Do NOT invent or remove these if they exist.

## 4. OUTPUT FORMAT
- Return ONLY valid JSON (no markdown, no code fences) with this exact structure.
- CRITICAL: Use PLAIN TEXT ONLY inside the JSON strings. DO NOT include any LaTeX commands (like \\textbf), HTML tags, or backslashes.
{
  "summary": "2-3 sentence professional summary tailored to the JD",
  "experience": [
    {
      "title": "Job Title",
      "company": "Company Name",
      "start": "MMM YYYY",
      "end": "MMM YYYY or Present",
      "bullets": ["Achievement bullet 1 with metric", "Achievement bullet 2 with metric"]
    }
  ],
  "projects": [
    {
      "name": "Impressive Project Name (enterprise-sounding)",
      "github_url": "URL if exists in profile",
      "demo_url": "URL if exists in profile",
      "bullets": ["Inflated achievement 1 with metrics", "Inflated achievement 2 with metrics"],
      "tech": ["Tech1", "Tech2"]
    }
  ],
  "skills": {
    "languages": ["..."],
    "frameworks": ["..."],
    "tools": ["..."],
    "other": ["..."]
  },
  "education": [
    {
      "degree": "...",
      "school": "...",
      "location": "...",
      "start": "...",
      "end": "...",
      "cgpa": "..."
    }
  ],
  "ats_keywords": ["List of actual technical skills, tools, and domain keywords extracted from the JD"]
}
"""


async def tailor_resume(profile: dict, jd: str, api_key: str) -> dict:
    """Send profile + JD to Gemini, get back tailored + inflated resume JSON."""
    client = genai.Client(api_key=api_key)
    prompt = f"""
## CANDIDATE PROFILE:
{json.dumps(profile, indent=2)}

## TARGET JOB DESCRIPTION:
{jd}

Generate an optimized, enterprise-level resume strictly in matching JSON structure.
"""

    max_retries = 3
    base_delay = 2

    for attempt in range(max_retries):
        try:
            response = await client.aio.models.generate_content(
                model=MODEL_ID,
                contents=[SYSTEM_PROMPT, prompt],
                config=types.GenerateContentConfig(
                    temperature=0.7,
                    response_mime_type="application/json",
                ),
            )

            text = response.text.strip()
            # Strip markdown code fences if Gemini wraps them
            if text.startswith("```"):
                text = text.split("\n", 1)[1]
                if text.endswith("```"):
                    text = text[:-3]
                text = text.strip()

            return json.loads(text)
            
        except APIError as e:
            if e.code in [503, 429] and attempt < max_retries - 1:
                delay = base_delay * (2 ** attempt)
                print(f"Gemini API rate limited/unavailable (Code {e.code}). Retrying in {delay} seconds...")
                await asyncio.sleep(delay)
            else:
                raise e
        except Exception as e:
            if attempt < max_retries - 1 and "503" in str(e):
                delay = base_delay * (2 ** attempt)
                print(f"Gemini API 503 Exception. Retrying in {delay} seconds...")
                await asyncio.sleep(delay)
            else:
                raise e

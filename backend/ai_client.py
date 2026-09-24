import asyncio
import json
import os
from openai import AsyncOpenAI

NVIDIA_BASE_URL = "https://integrate.api.nvidia.com/v1"
DEFAULT_MODEL_ID = "nvidia/nemotron-3.5-lightning-30b-a3b"

def _get_model() -> str:
    """Return model ID — env var overrides default."""
    return os.environ.get("NVIDIA_MODEL_ID", DEFAULT_MODEL_ID)

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
- Bold the most important technical keywords and metrics in your bullet points using Markdown syntax (e.g. "Developed using **React** and **Node.js**, improving speed by **32%**").

## 3. TAILOR CONTENT
- Rewrite the professional summary to be a sharp, metric-driven snapshot directly addressing the JD requirements, devoid of fluff.
- Reorder skills to put JD-matched technical skills first.
- Reorder experience bullets to highlight work relevant to the JD.
- SELECT ONLY the top 1 to 4 most highly relevant projects that best match the JD requirements. Order them by relevance to the JD.
- CRITICAL: Retain exact dates (start/end), locations, CGPA, and project URLs (github_url, demo_url) exactly as they are in the candidate profile. Do NOT invent, remove, or convert these. NEVER convert the CGPA to a 4.0 scale. YOU MUST NOT drop the github_url or demo_url keys if they exist!

## 4. OUTPUT FORMAT
- Return ONLY valid JSON (no markdown, no code fences) with this exact structure.
- CRITICAL: Use PLAIN TEXT ONLY inside the JSON strings. DO NOT include any LaTeX commands (like \\textbf), HTML tags, or backslashes. You MAY use Markdown **bold** syntax to highlight important keywords in your bullet points.
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
      "github_url": "copy exactly from profile",
      "demo_url": "copy exactly from profile",
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


def _make_client() -> AsyncOpenAI:
    api_key = os.environ["NVIDIA_API_KEY"]
    return AsyncOpenAI(
        base_url=NVIDIA_BASE_URL,
        api_key=api_key,
    )


async def tailor_resume(profile: dict, jd: str, model_id: str | None = None) -> dict:
    """Send profile + JD to NVIDIA NIM, get back tailored resume JSON."""
    client = _make_client()
    model = model_id or _get_model()
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
            response = await asyncio.wait_for(
                client.chat.completions.create(
                    model=model,
                    messages=[
                        {"role": "system", "content": SYSTEM_PROMPT},
                        {"role": "user", "content": prompt},
                    ],
                    temperature=0.7,
                    max_tokens=4096,
                ),
                timeout=90.0,
            )

            text = response.choices[0].message.content
            if not text or not text.strip():
                raise ValueError(f"Model returned empty response (attempt {attempt + 1})")
            text = text.strip()

            # Strip markdown code fences (```json ... ``` or ``` ... ```)
            if text.startswith("```"):
                lines = text.split("\n")
                # Remove first line (```json or ```) and last ``` if present
                inner = lines[1:] if len(lines) > 1 else lines
                if inner and inner[-1].strip() == "```":
                    inner = inner[:-1]
                text = "\n".join(inner).strip()

            # Find the first { to skip any leading prose the model might add
            brace_idx = text.find("{")
            if brace_idx > 0:
                text = text[brace_idx:]

            return json.loads(text)

        except (ValueError, json.JSONDecodeError) as e:
            if attempt < max_retries - 1:
                delay = base_delay * (2 ** attempt)
                print(f"Model returned bad/empty JSON, retrying in {delay}s: {e}")
                await asyncio.sleep(delay)
            else:
                raise RuntimeError(f"Model failed to return valid JSON after {max_retries} attempts: {e}")
        except Exception as e:
            err_str = str(e)
            if attempt < max_retries - 1 and any(code in err_str for code in ["503", "429", "rate", "timeout"]):
                delay = base_delay * (2 ** attempt)
                print(f"NVIDIA API error, retrying in {delay}s: {e}")
                await asyncio.sleep(delay)
            else:
                raise e



async def get_embedding(text: str) -> list:
    """Generate an embedding vector using NVIDIA NIM embedding model."""
    client = _make_client()
    try:
        response = await client.embeddings.create(
            model="nvidia/nv-embedqa-e5-v5",
            input=text,
            encoding_format="float",
            extra_body={"input_type": "query", "truncate": "END"},
        )
        if response.data and len(response.data) > 0:
            return response.data[0].embedding
        return []
    except Exception as e:
        print(f"Failed to generate embedding: {e}")
        return []

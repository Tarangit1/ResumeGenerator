import re
from collections import Counter


def _extract_keywords(text: str) -> set:
    """Extract meaningful keywords from text (lowercase, deduped)."""
    # Remove common stop words
    stop_words = {
        "a", "an", "the", "and", "or", "but", "in", "on", "at", "to", "for",
        "of", "with", "by", "from", "is", "are", "was", "were", "be", "been",
        "being", "have", "has", "had", "do", "does", "did", "will", "would",
        "could", "should", "may", "might", "must", "shall", "can", "need",
        "it", "its", "you", "your", "we", "our", "they", "their", "this",
        "that", "these", "those", "as", "if", "not", "no", "so", "up", "out",
        "about", "into", "over", "after", "also", "such", "other", "than",
        "then", "each", "all", "any", "both", "few", "more", "most", "some",
        "very", "just", "etc", "able", "work", "working", "using", "used",
        "including", "across", "within", "between", "through", "during",
        "experience", "required", "preferred", "strong", "excellent",
        "minimum", "years", "role", "responsibilities", "qualifications",
        "looking", "join", "team", "company", "position", "opportunity",
    }

    # Extract words (2+ chars, alphanumeric + common tech chars)
    words = re.findall(r'[a-zA-Z][a-zA-Z0-9#+.\-]{1,}', text)
    keywords = set()
    for w in words:
        lower = w.lower().rstrip(".")
        if lower not in stop_words and len(lower) >= 2:
            keywords.add(lower)

    # Also extract multi-word tech terms (e.g., "machine learning", "ci/cd")
    multi_word_patterns = [
        r'(?i)\b(?:machine\s+learning|deep\s+learning|natural\s+language\s+processing)',
        r'(?i)\b(?:ci/cd|ci\s*/\s*cd)',
        r'(?i)\b(?:cross[- ]functional|object[- ]oriented|event[- ]driven)',
        r'(?i)\b(?:rest\s+api|restful\s+api)',
        r'(?i)\b(?:unit\s+test|integration\s+test)',
        r'(?i)\b(?:data\s+structure|design\s+pattern)',
        r'(?i)\b(?:version\s+control|source\s+control)',
        r'(?i)\b(?:agile|scrum|kanban)',
    ]
    for pattern in multi_word_patterns:
        matches = re.findall(pattern, text)
        for m in matches:
            keywords.add(m.lower().strip())

    return keywords


def _flatten_resume_text(resume: dict) -> str:
    """Flatten resume JSON into a single text blob for keyword matching."""
    parts = []

    if resume.get("summary"):
        parts.append(resume["summary"])

    for exp in resume.get("experience", []):
        parts.append(exp.get("title", ""))
        parts.append(exp.get("company", ""))
        for b in exp.get("bullets", []):
            parts.append(b)

    for proj in resume.get("projects", []):
        parts.append(proj.get("name", ""))
        for b in proj.get("bullets", []):
            parts.append(b)
        for t in proj.get("tech", []):
            parts.append(t)

    skills = resume.get("skills", {})
    if isinstance(skills, dict):
        for category_skills in skills.values():
            if isinstance(category_skills, list):
                parts.extend(category_skills)
    elif isinstance(skills, list):
        parts.extend(skills)

    for edu in resume.get("education", []):
        parts.append(edu.get("degree", ""))
        parts.append(edu.get("school", ""))

    return " ".join(parts)


def score_resume(resume_data: dict, jd: str) -> dict:
    """
    Score how well a resume matches a JD by keyword overlap.

    Returns:
        {
            "score": 85,         # 0-100 percentage
            "matched": [...],    # keywords found in both
            "missing": [...]     # JD keywords not in resume
        }
    """
    jd_keywords = set(kw.lower().strip() for kw in resume_data.get("ats_keywords", []))
    if not jd_keywords:
        jd_keywords = _extract_keywords(jd)
        
    resume_text = _flatten_resume_text(resume_data)
    resume_keywords = _extract_keywords(resume_text)

    # Also do case-insensitive substring matching for compound terms
    resume_text_lower = resume_text.lower()

    matched = []
    missing = []

    for kw in sorted(jd_keywords):
        if kw in resume_keywords or kw in resume_text_lower:
            matched.append(kw)
        else:
            missing.append(kw)

    total = len(jd_keywords)
    score = round((len(matched) / total) * 100) if total > 0 else 0

    return {
        "score": score,
        "matched": matched,
        "missing": missing,
    }

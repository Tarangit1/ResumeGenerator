import os
import logging
from fastapi import FastAPI, Depends, HTTPException, status, UploadFile, File, Form, Header
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
from jinja2 import Environment, FileSystemLoader

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("resumeforge")

from database import engine, get_db, Base
from models import User, Profile, ResumeHistory, Template
from auth import hash_password, verify_password, create_token, get_current_user
from ai_client import tailor_resume, get_embedding
from ats_scorer import score_resume
from pdf_generator import generate_pdf
from resume_parser import extract_text_from_pdf, parse_resume
import math
import uuid
import asyncio

job_status = {}
generation_queue = asyncio.Queue()

def cosine_similarity(v1, v2):
    if not v1 or not v2: return 0.0
    dot_product = sum(a * b for a, b in zip(v1, v2))
    magnitude_v1 = math.sqrt(sum(a * a for a in v1))
    magnitude_v2 = math.sqrt(sum(b * b for b in v2))
    if magnitude_v1 == 0 or magnitude_v2 == 0: return 0.0
    return dot_product / (magnitude_v1 * magnitude_v2)

async def worker_task():
    from database import SessionLocal
    from ai_client import get_embedding, tailor_resume
    from ats_scorer import score_resume
    
    while True:
        task = await generation_queue.get()
        task_id = task["task_id"]
        req = task["req"]
        user_id = task["user_id"]
        
        job_status[task_id] = {"status": "processing"}
        db = SessionLocal()
        try:
            profile = db.query(Profile).filter(Profile.user_id == user_id).first()
            if not profile:
                job_status[task_id] = {"status": "error", "detail": "Fill your profile first"}
                continue
            
            profile_data = {
                "name": profile.name,
                "email": profile.email,
                "phone": profile.phone,
                "linkedin": profile.linkedin,
                "skills": profile.skills or [],
                "experience": profile.experience or [],
                "education": profile.education or [],
                "projects": profile.projects or [],
            }
            
            jd_embed = await get_embedding(req.jd)
            
            records = db.query(ResumeHistory).filter(ResumeHistory.user_id == user_id).order_by(ResumeHistory.created_at.desc()).limit(20).all()
            matched_resume = None
            matched_ats = None
            
            if jd_embed:
                for r in records:
                    if r.jd_embedding:
                        sim = cosine_similarity(jd_embed, r.jd_embedding)
                        if sim > 0.93: # 93% match for semantic cache
                            matched_resume = r.generated_resume
                            matched_ats = {"score": r.ats_score, "missing": []}
                            break
            
            if matched_resume:
                resume = matched_resume
                ats = matched_ats
            else:
                resume = await tailor_resume(profile_data, req.jd)
                ats = score_resume(resume, req.jd)
                
                history = ResumeHistory(
                    user_id=user_id,
                    jd_text=req.jd,
                    jd_embedding=jd_embed,
                    generated_resume=resume,
                    ats_score=ats["score"],
                )
                db.add(history)
                db.commit()
            
            job_status[task_id] = {
                "status": "completed",
                "result": {
                    "resume": resume,
                    "ats": ats,
                }
            }
        except Exception as e:
            job_status[task_id] = {"status": "error", "detail": str(e)}
        finally:
            db.close()
            generation_queue.task_done()
            await asyncio.sleep(4.0)  # 4 second delay to protect NVIDIA rate limits

# Create tables
Base.metadata.create_all(bind=engine)

# Auto-migration: add new columns to existing tables
def _run_migrations():
    from sqlalchemy import inspect, text
    inspector = inspect(engine)
    with engine.begin() as conn:
        if 'profiles' in inspector.get_table_names():
            columns = [c['name'] for c in inspector.get_columns('profiles')]
            if 'github' not in columns:
                conn.execute(text("ALTER TABLE profiles ADD COLUMN github VARCHAR(500) DEFAULT ''"))
                logger.info("Migration: Added 'github' column to profiles table")
        if 'resume_history' in inspector.get_table_names():
            columns = [c['name'] for c in inspector.get_columns('resume_history')]
            if 'jd_embedding' not in columns:
                conn.execute(text("ALTER TABLE resume_history ADD COLUMN jd_embedding JSON"))
                logger.info("Migration: Added 'jd_embedding' column to resume_history table")

try:
    _run_migrations()
except Exception as e:
    logger.warning(f"Migration check failed (OK on fresh DB): {e}")

app = FastAPI(title="Resume Generator API", docs_url="/api/docs", redoc_url=None)

cors_origins = os.getenv(
    "CORS_ORIGINS",
    "http://localhost:5173,http://localhost:3000,https://resume-generator-sigma-two.vercel.app"
).split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["Content-Disposition"],
)

@app.on_event("startup")
async def startup_event():
    asyncio.create_task(worker_task())

# Jinja2 for LaTeX
tex_env = Environment(
    loader=FileSystemLoader(os.path.join(os.path.dirname(__file__), "templates")),
    block_start_string="{%",
    block_end_string="%}",
    variable_start_string="{{",
    variable_end_string="}}",
    comment_start_string="{#",
    comment_end_string="#}",
)


# ─── Pydantic Schemas ───────────────────────────────────────────

class RegisterRequest(BaseModel):
    email: str
    password: str


class LoginRequest(BaseModel):
    email: str
    password: str


class TokenResponse(BaseModel):
    token: str
    email: str


class ProfileUpdate(BaseModel):
    name: str = ""
    email: str = ""
    phone: str = ""
    linkedin: str = ""
    github: str = ""
    skills: list = []
    experience: list = []
    education: list = []
    projects: list = []


class GenerateRequest(BaseModel):
    jd: str


class PdfRequest(BaseModel):
    resume: dict
    name: str = ""
    email: str = ""
    phone: str = ""
    linkedin: str = ""
    github: str = ""
    template_name: str = "modern.tex.j2"
    hide_keywords: list[str] = []


MAX_LATEX_SIZE = 200_000  # 200KB max for raw LaTeX



def check_malicious_latex(latex: str):
    dangerous_patterns = [
        r'\\input',
        r'\\include',
        r'\\write18',
        r'\\immediate',
        r'\\openout',
        r'\\read',
        r'\\openin',
        r'\\catcode',
        r'\\def\\',
        r'\\let\\',
    ]
    import re
    from fastapi import HTTPException
    for pattern in dangerous_patterns:
        if re.search(pattern, latex):
            raise HTTPException(status_code=400, detail="Malicious LaTeX command detected.")

class RawLatexRequest(BaseModel):
    latex: str

class TemplateCreate(BaseModel):
    name: str
    latex_code: str


class TemplateResponse(BaseModel):
    id: int
    name: str
    latex_code: str


# ─── Auth Routes ─────────────────────────────────────────────────

@app.post("/api/auth/register", response_model=TokenResponse)
def register(req: RegisterRequest, db: Session = Depends(get_db)):
    existing = db.query(User).filter(User.email == req.email).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered",
        )
    user = User(email=req.email, hashed_password=hash_password(req.password))
    db.add(user)
    db.commit()
    db.refresh(user)
    # Create empty profile
    profile = Profile(user_id=user.id)
    db.add(profile)
    db.commit()
    return TokenResponse(token=create_token(user.id), email=user.email)


@app.post("/api/auth/login", response_model=TokenResponse)
def login(req: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == req.email).first()
    if not user or not verify_password(req.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )
    return TokenResponse(token=create_token(user.id), email=user.email)


# ─── Template Routes ─────────────────────────────────────────────

@app.get("/api/templates", response_model=list[TemplateResponse])
def get_templates(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    # Return user's templates plus any system templates (user_id=None)
    templates = db.query(Template).filter(
        (Template.user_id == user.id) | (Template.user_id == None)
    ).all()
    return templates


@app.post("/api/templates", response_model=TemplateResponse)
def create_template(
    req: TemplateCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    template = Template(
        user_id=user.id,
        name=req.name,
        latex_code=req.latex_code
    )
    db.add(template)
    db.commit()
    db.refresh(template)
    return template




# ─── Profile Routes ─────────────────────────────────────────────

@app.get("/api/profile")
def get_profile(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    profile = db.query(Profile).filter(Profile.user_id == user.id).first()
    if not profile:
        profile = Profile(user_id=user.id)
        db.add(profile)
        db.commit()
        db.refresh(profile)
    return {
        "name": profile.name or "",
        "email": profile.email or "",
        "phone": profile.phone or "",
        "linkedin": profile.linkedin or "",
        "github": getattr(profile, 'github', '') or "",
        "skills": profile.skills or [],
        "experience": profile.experience or [],
        "education": profile.education or [],
        "projects": profile.projects or [],
    }


@app.put("/api/profile")
def update_profile(
    data: ProfileUpdate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    profile = db.query(Profile).filter(Profile.user_id == user.id).first()
    if not profile:
        profile = Profile(user_id=user.id)
        db.add(profile)

    profile.name = data.name
    profile.email = data.email
    profile.phone = data.phone
    profile.linkedin = data.linkedin
    profile.github = data.github
    profile.skills = data.skills
    profile.experience = data.experience
    profile.education = data.education
    profile.projects = data.projects
    db.commit()
    db.refresh(profile)
    return {"status": "saved"}


@app.post("/api/profile/import-pdf")
async def import_pdf(
    file: UploadFile = File(...),
    user: User = Depends(get_current_user)
):
    """Upload a PDF resume, extract profile data via NVIDIA NIM."""
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files accepted")
    try:
        pdf_bytes = await file.read()
        text = extract_text_from_pdf(pdf_bytes)
        if not text.strip():
            raise HTTPException(status_code=400, detail="Could not extract text from PDF")
        profile_data = await parse_resume(text)
        return profile_data
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI Processing Error: {str(e)}")


class LatexImportRequest(BaseModel):
    latex: str


@app.post("/api/profile/import-latex")
async def import_latex(
    req: LatexImportRequest,
    user: User = Depends(get_current_user)
):
    """Parse LaTeX resume code, extract profile data via NVIDIA NIM."""
    if not req.latex.strip():
        raise HTTPException(status_code=400, detail="Empty LaTeX content")
    try:
        profile_data = await parse_resume(req.latex)
        return profile_data
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI Processing Error: {str(e)}")


# ─── Generate Routes ────────────────────────────────────────────

@app.post("/api/generate")
async def generate(
    req: GenerateRequest,
    user: User = Depends(get_current_user)
):
    task_id = str(uuid.uuid4())
    job_status[task_id] = {"status": "queued"}

    await generation_queue.put({
        "task_id": task_id,
        "req": req,
        "user_id": user.id,
    })
    
    return {"task_id": task_id}

@app.get("/api/generate/status/{task_id}")
async def get_generate_status(task_id: str):
    if task_id not in job_status:
        raise HTTPException(status_code=404, detail="Task not found")
    status_data = job_status[task_id]
    if status_data["status"] == "error":
        raise HTTPException(status_code=500, detail=status_data.get("detail", "AI Processing Error"))
    return status_data


@app.post("/api/pdf")
async def gen_pdf(req: PdfRequest, user: User = Depends(get_current_user)):
    logger.info(f"PDF generation requested by user {user.id}, template={req.template_name}")
    try:
        pdf_bytes = await generate_pdf(
            req.resume,
            profile_name=req.name,
            profile_email=req.email,
            profile_phone=req.phone,
            profile_linkedin=req.linkedin,
            profile_github=req.github,
            template_name=req.template_name,
            hide_keywords=req.hide_keywords,
        )
    except RuntimeError as e:
        logger.error(f"PDF compilation failed for user {user.id}: {e}")
        raise HTTPException(status_code=500, detail=f"PDF compilation failed: {e}")
    logger.info(f"PDF generated successfully for user {user.id}, size={len(pdf_bytes)} bytes")
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": "attachment; filename=resume.pdf"},
    )


@app.post("/api/tex")
def gen_tex(req: PdfRequest, user: User = Depends(get_current_user)):
    from pdf_generator import _escape_dict, _escape_latex
    template = tex_env.get_template(req.template_name)

    safe_resume = _escape_dict(req.resume)
    safe_name = _escape_latex(req.name)
    safe_email = _escape_latex(req.email)
    safe_phone = _escape_latex(req.phone)
    safe_linkedin = req.linkedin  # URLs: keep raw for \href
    safe_github = req.github      # URLs: keep raw for \href
    safe_hide_keywords = [_escape_latex(k) for k in (req.hide_keywords or [])]

    tex_content = template.render(
        name=safe_name,
        email=safe_email,
        phone=safe_phone,
        linkedin=safe_linkedin,
        github=safe_github,
        hide_keywords=safe_hide_keywords,
        **safe_resume,
    )
    return Response(
        content=tex_content,
        media_type="application/x-tex",
        headers={"Content-Disposition": "attachment; filename=resume.tex"},
    )



@app.post("/api/pdf/raw")
async def gen_pdf_raw(req: RawLatexRequest, user: User = Depends(get_current_user)):
    if len(req.latex) > MAX_LATEX_SIZE:
        raise HTTPException(status_code=400, detail=f"LaTeX content too large (max {MAX_LATEX_SIZE // 1000}KB)")
    check_malicious_latex(req.latex)
    logger.info(f"Raw PDF compilation requested by user {user.id}, size={len(req.latex)} bytes")
    import tempfile, asyncio
    with tempfile.TemporaryDirectory() as tmpdir:
        tex_path = os.path.join(tmpdir, "resume.tex")
        pdf_path = os.path.join(tmpdir, "resume.pdf")

        with open(tex_path, "w", encoding="utf-8") as f:
            f.write(req.latex)

        # Run pdflatex twice (resolves references/links)
        for pass_num in range(2):
            process = await asyncio.create_subprocess_exec(
                "pdflatex",
                "-interaction=nonstopmode",
                "-halt-on-error",
                "-no-shell-escape",
                "-output-directory", tmpdir,
                tex_path,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )

            try:
                stdout, stderr = await asyncio.wait_for(process.communicate(), timeout=30.0)
            except asyncio.TimeoutError:
                process.kill()
                await process.communicate()
                logger.error(f"pdflatex timed out for user {user.id} on pass {pass_num + 1}")
                raise HTTPException(status_code=500, detail="pdflatex timed out after 30 seconds")

            if process.returncode != 0:
                stdout_str = stdout.decode(errors='replace') if stdout else ""
                stderr_str = stderr.decode(errors='replace') if stderr else ""
                # Extract the actual LaTeX error line
                log_path = os.path.join(tmpdir, "resume.log")
                error_detail = ""
                if os.path.exists(log_path):
                    with open(log_path, "r", encoding="utf-8", errors="replace") as lf:
                        log_lines = lf.readlines()
                    # Find lines starting with ! (LaTeX error markers)
                    error_lines = [l.strip() for l in log_lines if l.startswith("!")]
                    error_detail = "\n".join(error_lines[:5]) if error_lines else ""
                logger.error(f"pdflatex failed for user {user.id}: {error_detail or stderr_str[:300]}")
                raise HTTPException(
                    status_code=500,
                    detail=f"PDF compilation failed.\n{error_detail or stderr_str[-500:]}"
                )

        if not os.path.exists(pdf_path):
            raise HTTPException(status_code=500, detail="PDF generation failed — no output produced")

        with open(pdf_path, "rb") as pf:
            pdf_bytes = pf.read()

    logger.info(f"Raw PDF generated for user {user.id}, size={len(pdf_bytes)} bytes")
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": "attachment; filename=resume.pdf"},
    )

@app.get("/api/health")
def health_check():
    return {"status": "ok", "service": "resumeforge-api"}


@app.get("/api/history")
def get_history(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    records = (
        db.query(ResumeHistory)
        .filter(ResumeHistory.user_id == user.id)
        .order_by(ResumeHistory.created_at.desc())
        .limit(20)
        .all()
    )
    return [
        {
            "id": r.id,
            "jd_preview": r.jd_text[:100] + "..." if len(r.jd_text) > 100 else r.jd_text,
            "ats_score": r.ats_score,
            "created_at": r.created_at.isoformat() if r.created_at else None,
            "resume": r.generated_resume,
        }
        for r in records
    ]

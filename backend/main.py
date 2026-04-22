import os
from fastapi import FastAPI, Depends, HTTPException, status, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from sqlalchemy.orm import Session
from pydantic import BaseModel, EmailStr
from typing import Optional
from jinja2 import Environment, FileSystemLoader

from database import engine, get_db, Base
from models import User, Profile, ResumeHistory, Template
from auth import hash_password, verify_password, create_token, get_current_user
from gemini import tailor_resume
from ats_scorer import score_resume
from pdf_generator import generate_pdf
from resume_parser import extract_text_from_pdf, parse_resume

# Create tables
Base.metadata.create_all(bind=engine)

app = FastAPI(title="Resume Generator API")

cors_origins = os.getenv(
    "CORS_ORIGINS",
    "http://localhost:5173,http://localhost:3000"
).split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Jinja2 for LaTeX
tex_env = Environment(
    loader=FileSystemLoader(os.path.join(os.path.dirname(__file__), "templates")),
    block_start_string="{% ",
    block_end_string=" %}",
    variable_start_string="{{ ",
    variable_end_string=" }}",
    comment_start_string="{# ",
    comment_end_string=" #}",
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
    template_id: Optional[int] = None


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
    user: User = Depends(get_current_user),
):
    """Upload a PDF resume, extract profile data via Gemini."""
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files accepted")
    pdf_bytes = await file.read()
    text = extract_text_from_pdf(pdf_bytes)
    if not text.strip():
        raise HTTPException(status_code=400, detail="Could not extract text from PDF")
    profile_data = await parse_resume(text)
    return profile_data


class LatexImportRequest(BaseModel):
    latex: str


@app.post("/api/profile/import-latex")
async def import_latex(
    req: LatexImportRequest,
    user: User = Depends(get_current_user),
):
    """Parse LaTeX resume code, extract profile data via Gemini."""
    if not req.latex.strip():
        raise HTTPException(status_code=400, detail="Empty LaTeX content")
    profile_data = await parse_resume(req.latex)
    return profile_data


# ─── Generate Routes ────────────────────────────────────────────

@app.post("/api/generate")
async def generate(
    req: GenerateRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    profile = db.query(Profile).filter(Profile.user_id == user.id).first()
    if not profile:
        raise HTTPException(status_code=400, detail="Fill your profile first")

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

    # Call Gemini
    resume = await tailor_resume(profile_data, req.jd)

    # Score ATS
    ats = score_resume(resume, req.jd)

    # Save to history
    history = ResumeHistory(
        user_id=user.id,
        jd_text=req.jd,
        generated_resume=resume,
        ats_score=ats["score"],
    )
    db.add(history)
    db.commit()

    return {
        "resume": resume,
        "ats": ats,
    }


@app.post("/api/pdf")
def gen_pdf(req: PdfRequest):
    try:
        pdf_bytes = generate_pdf(
            req.resume,
            profile_name=req.name,
            profile_email=req.email,
            profile_phone=req.phone,
            profile_linkedin=req.linkedin,
        )
    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=f"PDF compilation failed: {e}")
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": "attachment; filename=resume.pdf"},
    )


@app.post("/api/tex")
def gen_tex(req: PdfRequest, db: Session = Depends(get_db)):
    if req.template_id:
        template_obj = db.query(Template).filter(Template.id == req.template_id).first()
        from jinja2 import Template as JinjaTemplate
        if not template_obj:
            raise HTTPException(status_code=404, detail="Template not found")
        template = JinjaTemplate(template_obj.latex_code)
    else:
        template = tex_env.get_template("resume.tex.j2")
        
    tex_content = template.render(
        name=req.name,
        email=req.email,
        phone=req.phone,
        linkedin=req.linkedin,
        **req.resume,
    )
    return Response(
        content=tex_content,
        media_type="application/x-tex",
        headers={"Content-Disposition": "attachment; filename=resume.tex"},
    )


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

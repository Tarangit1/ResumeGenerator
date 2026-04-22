from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, JSON, Float
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
from database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    profile = relationship("Profile", back_populates="user", uselist=False)
    resume_history = relationship("ResumeHistory", back_populates="user")
    templates = relationship("Template", back_populates="user")


class Profile(Base):
    __tablename__ = "profiles"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), unique=True, nullable=False)
    name = Column(String(255), default="")
    email = Column(String(255), default="")
    phone = Column(String(50), default="")
    linkedin = Column(String(500), default="")
    skills = Column(JSON, default=list)  # ["Python", "React", ...]
    experience = Column(JSON, default=list)
    # [{ "title": "...", "company": "...", "start": "...", "end": "...", "bullets": ["..."] }]
    education = Column(JSON, default=list)
    # [{ "degree": "...", "school": "...", "year": "..." }]
    projects = Column(JSON, default=list)
    # [{ "name": "...", "description": "...", "tech": ["..."] }]
    updated_at = Column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    user = relationship("User", back_populates="profile")


class ResumeHistory(Base):
    __tablename__ = "resume_history"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    jd_text = Column(String, nullable=False)
    generated_resume = Column(JSON, nullable=False)
    ats_score = Column(Float, default=0.0)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    user = relationship("User", back_populates="resume_history")


class Template(Base):
    __tablename__ = "templates"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)  # Null if system default
    name = Column(String(255), nullable=False)
    latex_code = Column(String, nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    user = relationship("User", back_populates="templates")

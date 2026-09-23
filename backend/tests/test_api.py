import pytest
import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from main import app, Base, get_db

# Use an in-memory SQLite database for testing, but let's use a temporary file so connection scoping isn't as tricky
SQLALCHEMY_DATABASE_URL = "sqlite:///./test_gen.db"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()

app.dependency_overrides[get_db] = override_get_db

client = TestClient(app)

@pytest.fixture(scope="module", autouse=True)
def setup_database():
    # create tables
    Base.metadata.create_all(bind=engine)
    yield
    # drop tables
    Base.metadata.drop_all(bind=engine)
    if os.path.exists("./test_gen.db"):
        os.remove("./test_gen.db")

def test_register():
    response = client.post("/api/auth/register", json={"email": "test@example.com", "password": "password123"})
    assert response.status_code == 200
    assert "token" in response.json()
    assert response.json()["email"] == "test@example.com"

def test_register_duplicate():
    response = client.post("/api/auth/register", json={"email": "test@example.com", "password": "password123"})
    assert response.status_code == 400
    assert response.json()["detail"] == "Email already registered"

def test_login():
    response = client.post("/api/auth/login", json={"email": "test@example.com", "password": "password123"})
    assert response.status_code == 200
    assert "token" in response.json()

def test_login_invalid():
    response = client.post("/api/auth/login", json={"email": "test@example.com", "password": "wrongpassword"})
    assert response.status_code == 401

def test_get_profile_unauthorized():
    response = client.get("/api/profile")
    assert response.status_code == 401

def test_get_and_update_profile():
    # Login first
    login_response = client.post("/api/auth/login", json={"email": "test@example.com", "password": "password123"})
    token = login_response.json()["token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Get empty profile
    response = client.get("/api/profile", headers=headers)
    assert response.status_code == 200
    assert response.json()["name"] == ""

    # Update profile
    update_data = {
        "name": "Test User",
        "email": "test@example.com",
        "phone": "1234567890",
        "linkedin": "linkedin.com/test",
        "skills": ["Python"],
        "experience": [],
        "education": [],
        "projects": []
    }
    response = client.put("/api/profile", json=update_data, headers=headers)
    assert response.status_code == 200

    # Get updated profile
    response = client.get("/api/profile", headers=headers)
    assert response.status_code == 200
    assert response.json()["name"] == "Test User"
    assert response.json()["skills"] == ["Python"]


def test_invalid_template_name():
    login_response = client.post("/api/auth/login", json={"email": "test@example.com", "password": "password123"})
    token = login_response.json()["token"]
    headers = {"Authorization": f"Bearer {token}"}

    payload = {
        "resume": {},
        "name": "Test User",
        "template_name": "../../../etc/passwd"
    }
    response = client.post("/api/tex", json=payload, headers=headers)
    assert response.status_code == 400
    assert "Invalid or disallowed template name" in response.json()["detail"]


def test_latex_url_injection():
    login_response = client.post("/api/auth/login", json={"email": "test@example.com", "password": "password123"})
    token = login_response.json()["token"]
    headers = {"Authorization": f"Bearer {token}"}

    payload = {
        "resume": {},
        "name": "Test User",
        "linkedin": "https://linkedin.com/in/user} \\input{/etc/passwd} %",
        "github": "https://github.com/user#section",
        "template_name": "resume.tex.j2"
    }
    response = client.post("/api/tex", json=payload, headers=headers)
    assert response.status_code == 200
    tex_content = response.text
    # Verify LaTeX control chars are escaped in the URL
    assert r"\} \textbackslash{}input\{/etc/passwd\} \%" in tex_content
    assert r"https://linkedin.com/in/user} \input" not in tex_content
    assert r"\#" in tex_content

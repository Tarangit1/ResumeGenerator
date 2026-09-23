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

def test_generate_status_security():
    from main import job_status

    # Register second user
    client.post("/api/auth/register", json={"email": "other@example.com", "password": "password123"})
    login_user1 = client.post("/api/auth/login", json={"email": "test@example.com", "password": "password123"}).json()
    login_user2 = client.post("/api/auth/login", json={"email": "other@example.com", "password": "password123"}).json()

    user1_headers = {"Authorization": f"Bearer {login_user1['token']}"}
    user2_headers = {"Authorization": f"Bearer {login_user2['token']}"}

    task_id = "test-task-uuid-123"
    job_status[task_id] = {"status": "queued", "user_id": 1}  # User 1 ID

    # 1. Unauthenticated request should fail (401)
    res_unauth = client.get(f"/api/generate/status/{task_id}")
    assert res_unauth.status_code == 401

    # 2. User 2 trying to access User 1's task should be forbidden (403)
    res_forbidden = client.get(f"/api/generate/status/{task_id}", headers=user2_headers)
    assert res_forbidden.status_code == 403

    # 3. User 1 accessing own task status should succeed (200)
    res_authorized = client.get(f"/api/generate/status/{task_id}", headers=user1_headers)
    assert res_authorized.status_code == 200
    assert res_authorized.json()["status"] == "queued"

import os
from datetime import datetime, timedelta, timezone
import bcrypt
from jose import JWTError, jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from database import get_db
from models import User

SECRET_KEY = os.getenv("JWT_SECRET", "super-secret-change-me-in-prod")
ALGORITHM = "HS256"
TOKEN_EXPIRY_HOURS = 24

security = HTTPBearer()


def hash_password(plain: str) -> str:
    pwd_bytes = plain.encode("utf-8")[:72]  # bcrypt max 72 bytes
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(pwd_bytes, salt).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    pwd_bytes = plain.encode("utf-8")[:72]
    return bcrypt.checkpw(pwd_bytes, hashed.encode("utf-8"))


def create_token(user_id: int) -> str:
    expire = datetime.now(timezone.utc) + timedelta(hours=TOKEN_EXPIRY_HOURS)
    payload = {"sub": str(user_id), "exp": expire}
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db),
) -> User:
    token = credentials.credentials
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = int(payload.get("sub"))
    except (JWTError, ValueError, TypeError):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
        )
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
        )
    return user

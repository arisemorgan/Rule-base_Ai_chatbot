import os, bcrypt, jwt
from datetime import datetime, timedelta, timezone
from fastapi import Depends, HTTPException
from fastapi.security import HTTPBearer
from .models import db, User
SECRET = os.getenv("SECRET_KEY", "change-me")
bearer = HTTPBearer(auto_error=False)
def hash_pw(p): return bcrypt.hashpw(p.encode(), bcrypt.gensalt()).decode()
def check_pw(p, h): return bool(h) and bcrypt.checkpw(p.encode(), h.encode())
def make_token(u): return jwt.encode({"sub": str(u.id), "exp": datetime.now(timezone.utc) + timedelta(hours=12)}, SECRET, "HS256")
def optional(c=Depends(bearer), s=Depends(db)):
    if not c: return None
    try: return s.get(User, int(jwt.decode(c.credentials, SECRET, ["HS256"])["sub"]))
    except Exception: return None
def require(*roles):
    def dep(u=Depends(optional)):
        if not u: raise HTTPException(401, "Not authenticated")
        if roles and u.role not in roles: raise HTTPException(403, "You do not have permission")
        return u
    return dep

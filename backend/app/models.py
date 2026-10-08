import os, json
from datetime import datetime
from sqlalchemy import create_engine, Column, Integer, String, Text, Boolean, DateTime, ForeignKey, Float
from sqlalchemy.orm import declarative_base, sessionmaker
URL = os.getenv("DATABASE_URL", "sqlite:///./chatbot.db")
engine = create_engine(URL, connect_args={"check_same_thread": False} if URL.startswith("sqlite") else {})
SessionLocal = sessionmaker(bind=engine, autoflush=False)
Base = declarative_base()
def db():
    s = SessionLocal()
    try: yield s
    finally: s.close()
now = datetime.utcnow
class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True); name = Column(String(120)); email = Column(String(200), unique=True, index=True)
    password_hash = Column(String(200)); role = Column(String(20), default="customer"); created_at = Column(DateTime, default=now)
class Business(Base):
    __tablename__ = "businesses"
    id = Column(Integer, primary_key=True); name = Column(String(200), default="My Business"); description = Column(Text, default="")
    phone = Column(String(60), default=""); email = Column(String(200), default=""); address = Column(Text, default="")
    opening_hours = Column(Text, default=""); welcome = Column(Text, default="Hello! 👋 How can I help you today?")
class Intent(Base):
    __tablename__ = "intents"
    id = Column(Integer, primary_key=True); name = Column(String(60), unique=True); description = Column(String(200), default="")
class Rule(Base):
    __tablename__ = "rules"
    id = Column(Integer, primary_key=True); intent = Column(String(60)); keywords = Column(Text, default="[]")
    priority = Column(Integer, default=50); response = Column(Text); is_active = Column(Boolean, default=True); created_at = Column(DateTime, default=now)
class Faq(Base):
    __tablename__ = "faqs"
    id = Column(Integer, primary_key=True); question = Column(Text); answer = Column(Text); is_active = Column(Boolean, default=True)
class Conversation(Base):
    __tablename__ = "conversations"
    id = Column(Integer, primary_key=True); session_id = Column(String(64), unique=True, index=True); customer_name = Column(String(120), default="Guest")
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True); status = Column(String(20), default="OPEN")
    started_at = Column(DateTime, default=now); ended_at = Column(DateTime, nullable=True)
class Message(Base):
    __tablename__ = "messages"
    id = Column(Integer, primary_key=True); conversation_id = Column(Integer, ForeignKey("conversations.id"), index=True)
    sender = Column(String(10)); text = Column(Text); intent = Column(String(60), nullable=True); rule_id = Column(Integer, nullable=True)
    ms = Column(Float, nullable=True); created_at = Column(DateTime, default=now)
class Unanswered(Base):
    __tablename__ = "unanswered"
    id = Column(Integer, primary_key=True); text = Column(Text); conversation_id = Column(Integer); status = Column(String(12), default="OPEN"); created_at = Column(DateTime, default=now)
def ser(o):
    d = {}
    for c in o.__table__.columns:
        if c.name == "password_hash": continue
        v = getattr(o, c.name)
        d[c.name] = v.isoformat() + "Z" if isinstance(v, datetime) else v
    if "keywords" in d: d["keywords"] = json.loads(d["keywords"] or "[]")
    return d

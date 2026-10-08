from dotenv import load_dotenv; load_dotenv()
import os, json, time
from datetime import datetime
from typing import Optional, List
from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from .models import *
from .security import hash_pw, check_pw, make_token, optional, require
from .engine import match, fill
INTENTS = ["greeting","business_hours","products","pricing","location","delivery","payment","refund","order_status","complaint","contact_support","goodbye"]
Base.metadata.create_all(engine)
with SessionLocal() as s:
    for n in INTENTS:
        if not s.query(Intent).filter_by(name=n).first(): s.add(Intent(name=n, description=n.replace("_", " ")))
    if not s.query(Business).first(): s.add(Business())
    if not s.query(User).first() and os.getenv("ADMIN_EMAIL") and os.getenv("ADMIN_PASSWORD"):
        s.add(User(name=os.getenv("ADMIN_NAME", "Administrator"), email=os.getenv("ADMIN_EMAIL").lower(), password_hash=hash_pw(os.getenv("ADMIN_PASSWORD")), role="admin"))
    s.commit()
app = FastAPI(title="SmartDesk Rule-Based Support Chatbot")
app.add_middleware(CORSMiddleware, allow_origins=os.getenv("CORS_ORIGINS", "http://localhost:5173").split(","), allow_methods=["*"], allow_headers=["*"])
STAFF = ("admin", "agent"); ADMIN = ("admin",)
class Login(BaseModel): email: str; password: str
class Reg(BaseModel): name: str = Field(min_length=2, max_length=100); email: str = Field(pattern=r"^[^@\s]+@[^@\s]+\.[^@\s]+$"); password: str = Field(min_length=8, max_length=100)
class UserIn(BaseModel): name: str; email: str; password: Optional[str] = Field(None, min_length=8); role: str = "agent"
class RuleIn(BaseModel): intent: str; keywords: List[str] = Field(min_length=1); priority: int = Field(50, ge=0, le=100); response: str = Field(min_length=1); is_active: bool = True
class FaqIn(BaseModel): question: str = Field(min_length=3); answer: str = Field(min_length=1); is_active: bool = True
class BizIn(BaseModel): name: str; description: str = ""; phone: str = ""; email: str = ""; address: str = ""; opening_hours: str = ""; welcome: str = ""
class Msg(BaseModel): session_id: str = Field(min_length=8, max_length=64); text: str = Field(min_length=1, max_length=1000)
class Reply(BaseModel): text: str = Field(min_length=1, max_length=2000)
class ToRule(BaseModel): intent: str; keywords: List[str]; response: str; priority: int = 50
def kw(k): return [x.strip().lower() for x in k if x.strip()]
# ---------- auth ----------
@app.post("/api/auth/login")
def login(b: Login, s: Session = Depends(db)):
    u = s.query(User).filter_by(email=b.email.lower().strip()).first()
    if not u or not check_pw(b.password, u.password_hash): raise HTTPException(401, "Invalid email or password")
    return {"token": make_token(u), "user": ser(u)}
@app.post("/api/auth/register")
def register(b: Reg, s: Session = Depends(db)):
    if s.query(User).filter_by(email=b.email.lower()).first(): raise HTTPException(409, "Email already registered")
    u = User(name=b.name.strip(), email=b.email.lower(), password_hash=hash_pw(b.password), role="customer"); s.add(u); s.commit()
    return {"token": make_token(u), "user": ser(u)}
@app.get("/api/auth/me")
def me(u=Depends(require())): return ser(u)
# ---------- chat ----------
def get_conv(s, sid, user):
    c = s.query(Conversation).filter_by(session_id=sid).first()
    if not c:
        c = Conversation(session_id=sid, customer_name=user.name if user else "Guest", user_id=user.id if user else None); s.add(c); s.commit()
    return c
def quick(s):
    out, seen = [], set()
    for r in s.query(Rule).filter_by(is_active=True).order_by(Rule.priority.desc()):
        k = json.loads(r.keywords)
        if r.intent not in seen and k and r.intent not in ("greeting", "goodbye", "contact_support"): seen.add(r.intent); out.append({"label": r.intent.replace("_", " ").title(), "text": k[0]})
    return out[:6]
@app.get("/api/chat/init")
def init(session_id: str, s: Session = Depends(db)):
    b = s.query(Business).first(); c = s.query(Conversation).filter_by(session_id=session_id).first()
    hist = [ser(m) for m in s.query(Message).filter_by(conversation_id=c.id).order_by(Message.id)] if c else []
    return {"business": b.name, "welcome": b.welcome, "quick": quick(s), "status": c.status if c else "OPEN", "messages": hist}
@app.post("/api/chat/message")
def chat(b: Msg, s: Session = Depends(db), u=Depends(optional)):
    t0 = time.perf_counter(); c = get_conv(s, b.session_id, u)
    s.add(Message(conversation_id=c.id, sender="customer", text=b.text.strip()))
    if c.status == "HUMAN_REQUIRED":
        s.commit(); return {"reply": None, "status": c.status}
    if c.status == "CLOSED": c.status = "OPEN"; c.ended_at = None
    biz = s.query(Business).first()
    rules = [(r.id, r.intent, json.loads(r.keywords), r.priority, r.response) for r in s.query(Rule).filter_by(is_active=True)]
    faqs = [(f.id, f.question, f.answer) for f in s.query(Faq).filter_by(is_active=True)]
    m = match(b.text, rules, faqs); ms = round((time.perf_counter() - t0) * 1000, 2)
    if m:
        reply, intent, rid, offer = fill(m["response"], biz), m["intent"], m["rule_id"], False
        c.status = "HUMAN_REQUIRED" if intent == "contact_support" else "BOT_RESOLVED"
    else:
        reply = "I'm sorry, I don't have enough information to answer that. Would you like to speak with a support representative?"
        intent, rid, offer = "unknown", None, True; s.add(Unanswered(text=b.text.strip(), conversation_id=c.id)); c.status = "OPEN"
    s.add(Message(conversation_id=c.id, sender="bot", text=reply, intent=intent, rule_id=rid, ms=ms)); s.commit()
    return {"reply": reply, "intent": intent, "offer_escalation": offer, "status": c.status, "ms": ms}
@app.post("/api/chat/escalate")
def escalate(b: dict, s: Session = Depends(db), u=Depends(optional)):
    sid = str(b.get("session_id", ""))
    if len(sid) < 8: raise HTTPException(422, "Invalid session")
    c = get_conv(s, sid, u); c.status = "HUMAN_REQUIRED"
    s.add(Message(conversation_id=c.id, sender="bot", text="Thanks! A support representative has been notified and will reply here shortly.", intent="contact_support")); s.commit()
    return {"status": c.status}
@app.get("/api/chat/{session_id}/messages")
def poll(session_id: str, s: Session = Depends(db)):
    c = s.query(Conversation).filter_by(session_id=session_id).first()
    if not c: return {"status": "OPEN", "messages": []}
    return {"status": c.status, "messages": [ser(m) for m in s.query(Message).filter_by(conversation_id=c.id).order_by(Message.id)]}
@app.get("/api/my/conversations")
def mine(s: Session = Depends(db), u=Depends(require())):
    out = []
    for c in s.query(Conversation).filter_by(user_id=u.id).order_by(Conversation.id.desc()).limit(50):
        last = s.query(Message).filter_by(conversation_id=c.id).order_by(Message.id.desc()).first()
        out.append({**ser(c), "last": last.text if last else ""})
    return out
# ---------- conversations ----------
@app.get("/api/conversations")
def convs(status: Optional[str] = None, s: Session = Depends(db), _=Depends(require(*STAFF))):
    q = s.query(Conversation)
    if status: q = q.filter_by(status=status)
    out = []
    for c in q.order_by(Conversation.id.desc()).limit(200):
        last = s.query(Message).filter_by(conversation_id=c.id).order_by(Message.id.desc()).first()
        out.append({**ser(c), "last": last.text if last else "", "count": s.query(Message).filter_by(conversation_id=c.id).count()})
    return out
def need(s, cid):
    c = s.get(Conversation, cid)
    if not c: raise HTTPException(404, "Not found")
    return c
@app.get("/api/conversations/{cid}")
def conv(cid: int, s: Session = Depends(db), _=Depends(require(*STAFF))):
    c = need(s, cid); return {**ser(c), "messages": [ser(m) for m in s.query(Message).filter_by(conversation_id=cid).order_by(Message.id)]}
@app.post("/api/conversations/{cid}/reply")
def agent_reply(cid: int, b: Reply, s: Session = Depends(db), _=Depends(require(*STAFF))):
    c = need(s, cid); s.add(Message(conversation_id=cid, sender="agent", text=b.text.strip())); c.status = "HUMAN_REQUIRED"; s.commit(); return {"ok": True}
@app.post("/api/conversations/{cid}/close")
def close(cid: int, s: Session = Depends(db), _=Depends(require(*STAFF))):
    c = need(s, cid); c.status = "CLOSED"; c.ended_at = datetime.utcnow(); s.commit(); return {"ok": True}
# ---------- generic CRUD ----------
def crud(path, M, In, write, read=STAFF, prep=lambda d, new: d):
    @app.get(f"/api/{path}")
    def lst(s: Session = Depends(db), _=Depends(require(*read))): return [ser(o) for o in s.query(M).order_by(M.id.desc())]
    @app.post(f"/api/{path}")
    def add(b: In, s: Session = Depends(db), _=Depends(require(*write))):
        o = M(**prep(b.model_dump(), True)); s.add(o)
        try: s.commit()
        except Exception: s.rollback(); raise HTTPException(409, "Could not save (duplicate?)")
        return ser(o)
    @app.put(f"/api/{path}/{{oid}}")
    def upd(oid: int, b: In, s: Session = Depends(db), _=Depends(require(*write))):
        o = s.get(M, oid)
        if not o: raise HTTPException(404, "Not found")
        for k, v in prep(b.model_dump(), False).items(): setattr(o, k, v)
        try: s.commit()
        except Exception: s.rollback(); raise HTTPException(409, "Could not save (duplicate?)")
        return ser(o)
    @app.delete(f"/api/{path}/{{oid}}")
    def rm(oid: int, s: Session = Depends(db), me=Depends(require(*write))):
        o = s.get(M, oid)
        if not o: raise HTTPException(404, "Not found")
        if M is User and o.id == me.id: raise HTTPException(400, "You cannot delete yourself")
        s.delete(o); s.commit(); return {"ok": True}
def rule_prep(d, new): d["keywords"] = json.dumps(kw(d["keywords"])); return d
def user_prep(d, new):
    d["email"] = d["email"].lower().strip(); pw = d.pop("password", None)
    if d["role"] not in ("admin", "agent", "customer"): raise HTTPException(422, "Invalid role")
    if pw: d["password_hash"] = hash_pw(pw)
    elif new: raise HTTPException(422, "Password is required (min 8 characters)")
    return d
crud("rules", Rule, RuleIn, ADMIN, prep=rule_prep); crud("faqs", Faq, FaqIn, ADMIN); crud("users", User, UserIn, ADMIN, read=ADMIN, prep=user_prep)
@app.get("/api/intents")
def intents(s: Session = Depends(db), _=Depends(require(*STAFF))): return [i.name for i in s.query(Intent).order_by(Intent.id)]
# ---------- business ----------
@app.get("/api/business")
def biz(s: Session = Depends(db), _=Depends(require(*STAFF))): return ser(s.query(Business).first())
@app.put("/api/business")
def biz_put(b: BizIn, s: Session = Depends(db), _=Depends(require(*ADMIN))):
    o = s.query(Business).first()
    for k, v in b.model_dump().items(): setattr(o, k, v)
    s.commit(); return ser(o)
# ---------- unanswered ----------
@app.get("/api/unanswered")
def un(status: str = "OPEN", s: Session = Depends(db), _=Depends(require(*STAFF))): return [ser(o) for o in s.query(Unanswered).filter_by(status=status).order_by(Unanswered.id.desc())]
@app.post("/api/unanswered/{oid}/rule")
def un_rule(oid: int, b: ToRule, s: Session = Depends(db), _=Depends(require(*ADMIN))):
    o = s.get(Unanswered, oid)
    if not o or not kw(b.keywords) or not b.response.strip(): raise HTTPException(422, "Invalid request")
    s.add(Rule(intent=b.intent, keywords=json.dumps(kw(b.keywords)), priority=b.priority, response=b.response)); o.status = "RESOLVED"; s.commit(); return {"ok": True}
@app.post("/api/unanswered/{oid}/dismiss")
def un_dismiss(oid: int, s: Session = Depends(db), _=Depends(require(*STAFF))):
    o = s.get(Unanswered, oid)
    if o: o.status = "DISMISSED"; s.commit()
    return {"ok": True}
# ---------- analytics ----------
@app.get("/api/analytics")
def analytics(s: Session = Depends(db), _=Depends(require(*STAFF))):
    total = s.query(Conversation).count(); today = s.query(Conversation).filter(Conversation.started_at >= datetime.utcnow().replace(hour=0, minute=0, second=0)).count()
    esc = s.query(Conversation).filter_by(status="HUMAN_REQUIRED").count()
    bad = {x[0] for x in s.query(Message.conversation_id).filter(Message.intent == "unknown")}
    ids = [x[0] for x in s.query(Conversation.id).filter(Conversation.status != "HUMAN_REQUIRED")]
    auto = len([i for i in ids if i not in bad and s.query(Message).filter_by(conversation_id=i, sender="bot").first()])
    bots = s.query(Message).filter(Message.sender == "bot", Message.ms.isnot(None)).all(); dist = {}
    for m in bots: dist[m.intent] = dist.get(m.intent, 0) + 1
    matched = sum(v for k, v in dist.items() if k != "unknown")
    return {"total": total, "today": today, "escalated": esc, "auto_resolved": auto, "resolution_rate": round(auto / total * 100, 1) if total else 0,
            "match_rate": round(matched / len(bots) * 100, 1) if bots else 0, "avg_ms": round(sum(m.ms for m in bots) / len(bots), 2) if bots else 0,
            "unanswered": s.query(Unanswered).filter_by(status="OPEN").count(), "active_rules": s.query(Rule).filter_by(is_active=True).count(),
            "distribution": sorted([{"intent": k, "count": v} for k, v in dist.items()], key=lambda x: -x["count"])}
# ---------- serve built frontend (production) ----------
DIST = os.path.join(os.path.dirname(__file__), "..", "..", "frontend", "dist")
if os.path.isdir(os.path.join(DIST, "assets")):
    app.mount("/assets", StaticFiles(directory=os.path.join(DIST, "assets")), name="assets")
    @app.get("/{p:path}")
    def spa(p: str): return FileResponse(os.path.join(DIST, "index.html"))
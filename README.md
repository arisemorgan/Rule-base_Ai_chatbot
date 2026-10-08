# SmartDesk — Rule-Based Customer Support Chatbot (Final Year Project)

Web chatbot for small businesses. **No AI/LLM** — a transparent rule engine (normalize → match keywords/phrases → rule priority → response), with admin dashboard, role-based access, escalation to human agents, and an "Unanswered → Create Rule" workflow. No mock data: everything is stored in the database and starts empty.

## Stack
FastAPI + SQLAlchemy (SQLite by default, PostgreSQL supported) · React + Vite · JWT auth + bcrypt.

## Requirements
Python 3.10+ and Node.js 18+.

## Install & run (development)
**1. Backend**
```bash
cd backend
python -m venv venv
source venv/bin/activate          # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env              # Windows: copy .env.example .env
# EDIT .env: set SECRET_KEY, ADMIN_EMAIL, ADMIN_PASSWORD
uvicorn app.main:app --reload --port 8000
```
API docs: http://localhost:8000/docs. On first start the admin account from `.env` is created.
(Using SQLite? Remove `psycopg2-binary` from requirements if it fails to install.)

**2. Frontend** (new terminal)
```bash
cd frontend
npm install
npm run dev
```
Open http://localhost:5173

## Production (single server)
```bash
cd frontend && npm install && npm run build
cd ../backend && uvicorn app.main:app --host 0.0.0.0 --port 8000
```
The backend serves the built frontend at http://localhost:8000. Set `CORS_ORIGINS` and a strong `SECRET_KEY`; use PostgreSQL via `DATABASE_URL`.

## Roles
| Role | Access |
|---|---|
| **admin** | Everything: rules, FAQs, business settings, users, conversations, unanswered → rules, analytics |
| **agent** | Dashboard, conversations (reply/close), unanswered (dismiss), read-only rules/FAQs |
| **customer** | Signs up publicly; chat only (guests can chat without an account) |

Public sign-up only creates customers. Admins create agents/admins under **Users**.

## First-use workflow
1. Sign in as admin → **Business**: fill name, hours, phone, address, delivery info.
2. **Rules**: create rules per intent, e.g. intent `business_hours`, keywords `open, opening, close, hours`, response `We are open {hours}.` Placeholders: `{name} {phone} {email} {address} {hours}`.
3. Chat at `/chat`. Unknown questions are logged under **Unanswered** → click *Create rule*.
4. "Talk to human" sets the conversation to `HUMAN_REQUIRED`; agents reply under **Conversations** and the customer sees replies live (4 s polling).

## Rule engine scoring
| Score | Condition |
|---|---|
| 100 | Message consists exactly of matched keywords/phrases |
| 80 | Two or more keywords/phrases matched |
| 70 | FAQ question similarity |
| 60 | Single keyword matched |
| <60 | No match → logged as unanswered, escalation offered |
Ties are broken by rule priority (0–100). Words are stemmed lightly (s/es/ed/ing).

## Evaluation (Chapter 4)
Dashboard shows resolution rate, match rate, avg engine response time (ms, stored per message) and intent distribution. For intent accuracy, run your 100–200 labelled test questions through `POST /api/chat/message` and compare each reply's `intent` to your label.

## Structure
```
backend/app/  main.py (API) · engine.py (rule engine) · models.py (DB) · security.py (JWT, roles)
frontend/src/ App.jsx (landing, auth, shell) · Chat.jsx · Admin.jsx · styles.css
```

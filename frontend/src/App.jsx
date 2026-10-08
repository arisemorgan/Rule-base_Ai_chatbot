import React, { useEffect, useState } from 'react'
import { Auth, useAuth } from './auth.js'
import { Routes, Route, Navigate, Link, NavLink, useNavigate, Outlet } from 'react-router-dom'
import { MessageCircle, LayoutDashboard, Inbox, HelpCircle, Workflow, BookOpen, Settings, Users, LogOut, Bot } from 'lucide-react'
import { api, tok } from './api'
import Chat from './Chat.jsx'
import Account from './Account.jsx'
import { Dashboard, Conversations, Unanswered, Rules, Faqs, Business, UsersPage } from './Admin.jsx'
export const Brand = () => <Link to="/" className="brand"><Bot size={22} /> <span className="gold">SmartDesk</span></Link>
function Landing() {
  const { user } = useAuth()
  return <div className="hero"><nav className="top"><Brand /><div className="row">
    {user ? <Link className="btn ghost" to={user.role === 'customer' ? '/account' : '/admin'}>{user.role === 'customer' ? 'My account' : 'Dashboard'}</Link> : <><Link className="btn ghost" to="/login">Sign in</Link><Link className="btn" to="/register">Sign up</Link></>}
  </div></nav>
    <div className="heroBody fade"><h1 className="gold">Your Questions,<br />Answered Instantly.</h1><p>Get quick answers about our business — hours, delivery, pricing, payments and more. Need a person? One click and a support agent takes over.</p>
      <Link className="btn big" to="/chat"><MessageCircle size={18} /> Start Chat</Link></div>
    <div className="feat">{[['Instant answers', 'Transparent rules, no guesswork.'], ['Human escalation', 'Talk to a real agent any time.'], ['Always improving', 'Unanswered questions become new rules.']].map(([a, b]) => <div className="card" key={a}><h3 className="gold">{a}</h3><p>{b}</p></div>)}</div></div>
}
function AuthPage({ mode }) {
  const nav = useNavigate(), { setUser } = useAuth(), reg = mode === 'register'
  const [f, setF] = useState({ name: '', email: '', password: '' }), [err, setErr] = useState(''), [busy, setBusy] = useState(false)
  const go = async e => {
    e.preventDefault(); setErr(''); setBusy(true)
    try { const r = await api(reg ? '/auth/register' : '/auth/login', { method: 'POST', body: f }); localStorage.setItem('token', r.token); setUser(r.user); nav(r.user.role === 'customer' ? '/account' : '/admin', { state: reg ? { welcome: true } : null }) }
    catch (x) { setErr(x.message) } finally { setBusy(false) }
  }
  return <div className="center"><form className="card auth fade" onSubmit={go}><Brand /><h2 className="gold">{reg ? 'Create your account' : 'Welcome back'}</h2>
    {reg && <label>Full name<input required minLength={2} value={f.name} onChange={e => setF({ ...f, name: e.target.value })} /></label>}
    <label>Email<input type="email" required value={f.email} onChange={e => setF({ ...f, email: e.target.value })} /></label>
    <label>Password<input type="password" required minLength={reg ? 8 : 1} value={f.password} onChange={e => setF({ ...f, password: e.target.value })} /></label>
    {err && <div className="err">{err}</div>}<button className="btn" disabled={busy}>{busy ? 'Please wait…' : reg ? 'Sign up' : 'Sign in'}</button>
    <p className="muted">{reg ? <>Already registered? <Link to="/login">Sign in</Link></> : <>New customer? <Link to="/register">Create an account</Link></>}</p></form></div>
}
const NAV = [['/admin', LayoutDashboard, 'Dashboard', 1], ['/admin/conversations', Inbox, 'Conversations', 1], ['/admin/unanswered', HelpCircle, 'Unanswered', 1], ['/admin/rules', Workflow, 'Rules', 1], ['/admin/faqs', BookOpen, 'FAQs', 1], ['/admin/business', Settings, 'Business', 1], ['/admin/users', Users, 'Users', 0]]
function Shell() {
  const { user, setUser } = useAuth(), nav = useNavigate()
  if (!user) return <Navigate to="/login" replace />
  if (user.role === 'customer') return <Navigate to="/account" replace />
  return <div className="shell"><aside><Brand /><nav>{NAV.filter(n => n[3] || user.role === 'admin').map(([to, I, l]) => <NavLink key={to} to={to} end={to === '/admin'}><I size={18} />{l}</NavLink>)}</nav>
    <div className="who"><b>{user.name}</b><span className="tag">{user.role}</span><button className="btn ghost" onClick={() => { localStorage.removeItem('token'); setUser(null); nav('/') }}><LogOut size={16} /> Sign out</button></div></aside>
    <main><Outlet /></main></div>
}
export default function App() {
  const [user, setUser] = useState(null), [ready, setReady] = useState(!tok())
  useEffect(() => { if (tok()) api('/auth/me').then(setUser).catch(() => localStorage.removeItem('token')).finally(() => setReady(true)) }, [])
  if (!ready) return <div className="center muted">Loading…</div>
  return <Auth.Provider value={{ user, setUser }}><Routes>
    <Route path="/" element={<Landing />} /><Route path="/login" element={<AuthPage mode="login" />} /><Route path="/register" element={<AuthPage mode="register" />} /><Route path="/chat" element={<Chat />} /><Route path="/account" element={<Account />} />
    <Route path="/admin" element={<Shell />}><Route index element={<Dashboard />} /><Route path="conversations" element={<Conversations />} /><Route path="unanswered" element={<Unanswered />} />
      <Route path="rules" element={<Rules />} /><Route path="faqs" element={<Faqs />} /><Route path="business" element={<Business />} /><Route path="users" element={user?.role === 'admin' ? <UsersPage /> : <Navigate to="/admin" />} /></Route>
    <Route path="*" element={<Navigate to="/" />} /></Routes></Auth.Provider>
}
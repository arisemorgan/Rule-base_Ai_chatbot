import React, { useEffect, useState } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { MessageCircle, LogOut } from 'lucide-react'
import { api } from './api'
import { useAuth } from './auth.js'
import { Brand } from './App.jsx'
export default function Account() {
  const { user, setUser } = useAuth(), loc = useLocation(), nav = useNavigate(), [list, setList] = useState(null)
  useEffect(() => { if (user) api('/my/conversations').then(setList).catch(() => setList([])) }, [user])
  if (!user) return <Navigate to="/login" replace />
  if (user.role !== 'customer') return <Navigate to="/admin" replace />
  return <div className="hero"><nav className="top"><Brand /><button className="btn ghost" onClick={() => { localStorage.removeItem('token'); setUser(null); nav('/') }}><LogOut size={16} /> Sign out</button></nav>
    <div style={{ maxWidth: 800, margin: '4vh auto' }}>
      {loc.state?.welcome && <div className="card fade" style={{ borderColor: '#14b8a6' }}>✅ Registered successfully. Welcome aboard, {user.name}!</div>}
      <h1 className="gold">Hello, {user.name}</h1><p className="muted">{user.email} · <span className="tag">{user.role}</span></p>
      <Link className="btn big" to="/chat"><MessageCircle size={18} /> Start a chat</Link>
      <h3 className="gold" style={{ marginTop: '2rem' }}>My conversations</h3>
      {!list ? <p className="muted">Loading…</p> : !list.length ? <div className="card muted">No conversations yet. Start a chat to get help.</div> : list.map(c => <div className="card" key={c.id}><b>{new Date(c.started_at).toLocaleString()}</b><span className={'tag ' + c.status}>{c.status.replace('_', ' ')}</span><p className="muted">{c.last}</p></div>)}
    </div></div>
}
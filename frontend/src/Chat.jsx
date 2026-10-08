import React, { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Send, User, ArrowLeft } from 'lucide-react'
import { api } from './api'
const sid = () => { let s = localStorage.getItem('sid'); if (!s) { s = (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2)).replace(/-/g, ''); localStorage.setItem('sid', s) } return s }
const hm = d => new Date(d || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
export default function Chat() {
  const [info, setInfo] = useState(null), [msgs, setMsgs] = useState([]), [text, setText] = useState(''), [typing, setTyping] = useState(false), [err, setErr] = useState(''), [offer, setOffer] = useState(false), [status, setStatus] = useState('OPEN'), end = useRef()
  const s = sid()
  useEffect(() => { api('/chat/init?session_id=' + s).then(r => { setInfo(r); setMsgs(r.messages || []); setStatus(r.status) }).catch(() => setErr('Unable to reach the support server.')) }, [])
  useEffect(() => { const t = setInterval(() => api(`/chat/${s}/messages`).then(r => { setStatus(r.status); if (!typing) setMsgs(r.messages || []) }).catch(() => {}), 4000); return () => clearInterval(t) }, [typing])
  useEffect(() => { if (end.current) end.current.scrollIntoView({ behavior: 'smooth' }) }, [msgs, typing])
  const send = async t => {
    t = (t ?? text).trim(); if (!t || typing) return; setText(''); setErr(''); setOffer(false)
    setMsgs(m => [...m, { id: 'l' + Date.now(), sender: 'customer', text: t, created_at: new Date().toISOString() }]); setTyping(true)
    try { const r = await api('/chat/message', { method: 'POST', body: { session_id: s, text: t } }); await new Promise(x => setTimeout(x, 450)); setStatus(r.status); setOffer(r.offer_escalation)
      const h = await api(`/chat/${s}/messages`); setMsgs(h.messages || []) } catch (e) { setErr(e.message) } finally { setTyping(false) }
  }
  const esc = async () => { setOffer(false); try { await api('/chat/escalate', { method: 'POST', body: { session_id: s } }); setStatus('HUMAN_REQUIRED'); setMsgs((await api(`/chat/${s}/messages`)).messages) } catch (e) { setErr(e.message) } }
  const human = status === 'HUMAN_REQUIRED'
  return <div className="center"><div className="chat card fade">
    <header><Link to={'/'} className="icon"><ArrowLeft size={18} /></Link><div><h3 className="gold">{info?.business || 'Customer Support'}</h3><small className={human ? 'warn' : 'ok'}>● {human ? 'Waiting for a human agent' : 'Online'}</small></div>
      {!human && <button className="btn ghost sm" onClick={esc}><User size={15} /> Talk to human</button>}</header>
    <div className="msgs">{info && <div className="b bot"><p>{info.welcome}</p></div>}
      {msgs.map(m => <div key={m.id} className={'b ' + (m.sender === 'customer' ? 'me' : m.sender)}>{m.sender === 'agent' && <small className="gold">Support agent</small>}<p>{m.text}</p><small>{hm(m.created_at)}</small></div>)}
      {typing && <div className="b bot"><span className="dots"><i /><i /><i /></span></div>}
      {offer && <div className="row wrap"><button className="btn sm" onClick={esc}>Talk to Support</button><button className="btn ghost sm" onClick={() => setOffer(false)}>Continue Chat</button></div>}
      {!msgs.length && (info?.quick || []).length > 0 && <div className="row wrap">{(info.quick || []).map(q => <button key={q.label} className="chip" onClick={() => send(q.text)}>{q.label}</button>)}</div>}
      {err && <div className="err">{err}</div>}<div ref={end} /></div>
    <form onSubmit={e => { e.preventDefault(); send() }}><input value={text} maxLength={1000} onChange={e => setText(e.target.value)} placeholder="Type your message…" /><button className="btn" disabled={!text.trim() || typing}><Send size={16} /></button></form>
  </div></div>
}
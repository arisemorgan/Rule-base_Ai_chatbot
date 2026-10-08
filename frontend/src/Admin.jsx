import React, { useEffect, useState } from 'react'
import { api } from './api'
import { useAuth } from './auth.js'
const fmt = d => new Date(d).toLocaleString()
const useLoad = (path, deps = []) => { const [d, setD] = useState(null), [err, setErr] = useState(''); const load = () => api(path).then(setD).catch(e => setErr(e.message)); useEffect(() => { load() }, deps); return [d, load, err] }
const Head = ({ t, children }) => <div className="head"><h1 className="gold">{t}</h1><div>{children}</div></div>
export function Dashboard() {
  const [a, , err] = useLoad('/analytics'); if (err) return <div className="err">{err}</div>; if (!a) return <p className="muted">Loading…</p>
  const max = Math.max(1, ...a.distribution.map(x => x.count))
  const K = [['Total conversations', a.total], ['Today', a.today], ['Automatically resolved', a.auto_resolved], ['Escalated', a.escalated], ['Resolution rate', a.resolution_rate + '%'], ['Message match rate', a.match_rate + '%'], ['Avg response time', a.avg_ms + ' ms'], ['Open unanswered', a.unanswered], ['Active rules', a.active_rules]]
  return <><Head t="Dashboard" /><div className="grid">{K.map(([l, v]) => <div className="card stat" key={l}><span>{l}</span><b>{v}</b></div>)}</div>
    <div className="card"><h3 className="gold">Intent distribution</h3>{a.distribution.length ? a.distribution.map(d => <div className="bar" key={d.intent}><span>{d.intent}</span><div><i style={{ width: d.count / max * 100 + '%' }} /></div><em>{d.count}</em></div>) : <p className="muted">No chatbot replies yet. Statistics appear as customers chat.</p>}</div></>
}
export function Conversations() {
  const [list, reload] = useLoad('/conversations'), [sel, setSel] = useState(null), [txt, setTxt] = useState(''), { user } = useAuth()
  const open = id => api('/conversations/' + id).then(setSel)
  useEffect(() => { const t = setInterval(() => { reload(); if (sel) open(sel.id) }, 5000); return () => clearInterval(t) }, [sel?.id])
  const reply = async e => { e.preventDefault(); if (!txt.trim()) return; await api(`/conversations/${sel.id}/reply`, { method: 'POST', body: { text: txt } }); setTxt(''); open(sel.id); reload() }
  const close = async () => { await api(`/conversations/${sel.id}/close`, { method: 'POST' }); open(sel.id); reload() }
  return <><Head t="Conversations" /><div className="split"><div className="card list">{!list ? <p className="muted">Loading…</p> : !list.length ? <p className="muted">No conversations yet.</p> : list.map(c => <div key={c.id} className={'item' + (sel?.id === c.id ? ' on' : '')} onClick={() => open(c.id)}><b>{c.customer_name}</b><span className={'tag ' + c.status}>{c.status.replace('_', ' ')}</span><p>{c.last}</p><small>{fmt(c.started_at)} · {c.count} msgs</small></div>)}</div>
    <div className="card">{!sel ? <p className="muted">Select a conversation.</p> : <><div className="head"><h3>{sel.customer_name}</h3><button className="btn ghost sm" onClick={close}>Close conversation</button></div>
      <div className="msgs thread">{sel.messages.map(m => <div key={m.id} className={'b ' + (m.sender === 'customer' ? 'me' : m.sender)}><small>{m.sender}{m.intent ? ' · ' + m.intent : ''}</small><p>{m.text}</p><small>{fmt(m.created_at)}</small></div>)}</div>
      <form onSubmit={reply}><input value={txt} onChange={e => setTxt(e.target.value)} placeholder="Reply as support agent…" /><button className="btn">Send</button></form></>}</div></div></>
}
export function Unanswered() {
  const [list, load, err] = useLoad('/unanswered'), [ints] = useLoad('/intents'), { user } = useAuth(), [ed, setEd] = useState(null), [e2, setE2] = useState('')
  const save = async e => { e.preventDefault(); try { await api(`/unanswered/${ed.id}/rule`, { method: 'POST', body: { intent: ed.intent, keywords: ed.kw.split(','), response: ed.response, priority: 60 } }); setEd(null); load() } catch (x) { setE2(x.message) } }
  return <><Head t="Unanswered questions" />{err && <div className="err">{err}</div>}{list && !list.length && <div className="card muted">No unanswered questions. 🎉</div>}
    {list?.map(u => <div className="card row between fade" key={u.id}><div><b>“{u.text}”</b><br /><small className="muted">{fmt(u.created_at)}</small></div><div className="row">
      {user.role === 'admin' && <button className="btn sm" onClick={() => setEd({ id: u.id, intent: ints?.[0] || '', kw: '', response: '' })}>Create rule</button>}<button className="btn ghost sm" onClick={() => api(`/unanswered/${u.id}/dismiss`, { method: 'POST' }).then(load)}>Dismiss</button></div></div>)}
    {ed && <div className="modal"><form className="card fade" onSubmit={save}><h3 className="gold">Create rule</h3><label>Intent<select value={ed.intent} onChange={e => setEd({ ...ed, intent: e.target.value })}>{ints?.map(i => <option key={i}>{i}</option>)}</select></label>
      <label>Keywords (comma separated)<input required value={ed.kw} onChange={e => setEd({ ...ed, kw: e.target.value })} /></label><label>Response<textarea required rows={4} value={ed.response} onChange={e => setEd({ ...ed, response: e.target.value })} /></label>{e2 && <div className="err">{e2}</div>}
      <div className="row"><button className="btn">Save rule</button><button type="button" className="btn ghost" onClick={() => setEd(null)}>Cancel</button></div></form></div>}</>
}
function Crud({ title, path, cols, fields, blank, hint }) {
  const [rows, load, err] = useLoad(path), [f, setF] = useState(null), [e2, setE2] = useState(''), { user } = useAuth(), adm = user.role === 'admin'
  const val = (r, k) => Array.isArray(r[k]) ? r[k].join(', ') : r[k]
  const save = async e => { e.preventDefault(); setE2(''); const b = { ...f }; fields.forEach(x => { if (x.t === 'list') b[x.k] = String(b[x.k]).split(',').map(s => s.trim()).filter(Boolean); if (x.t === 'number') b[x.k] = +b[x.k] }); if (b.password === '') delete b.password
    try { await api(b.id ? `${path}/${b.id}` : path, { method: b.id ? 'PUT' : 'POST', body: b }); setF(null); load() } catch (x) { setE2(x.message) } }
  return <><Head t={title}>{adm && <button className="btn" onClick={() => setF({ ...blank })}>+ Add</button>}</Head>{hint && <p className="muted">{hint}</p>}{err && <div className="err">{err}</div>}
    <div className="card tbl"><table><thead><tr>{cols.map(c => <th key={c[0]}>{c[1]}</th>)}{adm && <th />}</tr></thead><tbody>{rows?.map(r => <tr key={r.id}>{cols.map(c => <td key={c[0]}>{typeof r[c[0]] === 'boolean' ? (r[c[0]] ? 'Yes' : 'No') : String(val(r, c[0]) ?? '')}</td>)}
      {adm && <td className="row"><button className="btn ghost sm" onClick={() => setF({ ...r, password: '' })}>Edit</button><button className="btn ghost sm" onClick={() => confirm('Delete this item?') && api(`${path}/${r.id}`, { method: 'DELETE' }).then(load).catch(x => alert(x.message))}>Delete</button></td>}</tr>)}</tbody></table>{rows && !rows.length && <p className="muted pad">Nothing here yet.</p>}</div>
    {f && <div className="modal"><form className="card fade" onSubmit={save}><h3 className="gold">{f.id ? 'Edit' : 'Add'} {title.slice(0, -1)}</h3>{fields.map(x => <label key={x.k} className={x.t === 'check' ? 'chk' : ''}>{x.l}
      {x.t === 'textarea' ? <textarea rows={4} required value={f[x.k] ?? ''} onChange={e => setF({ ...f, [x.k]: e.target.value })} /> : x.t === 'select' ? <select value={f[x.k]} onChange={e => setF({ ...f, [x.k]: e.target.value })}>{(x.o || []).map(o => <option key={o}>{o}</option>)}</select>
        : x.t === 'check' ? <input type="checkbox" checked={!!f[x.k]} onChange={e => setF({ ...f, [x.k]: e.target.checked })} /> : <input type={x.t === 'number' ? 'number' : x.t === 'password' ? 'password' : 'text'} required={x.req !== false} min={0} max={x.t === 'number' ? 100 : undefined} value={Array.isArray(f[x.k]) ? f[x.k].join(', ') : f[x.k] ?? ''} placeholder={x.p} onChange={e => setF({ ...f, [x.k]: e.target.value })} />}</label>)}
      {e2 && <div className="err">{e2}</div>}<div className="row"><button className="btn">Save</button><button type="button" className="btn ghost" onClick={() => setF(null)}>Cancel</button></div></form></div>}</>
}
export function Rules() {
  const [ints] = useLoad('/intents')
  return <Crud title="Rules" path="/rules" hint="Use {name} {phone} {email} {address} {hours} in responses to insert business details. Priority 0–100 breaks ties (higher wins)." cols={[['intent', 'Intent'], ['keywords', 'Keywords'], ['priority', 'Priority'], ['response', 'Response'], ['is_active', 'Active']]}
    blank={{ intent: 'business_hours', keywords: '', priority: 50, response: '', is_active: true }} fields={[{ k: 'intent', l: 'Intent', t: 'select', o: ints || [] }, { k: 'keywords', l: 'Keywords / phrases (comma separated)', t: 'list' }, { k: 'priority', l: 'Priority (0–100)', t: 'number' }, { k: 'response', l: 'Response', t: 'textarea' }, { k: 'is_active', l: 'Active', t: 'check' }]} />
}
export const Faqs = () => <Crud title="FAQs" path="/faqs" hint="FAQs are matched by question similarity when no rule matches strongly." cols={[['question', 'Question'], ['answer', 'Answer'], ['is_active', 'Active']]} blank={{ question: '', answer: '', is_active: true }}
  fields={[{ k: 'question', l: 'Question', t: 'text' }, { k: 'answer', l: 'Answer', t: 'textarea' }, { k: 'is_active', l: 'Active', t: 'check' }]} />
export const UsersPage = () => <Crud title="Users" path="/users" hint="Admins manage everything. Agents handle conversations. Customers can only chat." cols={[['name', 'Name'], ['email', 'Email'], ['role', 'Role']]} blank={{ name: '', email: '', password: '', role: 'agent' }}
  fields={[{ k: 'name', l: 'Name', t: 'text' }, { k: 'email', l: 'Email', t: 'text' }, { k: 'password', l: 'Password (min 8; blank keeps current when editing)', t: 'password', req: false }, { k: 'role', l: 'Role', t: 'select', o: ['admin', 'agent', 'customer'] }]} />
export function Business() {
  const [b, , err] = useLoad('/business'), [f, setF] = useState(null), [m, setM] = useState(''), { user } = useAuth()
  useEffect(() => { if (b) setF(b) }, [b]); if (!f) return err ? <div className="err">{err}</div> : <p className="muted">Loading…</p>
  const L = [['name', 'Business name'], ['phone', 'Phone'], ['email', 'Email'], ['address', 'Address'], ['opening_hours', 'Opening hours'], ['description', 'Description'], ['welcome', 'Chat welcome message']]
  const save = async e => { e.preventDefault(); try { await api('/business', { method: 'PUT', body: f }); setM('Saved ✓') } catch (x) { setM(x.message) } }
  return <><Head t="Business settings" /><form className="card fade" onSubmit={save}>{L.map(([k, l]) => <label key={k}>{l}<input disabled={user.role !== 'admin'} value={f[k] || ''} onChange={e => setF({ ...f, [k]: e.target.value })} /></label>)}
    {user.role === 'admin' && <button className="btn">Save</button>} <span className="muted"> {m}</span></form></>
}

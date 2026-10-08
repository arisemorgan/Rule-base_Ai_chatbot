export const tok = () => localStorage.getItem('token')
export async function api(path, { method = 'GET', body } = {}) {
  const r = await fetch('/api' + path, { method, headers: { 'Content-Type': 'application/json', ...(tok() ? { Authorization: 'Bearer ' + tok() } : {}) }, body: body ? JSON.stringify(body) : undefined })
  const j = await r.json().catch(() => ({}))
  if (!r.ok) {
    if (r.status === 401 && tok() && !path.startsWith('/auth/login')) { localStorage.removeItem('token'); location = '/login' }
    throw new Error(Array.isArray(j.detail) ? j.detail.map(d => d.loc.slice(-1) + ': ' + d.msg).join('; ') : j.detail || 'Request failed')
  }
  return j
}

"""Transparent rule-based engine: normalize -> match keywords/phrases -> rule priority -> response."""
import re
STOP = set("a an the is are do you i me my we our to of for in on at it and or can what how does your please there this that with be have".split())
def stem(w):
    for s in ("ing", "es", "ed", "s"):
        if w.endswith(s) and len(w) - len(s) >= 3: return w[:-len(s)]
    return w
STOPS = {stem(s) for s in STOP}
def toks(t): return [stem(w) for w in re.sub(r"[^a-z0-9\s]", " ", t.lower().replace("'", "")).split()]
def has_phrase(p, tk):
    n = len(p); return n > 0 and any(tk[i:i + n] == p for i in range(len(tk) - n + 1))
TIERS = {100: "exact phrase", 80: "strong keyword combination", 70: "FAQ match", 60: "single keyword"}
def match(text, rules, faqs, threshold=60):
    """rules: [(id, intent, [keywords], priority, response)], faqs: [(id, question, answer)]. Returns best match or None."""
    tk = toks(text); best = None
    for rid, intent, kws, pr, resp in rules:
        hits = [k for k in kws if has_phrase(toks(k), tk)]
        if not hits: continue
        flat = [w for k in hits for w in toks(k)]
        base = 100 if flat == tk else 80 if len(hits) >= 2 else 60
        cand = (base, pr, {"rule_id": rid, "intent": intent, "response": resp, "score": base, "tier": TIERS[base], "hits": hits})
        if not best or cand[:2] > best[:2]: best = cand
    sig = {w for w in tk if w not in STOPS}
    for fid, q, a in faqs:
        qs = {w for w in toks(q) if w not in STOPS}; ov = qs & sig
        if qs and sig and len(ov) / len(qs) >= 0.6 and len(ov) / len(sig) >= 0.4:
            cand = (70, 0, {"rule_id": None, "intent": "faq", "response": a, "score": 70, "tier": TIERS[70], "hits": sorted(ov)})
            if not best or cand[:2] > best[:2]: best = cand
    return best[2] if best and best[0] >= threshold else None
def fill(resp, b):
    m = {"name": b.name, "phone": b.phone, "email": b.email, "address": b.address, "hours": b.opening_hours}
    return re.sub(r"\{(name|phone|email|address|hours)\}", lambda x: m[x.group(1)] or "(not set)", resp)

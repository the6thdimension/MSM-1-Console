/* ============================================================
   Merge — three-way merge for work done in several tabs at once
   ============================================================
   base   = the program when this tab's work started (a form opened, or just after
            a change that can be undone),
   theirs = the program as saved now (other tabs may have changed it since),
   mine   = theirs with this tab's work applied on top.

   A field only this tab changed keeps this tab's value. A field only another tab
   changed keeps theirs, even when this tab's form re-submitted the old value. A
   field both changed to different values is a conflict for the person to decide.
   Nothing is merged silently when both sides disagree. */
const Merge = {
  plain(v) { return v !== null && typeof v === "object" && !Array.isArray(v); },

  /* Deep equality that ignores key order and treats a missing key as undefined. */
  equal(a, b) {
    if (a === b) return true;
    if (Array.isArray(a) || Array.isArray(b)) {
      if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
      return a.every((x, i) => this.equal(x, b[i]));
    }
    if (!this.plain(a) || !this.plain(b)) return false;
    const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
    for (const k of keys) if (!this.equal(a[k], b[k])) return false;
    return true;
  },

  keyed(list) { return Array.isArray(list) && list.every(x => this.plain(x) && typeof x.id === "string" && x.id); },

  /* Merge whole programs. `resolutions` maps a conflict key to {choice, theirs}; a
     choice applies only while the other tab's value is still the one that was shown. */
  db(base, theirs, mine, resolutions = {}) {
    const conflicts = [];
    const out = {};
    const ctx = { conflicts, resolutions, mine, theirs };
    for (const key of new Set([...Object.keys(theirs), ...Object.keys(mine)])) {
      if (key === "audit" || key === "snapshots") { out[key] = theirs[key] !== undefined ? theirs[key] : mine[key]; continue; }
      if (key === "meta") { out.meta = this.meta(base.meta || {}, theirs.meta || {}, mine.meta || {}, ctx); continue; }
      const v = this.value(base[key], theirs[key], mine[key], [key], ctx);
      if (v !== undefined) out[key] = v;
    }
    return { db: out, conflicts };
  },

  /* Code counters only ever move forward, so the higher counter wins. */
  meta(b, t, m, ctx) {
    const noSeq = x => { const { seq, ...rest } = x; return rest; };
    const out = this.value(noSeq(b), noSeq(t), noSeq(m), ["meta"], ctx) || {};
    if (this.plain(t.seq) || this.plain(m.seq)) {
      const seq = {};
      for (const k of new Set([...Object.keys(t.seq || {}), ...Object.keys(m.seq || {})])) seq[k] = Math.max(Number((t.seq || {})[k]) || 0, Number((m.seq || {})[k]) || 0);
      out.seq = seq;
    }
    return out;
  },

  value(b, t, m, path, ctx) {
    if (this.equal(m, t)) return t;
    if (this.equal(t, b)) return m;
    if (this.equal(m, b)) return t;
    if (this.plain(b) && this.plain(t) && this.plain(m)) {
      const out = {};
      for (const k of new Set([...Object.keys(t), ...Object.keys(m)])) {
        const v = this.value(b[k], t[k], m[k], path.concat(k), ctx);
        if (v !== undefined) out[k] = v;
      }
      return out;
    }
    if (this.keyed(t) && this.keyed(m) && (b === undefined || this.keyed(b))) return this.list(b || [], t, m, path, ctx);
    const last = String(path[path.length - 1]);
    const strings = x => Array.isArray(x) && x.every(v => typeof v === "string");
    if (/Ids$/.test(last) && strings(t) && strings(m) && (b === undefined || strings(b))) {
      // Reference sets: apply this tab's additions and removals to the other tab's set.
      const bb = b || [];
      return t.filter(x => !(bb.includes(x) && !m.includes(x))).concat(m.filter(x => !bb.includes(x) && !t.includes(x)));
    }
    return this.conflict(b, t, m, path, ctx);
  },

  /* Records (or nested items with ids) merged one by one, in the other tab's order,
     with this tab's new items appended. */
  list(b, t, m, path, ctx) {
    const B = new Map(b.map(x => [x.id, x])), T = new Map(t.map(x => [x.id, x])), M = new Map(m.map(x => [x.id, x]));
    const order = t.map(x => x.id).concat(m.map(x => x.id).filter(id => !T.has(id)));
    const out = [];
    for (const id of order) {
      const bb = B.get(id), tt = T.get(id), mm = M.get(id);
      let v;
      if (bb === undefined) v = tt === undefined ? mm : mm === undefined ? tt : this.value(undefined, tt, mm, path.concat(id), ctx);
      else if (tt === undefined) v = mm === undefined || this.equal(mm, bb) ? undefined : this.conflict(bb, undefined, mm, path.concat(id), ctx, "deleted");
      else if (mm === undefined) v = this.equal(tt, bb) ? undefined : this.conflict(bb, tt, undefined, path.concat(id), ctx, "kept");
      else v = this.value(bb, tt, mm, path.concat(id), ctx);
      if (v !== undefined) out.push(v);
    }
    return out;
  },

  conflict(b, t, m, path, ctx, kind = "changed") {
    const key = path.join("/");
    const r = ctx.resolutions[key];
    if (r && this.equal(r.theirs, t)) return r.choice === "theirs" ? t : m;
    // Name the record the field belongs to (collection / record id / field…).
    const [coll, id, ...rest] = path;
    const rec = (ctx.theirs[coll] || ctx.mine[coll] || []).find?.(x => x && x.id === id)
      || (ctx.mine[coll] || []).find?.(x => x && x.id === id);
    ctx.conflicts.push({ key, kind, coll, id, code: rec ? rec.code || rec.name || id : id, field: rest.join("."), base: b, theirs: t, mine: m });
    return m;
  }
};

/* BV Mudrana: editing operations on stories. Positions are {p: paragraph index, o: UTF-16 offset}. */
(function () {
  const BV = (window.BV = window.BV || {});
  const ATTR_KEYS = ['font', 'size', 'bold', 'italic', 'underline', 'strike', 'caps', 'color', 'shift', 'track', 'width', 'pos', 'legacy', 'smallCaps', 'reverse', 'tint', 'outline', 'shadow', 'ix', 'link', 'fn'];

  const cmp = (a, b) => (a.p !== b.p ? a.p - b.p : a.o - b.o);
  const order = (a, b) => (cmp(a, b) <= 0 ? [a, b] : [b, a]);
  const paraText = (para) => para.runs.map((r) => r.t).join('');
  const attrsOf = (r) => { const o = {}; for (const k of ATTR_KEYS) if (r[k] !== undefined) o[k] = r[k]; return o; };
  const sameAttrs = (a, b) => ATTR_KEYS.every((k) => a[k] === b[k]);
  const clone = (x) => JSON.parse(JSON.stringify(x));

  function normalize(para) {
    const out = [];
    for (const r of para.runs) {
      if (!r.t && out.length) continue;
      const prev = out[out.length - 1];
      if (prev && sameAttrs(prev, r)) prev.t += r.t;
      else if (prev && !prev.t) out[out.length - 1] = r; // drop leading empty run
      else out.push(r);
    }
    para.runs = out.length ? out : [{ t: '' }];
  }

  function splitRuns(para, o) {
    const left = [], right = [];
    let a = 0;
    for (const r of para.runs) {
      const b = a + r.t.length;
      if (b <= o) left.push({ ...r });
      else if (a >= o) right.push({ ...r });
      else { left.push({ ...r, t: r.t.slice(0, o - a) }); right.push({ ...r, t: r.t.slice(o - a) }); }
      a = b;
    }
    return [left, right];
  }

  // attributes that typing at this offset would get
  function attrsAt(para, o) {
    let a = 0;
    let found = para.runs[0];
    for (const r of para.runs) {
      const b = a + r.t.length;
      if (o > a && o <= b) { found = r; break; }
      if (o === 0) { found = r; break; }
      a = b;
    }
    return attrsOf(found || {});
  }

  function insert(story, pos, text, attrs, opts = {}) {
    const chunks = text.replace(/\r\n?/g, '\n').split('\n');
    const para = story.paras[pos.p];
    const [left, right] = splitRuns(para, pos.o);
    const mk = (t) => Object.assign({ t }, attrs || {});
    if (chunks.length === 1) {
      para.runs = [...left, mk(chunks[0]), ...right];
      normalize(para);
      return { p: pos.p, o: pos.o + chunks[0].length };
    }
    para.runs = [...left, mk(chunks[0])];
    normalize(para);
    const newParas = [];
    const nextStyle = opts.nextStyle || para.style;
    for (let i = 1; i < chunks.length; i++) {
      const np = { style: i === chunks.length - 1 && right.length && paraLen(right) > 0 ? para.style : nextStyle, runs: [mk(chunks[i])] };
      if (para.ov) np.ov = clone(para.ov);
      newParas.push(np);
    }
    const last = newParas[newParas.length - 1];
    last.runs = [...last.runs, ...right];
    newParas.forEach(normalize);
    story.paras.splice(pos.p + 1, 0, ...newParas);
    return { p: pos.p + chunks.length - 1, o: chunks[chunks.length - 1].length };
  }
  const paraLen = (runs) => runs.reduce((n, r) => n + r.t.length, 0);

  function deleteRange(story, a, b) {
    [a, b] = order(a, b);
    if (a.p === b.p) {
      const para = story.paras[a.p];
      const [l] = splitRuns(para, a.o);
      const [, r] = splitRuns(para, b.o);
      para.runs = [...l, ...r];
      normalize(para);
      return { ...a };
    }
    const pa = story.paras[a.p], pb = story.paras[b.p];
    const [l] = splitRuns(pa, a.o);
    const [, r] = splitRuns(pb, b.o);
    pa.runs = [...l, ...r];
    normalize(pa);
    story.paras.splice(a.p + 1, b.p - a.p);
    return { ...a };
  }

  function extract(story, a, b) {
    [a, b] = order(a, b);
    const out = [];
    for (let p = a.p; p <= b.p; p++) {
      const para = story.paras[p];
      let runs = para.runs;
      if (p === b.p) runs = splitRuns({ runs }, b.o)[0];
      if (p === a.p) runs = splitRuns({ runs }, a.o)[1];
      const np = { style: para.style, runs: runs.map((r) => ({ ...r })) };
      if (para.ov) np.ov = clone(para.ov);
      normalize(np);
      out.push(np);
    }
    return out;
  }

  function insertFragment(doc, story, pos, frag) {
    frag = clone(frag);
    frag.forEach((p) => { if (!doc.styles[p.style]) p.style = Object.keys(doc.styles)[0]; });
    const para = story.paras[pos.p];
    const [left, right] = splitRuns(para, pos.o);
    if (frag.length === 1) {
      para.runs = [...left, ...frag[0].runs, ...right];
      normalize(para);
      return { p: pos.p, o: pos.o + paraLen(frag[0].runs) };
    }
    para.runs = [...left, ...frag[0].runs];
    normalize(para);
    const rest = frag.slice(1);
    const last = rest[rest.length - 1];
    const lastLen = paraLen(last.runs);
    last.runs = [...last.runs, ...right];
    rest.forEach(normalize);
    story.paras.splice(pos.p + 1, 0, ...rest);
    return { p: pos.p + rest.length, o: lastLen };
  }

  function applyChar(story, a, b, attrs) {
    [a, b] = order(a, b);
    for (let p = a.p; p <= b.p; p++) {
      const para = story.paras[p];
      const s = p === a.p ? a.o : 0;
      const e = p === b.p ? b.o : paraText(para).length;
      if (e <= s && !(s === 0 && e === 0)) continue;
      const [l, mid0] = splitRuns(para, s);
      const [mid, r] = splitRuns({ runs: mid0 }, e - s);
      mid.forEach((run) => {
        for (const k in attrs) {
          if (attrs[k] === null || attrs[k] === undefined) delete run[k];
          else run[k] = attrs[k];
        }
      });
      para.runs = [...l, ...mid, ...r];
      normalize(para);
    }
  }

  function setParaStyle(story, pa, pb, style, clearOverrides) {
    for (let p = Math.min(pa, pb); p <= Math.max(pa, pb); p++) {
      story.paras[p].style = style;
      if (clearOverrides) {
        delete story.paras[p].ov;
        story.paras[p].runs.forEach((r) => { delete r.font; delete r.size; delete r.bold; delete r.italic; });
        normalize(story.paras[p]);
      }
    }
  }
  function setParaOv(story, pa, pb, key, value) {
    for (let p = Math.min(pa, pb); p <= Math.max(pa, pb); p++) {
      const para = story.paras[p];
      para.ov = para.ov || {};
      if (value === null || value === undefined) delete para.ov[key];
      else para.ov[key] = value;
      if (!Object.keys(para.ov).length) delete para.ov;
    }
  }

  const plain = (frag) => frag.map(paraText).join('\n');
  const fromPlain = (text, style) => text.replace(/\r\n?/g, '\n').split('\n').map((t) => ({ style, runs: [{ t }] }));
  const storyEnd = (story) => ({ p: story.paras.length - 1, o: paraText(story.paras[story.paras.length - 1]).length });

  // grapheme navigation
  function nextBoundary(text, o) {
    const b = BV.Layout.graphemeBounds(text);
    for (const x of b) if (x > o) return x;
    return text.length;
  }
  function prevBoundary(text, o) {
    const b = BV.Layout.graphemeBounds(text);
    let r = 0;
    for (const x of b) { if (x >= o) break; r = x; }
    return r;
  }
  function wordBounds(text, o) {
    const s = new Intl.Segmenter(undefined, { granularity: 'word' });
    for (const w of s.segment(text)) {
      if (o >= w.index && o <= w.index + w.segment.length && w.isWordLike) return [w.index, w.index + w.segment.length];
    }
    return [o, o];
  }

  BV.Text = { cmp, order, paraText, attrsOf, attrsAt, normalize, insert, deleteRange, extract, insertFragment, applyChar, setParaStyle, setParaOv, plain, fromPlain, storyEnd, nextBoundary, prevBoundary, wordBounds, clone, ATTR_KEYS };
})();

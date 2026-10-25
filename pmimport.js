// BV Mudrana: reader for Adobe PageMaker 6.x / 7 files (.pm6, .p65, .pmd, .pt6, .t65)
// Record layout follows the open libpagemaker project (MPL-2.0), reimplemented in JavaScript.
// Text is returned as raw bytes so legacy-font text (Nudi, Baraha …) can be converted later.
'use strict';
const CFB = require('cfb');

const REC = { FONTS_PARENT: 0x01, PAGE: 0x05, PARA: 0x0b, TIFF: 0x0e, LINE_SET: 0x11, FONTS: 0x13, COLORS: 0x15, GLOBAL_INFO: 0x18, SHAPE: 0x19, TEXT_BLOCK: 0x1a, CHARS: 0x1c, XFORM: 0x28 };
const REC_SIZE = { 0x19: 258, 0x18: 2496, 0x05: 472, 0x11: 4, 0x28: 26, 0x1a: 36, 0x1c: 30, 0x0b: 80, 0x13: 94, 0x01: 10, 0x15: 210 };
const SHAPE_TYPES = { 1: 'text', 3: 'line', 4: 'rect', 5: 'ellipse', 6: 'bitmap', 0x0a: 'metafile', 0x0c: 'polygon' };

class Reader {
  constructor(buf, be) { this.b = buf; this.p = 0; this.be = be; }
  seek(p) { this.p = p; }
  skip(n) { this.p += n; }
  u8() { return this.b[this.p++]; }
  u16() { const v = this.be ? this.b.readUInt16BE(this.p) : this.b.readUInt16LE(this.p); this.p += 2; return v; }
  s16() { const v = this.be ? this.b.readInt16BE(this.p) : this.b.readInt16LE(this.p); this.p += 2; return v; }
  u32() { const v = this.be ? this.b.readUInt32BE(this.p) : this.b.readUInt32LE(this.p); this.p += 4; return v; }
  point() { const a = this.s16(), b = this.s16(); return this.be ? { x: b, y: a } : { x: a, y: b }; }
}

function parse(fileBuffer) {
  let buf = fileBuffer;
  if (buf.readUInt32LE(0) === 0xe011cfd0) {
    const cfb = CFB.read(fileBuffer, { type: 'buffer' });
    const ent = cfb.FileIndex.find((e) => e.name === 'PageMaker');
    if (!ent) throw new Error('This file has no PageMaker data in it.');
    buf = Buffer.from(ent.content);
  }
  const marker = buf.readUInt16LE(6);
  let be;
  if (marker === 0x99ff) be = false;
  else if (marker === 0xff99) be = true;
  else throw new Error('Not a PageMaker 6/7 file (or the file is damaged). Only PageMaker 6.0, 6.5 and 7 files can be opened.');
  const r = new Reader(buf, be);
  // PageMaker 5 (version byte 6) uses the same table of contents with smaller records
  const ver = be ? buf[0x0b] : buf[0x0a];
  const pm5 = ver > 0 && ver < 7;
  if (pm5) Object.assign(REC_SIZE, { 0x19: 78, 0x05: 290, 0x0b: 76, 0x15: 86 });
  else Object.assign(REC_SIZE, { 0x19: 258, 0x05: 472, 0x0b: 80, 0x15: 210 });
  r.seek(0x2e);
  const tocLen = r.u16();
  r.seek(0x30);
  const tocOff = r.u32();

  // ---- table of contents ------------------------------------------------------
  const records = []; // {type, offset, seq, num}
  const byType = {};
  const state = { seq: 0, parsed: new Set() };
  const readEntry = (sub, subType) => {
    r.skip(1);
    let type = r.u8();
    const num = r.u16();
    const offset = r.u32();
    r.skip(2);
    let st = 0;
    if (!sub && (type !== 0 || num === 0)) { r.skip(1); st = r.u8(); r.skip(4); }
    if (type === 0 && num === 0) state.seq++;
    else if (!sub && type === 1) { readToc(offset, num, true, st); state.seq++; }
    else if (!sub && type === 0) readToc(offset, num, false);
    else {
      if (num && offset) {
        if (sub && type !== subType && subType) type = subType;
        records.push({ type, offset, seq: state.seq, num });
        (byType[type] = byType[type] || []).push(records.length - 1);
      }
      if (!sub) state.seq++;
    }
  };
  const readToc = (offset, n, sub, subType) => {
    if (state.parsed.has(r.p)) return;
    state.parsed.add(r.p);
    if (!n || !offset) return;
    const orig = r.p;
    r.seek(offset);
    const minSize = sub ? 10 : 16;
    const max = Math.floor((buf.length - offset) / minSize);
    for (let i = 0; i < Math.min(n, max); i++) {
      if (r.p + minSize > buf.length) break;
      readEntry(sub, subType);
    }
    r.seek(orig);
  };
  try { readToc(tocOff, tocLen, false); } catch (e) { /* partial TOC */ }

  const ofType = (t) => (byType[t] || []).map((i) => records[i]);
  const withSeq = (s) => records.filter((x) => x.seq === s);
  const seekRec = (c, i) => r.seek(c.offset + (i ? REC_SIZE[c.type] * i : 0));
  const safe = (fn) => { try { return fn(); } catch (e) { return null; } };

  // ---- fonts -----------------------------------------------------------------
  const fonts = [];
  for (const c of ofType(REC.FONTS)) for (let i = 0; i < c.num; i++) {
    seekRec(c, i);
    const bytes = [];
    let ch;
    while ((ch = r.u8()) && bytes.length < 64) bytes.push(ch);
    fonts.push(Buffer.from(bytes).toString('latin1'));
  }
  // ---- colors ----------------------------------------------------------------
  const colors = [];
  const NAMED = { registration: '#000000', black: '#000000', paper: '#ffffff', white: '#ffffff', red: '#e60012', green: '#00a650', blue: '#0000ff', cyan: '#00a0e9', magenta: '#e4007f', yellow: '#fff100' };
  if (pm5) for (const c of ofType(REC.COLORS)) for (let i = 0; i < c.num; i++) {
    seekRec(c, i);
    const nb = [];
    for (let k = 0; k < 0x20; k++) nb.push(r.u8());
    let name = Buffer.from(nb).toString('latin1');
    name = name.slice(0, name.indexOf('\0') >= 0 ? name.indexOf('\0') : name.length).replace(/[^\x20-\x7e]/g, '').trim();
    colors.push({ name, hex: NAMED[name.toLowerCase()] || '#000000' });
  }
  if (!pm5) for (const c of ofType(REC.COLORS)) for (let i = 0; i < c.num; i++) {
    seekRec(c, i);
    const nameBytes = [];
    for (let k = 0; k < 0x22; k++) nameBytes.push(r.u8());
    const model = r.u8();
    r.skip(3);
    let rgb = [0, 0, 0];
    if (model === 0x18) rgb = [r.u8(), r.u8(), r.u8()];
    else if (model === 0x08 || model === 0x10) {
      const C = r.u16() / 65535, M = r.u16() / 65535, Y = r.u16() / 65535, K = r.u16() / 65535;
      rgb = [255 * (1 - Math.min(1, C + K)), 255 * (1 - Math.min(1, M + K)), 255 * (1 - Math.min(1, Y + K))].map(Math.round);
    }
    let name = Buffer.from(nameBytes).toString('latin1');
    name = name.slice(0, name.indexOf('\0') >= 0 ? name.indexOf('\0') : name.length).replace(/[^\x20-\x7e]/g, '').trim();
    colors.push({ name, hex: '#' + rgb.map((v) => v.toString(16).padStart(2, '0')).join('') });
  }
  // ---- transforms (rotation) --------------------------------------------------
  const xforms = { 0: { rot: 0, skew: 0 } };
  for (const c of ofType(REC.XFORM)) for (let i = 0; i < c.num; i++) {
    seekRec(c, i);
    const rot = r.u32(), skew = r.u32();
    r.skip(2);
    const tl = r.point(), br = r.point(), rp = r.point();
    const id = r.u32();
    xforms[id] = { rot: (rot | 0) / 1000, skew: (skew | 0) / 1000, tl, br, rp };
  }
  const xf = (id) => (id && id !== 0xffffffff && xforms[id]) || xforms[0];

  // ---- document setup ---------------------------------------------------------
  const gi = ofType(REC.GLOBAL_INFO)[0];
  if (!gi) throw new Error('The file has no document setup record.');
  seekRec(gi, 0);
  const opts = r.u8();
  r.skip(pm5 ? 0x31 : 0x35);
  const a = r.point(), b = r.point();
  const doubleSided = !!(be ? opts & 0x40 : opts & 0x2);
  const setup = { pageW: b.x - a.x, pageH: b.y - a.y, doubleSided, left: a.x, top: a.y };
  if (pm5) {
    r.seek(gi.offset + 0x26);
    const sp = r.u16();
    if (sp >= 1 && sp < 10000) setup.startPage = sp;
  }

  // ---- text blocks (stories) --------------------------------------------------
  const textBlocks = {};
  for (const c of ofType(REC.TEXT_BLOCK)) for (let i = 0; i < c.num; i++) {
    seekRec(c, i);
    const p1 = r.u16(), p2 = r.u16(), textSeq = r.u16(), charsSeq = r.u16(), paraSeq = r.u16(), styleSeq = r.u16();
    r.seek(c.offset + REC_SIZE[c.type] * i + 0x20);
    const id = r.u32();
    textBlocks[id] = { id, textSeq, charsSeq, paraSeq, styleSeq, p1, p2 };
  }
  const storyCache = {};
  function readStory(tb) {
    if (storyCache[tb.id]) return storyCache[tb.id];
    const parts = [];
    for (const c of withSeq(tb.textSeq)) parts.push(buf.slice(c.offset, c.offset + c.num));
    const text = Buffer.concat(parts);
    const chars = [];
    for (const c of withSeq(tb.charsSeq)) for (let i = 0; i < c.num; i++) {
      seekRec(c, i);
      const ch = { len: r.u16(), font: r.u16(), size: r.u16() / 10, lead: r.u16() };
      ch.color = r.u16();
      const fl = r.u16();
      Object.assign(ch, { bold: !!(fl & 1), italic: !!(fl & 2), underline: !!(fl & 4), outline: !!(fl & 8), shadow: !!(fl & 0x10), strike: !!(fl & 0x100), sup: !!(fl & 0x200), sub: !!(fl & 0x400), caps: !!(fl & 0x800), smallCaps: !!(fl & 0x1000), reverse: !!(fl & 0x20) });
      if (pm5) { ch.kern = r.s16(); ch.setWidth = r.u16(); ch.track = r.u16(); } // PageMaker 5 order
      else {
        ch.setWidth = r.u16(); // horizontal scale in tenths of a percent (65535 = normal)
        ch.track = r.u16();
        ch.kern = r.s16();
      }
      r.skip(2);
      ch.ssSize = r.u16(); ch.subPos = r.u16(); ch.supPos = r.u16();
      ch.baseShift = r.s16(); // tenths of a point
      ch.tint = r.u16();
      chars.push(ch);
    }
    const paras = [];
    for (const c of withSeq(tb.paraSeq)) for (let i = 0; i < c.num; i++) {
      seekRec(c, i);
      const pa = { len: r.u16() };
      const fl = r.u8();
      pa.hyphenate = !!(fl & 8);
      pa.align = r.u8();
      r.skip(6);
      pa.left = r.u16(); pa.first = r.s16(); pa.right = r.u16(); pa.before = r.u16(); pa.after = r.u16();
      { const o = r.p; r.seek(o + 4); pa.wsMin = r.u16(); pa.wsMax = r.u16(); pa.wsDes = r.u16(); r.seek(o); } // word spacing %
      r.skip(18);
      r.skip(2);
      const keep = r.u16();
      pa.keepTogether = !!(keep & 1); pa.keepNext = (keep >> 1) & 3;
      // leading lives in the paragraph record of newer files at a fixed offset (not documented); handled by fallback
      paras.push(pa);
    }
    // tab stops: runs of {len, count<<8, then count x (position, kind)} records of 164 bytes
    let tabs = [];
    for (const c of withSeq(tb.styleSeq)) {
      if (c.type !== 0x0c) continue;
      for (let i = 0; i < c.num; i++) {
        const o = c.offset + 164 * i;
        if (o + 164 > buf.length) break;
        r.seek(o);
        const len = r.u16();
        const n = Math.min(40, r.u16() >> 8);
        const stops = [];
        for (let k = 0; k < n; k++) { const pos = r.u16(), kind = r.u16(); stops.push({ pos, kind }); }
        tabs.push({ len, stops });
      }
    }
    if (tabs.reduce((a2, t) => a2 + t.len, 0) !== text.length) tabs = [];
    // how many characters each text block of the story holds, in thread order (24-byte records)
    let frames = [];
    for (const c of withSeq(tb.p1)) {
      if (c.type !== 0x1b) continue;
      for (let i = 0; i < c.num; i++) { const o = c.offset + 24 * i; if (o + 24 > buf.length) break; frames.push({ chars: buf.readUInt32LE(o), id: buf.readUInt32LE(o + 0x14) }); }
    }
    if (frames.reduce((a2, f) => a2 + f.chars, 0) !== text.length) frames = [];
    return (storyCache[tb.id] = { id: tb.id, text: text.toString('base64'), length: text.length, chars, paras, tabs, frames });
  }

  // ---- pages & shapes ---------------------------------------------------------
  const spreads = [];
  const pageRecs = ofType(REC.PAGE);
  if (!pageRecs.length) throw new Error('The file has no pages.');
  const masters = [];
  for (const pageRec of pageRecs) for (let i = 0; i < pageRec.num; i++) {
    seekRec(pageRec, i);
    const pflags = r.u16();
    const shapesSeq = r.u16();
    // PageMaker 5 keeps the master pages among the pages (flag 4)
    const isMasterRec = pm5 && (pflags & 0xc) === 4;
    const shapes = [];
    for (const c of withSeq(shapesSeq)) for (let k = 0; k < c.num; k++) {
      seekRec(c, k);
      const t = r.u8();
      const kind = SHAPE_TYPES[t];
      if (!kind) continue;
      const base = c.offset + REC_SIZE[c.type] * k;
      const s = safe(() => (pm5 ? readShape5(kind, base) : readShape(kind, base)));
      if (s) shapes.push(s);
    }
    if (isMasterRec) { if (shapes.length) masters.push({ seq: shapesSeq, shapes }); }
    else spreads.push({ shapes });
  }

  // PageMaker 5 shape records (78 bytes): corners at +6 and +10, line ends at +0x26 and +0x2a,
  // stroke style and weight at +0x0e and +0x0f, text block id at +0x20
  function readShape5(kind, base) {
    r.seek(base + 6);
    const tl = r.point(), br = r.point();
    const sType = buf[base + 0x0e], wCode = buf[base + 0x0f];
    const width = wCode ? wCode / 16 : 0.5;
    if (kind === 'text') {
      r.seek(base + 0x1c);
      r.u32();
      const tbid = r.u32();
      const frameId = r.u32();
      return { kind, tl, br, xform: xf(0), story: textBlocks[tbid] ? tbid : null, frameId, raw: shapeHex(base) };
    }
    if (kind === 'line') {
      r.seek(base + 0x28);
      const p1 = r.point(), p2 = r.point();
      return { kind, tl: p1, br: p2, mirrored: false, stroke: { color: 2, type: sType === 1 ? 1 : sType, width, tint: 100 } };
    }
    if (kind === 'rect' || kind === 'ellipse') return { kind, tl, br, xform: xf(0), fill: { type: 0, color: 0 }, stroke: { type: 1, width, color: 2, tint: 100 } };
    return null;
  }

  function readShape(kind, base) {
    r.seek(base);
    if (kind === 'text') {
      r.skip(6);
      const tl = r.point(), br = r.point();
      r.skip(0xe);
      const xid = r.u32(), tbid = r.u32();
      const frameId = r.u32();
      const tb = textBlocks[tbid];
      return { kind, tl, br, xform: xf(xid), story: tb ? tbid : null, frameId, raw: shapeHex(base) };
    }
    if (kind === 'line') {
      r.skip(4);
      const color = r.u8();
      r.skip(1);
      const tl = r.point(), br = r.point();
      r.skip(0x18);
      const tmp = r.u16();
      r.skip(6);
      const type = r.u8();
      r.skip(1);
      const width = r.u16() / 5;
      r.skip(1);
      const tint = r.u8();
      return { kind, tl, br, mirrored: tmp !== 257 && tmp !== 0, stroke: { color, type, width, tint } };
    }
    if (kind === 'rect' || kind === 'ellipse' || kind === 'polygon') {
      r.skip(2);
      r.skip(1);
      r.skip(1);
      const fillColor = r.u8();
      r.skip(1);
      const tl = r.point(), br = r.point();
      r.skip(14);
      const xid = r.u32();
      const sType = r.u8();
      r.skip(2);
      const sWidth = r.u16() / 5;
      r.skip(1);
      const fillType = r.u8();
      r.skip(1);
      const sColor = r.u8();
      r.skip(1);
      r.skip(1);
      r.skip(1);
      const sTint = r.u8();
      const out = { kind, tl, br, xform: xf(xid), fill: { type: fillType, color: fillColor }, stroke: { type: sType, width: sWidth, color: sColor, tint: sTint } };
      if (kind === 'polygon') {
        r.skip(1);
        const lsSeq = r.u16();
        r.skip(8);
        const closed = r.u8();
        out.closed = closed !== 1;
        out.points = [];
        for (const c of withSeq(lsSeq)) for (let i = 0; i < c.num; i++) { seekRec(c, i); out.points.push(r.point()); }
      }
      return out;
    }
    if (kind === 'bitmap' || kind === 'metafile') {
      r.skip(6);
      const tl = r.point(), br = r.point();
      r.skip(14);
      const xid = r.u32();
      // +0x20: the visible (cropped) part of the graphic, +0x28: the whole graphic, in the graphic's own units
      const cropTL = r.point(), cropBR = r.point(), fullTL = r.point(), fullBR = r.point();
      const seq = r.u16();
      const parts = [];
      for (const c of withSeq(seq)) parts.push(buf.slice(c.offset, c.offset + c.num));
      for (const c of withSeq(seq + 1)) parts.push(buf.slice(c.offset, c.offset + c.num));
      const data = Buffer.concat(parts);
      return { kind, tl, br, xform: xf(xid), crop: { tl: cropTL, br: cropBR }, full: { tl: fullTL, br: fullBR }, data: data.length ? data.toString('base64') : null, format: sniff(data), raw: buf.slice(base, base + REC_SIZE[0x19]).toString('hex') };
    }
    return null;
  }
  function shapeHex(base) { return buf.slice(base, base + 64).toString('hex'); }
  function sniff(d) {
    if (!d || d.length < 4) return 'none';
    if (d[0] === 0x49 && d[1] === 0x49) return 'tiff';
    if (d[0] === 0x4d && d[1] === 0x4d) return 'tiff';
    if (d[0] === 0xff && d[1] === 0xd8) return 'jpeg';
    if (d[0] === 0x89 && d[1] === 0x50) return 'png';
    if (d[0] === 0x42 && d[1] === 0x4d) return 'bmp';
    if (d.readUInt32LE(0) === 0x9ac6cdd7) return 'wmf';
    if (d.readUInt32LE(0) === 1) return 'emf';
    return 'unknown';
  }

  // ---- master pages (record 0x2F "Document Master"): shape lists at +546 / +566
  for (const c of records.filter((x) => x.type === 0x2f)) {
    for (const off of [546, 566]) {
      if (c.offset + off + 2 > buf.length) continue;
      r.seek(c.offset + off);
      const seq = r.u16();
      const conts = records.filter((x) => x.seq === seq && x.type === REC.SHAPE);
      if (!conts.length || masters.some((m) => m.seq === seq)) continue;
      const shapes = [];
      for (const sc of conts) for (let k = 0; k < sc.num; k++) {
        seekRec(sc, k);
        const kind = SHAPE_TYPES[r.u8()];
        if (!kind) continue;
        const sh = safe(() => readShape(kind, sc.offset + REC_SIZE[sc.type] * k));
        if (sh) shapes.push(sh);
      }
      masters.push({ seq, shapes });
    }
  }
  for (const m of masters) for (const s of m.shapes) if (s.kind === 'text' && s.story != null && textBlocks[s.story] && !storyCacheHas(s.story)) readStory(textBlocks[s.story]);
  function storyCacheHas(id) { return !!storyCache[id]; }

  const stories = {};
  for (const id of Object.keys(storyCache)) stories[id] = storyCache[id];
  for (const sp of spreads) for (const s of sp.shapes) if (s.kind === 'text' && s.story != null && !stories[s.story]) stories[s.story] = readStory(textBlocks[s.story]);
  return { format: pm5 ? 'pagemaker5' : 'pagemaker', version: ver, bigEndian: be, setup, fonts, colors, spreads, masters, stories };
}

module.exports = { parse };

if (require.main === module) {
  const fs = require('fs');
  const doc = parse(fs.readFileSync(process.argv[2]));
  const sum = { setup: doc.setup, fonts: doc.fonts, colors: doc.colors.map((c) => c.name + ' ' + c.hex), spreads: doc.spreads.length, stories: Object.keys(doc.stories).length };
  console.log(JSON.stringify(sum, null, 1));
  doc.spreads.forEach((sp, i) => console.log(i, sp.shapes.map((s) => `${s.kind}${s.story != null ? '#' + s.story : ''}[${s.tl.x},${s.tl.y} ${s.br.x},${s.br.y}]${s.format ? ' ' + s.format : ''}`).join('  ')));
  for (const st of Object.values(doc.stories)) {
    const t = Buffer.from(st.text, 'base64').toString('latin1');
    console.log('story', st.id, 'len', st.length, 'chars', st.chars.length, 'paras', st.paras.length, 'fonts', [...new Set(st.chars.map((c) => doc.fonts[c.font]))].join(', '));
    console.log('   ', JSON.stringify(t.slice(0, 160)));
  }
}

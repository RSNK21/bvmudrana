// BV Mudrana: finds every font installed on the computer by reading the font files themselves
// (Windows font folders, per-user fonts, macOS and Linux folders). No PowerShell or registry needed.
'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');

function fontDirs() {
  const dirs = [];
  if (process.platform === 'win32') {
    const win = process.env.WINDIR || process.env.SystemRoot || 'C:\\Windows';
    dirs.push(path.join(win, 'Fonts'));
    if (process.env.LOCALAPPDATA) dirs.push(path.join(process.env.LOCALAPPDATA, 'Microsoft', 'Windows', 'Fonts'));
  } else if (process.platform === 'darwin') {
    dirs.push('/System/Library/Fonts', '/Library/Fonts', path.join(os.homedir(), 'Library/Fonts'));
  } else {
    dirs.push('/usr/share/fonts', '/usr/local/share/fonts', path.join(os.homedir(), '.fonts'), path.join(os.homedir(), '.local/share/fonts'));
  }
  return dirs.filter((d) => { try { return fs.statSync(d).isDirectory(); } catch (_) { return false; } });
}

function walk(dir, out, depth = 0) {
  let ents = [];
  try { ents = fs.readdirSync(dir, { withFileTypes: true }); } catch (_) { return; }
  for (const e of ents) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { if (depth < 4) walk(p, out, depth + 1); }
    else if (/\.(ttf|otf|ttc|otc)$/i.test(e.name)) out.push(p);
  }
}

// read just enough of a font file: header, table directory, name, OS/2, head, cmap header
function readFaces(file) {
  let fd;
  try { fd = fs.openSync(file, 'r'); } catch (_) { return []; }
  const read = (pos, len) => { const b = Buffer.alloc(len); const n = fs.readSync(fd, b, 0, len, pos); return n < len ? b.subarray(0, n) : b; };
  const faces = [];
  try {
    const head = read(0, 12);
    if (head.length < 12) return faces;
    const tag = head.toString('latin1', 0, 4);
    let offsets = [0];
    if (tag === 'ttcf') {
      const n = Math.min(head.readUInt32BE(8), 64);
      const b = read(12, 4 * n);
      offsets = [];
      for (let i = 0; i < n; i++) offsets.push(b.readUInt32BE(i * 4));
    }
    offsets.forEach((off, index) => {
      const f = readFace(read, off);
      if (f) faces.push(Object.assign(f, { file, index }));
    });
  } catch (_) { /* damaged font file */ } finally { fs.closeSync(fd); }
  return faces;
}

function readFace(read, off) {
  const hdr = read(off, 12);
  if (hdr.length < 12) return null;
  const numTables = hdr.readUInt16BE(4);
  if (!numTables || numTables > 200) return null;
  const dir = read(off + 12, numTables * 16);
  const tables = {};
  for (let i = 0; i < numTables; i++) {
    const t = dir.toString('latin1', i * 16, i * 16 + 4);
    tables[t] = { off: dir.readUInt32BE(i * 16 + 8), len: dir.readUInt32BE(i * 16 + 12) };
  }
  if (!tables.name) return null;
  const nb = read(tables.name.off, Math.min(tables.name.len, 1 << 20));
  const count = nb.readUInt16BE(2), strOff = nb.readUInt16BE(4);
  const names = {};
  for (let i = 0; i < count; i++) {
    const r = 6 + i * 12;
    if (r + 12 > nb.length) break;
    const plat = nb.readUInt16BE(r), enc = nb.readUInt16BE(r + 2), lang = nb.readUInt16BE(r + 4), id = nb.readUInt16BE(r + 6);
    const len = nb.readUInt16BE(r + 8), so = nb.readUInt16BE(r + 10);
    if (![1, 2, 4, 16, 17].includes(id)) continue;
    const s = nb.subarray(strOff + so, strOff + so + len);
    let str = null, score = 0;
    if (plat === 3 || plat === 0) {
      const u = Buffer.from(s); // UTF-16BE
      for (let k = 0; k + 1 < u.length; k += 2) { const t = u[k]; u[k] = u[k + 1]; u[k + 1] = t; }
      str = u.toString('utf16le');
      score = plat === 3 && lang === 0x409 ? 3 : plat === 3 ? 2 : 1;
      if (plat === 3 && enc === 0) score += 0; // symbol-encoded name, still fine
    } else if (plat === 1 && enc === 0) { str = s.toString('latin1'); score = lang === 0 ? 1.5 : 0.5; }
    if (str === null) continue;
    str = str.replace(/\0/g, '').trim();
    if (!str) continue;
    if (!names[id] || names[id].score < score) names[id] = { str, score };
  }
  const family = (names[1] || names[16] || names[4] || {}).str;
  if (!family) return null;
  let weight = 400, italic = false;
  if (tables['OS/2']) {
    const o = read(tables['OS/2'].off, 64);
    if (o.length >= 64) { weight = o.readUInt16BE(4) || 400; italic = !!(o.readUInt16BE(62) & 1); }
  }
  const sub = ((names[2] || {}).str || '').toLowerCase();
  if (/bold/.test(sub) && weight < 600) weight = 700;
  if (/italic|oblique/.test(sub)) italic = true;
  let symbol = false;
  if (tables.cmap) {
    const c = read(tables.cmap.off, 4 + 8 * 16);
    const n = Math.min(c.readUInt16BE(2), 16);
    let hasUni = false;
    for (let i = 0; i < n; i++) {
      const p = c.readUInt16BE(4 + i * 8), e = c.readUInt16BE(6 + i * 8);
      if (p === 3 && e === 0) symbol = true;
      if ((p === 3 && (e === 1 || e === 10)) || p === 0) hasUni = true;
    }
    if (hasUni) symbol = false;
  }
  return {
    family,
    typoFamily: names[16] && names[16].str !== family ? names[16].str : undefined,
    full: (names[4] || {}).str,
    style: (names[2] || {}).str || 'Regular',
    weight, italic, symbol,
  };
}

let cache = null;
function scan() {
  if (cache) return cache;
  const files = [];
  for (const d of fontDirs()) walk(d, files);
  const faces = [];
  const seen = new Set();
  for (const f of files) {
    const key = path.basename(f).toLowerCase();
    // the same file can be installed both per-user and system-wide
    if (seen.has(key + fs.statSync(f).size)) continue;
    seen.add(key + fs.statSync(f).size);
    for (const face of readFaces(f)) faces.push(face);
  }
  const families = {};
  for (const fc of faces) {
    (families[fc.family] = families[fc.family] || []).push(fc);
    if (fc.typoFamily) (families[fc.typoFamily] = families[fc.typoFamily] || []).push(Object.assign({}, fc, { alias: true }));
  }
  cache = { families, list: Object.keys(families).sort((a, b) => a.localeCompare(b)), faces };
  return cache;
}

// CSS @font-face rules for the requested families, served through the bvfont: protocol
function cssFor(familyNames) {
  const { families } = scan();
  let css = '';
  for (const name of familyNames) {
    const fcs = families[name];
    if (!fcs) continue;
    const used = new Set();
    for (const fc of fcs) {
      const k = fc.weight + (fc.italic ? 'i' : 'n');
      if (used.has(k)) continue;
      used.add(k);
      const id = Buffer.from(fc.file + '|' + fc.index).toString('base64url');
      css += `@font-face{font-family:"${name.replace(/"/g, '')}";src:url("bvfont://f/${id}");font-weight:${fc.weight};font-style:${fc.italic ? 'italic' : 'normal'};font-display:block}\n`;
    }
  }
  return css;
}

// font file bytes for bvfont:// requests. For a face inside a .ttc collection the whole file is
// returned; Chromium reads the first face only, so collections are rebuilt as a single font.
function fontBytes(id) {
  const [file, idx] = Buffer.from(id, 'base64url').toString().split('|');
  const known = scan().faces.some((f) => f.file === file);
  if (!known) throw new Error('unknown font');
  const buf = fs.readFileSync(file);
  const index = +idx || 0;
  if (buf.toString('latin1', 0, 4) !== 'ttcf') return buf;
  return extractFromCollection(buf, index);
}

function extractFromCollection(buf, index) {
  const off = buf.readUInt32BE(12 + 4 * index);
  const numTables = buf.readUInt16BE(off + 4);
  const recs = [];
  for (let i = 0; i < numTables; i++) {
    const r = off + 12 + i * 16;
    recs.push({ tag: buf.slice(r, r + 4), sum: buf.readUInt32BE(r + 4), off: buf.readUInt32BE(r + 8), len: buf.readUInt32BE(r + 12) });
  }
  const headerLen = 12 + numTables * 16;
  let pos = headerLen;
  const parts = [];
  const out = Buffer.alloc(headerLen);
  buf.copy(out, 0, off, off + 12);
  recs.forEach((t, i) => {
    const r = 12 + i * 16;
    t.tag.copy(out, r);
    out.writeUInt32BE(t.sum, r + 4);
    out.writeUInt32BE(pos, r + 8);
    out.writeUInt32BE(t.len, r + 12);
    const data = buf.slice(t.off, t.off + t.len);
    const pad = (4 - (t.len % 4)) % 4;
    parts.push(data, Buffer.alloc(pad));
    pos += t.len + pad;
  });
  return Buffer.concat([out, ...parts]);
}

module.exports = { scan, cssFor, fontBytes, fontDirs };

if (require.main === module) {
  const r = scan();
  console.log(r.list.length, 'families', r.faces.length, 'faces');
  console.log(r.list.slice(0, 40).join(' | '));
}

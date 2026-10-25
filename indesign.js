/* BV Mudrana: InDesign files.
   IDML (InDesign CS4 and later) is read and written directly: it is a zip of XML files.
   INDD, INDT and INX are InDesign's own binary or older formats; for those BV Mudrana asks an installed
   InDesign (any version from CS3 on, through its COM automation on Windows) to convert to or from IDML. */
const fs = require('fs');
const path = require('path');
const os = require('os');
const cp = require('child_process');

const isWin = process.platform === 'win32';

// ---------------------------------------------------------------- reading IDML
function unzipSync(buf) {
  const CFB = require('cfb');
  const z = CFB.read(buf, { type: 'buffer' });
  const out = {};
  z.FullPaths.forEach((p, i) => {
    const e = z.FileIndex[i];
    if (!e || !e.content || e.type !== 2) return;
    const name = p.replace(/^Root Entry\//, '');
    out[name] = Buffer.from(e.content);
  });
  return out;
}
function mimeOf(buf, name) {
  if (buf.length > 4 && buf[0] === 0xff && buf[1] === 0xd8) return 'jpeg';
  if (buf.length > 8 && buf.readUInt32BE(0) === 0x89504e47) return 'png';
  if (buf.length > 4 && ((buf[0] === 0x49 && buf[1] === 0x49) || (buf[0] === 0x4d && buf[1] === 0x4d))) return 'tiff';
  if (buf.length > 2 && buf[0] === 0x42 && buf[1] === 0x4d) return 'bmp';
  if (buf.length > 3 && buf.toString('latin1', 0, 3) === 'GIF') return 'gif';
  return (path.extname(name || '').slice(1) || 'bin').toLowerCase();
}
// a linked or embedded picture as a data URL the renderer can show (null for PSD, AI, EPS, PDF)
function toDataUrl(buf, name, decodeImage) {
  const kind = mimeOf(buf, name);
  if (kind === 'jpeg' || kind === 'png' || kind === 'gif') return `data:image/${kind};base64,` + buf.toString('base64');
  if ((kind === 'tiff' || kind === 'tif' || kind === 'bmp') && decodeImage) return decodeImage({ format: kind === 'tif' ? 'tiff' : kind, data: buf.toString('base64') });
  return null;
}
function uriToPath(uri) {
  let u = String(uri || '');
  if (!u) return null;
  try { u = decodeURIComponent(u); } catch (_) {}
  u = u.replace(/^file:(\/\/)?/i, '');
  if (/^\/[A-Za-z]:/.test(u)) u = u.slice(1); // file:///C:/...
  if (/^[A-Za-z]%3A/i.test(u)) u = u.replace(/%3A/i, ':');
  return u;
}
// find a linked file: where InDesign had it, in a Links folder next to the file, or next to the file
function findLink(uri, base) {
  const p = uriToPath(uri);
  if (!p) return null;
  const name = p.split(/[\\/]/).pop();
  const tries = [p, path.join(base, 'Links', name), path.join(base, name)];
  try { for (const d of fs.readdirSync(base)) if (/links$/i.test(d)) tries.push(path.join(base, d, name)); } catch (_) {}
  for (const t of tries) { try { if (t && fs.existsSync(t) && fs.statSync(t).isFile()) return t; } catch (_) {} }
  return null;
}
function readIdml(p, decodeImage) {
  const files = unzipSync(fs.readFileSync(p));
  if (!files['designmap.xml']) throw new Error('This IDML file has no designmap.xml, so it is not an InDesign Markup file.');
  const xml = {};
  for (const [k, v] of Object.entries(files)) if (/\.xml$/i.test(k)) xml[k] = v.toString('utf8');
  // linked pictures
  const links = {};
  const base = path.dirname(p);
  for (const [k, s] of Object.entries(xml)) {
    if (!/^(Master)?Spreads\//.test(k)) continue;
    for (const m of s.matchAll(/LinkResourceURI="([^"]*)"/g)) {
      const uri = m[1].replace(/&amp;/g, '&');
      if (links[uri] !== undefined) continue;
      const f = findLink(uri, base);
      links[uri] = f ? { path: f, src: toDataUrl(fs.readFileSync(f), f, decodeImage) } : null;
    }
  }
  return { xml, links };
}

// ---------------------------------------------------------------- writing IDML
async function writeIdml(filePath, files, images) {
  const JSZip = require('jszip');
  const zip = new JSZip();
  // the mimetype comes first and is stored, not compressed (the IDML rule)
  zip.file('mimetype', 'application/vnd.adobe.indesign-idml-package', { compression: 'STORE' });
  for (const [name, text] of Object.entries(files)) if (name !== 'mimetype') zip.file(name, text, { createFolders: false });
  fs.writeFileSync(filePath, await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE', compressionOptions: { level: 6 } }));
  // pictures go in a Links folder beside the file, as InDesign packages them
  const written = [];
  if (images && Object.keys(images).length) {
    const dir = path.join(path.dirname(filePath), path.basename(filePath).replace(/\.[^.]+$/, '') + ' Links');
    fs.mkdirSync(dir, { recursive: true });
    for (const [name, b64] of Object.entries(images)) { const f = path.join(dir, name); fs.writeFileSync(f, Buffer.from(b64, 'base64')); written.push(f); }
  }
  return { path: filePath, links: written };
}
const linksDirFor = (filePath) => path.join(path.dirname(filePath), path.basename(filePath).replace(/\.[^.]+$/, '') + ' Links');

// ---------------------------------------------------------------- InDesign automation (Windows COM)
const PROGIDS = ['InDesign.Application', ...['2027', '2026', '2025', '2024', '2023', '2022', '2021', '2020', 'CC.2019', 'CC.2018', 'CC.2017', 'CC.2015', 'CC.2014', 'CC', 'CS6', 'CS5.5', 'CS5', 'CS4', 'CS3'].map((v) => 'InDesign.Application.' + v)];
const JS = 1246973031; // ScriptLanguage.JAVASCRIPT
function runJsx(jsx, timeoutMs = 600000) {
  return new Promise((resolve) => {
    if (!isWin) return resolve({ ok: false, reason: 'InDesign automation works on Windows only.' });
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bvm-id-'));
    const jsxFile = path.join(dir, 'job.jsx');
    fs.writeFileSync(jsxFile, jsx, 'utf8');
    const ps = `$ErrorActionPreference = 'Stop'
$app = $null; $used = ''
foreach ($p in @(${PROGIDS.map((x) => `'${x}'`).join(',')})) { try { $app = New-Object -ComObject $p; $used = $p; break } catch { } }
if (-not $app) { Write-Output 'FAIL NOTFOUND'; exit 2 }
try { $code = [System.IO.File]::ReadAllText('${jsxFile.replace(/'/g, "''")}', [System.Text.Encoding]::UTF8); $r = $app.DoScript($code, ${JS}); Write-Output ('DONE ' + $used + ' ' + $r) }
catch { Write-Output ('FAIL ' + $_.Exception.Message); exit 3 }`;
    const psFile = path.join(dir, 'run.ps1');
    fs.writeFileSync(psFile, '\ufeff' + ps, 'utf8');
    const p = cp.spawn('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', psFile], { windowsHide: true });
    let out = '';
    const t = setTimeout(() => { try { p.kill(); } catch (_) {} }, timeoutMs);
    p.stdout.on('data', (d) => (out += d.toString()));
    p.stderr.on('data', (d) => (out += d.toString()));
    p.on('error', (e) => { clearTimeout(t); resolve({ ok: false, reason: 'PowerShell could not start: ' + e.message }); });
    p.on('close', () => {
      clearTimeout(t);
      try { fs.rmSync(dir, { recursive: true, force: true }); } catch (_) {}
      const done = /DONE (\S+)/.exec(out);
      if (done) return resolve({ ok: true, app: done[1] });
      if (/FAIL NOTFOUND/.test(out)) return resolve({ ok: false, notFound: true, reason: 'InDesign is not installed on this computer.' });
      const f = /FAIL (.*)/.exec(out);
      resolve({ ok: false, reason: f ? f[1].trim() : out.trim().split('\n').slice(-2).join(' ') || 'InDesign did not answer.' });
    });
  });
}
const jsPath = (p) => JSON.stringify(p.replace(/\\/g, '/'));
const PRE = 'app.scriptPreferences.userInteractionLevel = UserInteractionLevels.NEVER_INTERACT;\n';
// INDD, INDT, INX or IDMS -> IDML through InDesign
async function toIdml(src) {
  const out = path.join(os.tmpdir(), 'bvm-' + Date.now().toString(36) + '.idml');
  const jsx = PRE + `var d = app.open(File(${jsPath(src)}), false);
try { d.exportFile(ExportFormat.INDESIGN_MARKUP, File(${jsPath(out)})); } finally { d.close(SaveOptions.NO); }
"ok";`;
  const r = await runJsx(jsx);
  if (!r.ok) return r;
  if (!fs.existsSync(out)) return { ok: false, reason: 'InDesign did not write the IDML file.' };
  return { ok: true, idml: out, app: r.app };
}
// IDML -> INDD or INDT through InDesign
async function fromIdml(idml, target) {
  const tmpl = /\.indt$/i.test(target);
  const jsx = PRE + `var d = app.open(File(${jsPath(idml)}), false);
try { d.save(File(${jsPath(target)}), ${tmpl ? 'true' : 'false'}); } finally { d.close(SaveOptions.NO); }
"ok";`;
  const r = await runJsx(jsx);
  if (!r.ok) return r;
  return fs.existsSync(target) ? { ok: true, path: target, app: r.app } : { ok: false, reason: 'InDesign did not save the file.' };
}

module.exports = { readIdml, writeIdml, toIdml, fromIdml, linksDirFor, unzipSync };

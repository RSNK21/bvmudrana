// BV Mudrana: saving PageMaker publications.
// PageMaker's own file format is private, so the publication is built by PageMaker 7 itself: BV Mudrana writes a
// job folder (tagged text, graphics, a script) and drives PageMaker over DDE, PageMaker's documented automation
// interface. Without PageMaker on this computer, a "PageMaker kit" folder is written instead; running its script
// in PageMaker 7 (Scripts palette) gives the same result.
'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');
const cp = require('child_process');

const isWin = process.platform === 'win32';

function regDefault(key) {
  try {
    const out = cp.execFileSync('reg', ['query', key, '/ve'], { encoding: 'utf8', windowsHide: true, timeout: 5000 });
    const m = out.match(/REG_(?:EXPAND_)?SZ\s+(.+)/);
    return m ? m[1].trim().replace(/^"|"$/g, '') : null;
  } catch (_) { return null; }
}

// where the person told us PageMaker is (File ▸ Save As ▸ “Locate PageMaker…”)
let settingsFile = null;
function init(userDataDir) { settingsFile = path.join(userDataDir, 'pagemaker.json'); }
function readSettings() { try { return JSON.parse(fs.readFileSync(settingsFile, 'utf8')); } catch (_) { return {}; } }
function setPageMakerPath(p) { if (!settingsFile) return; const st = readSettings(); st.exe = p; fs.writeFileSync(settingsFile, JSON.stringify(st, null, 1)); }

function findPageMaker() {
  const saved = readSettings().exe;
  if (saved && fs.existsSync(saved)) return saved;
  if (!isWin) return null;
  const keys = [];
  for (const exe of ['PM70.EXE', 'PM7.EXE', 'PM65.EXE']) {
    keys.push(`HKLM\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\App Paths\\${exe}`, `HKLM\\SOFTWARE\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\App Paths\\${exe}`, `HKCU\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\App Paths\\${exe}`);
  }
  for (const k of keys) { const p = regDefault(k); if (p && fs.existsSync(p)) return p; }
  const roots = [process.env['ProgramFiles(x86)'], process.env.ProgramFiles, 'C:\\Program Files (x86)', 'C:\\Program Files', 'C:\\'].filter(Boolean);
  for (const r of roots) for (const d of ['Adobe\\PageMaker 7.0', 'Adobe\\PageMaker 7', 'PageMaker 7.0', 'PM7', 'Adobe\\PM7']) {
    for (const exe of ['PM70.EXE', 'Pm70.exe', 'PM7.EXE']) { const p = path.join(r, d, exe); if (fs.existsSync(p)) return p; }
  }
  // any folder with “PageMaker” in its name, one or two levels down
  const isPm = (f) => /^pm(70|7|65)\.exe$/i.test(f);
  for (const r of roots.slice(0, 4)) {
    let top = [];
    try { top = fs.readdirSync(r); } catch (_) { continue; }
    for (const d of top) {
      const full = path.join(r, d);
      const tryDir = (dir) => { try { const f = fs.readdirSync(dir).find(isPm); return f ? path.join(dir, f) : null; } catch (_) { return null; } };
      if (/pagemaker/i.test(d)) { const hit = tryDir(full); if (hit) return hit; }
      if (/^adobe$/i.test(d)) { let sub = []; try { sub = fs.readdirSync(full); } catch (_) {} for (const s2 of sub) if (/pagemaker|^pm/i.test(s2)) { const hit = tryDir(path.join(full, s2)); if (hit) return hit; } }
    }
  }
  return null;
}

// PageMaker scripts accept paths of at most 91 characters, so jobs live in a short folder
function jobRoot() { return isWin ? 'C:\\Users\\Public\\BVM' : path.join(os.tmpdir(), 'BVM'); }

function fill(s, dir, out) { return s.split('%DIR%').join(dir).split('%OUT%').join(out); }

function writeJob(dir, job, outPath) {
  fs.mkdirSync(dir, { recursive: true });
  for (const f of job.files) fs.writeFileSync(path.join(dir, f.name), Buffer.from(f.base64, 'base64'));
  // the .spt is ANSI text like everything PageMaker reads
  fs.writeFileSync(path.join(dir, 'Build publication.spt'), Buffer.from(fill(job.spt, dir, outPath), 'latin1'));
  const steps = job.steps.filter((s) => !s.c.startsWith('--')).map((s) => Object.assign({}, s, { c: fill(s.c, dir, outPath), alt: s.alt && s.alt.map((a) => fill(a, dir, outPath)) }));
  fs.writeFileSync(path.join(dir, 'steps.json'), JSON.stringify(steps));
  const clean = (t) => String(t).replace(/[\t\r\n]/g, ' ');
  fs.writeFileSync(path.join(dir, 'steps.tsv'), steps.map((x) => [x.q ? 'Q' : 'X', (x.try ? 't' : '') + (x.save ? 's' : ''), x.v || '', x.i || 0, clean(x.c), ...(x.alt || []).map(clean)].join('\t')).join('\r\n'), 'utf8');
  return steps;
}

// ---- DDE driver (C# compiled by PowerShell; DDEML is part of Windows)
const DRIVER = String.raw`
param([string]$Dir, [string]$Exe, [string]$Out)
$ErrorActionPreference = 'Stop'
Add-Type -TypeDefinition @"
using System; using System.Text; using System.Runtime.InteropServices;
public static class PmDde {
  public delegate IntPtr Cb(uint t, uint f, IntPtr hc, IntPtr h1, IntPtr h2, IntPtr hd, IntPtr d1, IntPtr d2);
  [DllImport("user32.dll")] static extern uint DdeInitializeW(ref uint id, Cb cb, uint cmd, uint res);
  [DllImport("user32.dll", CharSet=CharSet.Unicode)] static extern IntPtr DdeCreateStringHandleW(uint id, string s, int cp);
  [DllImport("user32.dll")] static extern IntPtr DdeConnect(uint id, IntPtr svc, IntPtr topic, IntPtr cc);
  [DllImport("user32.dll")] static extern IntPtr DdeClientTransaction(byte[] d, uint cb, IntPtr hc, IntPtr item, uint fmt, uint type, uint ms, out uint res);
  [DllImport("user32.dll")] static extern uint DdeGetData(IntPtr h, byte[] d, uint cb, uint off);
  [DllImport("user32.dll")] static extern bool DdeFreeDataHandle(IntPtr h);
  [DllImport("user32.dll")] static extern bool DdeDisconnect(IntPtr hc);
  [DllImport("user32.dll")] static extern uint DdeGetLastError(uint id);
  static uint inst; static IntPtr conv; static Cb keep = (a,b,c,d,e,f,g,h) => IntPtr.Zero;
  public static bool Connect() {
    if (inst == 0) DdeInitializeW(ref inst, keep, 0x10, 0);
    IntPtr s = DdeCreateStringHandleW(inst, "PageMaker", 1200), t = DdeCreateStringHandleW(inst, "PageMaker", 1200);
    conv = DdeConnect(inst, s, t, IntPtr.Zero);
    if (conv == IntPtr.Zero) conv = DdeConnect(inst, s, IntPtr.Zero, IntPtr.Zero);
    return conv != IntPtr.Zero;
  }
  public static string Exec(string c) {
    byte[] d = Encoding.Unicode.GetBytes(c + "\0"); uint r;
    IntPtr h = DdeClientTransaction(d, (uint)d.Length, conv, IntPtr.Zero, 0, 0x4050, 300000, out r);
    return h == IntPtr.Zero ? ("ERR " + DdeGetLastError(inst)) : "OK";
  }
  public static string Ask(string q) {
    IntPtr item = DdeCreateStringHandleW(inst, q, 1200); uint r;
    IntPtr h = DdeClientTransaction(null, 0, conv, item, 1, 0x20B0, 120000, out r);
    if (h == IntPtr.Zero) return null;
    byte[] b = new byte[65536]; uint n = DdeGetData(h, b, (uint)b.Length, 0); DdeFreeDataHandle(h);
    return Encoding.Default.GetString(b, 0, (int)n).TrimEnd('\0', '\r', '\n');
  }
  public static void Close() { if (conv != IntPtr.Zero) DdeDisconnect(conv); }
}
"@
if (-not [PmDde]::Connect()) {
  Write-Output "MSG Starting PageMaker 7..."
  Start-Process -FilePath $Exe | Out-Null
  $ok = $false
  for ($i = 0; $i -lt 120; $i++) { Start-Sleep -Milliseconds 1000; if ([PmDde]::Connect()) { $ok = $true; break } }
  if (-not $ok) { Write-Output "FAIL PageMaker did not answer. Start PageMaker 7, close any dialog it shows, and save again."; exit 2 }
  Start-Sleep -Seconds 3
}
$steps = Get-Content -Raw -Encoding UTF8 (Join-Path $Dir 'steps.json') | ConvertFrom-Json
$vars = @{}
$n = $steps.Count; $i = 0; $errs = 0
foreach ($s in $steps) {
  $i++
  $c = $s.c
  foreach ($k in $vars.Keys) { $c = $c.Replace('%' + $k + '%', $vars[$k]) }
  if ($i % 10 -eq 0 -or $s.save) { Write-Output ("STEP " + $i + " " + $n) }
  if ($s.q) {
    $r = [PmDde]::Ask($c)
    if ($r -ne $null) { $parts = $r.Split(','); if ($parts.Count -gt $s.i) { $vars[$s.v] = $parts[$s.i].Trim().Trim('"') } }
    continue
  }
  $res = [PmDde]::Exec($c)
  if ($res -ne 'OK' -and $s.alt) { foreach ($a in $s.alt) { $res = [PmDde]::Exec($a) } }
  if ($res -ne 'OK' -and -not $s.try) { $errs++; Write-Output ("ERR " + $i + " " + $c + " :: " + $res) }
}
# close the new publication only once it is saved (otherwise PageMaker would ask about unsaved changes)
if ($Out -and (Test-Path -LiteralPath $Out)) { [PmDde]::Exec('close') | Out-Null }
[PmDde]::Close()
Write-Output ("DONE " + $errs)
`;

// the helper ships unpacked next to the app (an .exe cannot run from inside app.asar)
function helperPath() {
  const p = path.join(__dirname, 'helpers', 'pmdde.exe').replace(/app\.asar([\\/])/, 'app.asar.unpacked$1');
  return fs.existsSync(p) ? p : null;
}
function runDriver(dir, exe, out, progress, usePowerShell) {
  return new Promise((resolve) => {
    let p;
    const helper = !usePowerShell && helperPath();
    if (helper) p = cp.spawn(helper, [path.join(dir, 'steps.tsv'), exe, out, path.join(dir, 'pagemaker-log.txt')], { windowsHide: true, cwd: dir });
    else {
      const ps1 = path.join(dir, 'driver.ps1');
      fs.writeFileSync(ps1, '\ufeff' + DRIVER, 'utf8');
      p = cp.spawn('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', ps1, '-Dir', dir, '-Exe', exe, '-Out', out], { windowsHide: true });
    }
    p.on('error', (e) => resolve({ done: false, fail: 'The PageMaker helper could not start: ' + e.message, errors: [], spawnError: true }));
    const errors = [];
    let fail = null, done = false, buf = '';
    p.stdout.on('data', (d) => {
      buf += d.toString();
      let k;
      while ((k = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, k).trim(); buf = buf.slice(k + 1);
        if (line.startsWith('STEP ')) { const [, a, b] = line.split(' '); progress && progress({ step: +a, of: +b }); }
        else if (line.startsWith('MSG ')) progress && progress({ message: line.slice(4) });
        else if (line.startsWith('ERR ')) errors.push(line.slice(4));
        else if (line.startsWith('FAIL ')) fail = line.slice(5);
        else if (line.startsWith('DONE')) done = true;
      }
    });
    let stderr = '';
    p.stderr.on('data', (d) => (stderr += d.toString()));
    p.on('close', () => resolve({ done, crashed: !done && !fail && /Exception/.test(stderr), fail: fail || (!done ? stderr.trim().split('\n').slice(0, 2).join(' ') || 'PageMaker automation stopped.' : null), errors }));
  });
}

const README = (name, dir) => `BV Mudrana: PageMaker kit for “${name}”
=========================================================

PageMaker 7 builds the publication from this kit, so it opens and saves in real PageMaker format.

1. Copy this whole folder to   ${dir}
   (PageMaker scripts can only use short paths; the script expects exactly this folder.)
2. Start PageMaker 7. Choose Window ▸ Plug-in Palettes ▸ Show Scripts.
3. In the Scripts palette menu choose “Add Script…” and pick “Build publication.spt” from this folder,
   then double-click it. PageMaker creates the pages, styles, text frames and graphics, flows the text and
   saves the publication in this folder.

The s###.txt files are PageMaker Tagged Text (place them yourself with File ▸ Place, “Read tags” on, if you prefer).
Unicode Kannada has been converted to Nudi ASCII with the Brahmavidya converter; the Nudi fonts must be installed.
`;

async function save(job, progress) {
  const ext = (path.extname(job.target).slice(1) || 'pmd').toLowerCase();
  const kind = ext === 'p65' ? 'p65' : ext === 'pmt' || ext === 't65' ? 'pmt' : 'pmd';
  const exe = job.exe && fs.existsSync(job.exe) ? job.exe : findPageMaker();
  const base = path.basename(job.target).replace(/\.[^.]+$/, '');
  const short = (base.replace(/[^A-Za-z0-9]+/g, '').slice(0, 12) || 'pub') + '-' + Date.now().toString(36).slice(-5);
  if (job.kitOnly || !exe || !isWin) {
    const kit = makeKit(job, base);
    return { ok: false, notFound: !exe && !job.kitOnly, kitOnly: !!job.kitOnly, reason: job.kitOnly ? 'A PageMaker kit was made.' : isWin ? 'PageMaker 7 was not found on this computer.' : 'PageMaker 7 runs on Windows only.', kit };
  }
  const dir = path.join(jobRoot(), short);
  const out = path.join(dir, 'out.' + (kind === 'p65' ? 'p65' : kind === 'pmt' ? 'pmt' : 'pmd'));
  writeJob(dir, job, out);
  progress && progress({ message: 'PageMaker 7 is building the publication…' });
  let r = await runDriver(dir, exe, out, progress, false);
  if (r.spawnError || r.crashed) r = await runDriver(dir, exe, out, progress, true); // no .NET? try PowerShell
  const logSrc = path.join(dir, 'pagemaker-log.txt');
  if (fs.existsSync(out)) {
    fs.copyFileSync(out, job.target);
    if (r.errors.length && fs.existsSync(logSrc)) { try { fs.copyFileSync(logSrc, path.join(path.dirname(job.target), base + ' - PageMaker log.txt')); } catch (_) {} }
    try { fs.rmSync(dir, { recursive: true, force: true }); } catch (_) {}
    return { ok: true, path: job.target, errors: r.errors, pagemaker: exe };
  }
  // nothing saved: keep everything that is needed to finish by hand, and the log of what PageMaker answered
  const kit = makeKit(job, base);
  let log = null;
  if (fs.existsSync(logSrc)) { log = path.join(kit, 'PageMaker log.txt'); try { fs.copyFileSync(logSrc, log); } catch (_) { log = null; } }
  return { ok: false, reason: r.fail || 'PageMaker did not save the publication.', errors: r.errors, kit, log, pagemaker: exe };
}

function makeKit(job, base) {
  const kitDir = path.join(path.dirname(job.target), base + ' - PageMaker kit');
  const winDir = 'C:\\BVM\\' + (base.replace(/[^A-Za-z0-9 _-]+/g, '').trim().slice(0, 30) || 'Publication');
  const out = winDir + '\\' + (base.replace(/[^A-Za-z0-9 _-]+/g, '').trim().slice(0, 30) || 'Publication') + path.extname(job.target).replace(/^\.pm7$/i, '.pmd');
  fs.mkdirSync(kitDir, { recursive: true });
  for (const f of job.files) fs.writeFileSync(path.join(kitDir, f.name), Buffer.from(f.base64, 'base64'));
  fs.writeFileSync(path.join(kitDir, 'Build publication.spt'), Buffer.from(fill(job.spt, winDir, out), 'latin1'));
  fs.writeFileSync(path.join(kitDir, 'README.txt'), '\ufeff' + README(base, winDir).replace(/\n/g, '\r\n'), 'utf8');
  return kitDir;
}

// copy a script into PageMaker's Scripts palette folder
function installScript(scriptPath) {
  const exe = findPageMaker();
  if (!exe) return null;
  const dir = path.join(path.dirname(exe), 'RSRC', 'USENGLSH', 'Plugins', 'Scripts', 'BV Mudrana');
  try { fs.mkdirSync(dir, { recursive: true }); const d = path.join(dir, path.basename(scriptPath)); fs.copyFileSync(scriptPath, d); return d; } catch (_) { return null; }
}

// PageMaker 4 and 5 publications: PageMaker 7 opens them (it converts older publications itself) and saves
// a PageMaker 7 copy, which BV Mudrana then reads.
async function convertOld(src, progress) {
  const exe = findPageMaker();
  if (!isWin) return { ok: false, reason: 'PageMaker 7 runs on Windows only.' };
  if (!exe) return { ok: false, notFound: true, reason: 'PageMaker 7 was not found on this computer.' };
  const short = 'old-' + Date.now().toString(36).slice(-6);
  const dir = path.join(jobRoot(), short);
  fs.mkdirSync(dir, { recursive: true });
  const inName = 'in' + (path.extname(src) || '.pm5').toLowerCase();
  fs.copyFileSync(src, path.join(dir, inName));
  const out = path.join(dir, 'out.pmd');
  const job = { files: [], spt: '', steps: [
    { c: 'new 1', try: true },
    { c: 'close', try: true },
    { c: `open "${path.join(dir, inName)}"` },
    { c: 'saveas "%OUT%"', save: true },
    { c: 'close', try: true },
  ] };
  writeJob(dir, job, out);
  progress && progress({ message: 'PageMaker 7 is converting ' + path.basename(src) + '…' });
  let r = await runDriver(dir, exe, out, progress, false);
  if (r.spawnError || r.crashed) r = await runDriver(dir, exe, out, progress, true);
  if (fs.existsSync(out)) return { ok: true, path: out, dir };
  return { ok: false, reason: r.fail || 'PageMaker did not convert the publication.', errors: r.errors };
}

module.exports = { init, findPageMaker, setPageMakerPath, save, convertOld, installScript, writeJob, makeKit, DRIVER, helperPath };

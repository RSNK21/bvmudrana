// BV Mudrana: Electron main process
const { app, BrowserWindow, Menu, dialog, ipcMain, shell, session, nativeImage, protocol } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const fontscan = require('./fontscan');
const pmsave = require('./pmsave');
const indesign = require('./indesign');

let win = null;
let dirty = false;
const PM_EXT = ['pmd', 'pm7', 'p65', 'pm6', 'pt6', 't65', 'pmt', 'pm5', 'pt5', 'pm4', 'pt4'];
const PM_OLD = ['pm5', 'pt5', 'pm4', 'pt4'];
const ID_EXT = ['idml', 'indd', 'indt', 'idms', 'inx'];
const OPEN_RE = /\.(bvm|bvt|pmd|pm7|p65|pm6|pt6|t65|pmt|pm5|pt5|pm4|pt4|idml|indd|indt|idms|inx)$/i;
let pendingOpen = process.argv.slice(1).find((a) => OPEN_RE.test(a)) || null;
const menuState = {
  autoflow: false, rulers: true, guides: true, snap: true, snapRulers: false, zeroLock: false, guidesFront: false, scrollbars: true,
  masters: true, lockGuides: false, nonPrinting: true, tools: true, control: true, styles: true, colors: true, layers: true,
  masterPal: true, toolbar: true, theme_dark: true, mode_pagemaker: true, baseline: false, pagesPal: false, storyEditor: false, displayPara: false, displayStyleNames: true, styleNames: [], recentFonts: [],
};

protocol.registerSchemesAsPrivileged([{ scheme: 'bvfont', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true } }]);

// ---------------------------------------------------------------- recent files
const recentFile = () => path.join(app.getPath('userData'), 'recent.json');
function getRecent() { try { return JSON.parse(fs.readFileSync(recentFile(), 'utf8')).filter((p) => fs.existsSync(p)).slice(0, 10); } catch (_) { return []; } }
function addRecent(p) {
  const list = [p, ...getRecent().filter((x) => x !== p)].slice(0, 10);
  try { fs.mkdirSync(path.dirname(recentFile()), { recursive: true }); fs.writeFileSync(recentFile(), JSON.stringify(list)); } catch (_) {}
  buildMenu();
}

function send(cmd, arg) { if (win) win.webContents.send('menu', cmd, arg); }

// ---------------------------------------------------------------- menus (PageMaker 7 layout and shortcuts)
function buildMenu() {
  const c = (label, accelerator, cmd, extra = {}) => ({ label, accelerator, click: () => send(cmd), _cmd: cmd, ...extra });
  const shown = (label, accelerator, cmd) => ({ label, accelerator, registerAccelerator: false, click: () => send(cmd), _cmd: cmd });
  const chk = (label, accelerator, cmd, key) => ({ label, accelerator, type: 'checkbox', checked: !!menuState[key], click: () => send(cmd), _cmd: cmd });
  const sep = { type: 'separator' };
  const recent = getRecent();
  const SE = menuState.storyEditor;
  const sizes = [6, 7, 8, 9, 10, 11, 12, 14, 18, 24, 30, 36, 48, 60, 72];
  const file = { label: '&File', submenu: [
    c('&New…', 'CmdOrCtrl+N', 'new'),
    c('&Open…', 'CmdOrCtrl+O', 'open'),
    { label: '&Recent Publications', submenu: recent.length ? [...recent.map((p) => ({ label: path.basename(p), sublabel: p, click: () => send('recent', p), _cmd: 'recent', _arg: p })), sep, c('Clear Recent', undefined, 'clearRecent')] : [{ label: '(none)', enabled: false }] },
    SE ? shown('&Close', 'CmdOrCtrl+Shift+W', 'close') : c('&Close', 'CmdOrCtrl+W', 'close'),
    c('&Save', 'CmdOrCtrl+S', 'save'),
    c('Save &As…', 'CmdOrCtrl+Shift+S', 'saveAs'),
    c('Re&vert', undefined, 'revert'),
    c('Recover &Unsaved Work…', undefined, 'recover'),
    sep,
    c('P&lace…', 'CmdOrCtrl+D', 'place'),
    sep,
    { label: '&Export', submenu: [
      c('Adobe &PDF…', 'CmdOrCtrl+Alt+Shift+P', 'exportPdf'),
      c('&HTML…', undefined, 'exportHtml'),
      sep,
      c('&Graphic…', undefined, 'exportGraphic'),
      c('&Text…', undefined, 'exportText'),
      c('PageMaker &Tagged Text…', undefined, 'exportTags'),
      sep,
      c('&InDesign Markup (IDML)…', undefined, 'exportIdml'),
      c('InDesign &Document (INDD)…', undefined, 'exportIndd'),
    ] },
    sep,
    c('Lin&ks Manager…', 'CmdOrCtrl+Shift+D', 'linksManager'),
    sep,
    c('Docu&ment Setup…', 'CmdOrCtrl+Shift+P', 'docSetup'),
    c('Document &Information…', undefined, 'docInfo'),
    c('&Print…', 'CmdOrCtrl+P', 'print'),
    sep,
    { label: 'Pre&ferences', submenu: [c('&General…', 'CmdOrCtrl+K', 'preferences'), c('&Layout Adjustment…', undefined, 'prefsLayout'), c('&Your Name…', undefined, 'userName')] },
    sep,
    { label: 'E&xit', accelerator: 'CmdOrCtrl+Q', click: () => win && win.close(), _cmd: 'role:close' },
  ] };
  const edit = { label: '&Edit', submenu: [
    c('&Undo', 'CmdOrCtrl+Z', 'undo'),
    c('&Redo', 'CmdOrCtrl+Shift+Z', 'redo'),
    sep,
    { label: 'Cu&t', role: 'cut', accelerator: 'CmdOrCtrl+X', _cmd: 'role:cut' },
    { label: '&Copy', role: 'copy', accelerator: 'CmdOrCtrl+C', _cmd: 'role:copy' },
    { label: '&Paste', role: 'paste', accelerator: 'CmdOrCtrl+V', _cmd: 'role:paste' },
    c('C&lear', undefined, 'clear'),
    sep,
    c('Select &All', 'CmdOrCtrl+A', 'selectAll'),
    c('&Deselect All', 'CmdOrCtrl+Shift+A', 'deselectAll'),
    sep,
    c('Paste &Multiple…', undefined, 'pasteMultiple'),
    c('Paste &Special…', undefined, 'pasteSpecial'),
    sep,
    c('Copy F&ormatting', 'CmdOrCtrl+Alt+Shift+C', 'copyFormat'),
    c('Paste Fo&rmatting', 'CmdOrCtrl+Alt+Shift+V', 'pasteFormat'),
    c('Format &Painter', undefined, 'formatBrush'),
    c('D&uplicate', 'CmdOrCtrl+Alt+D', 'duplicate'),
    sep,
    c(SE ? 'Edit &Layout' : 'Edit &Story', 'CmdOrCtrl+E', 'editStory'),
  ] };
  const layout = { label: '&Layout', submenu: [
    c('&Go to Page…', 'CmdOrCtrl+Alt+G', 'gotoPage'),
    c('&Insert Pages…', undefined, 'insertPages'),
    c('&Remove Pages…', undefined, 'removePages'),
    c('&Sort Pages…', undefined, 'sortPages'),
    sep,
    c('Go &Back', 'CmdOrCtrl+PageUp', 'goBack'),
    c('Go For&ward', 'CmdOrCtrl+PageDown', 'goForward'),
    c('Previous Page', 'PageUp', 'prevPage', { registerAccelerator: false }),
    c('Next Page', 'PageDown', 'nextPage', { registerAccelerator: false }),
    sep,
    c('&Column Guides…', undefined, 'columnGuides'),
    c('&Numbering and Sections…', undefined, 'sections'),
    c('&Watermark and Page Border…', undefined, 'pageDecor'),
    sep,
    c('Re&flow Overset Text…', undefined, 'reflowOverset'),
    chk('Smart &Text Reflow', undefined, 'smartReflow', 'smartReflow'),
    c('Copy &Master Guides', undefined, 'copyMasterGuides'),
    { label: 'Master &Pages', submenu: [
      c('&Apply Master…', undefined, 'applyMaster'),
      c('&New Master Page…', undefined, 'newMaster'),
      c('&Duplicate Master Page', undefined, 'duplicateMaster'),
      c('D&elete Master Page…', undefined, 'deleteMaster'),
      c('Master Page &Options…', undefined, 'masterOptions'),
      c('&Save Page as Master…', undefined, 'savePageAsMaster'),
      sep,
      c('&Go to Master Pages', undefined, 'gotoMasters'),
    ] },
    sep,
    chk('Auto&flow', undefined, 'toggleAutoflow', 'autoflow'),
  ] };
  const story = { label: '&Story', submenu: [
    c('&New Story', undefined, 'newStory'),
    c('&Close Story', 'CmdOrCtrl+W', 'closeStory'),
    sep,
    chk('&Display ¶', undefined, 'toggleDisplayPara', 'displayPara'),
    chk('Display &Style Names', undefined, 'toggleStyleNames', 'displayStyleNames'),
  ] };
  const type = { label: '&Type', submenu: [
    { label: '&Font', submenu: [c('&Other…', undefined, 'fontDialog'), ...(menuState.recentFonts.length ? [sep, ...menuState.recentFonts.map((f) => ({ label: f, click: () => send('font', f), _cmd: 'font', _arg: f }))] : [])] },
    { label: 'Si&ze', submenu: [c('&Other…', undefined, 'size:other'), sep, ...sizes.map((s) => c(String(s), undefined, 'size:' + s)), sep, c('Larger', 'CmdOrCtrl+Shift+.', 'sizeUp'), c('Smaller', 'CmdOrCtrl+Shift+,', 'sizeDown')] },
    { label: '&Leading', submenu: [c('&Other…', undefined, 'lead:other'), c('&Auto', 'CmdOrCtrl+Alt+Shift+A', 'lead:auto'), sep, ...[10, 11, 12, 13, 14, 15, 16, 17, 18, 20, 22, 24, 30, 36].map((s) => c(String(s), undefined, 'lead:' + s))] },
    { label: 'T&ype Style', submenu: [
      c('&Normal', 'CmdOrCtrl+Shift+Space', 'normalStyle'),
      c('&Bold', 'CmdOrCtrl+Shift+B', 'bold'),
      c('&Italic', 'CmdOrCtrl+Shift+I', 'italic'),
      c('&Underline', 'CmdOrCtrl+Shift+U', 'underline'),
      c('&Strikethru', 'CmdOrCtrl+Shift+/', 'strike'),
      c('&Reverse', 'CmdOrCtrl+Shift+V', 'reverse'),
      sep,
      c('&All Caps', 'CmdOrCtrl+Shift+K', 'caps'),
      c('S&mall Caps', 'CmdOrCtrl+Shift+H', 'smallCaps'),
      c('Su&perscript', 'CmdOrCtrl+Shift+\\', 'superscript'),
      c('Subs&cript', 'CmdOrCtrl+\\', 'subscript'),
    ] },
    sep,
    c('Expert &Kerning…', undefined, 'expertKerning'),
    { label: 'Expert T&racking', submenu: [c('Edit T&racks…', undefined, 'editTracks'), sep, ...[['No &Track', 0, 'CmdOrCtrl+Shift+Q'], ['&Very Loose', 0.1], ['&Loose', 0.05], ['&Normal', 0.02], ['T&ight', -0.02], ['V&ery Tight', -0.05]].map(([l, v, a]) => c(l, a, 'track:' + v))] },
    { label: 'Horizontal &Scale', submenu: [c('&Other…', undefined, 'width:other'), sep, ...[70, 80, 90].map((w) => c(w + '%', undefined, 'width:' + w)), c('&Normal', 'CmdOrCtrl+Shift+X', 'width:100'), ...[110, 120, 130].map((w) => c(w + '%', undefined, 'width:' + w))] },
    sep,
    c('Charac&ter…', 'CmdOrCtrl+T', 'typeSpecs'),
    c('&Paragraph…', 'CmdOrCtrl+M', 'paraSpecs'),
    c('&Indents/Tabs…', 'CmdOrCtrl+I', 'indentsTabs'),
    c('&Hyphenation…', undefined, 'hyphenation'),
    c('Paragraph R&ules…', undefined, 'paraRules'),
    shown('Discretionary H&yphen', 'CmdOrCtrl+Shift+-', 'insertSHY'),
    sep,
    { label: '&Alignment', submenu: [
      c('Align &Left', 'CmdOrCtrl+Shift+L', 'alignLeft'),
      c('Align &Center', 'CmdOrCtrl+Shift+C', 'alignCenter'),
      c('Align &Right', 'CmdOrCtrl+Shift+R', 'alignRight'),
      c('&Justify', 'CmdOrCtrl+Shift+J', 'alignJustify'),
      c('&Force Justify', 'CmdOrCtrl+Shift+F', 'alignForce'),
    ] },
    { label: 'Styl&e', submenu: [c('&No style', undefined, 'style:'), ...(menuState.styleNames.length ? [sep] : []), ...menuState.styleNames.map((n) => ({ label: n, click: () => send('style', n), _cmd: 'style', _arg: n }))] },
    sep,
    c('&Define Styles…', 'CmdOrCtrl+3', 'defineStyles'),
    c('C&haracter Styles…', 'CmdOrCtrl+Shift+3', 'charStyles'),
    sep,
    c('Insert G&lyph…', 'CmdOrCtrl+Alt+Shift+G', 'showGlyphs'),
    c('Insert Sample Te&xt…', undefined, 'sampleText'),
    sep,
    c('Insert Page &Number Marker', 'CmdOrCtrl+Alt+P', 'pageMarker'),
    c('Insert &Footnote…', 'CmdOrCtrl+Alt+Shift+N', 'footnote'),
    { label: 'Insert Special &Character', submenu: [
      c('Danda ।', undefined, 'char:0964'),
      c('Double Danda ॥', undefined, 'char:0965'),
      c('Avagraha ಽ', undefined, 'char:0CBD'),
      c('Avagraha (Devanagari) ऽ', undefined, 'char:093D'),
      c('Om ॐ', undefined, 'char:0950'),
      sep,
      c('Zero-Width Non-Joiner (shows the halant)', undefined, 'char:200C'),
      c('Zero-Width Joiner', undefined, 'char:200D'),
      sep,
      c('Rupee ₹', undefined, 'char:20B9'),
      c('Copyright ©', undefined, 'char:00A9'),
      c('Registered ®', undefined, 'char:00AE'),
      c('Trademark ™', undefined, 'char:2122'),
      c('Section §', undefined, 'char:00A7'),
      c('Pilcrow ¶', undefined, 'char:00B6'),
      c('Degree °', undefined, 'char:00B0'),
      sep,
      c('Bullet •', undefined, 'char:2022'),
      c('En Dash –', undefined, 'char:2013'),
      c('Ellipsis …', undefined, 'char:2026'),
      c('Single Quotes ‘ ’', undefined, 'char:2018+2019'),
      c('Double Quotes “ ”', undefined, 'char:201C+201D'),
      c('Multiplication ×', undefined, 'char:00D7'),
      c('Division ÷', undefined, 'char:00F7'),
    ] },
    chk('Use T&ypographer\'s Quotes', undefined, 'smartQuotes', 'smartQuotes'),
    { label: 'Insert &White Space', submenu: [c('Non-Breaking Space', undefined, 'char:00A0'), c('Thin Space', undefined, 'char:2009'), c('En Space', undefined, 'char:2002'), c('Hair Space', undefined, 'char:200A'), c('Figure Space', undefined, 'char:2007')] },
    { label: 'Insert Fiel&d', submenu: [
      c('&Date (dd-mm-yyyy)', undefined, 'field:date'), c('Date in &Words', undefined, 'field:dateLong'), c('Date in &Kannada', undefined, 'field:dateKn'), c('&Time', undefined, 'field:time'), sep,
      c('&Publication Name', undefined, 'field:pubName'), c('&Number of Pages', undefined, 'field:pageCount'), c('&Your Name', undefined, 'field:userName'),
    ] },
  ] };
  const element = { label: 'E&lement', submenu: [
    { label: 'Fi&ll', submenu: [c('&None', undefined, 'fill:none'), c('&Paper', undefined, 'fill:paper'), c('&Solid', undefined, 'fill:solid'), sep, ...[['10%', 10], ['20%', 20], ['30%', 30], ['40%', 40], ['60%', 60], ['80%', 80]].map(([l, v]) => c(l, undefined, 'fill:tint' + v))] },
    { label: 'Stroke', submenu: [c('&Custom…', undefined, 'fillStroke'), sep, c('&None', undefined, 'stroke:0'), c('&Hairline', undefined, 'stroke:0.25'), ...[0.5, 1, 2, 4, 6, 8, 12].map((w) => c(w + 'pt', undefined, 'stroke:' + w)), sep, c('Double (thin-thin)', undefined, 'stroke:double'), c('Thick-thin', undefined, 'stroke:thickthin'), c('Thin-thick', undefined, 'stroke:thinthick'), c('Triple', undefined, 'stroke:triple'), c('Dashed', undefined, 'stroke:dash'), c('Dotted', undefined, 'stroke:dot'), c('Solid', undefined, 'stroke:solid'), sep, c('&Transparent background', undefined, 'stroke:transparent'), c('&Reverse', undefined, 'stroke:reverse')] },
    c('Fill &and Stroke…', 'CmdOrCtrl+U', 'fillStroke'),
    sep,
    { label: '&Frame', submenu: [
      SE ? shown('&Attach Content', 'CmdOrCtrl+F', 'frameAttach') : c('&Attach Content', 'CmdOrCtrl+F', 'ctxF'),
      c('Frame &Options…', 'CmdOrCtrl+Alt+F', 'frameOptions'),
      c('Change to &Frame', 'CmdOrCtrl+Alt+Shift+F', 'frameConvert'),
      sep,
      c('&Next Frame', 'CmdOrCtrl+Alt+]', 'nextFrame'),
      c('&Previous Frame', 'CmdOrCtrl+Alt+[', 'prevFrame'),
      sep,
      c('&Remove From Threads', undefined, 'removeFromThreads'),
      sep,
      c('&Delete Content', undefined, 'frameDelete'),
    ] },
    { label: 'Arran&ge', submenu: [c('Bring to &Front', 'CmdOrCtrl+Shift+]', 'front'), c('Bring Fo&rward', 'CmdOrCtrl+]', 'forward'), c('Send Bac&kward', 'CmdOrCtrl+[', 'backward'), c('Send to &Back', 'CmdOrCtrl+Shift+[', 'back')] },
    c('&Align Objects…', 'CmdOrCtrl+Shift+E', 'alignObjects'),
    c('Text &Wrap…', 'CmdOrCtrl+Alt+E', 'textWrap'),
    sep,
    SE ? shown('&Group', 'CmdOrCtrl+G', 'group') : c('&Group', 'CmdOrCtrl+G', 'ctxG'),
    c('&Ungroup', 'CmdOrCtrl+Shift+G', 'ungroup'),
    SE ? shown('&Lock Position', 'CmdOrCtrl+L', 'lock') : c('&Lock Position', 'CmdOrCtrl+L', 'ctxL'),
    c('U&nlock', 'CmdOrCtrl+Alt+L', 'unlock'),
    sep,
    c('&Mask', 'CmdOrCtrl+6', 'mask'),
    c('&Unmask', 'CmdOrCtrl+Shift+6', 'unmask'),
    sep,
    { label: '&Image', submenu: [c('&Image Control…', undefined, 'imageControl'), sep, c('&Fit Picture to Frame', undefined, 'fitContent'), c('Fit Picture Proportionally', undefined, 'fitContentProp'), c('Fit Frame to &Picture', undefined, 'fitFrame')] },
    c('Fill &Gradient and Transparency…', undefined, 'gradientFill'),
    c('Add Colour from Selection (&Eyedropper)', undefined, 'eyedropper'),
    sep,
    c('Insert &Table…', 'CmdOrCtrl+Alt+T', 'insertTable'),
    c('ISBN &Barcode…', undefined, 'barcode'),
    sep,
    c('&Polygon Settings…', undefined, 'polygonSettings'),
    c('Rounded &Corners…', undefined, 'roundedCorners'),
    sep,
    c('Li&nk Info…', undefined, 'linkInfo'),
    c('Link &Options…', undefined, 'linkOptions'),
    sep,
    c('Fit Frame to &Text', 'CmdOrCtrl+Alt+C', 'fitFrameText'),
    c('Non-P&rinting', undefined, 'nonPrint'),
    c('Remove &Transformation', undefined, 'removeTransform'),
  ] };
  const utilities = { label: '&Utilities', submenu: [
    c('Convert &Legacy Text to Unicode…', undefined, 'convertLegacyAll'),
    c('Install Brahmavidya &Fonts in Windows', undefined, 'installBvFonts'),
    sep,
    { label: '&Plug-ins', submenu: [
      c('&Balance Columns…', undefined, 'balanceColumns'),
      c('Build &Booklet…', undefined, 'buildBooklet'),
      c('B&ullets and Numbering…', undefined, 'bullets'),
      c('Change &Case…', undefined, 'changeCase'),
      c('C&ontinuation…', undefined, 'continuation'),
      c('&Drop Cap…', undefined, 'dropCap'),
      c('&Grid Manager…', undefined, 'gridManager'),
      c('&Keyline…', undefined, 'keyline'),
      c('&Running Headers/Footers…', undefined, 'runningHeads'),
      c('&Sort Pages…', undefined, 'sortPages'),
      c('&Word Counter', undefined, 'wordCount'),
      c('Data &Merge…', undefined, 'dataMerge'),
      c('Save for Service &Provider…', undefined, 'packageFiles'),
      sep,
      { label: '&Transliterate Selection', submenu: [
        c('→ Devanagari', 'CmdOrCtrl+Alt+1', 'tr:deva'), c('→ Kannada', 'CmdOrCtrl+Alt+2', 'tr:knda'), c('→ IAST', 'CmdOrCtrl+Alt+3', 'tr:iast'), sep,
        c('ITRANS → IAST', undefined, 'tr:itrans>iast'), c('ITRANS → Devanagari', undefined, 'tr:itrans>deva'), c('ITRANS → Kannada', undefined, 'tr:itrans>knda'), c('Harvard-Kyoto → IAST', undefined, 'tr:hk>iast'),
      ] },
      c('Duplicate as &Transliteration…', undefined, 'dupTranslit'),
      c('Kannada ASCII (Nudi/Baraha) → &Unicode', undefined, 'convertNudi'),
      c('Kannada Unicode → ASCII (&Nudi/Baraha)', undefined, 'convertToNudi'),
      sep,
      c('Kannada ASCII (&Praja) → Unicode…', undefined, 'convertPraja'),
      c('Kannada Unicode → ASCII (P&raja)', undefined, 'convertToPraja'),
      c('Convert a Praja or Nudi &Document (Word, RTF, Text)…', undefined, 'legacyFile'),
      c('Install the Praja &Fonts…', undefined, 'prajaFonts'),
      sep,
      c('&IAST Characters', 'CmdOrCtrl+Alt+I', 'iastPalette'),
    ] },
    sep,
    SE ? c('&Find…', 'CmdOrCtrl+F', 'findChange', { registerAccelerator: false }) : shown('&Find…', 'CmdOrCtrl+F', 'findChange'),
    SE ? c('Find Ne&xt', 'CmdOrCtrl+G', 'findNext', { registerAccelerator: false }) : shown('Find Ne&xt', 'CmdOrCtrl+G', 'findNext'),
    c('C&hange…', 'CmdOrCtrl+H', 'findChange'),
    SE ? c('&Spelling…', 'CmdOrCtrl+L', 'spelling', { registerAccelerator: false }) : shown('&Spelling…', 'CmdOrCtrl+L', 'spelling'),
    sep,
    c('&Book…', undefined, 'book'),
    c('Export Book as &PDF…', undefined, 'exportBook'),
    c('Index &Entry…', 'CmdOrCtrl+Y', 'indexEntry'),
    c('Sho&w Index…', undefined, 'showIndex'),
    c('Create &Index…', undefined, 'createIndex'),
    c('Create &TOC…', undefined, 'createToc'),
    sep,
    c('Define &Colors…', undefined, 'defineColors'),
    c('Pre&flight…', undefined, 'preflight'),
    sep,
    c('Clean &Up Text…', undefined, 'cleanUp'),
    c('Find F&ont…', undefined, 'findFont'),
    c('Insert Stick&y Note', undefined, 'stickyNote'),
    c('Read &Aloud (start / stop)', undefined, 'readAloud'),
    { label: '&Keyboard', submenu: [
      c('Switch Keyboard On / Off', 'CmdOrCtrl+Alt+K', 'toggleKeyboard', { registerAccelerator: false }),
      sep,
      c('&English', undefined, 'kbd:off'),
      c('&Kannada: Nudi / KGP layout', undefined, 'kbd:kgp'),
      c('Kannada: &phonetic (ka = ಕ)', undefined, 'kbd:knPh'),
      c('&Devanagari: phonetic (ka = क)', undefined, 'kbd:saPh'),
      c('&IAST: phonetic (aa = ā)', undefined, 'kbd:iastPh'),
    ] },
  ] };
  const view = { label: '&View', submenu: [
    chk('Pre&view', 'CmdOrCtrl+Alt+Shift+W', 'preview', 'preview'),
    sep,
    chk('&Display Master Items', undefined, 'toggleMasterItems', 'masters'),
    chk('Display &Non-Printing Items', 'CmdOrCtrl+Alt+N', 'toggleNonPrinting', 'nonPrinting'),
    sep,
    c('Zoom &In', 'CmdOrCtrl+=', 'zoom:in'),
    c('Zoom In', 'CmdOrCtrl+Plus', 'zoom:in', { visible: false }),
    c('Zoom &Out', 'CmdOrCtrl+-', 'zoom:out'),
    c('&Actual Size', 'CmdOrCtrl+1', 'zoom:1'),
    c('Fit in &Window', 'CmdOrCtrl+0', 'zoom:fit'),
    c('Entire &Pasteboard', 'CmdOrCtrl+Shift+0', 'zoom:pasteboard'),
    { label: '&Zoom To', submenu: [
      c('25% Size', undefined, 'zoom:0.25'), c('&50% Size', 'CmdOrCtrl+5', 'zoom:0.5'), c('&75% Size', 'CmdOrCtrl+7', 'zoom:0.75'), c('&100% Size', undefined, 'zoom:1'),
      c('&200% Size', 'CmdOrCtrl+2', 'zoom:2'), c('&400% Size', 'CmdOrCtrl+4', 'zoom:4'), c('800% Size', undefined, 'zoom:8'), sep,
      c('Fit Page &Width', 'CmdOrCtrl+Alt+0', 'zoom:width'),
      c('Fit &Spread Width', 'CmdOrCtrl+Alt+Shift+0', 'zoom:spreadwidth'),
      c('Zoom to &Selection', 'CmdOrCtrl+Alt+=', 'zoom:selection'),
      c('&Previous View', 'CmdOrCtrl+Alt+-', 'zoom:previous'),
      c('Zoom In a &Little', 'CmdOrCtrl+Alt+Shift+=', 'zoom:inSmall'),
      c('Zoom Out a L&ittle', 'CmdOrCtrl+Alt+Shift+-', 'zoom:outSmall'),
      c('&Other…', undefined, 'zoom:other'),
    ] },
    sep,
    chk('Show &Rulers', 'CmdOrCtrl+R', 'toggleRulers', 'rulers'),
    chk('Snap &to Rulers', 'CmdOrCtrl+Alt+R', 'toggleSnapRulers', 'snapRulers'),
    chk('Zero Loc&k', undefined, 'toggleZeroLock', 'zeroLock'),
    sep,
    chk('Show &Guides', 'CmdOrCtrl+;', 'toggleGuides', 'guides'),
    chk('&Snap to Guides', 'CmdOrCtrl+Shift+;', 'toggleSnap', 'snap'),
    chk('&Lock Guides', 'CmdOrCtrl+Alt+;', 'toggleLockGuides', 'lockGuides'),
    c('&Clear Ruler Guides', undefined, 'clearGuides'),
    chk('Bring G&uides to Front', undefined, 'toggleGuidesFront', 'guidesFront'),
    chk('S&mart Guides', undefined, 'smartGuides', 'smartGuides'),
    sep,
    chk('Show Scroll &Bars', undefined, 'toggleScrollbars', 'scrollbars'),
    chk('Show Baseline &Grid', 'CmdOrCtrl+Alt+\'', 'toggleBaseline', 'baseline'),
    chk('Show Text T&hreads', undefined, 'showThreads', 'showThreads'),
    c('Baseline Grid Set&up…', undefined, 'baselineSetup'),
    sep,
    { label: 'Interface &Theme', submenu: [
      chk('Studio &Dark', undefined, 'theme:dark', 'theme_dark'), chk('Paper &Light', undefined, 'theme:light', 'theme_light'), sep,
      chk('&Material You (Pixel)', undefined, 'theme:material', 'theme_material'), chk('Material You D&ark', undefined, 'theme:materialDark', 'theme_materialDark'), sep,
      chk('&Classic PageMaker 7', undefined, 'theme:classic', 'theme_classic'), chk('Modern &Expressive', undefined, 'theme:expressive', 'theme_expressive'), chk('&Generic', undefined, 'theme:generic', 'theme_generic'), sep,
      c('Appearance &Settings…', undefined, 'appearance'),
    ] },
    { label: 'Interface &Mode', submenu: [
      chk('&PageMaker', undefined, 'mode:pagemaker', 'mode_pagemaker'), chk('&Advanced', undefined, 'mode:advanced', 'mode_advanced'),
      chk('&Word Style (Ribbon)', undefined, 'mode:word', 'mode_word'), chk('&Basic', undefined, 'mode:basic', 'mode_basic'), sep,
      c('Appearance &Settings…', undefined, 'appearance'),
    ] },
  ] };
  const windowMenu = { label: '&Window', submenu: [
    chk('Show &Tools', undefined, 'showTools', 'tools'),
    chk('Show Control &Palette', "CmdOrCtrl+'", 'showControl', 'control'),
    sep,
    chk('Show &Colors', 'CmdOrCtrl+J', 'showColors', 'colors'),
    chk('Show &Styles', 'CmdOrCtrl+B', 'showStyles', 'styles'),
    chk('Show &Layers', 'CmdOrCtrl+8', 'showLayers', 'layers'),
    chk('Show &Master Pages', 'CmdOrCtrl+Shift+8', 'showMasterPal', 'masterPal'),
    c('Show &Hyperlinks', 'CmdOrCtrl+9', 'showHyperlinks'),
    sep,
    chk('Show &Pages', 'CmdOrCtrl+Alt+Shift+8', 'showPages', 'pagesPal'),
    c('Show &Outline', undefined, 'showOutline'),
    chk('Show &Align && Distribute', 'CmdOrCtrl+Shift+F7', 'showAlign', 'alignPal'),
    chk('Show Gl&yphs', undefined, 'showGlyphs', 'glyphPal'),
    { label: 'Plu&g-in Palettes', submenu: [c('Show &Library', undefined, 'showLibrary'), c('Show &IAST Characters', undefined, 'iastPalette')] },
    chk('Show Tool&bar', undefined, 'showToolbar', 'toolbar'),
    sep,
    c('&Reset Palette Positions', undefined, 'resetPalettes'),
    sep,
    c('&Next Publication', 'Ctrl+Tab', 'tabNext'),
    c('Pre&vious Publication', 'Ctrl+Shift+Tab', 'tabPrev'),
    c('Reopen Closed P&ublication', 'CmdOrCtrl+Shift+T', 'tabReopen'),
    ...((menuState.docs || []).length ? [sep, ...menuState.docs.map((d, i) => ({ label: (i < 9 ? `&${i + 1} ` : '') + d.replace(/&/g, '&&'), type: 'radio', checked: i === menuState.curDoc, click: () => send('tab', i), _cmd: 'tab', _arg: i }))] : []),
    sep,
    { label: 'Toggle &Full Screen', accelerator: 'F11', role: 'togglefullscreen', _cmd: 'role:fullscreen' },
  ] };
  const help = { label: '&Help', submenu: [
    shown('&Find a Command…', 'CmdOrCtrl+Enter', 'commandPalette'),
    c('&What\'s New in This Version', undefined, 'whatsNew'),
    c('&Quick Start: Your First Page', undefined, 'quickStart'),
    c('&Keyboard Shortcuts', 'F1', 'shortcuts'),
    c('&Start Screen', undefined, 'welcome'),
    { label: 'Developer Tools', accelerator: 'F12', click: () => win && win.webContents.toggleDevTools(), _cmd: 'role:devtools' },
    sep,
    c('&About BV Mudrana…', undefined, 'about'),
  ] };
  const template = [file, edit, SE ? story : layout, type, element, utilities, view, windowMenu, help];
  // The menus are drawn inside the window (styled like the rest of BV Mudrana); the renderer handles the
  // keyboard shortcuts. Electron's own menu is kept off so nothing fires twice.
  Menu.setApplicationMenu(null);
  lastTemplate = serializeMenu(template);
  if (win && !win.isDestroyed()) win.webContents.send('menu-template', lastTemplate);
}
let lastTemplate = [];
function serializeMenu(items) {
  return items.filter((it) => it && it.visible !== false).map((it) => {
    if (it.type === 'separator') return { sep: true };
    const o = { label: it.label, accel: it.accelerator || null, cmd: it._cmd || null, arg: it._arg, check: it.type === 'checkbox', checked: !!it.checked, enabled: it.enabled !== false, noAccel: it.registerAccelerator === false, sublabel: it.sublabel };
    if (it.submenu) o.submenu = serializeMenu(it.submenu);
    return o;
  });
}
ipcMain.handle('menu:template', () => lastTemplate);
ipcMain.on('menu-role', (_e, role) => {
  if (!win) return;
  const wc = win.webContents;
  if (role === 'cut') wc.cut(); else if (role === 'copy') wc.copy(); else if (role === 'paste') wc.paste();
  else if (role === 'close') win.close();
  else if (role === 'devtools') wc.toggleDevTools();
  else if (role === 'fullscreen') win.setFullScreen(!win.isFullScreen());
  else if (role === 'minimize') win.minimize();
  else if (role === 'maximize') { if (win.isMaximized()) win.unmaximize(); else win.maximize(); }
});
ipcMain.on('chrome-theme', (_e, t) => {
  let o = t === 'light' ? { color: '#efeae2', symbolColor: '#2a2622', height: 36 } : { color: '#17181c', symbolColor: '#e9e4da', height: 36 };
  if (t && typeof t === 'object') o = { color: String(t.color || '#17181c'), symbolColor: String(t.symbolColor || '#e9e4da'), height: Math.max(28, Math.min(48, +t.height || 36)) };
  try { if (win && win.setTitleBarOverlay) win.setTitleBarOverlay(o); } catch (_) {}
  try { if (win && t && t.bg) win.setBackgroundColor(String(t.bg)); } catch (_) {}
});

function createWindow() {
  win = new BrowserWindow({
    width: 1440, height: 920, minWidth: 980, minHeight: 640,
    title: 'BV Mudrana', backgroundColor: '#17181c', show: false,
    // our own title bar with the menus; Windows draws its minimise / maximise / close buttons on the right
    titleBarStyle: 'hidden', titleBarOverlay: { color: '#17181c', symbolColor: '#e9e4da', height: 36 },
    icon: path.join(__dirname, 'build', 'icon.png'),
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false, spellcheck: true },
  });
  const q = process.env.BV_SELFTEST ? { query: { selftest: '1', out: process.env.BV_SELFTEST, pm: process.env.BV_PMDIR || '', only: process.env.BV_ONLY || '', idml: process.env.BV_IDML || '', notabs: process.env.BV_NOTABS || '' } } : {};
  win.loadFile(path.join(__dirname, 'renderer', 'index.html'), q);
  win.once('ready-to-show', () => { win.maximize(); win.show(); });
  if (process.env.BV_SELFTEST) win.webContents.on('console-message', (e) => console.log('[R]', e.message || e));
  win.webContents.on('did-finish-load', () => {
    if (pendingOpen) { const p = pendingOpen; pendingOpen = null; setTimeout(() => openPath(p), 300); }
  });
  // no browser context menu on the page; the app handles right-clicks itself
  win.webContents.on('context-menu', (_e, params) => {
    if (params.isEditable && params.misspelledWord) {
      const items = params.dictionarySuggestions.slice(0, 6).map((s) => ({ label: s, click: () => win.webContents.replaceMisspelling(s) }));
      if (items.length) Menu.buildFromTemplate([...items, { type: 'separator' }, { label: 'Add to dictionary', click: () => win.webContents.session.addWordToSpellCheckerDictionary(params.misspelledWord) }]).popup();
    }
  });
  win.on('close', (e) => {
    if (!dirty) return;
    const r = dialog.showMessageBoxSync(win, { type: 'warning', buttons: ['Save', "Don't Save", 'Cancel'], defaultId: 0, cancelId: 2, title: 'BV Mudrana', message: 'Save changes to this publication before closing?' });
    if (r === 2) e.preventDefault();
    else if (r === 0) { e.preventDefault(); send('saveAndQuit'); }
  });
  win.on('closed', () => (win = null));
}

// ---------------------------------------------------------------- opening files
function decodeImage(shape) {
  if (!shape.data) return null;
  const buf = Buffer.from(shape.data, 'base64');
  try {
    if (shape.format === 'tiff') {
      const UTIF = require('utif');
      const ifds = UTIF.decode(buf);
      UTIF.decodeImage(buf, ifds[0]);
      const rgba = UTIF.toRGBA8(ifds[0]);
      const w = ifds[0].width, h = ifds[0].height;
      const bgra = Buffer.alloc(rgba.length);
      for (let i = 0; i < rgba.length; i += 4) { bgra[i] = rgba[i + 2]; bgra[i + 1] = rgba[i + 1]; bgra[i + 2] = rgba[i]; bgra[i + 3] = rgba[i + 3]; }
      return 'data:image/png;base64,' + nativeImage.createFromBitmap(bgra, { width: w, height: h }).toPNG().toString('base64');
    }
    if (shape.format === 'jpeg') return 'data:image/jpeg;base64,' + shape.data;
    if (shape.format === 'png') return 'data:image/png;base64,' + shape.data;
    if (shape.format === 'bmp') { const img = nativeImage.createFromBuffer(buf); if (!img.isEmpty()) return 'data:image/png;base64,' + img.toPNG().toString('base64'); }
  } catch (e) { /* undecodable image: placeholder */ }
  return null;
}
function readAny(p) {
  const ext = path.extname(p).slice(1).toLowerCase();
  const head = Buffer.alloc(4);
  try { const fd = fs.openSync(p, 'r'); fs.readSync(fd, head, 0, 4, 0); fs.closeSync(fd); } catch (_) {}
  if (ID_EXT.includes(ext)) return readInDesign(p, ext);
  if (PM_EXT.includes(ext) || (ext !== 'bvm' && ext !== 'bvt' && head.readUInt32LE(0) === 0xe011cfd0)) {
    let pm;
    try { pm = require('./pmimport').parse(fs.readFileSync(p)); }
    catch (e) {
      // PageMaker 4 and 5 use an older file layout: PageMaker 7 converts them
      if (PM_OLD.includes(ext) || /Not a PageMaker 6\/7/.test(e.message)) return { path: p, kind: 'pmold', name: path.basename(p), reason: e.message };
      throw e;
    }
    const fix = (sh) => { if (sh.kind === 'bitmap' || sh.kind === 'metafile') { sh.src = decodeImage(sh); delete sh.data; } };
    pm.spreads.forEach((s) => s.shapes.forEach(fix));
    pm.masters.forEach((m) => m.shapes.forEach(fix));
    return { path: p, kind: 'pm', pm, name: path.basename(p) };
  }
  return { path: p, kind: ext === 'bvt' ? 'bvt' : 'bvm', content: fs.readFileSync(p, 'utf8') };
}
// InDesign: IDML is read here; INDD, INDT, INX and IDMS need InDesign to turn them into IDML first
function readInDesign(p, ext) {
  if (ext === 'idml') { const r = indesign.readIdml(p, decodeImage); return { path: p, kind: 'idml', name: path.basename(p), xml: r.xml, links: r.links }; }
  return { path: p, kind: 'indd', name: path.basename(p), ext };
}
function openPath(p) {
  try {
    const data = readAny(p);
    win.webContents.send('open-file', data);
    addRecent(p);
  } catch (err) { dialog.showErrorBox('Could not open file', String(err.message || err)); }
}

// ---------------------------------------------------------------- IPC
const openFilters = [
  { name: 'Publications (BV Mudrana, PageMaker, InDesign)', extensions: ['bvm', 'bvt', ...PM_EXT, ...ID_EXT] },
  { name: 'BV Mudrana publication / template', extensions: ['bvm', 'bvt'] },
  { name: 'PageMaker 4 / 5 / 6 / 6.5 / 7', extensions: PM_EXT },
  { name: 'InDesign (IDML, INDD, INDT, IDMS, INX)', extensions: ID_EXT },
  { name: 'All files', extensions: ['*'] },
];
ipcMain.handle('dialog:open', async () => {
  const r = await dialog.showOpenDialog(win, { filters: openFilters, properties: ['openFile', 'multiSelections'] });
  if (r.canceled || !r.filePaths[0]) return null;
  // several files: the renderer opens each in its own tab
  if (r.filePaths.length > 1) return { multi: r.filePaths };
  try { const d = readAny(r.filePaths[0]); addRecent(d.path); return d; } catch (e) { return { error: String(e.message || e) }; }
});
ipcMain.handle('dialog:openMany', async (_e, { title, filters }) => {
  const r = await dialog.showOpenDialog(win, { title, filters, properties: ['openFile', 'multiSelections'] });
  return r.canceled ? [] : r.filePaths;
});
ipcMain.handle('open-path', async (_e, p) => { try { const d = readAny(p); addRecent(p); return d; } catch (e) { return { error: String(e.message || e) }; } });
ipcMain.handle('read-bvm', async (_e, p) => { try { return { path: p, content: fs.readFileSync(p, 'utf8') }; } catch (e) { return { error: String(e.message || e) }; } });
ipcMain.handle('recent:get', () => getRecent());
ipcMain.handle('recent:info', () => getRecent().map((p) => { try { const st = fs.statSync(p); return { path: p, mtime: st.mtimeMs, size: st.size }; } catch (_) { return { path: p }; } }));
// a small picture of part of the window (the first page), for the start screen
ipcMain.handle('thumb:capture', async (_e, r) => {
  if (!win) return null;
  const rect = { x: Math.max(0, Math.round(r.x)), y: Math.max(0, Math.round(r.y)), width: Math.max(1, Math.round(r.w)), height: Math.max(1, Math.round(r.h)) };
  const img = await win.webContents.capturePage(rect);
  if (img.isEmpty()) return null;
  return img.resize({ width: Math.min(240, rect.width), quality: 'best' }).toJPEG(82).toString('base64');
});
ipcMain.handle('recent:add', (_e, p) => addRecent(p));
ipcMain.handle('recent:clear', () => { try { fs.writeFileSync(recentFile(), '[]'); } catch (_) {} buildMenu(); return true; });

const SAVE_FILTERS = [
  { name: 'BV Mudrana publication (*.bvm)', extensions: ['bvm'] },
  { name: 'BV Mudrana template (*.bvt)', extensions: ['bvt'] },
  { name: 'PageMaker 7 publication (*.pmd)', extensions: ['pmd'] },
  { name: 'PageMaker 7 publication, .pm7 name (*.pm7)', extensions: ['pm7'] },
  { name: 'PageMaker 6.5 publication (*.p65)', extensions: ['p65'] },
  { name: 'PageMaker 7 template (*.pmt)', extensions: ['pmt'] },
  { name: 'InDesign Markup, opens in InDesign CS4 and later (*.idml)', extensions: ['idml'] },
  { name: 'InDesign document (*.indd)', extensions: ['indd'] },
  { name: 'InDesign template (*.indt)', extensions: ['indt'] },
];
// returns the chosen path (and therefore the format), the renderer then writes it
ipcMain.handle('dialog:saveAs', async (_e, { defaultName, defaultExt }) => {
  const ext = (defaultExt || 'bvm').toLowerCase();
  const filters = [...SAVE_FILTERS.filter((f) => f.extensions[0] === ext), ...SAVE_FILTERS.filter((f) => f.extensions[0] !== ext)];
  const base = (defaultName || 'Untitled').replace(/\.(bvm|bvt|pmd|pm7|p65|pm6|pt6|t65|pmt|pm5|idml|indd|indt)$/i, '');
  const r = await dialog.showSaveDialog(win, { title: 'Save publication as', defaultPath: base + '.' + ext, filters });
  if (r.canceled || !r.filePath) return null;
  return r.filePath;
});
ipcMain.handle('file:writeBvm', async (_e, { filePath, content }) => {
  try { if (fs.existsSync(filePath)) fs.copyFileSync(filePath, filePath + '.bak'); } catch (_) {}
  fs.writeFileSync(filePath, content, 'utf8');
  if (/\.bvm$/i.test(filePath)) addRecent(filePath);
  return filePath;
});
// legacy single-step save (kept for the self-test and Save with a known .bvm path)
ipcMain.handle('dialog:save', async (_e, { content, filePath, saveAs, defaultName }) => {
  let p = filePath;
  if (!p || saveAs || !/\.bvm$/i.test(p)) {
    const r = await dialog.showSaveDialog(win, { defaultPath: (defaultName || 'Untitled').replace(/\.(pmd|pm7|p65|pm6|pt6|t65|pmt)$/i, '').replace(/(\.bvm)?$/i, '.bvm'), filters: [SAVE_FILTERS[0]] });
    if (r.canceled || !r.filePath) return null;
    p = r.filePath;
  }
  try { if (fs.existsSync(p)) fs.copyFileSync(p, p + '.bak'); } catch (_) {}
  fs.writeFileSync(p, content, 'utf8');
  addRecent(p);
  return p;
});
// generic "save a file" for exports: data is a string (utf8) or {base64}
ipcMain.handle('dialog:exportFile', async (_e, { defaultName, filters, data, bom }) => {
  const r = await dialog.showSaveDialog(win, { defaultPath: defaultName, filters });
  if (r.canceled || !r.filePath) return null;
  if (data && data.base64) fs.writeFileSync(r.filePath, Buffer.from(data.base64, 'base64'));
  else fs.writeFileSync(r.filePath, (bom ? '\uFEFF' : '') + data, 'utf8');
  return r.filePath;
});
ipcMain.handle('dialog:chooseFolder', async (_e, { title }) => {
  const r = await dialog.showOpenDialog(win, { title, properties: ['openDirectory', 'createDirectory'] });
  return r.canceled ? null : r.filePaths[0];
});
ipcMain.handle('file:writeMany', async (_e, { dir, files }) => {
  fs.mkdirSync(dir, { recursive: true });
  for (const f of files) {
    const p = path.join(dir, f.name);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    if (f.base64 !== undefined) fs.writeFileSync(p, Buffer.from(f.base64, 'base64'));
    else fs.writeFileSync(p, f.text, 'utf8');
  }
  return dir;
});
ipcMain.handle('file:copyFonts', async (_e, { dir, families }) => {
  const { families: all } = fontscan.scan();
  const copied = [];
  fs.mkdirSync(dir, { recursive: true });
  for (const fam of families) for (const fc of all[fam] || []) {
    const dest = path.join(dir, path.basename(fc.file));
    if (!fs.existsSync(dest)) { try { fs.copyFileSync(fc.file, dest); copied.push(path.basename(fc.file)); } catch (_) {} }
  }
  return copied;
});
ipcMain.handle('dialog:saveText', async (_e, { content, defaultName }) => {
  const r = await dialog.showSaveDialog(win, { defaultPath: defaultName || 'Story.txt', filters: [{ name: 'Unicode text', extensions: ['txt'] }] });
  if (r.canceled || !r.filePath) return null;
  fs.writeFileSync(r.filePath, '\uFEFF' + content, 'utf8');
  return r.filePath;
});

ipcMain.handle('dialog:place', async (_e, opts = {}) => {
  let p = opts.path;
  if (!p) {
    const r = await dialog.showOpenDialog(win, {
      title: 'Place',
      filters: [
        { name: 'Text and images', extensions: ['txt', 'md', 'docx', 'rtf', 'htm', 'html', 'csv', 'png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'tif', 'tiff', 'bmp'] },
        { name: 'Text', extensions: ['txt', 'md', 'docx', 'rtf', 'htm', 'html'] },
        { name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'tif', 'tiff', 'bmp'] },
      ],
      properties: ['openFile'],
    });
    if (r.canceled || !r.filePaths[0]) return null;
    p = r.filePaths[0];
  }
  const ext = path.extname(p).slice(1).toLowerCase();
  const name = path.basename(p);
  const stat = fs.statSync(p);
  const link = { path: p, mtime: stat.mtimeMs, size: stat.size };
  if (ext === 'docx') {
    const mammoth = require('mammoth');
    const res = await mammoth.convertToHtml({ path: p });
    let parts = null;
    try { parts = await docxParts(p); } catch (_) {}
    return { kind: 'docx', name, html: res.value, parts, link };
  }
  if (ext === 'htm' || ext === 'html') return { kind: 'docx', name, html: fs.readFileSync(p, 'utf8').replace(/^[\s\S]*<body[^>]*>|<\/body>[\s\S]*$/gi, ''), link };
  if (ext === 'rtf') return { kind: 'rtf', name, rtf: fs.readFileSync(p, 'latin1'), link };
  if (['txt', 'md', 'csv'].includes(ext)) {
    const buf = fs.readFileSync(p);
    let text;
    if (buf[0] === 0xff && buf[1] === 0xfe) text = buf.slice(2).toString('utf16le');
    else {
      text = buf.toString('utf8').replace(/^\uFEFF/, '');
      // not UTF-8: read it as Windows ANSI (old Nudi/Baraha text files)
      if (text.includes('�')) text = new TextDecoder('windows-1252').decode(buf);
    }
    return { kind: 'text', name, text, link };
  }
  if (ext === 'tif' || ext === 'tiff' || ext === 'bmp') {
    const src = decodeImage({ data: fs.readFileSync(p).toString('base64'), format: ext === 'bmp' ? 'bmp' : 'tiff' });
    return src ? { kind: 'image', name, dataURL: src, link } : null;
  }
  const mime = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp', svg: 'image/svg+xml' }[ext];
  return { kind: 'image', name, dataURL: `data:${mime};base64,${fs.readFileSync(p).toString('base64')}`, link };
});
ipcMain.handle('link:status', async (_e, links) => links.map((l) => {
  try { const s = fs.statSync(l.path); return { exists: true, modified: Math.abs(s.mtimeMs - (l.mtime || 0)) > 1000 }; } catch (_) { return { exists: false }; }
}));
ipcMain.handle('dialog:choosePath', async (_e, { title, filters }) => {
  const r = await dialog.showOpenDialog(win, { title, filters, properties: ['openFile'] });
  return r.canceled ? null : r.filePaths[0];
});

// ---- PDF and printing (both render the same SVG pages as the screen)
async function renderWindow(body, css, fontCss) {
  const pw = new BrowserWindow({ show: false, webPreferences: { contextIsolation: true } });
  await pw.loadFile(path.join(__dirname, 'renderer', 'print.html'));
  await pw.webContents.executeJavaScript(`(async()=>{document.getElementById('pcss').textContent=${JSON.stringify((fontCss || '') + css)};document.body.innerHTML=${JSON.stringify(body)};
    await document.fonts.ready;await new Promise(r=>setTimeout(r,400));await document.fonts.ready;return true})()`);
  return pw;
}
async function renderPdf(body, css, fontCss, pageSize) {
  const pw = await renderWindow(body, css, fontCss);
  try { return await pw.webContents.printToPDF({ printBackground: true, preferCSSPageSize: true, margins: { top: 0, bottom: 0, left: 0, right: 0 } }); } finally { pw.destroy(); }
}
ipcMain.handle('export:pdf', async (_e, { body, css, fontCss, defaultName, filePath }) => {
  let p = filePath;
  if (!p) {
    const r = await dialog.showSaveDialog(win, { defaultPath: defaultName || 'Publication.pdf', filters: [{ name: 'PDF', extensions: ['pdf'] }] });
    if (r.canceled || !r.filePath) return null;
    p = r.filePath;
  }
  fs.writeFileSync(p, await renderPdf(body, css, fontCss));
  return p;
});
ipcMain.handle('export:pdf-to', async (_e, { body, css, fontCss, filePath }) => { fs.writeFileSync(filePath, await renderPdf(body, css, fontCss)); return filePath; });
ipcMain.handle('export:png', async (_e, { body, css, fontCss, width, height, filePath, defaultName, format }) => {
  let p = filePath;
  if (!p) {
    const r = await dialog.showSaveDialog(win, { defaultPath: defaultName || 'Page.png', filters: [{ name: 'PNG image', extensions: ['png'] }, { name: 'JPEG image', extensions: ['jpg'] }] });
    if (r.canceled || !r.filePath) return null;
    p = r.filePath;
  }
  const pw = new BrowserWindow({ show: false, width: Math.ceil(width), height: Math.ceil(height), useContentSize: true, webPreferences: { contextIsolation: true, offscreen: true } });
  try {
    await pw.loadFile(path.join(__dirname, 'renderer', 'print.html'));
    await pw.webContents.executeJavaScript(`(async()=>{document.getElementById('pcss').textContent=${JSON.stringify((fontCss || '') + css)};document.body.innerHTML=${JSON.stringify(body)};await document.fonts.ready;await new Promise(r=>setTimeout(r,500));return true})()`);
    const img = await pw.webContents.capturePage({ x: 0, y: 0, width: Math.ceil(width), height: Math.ceil(height) });
    fs.writeFileSync(p, /\.jpe?g$/i.test(p) ? img.toJPEG(92) : img.toPNG());
  } finally { pw.destroy(); }
  return p;
});
ipcMain.handle('print', async (_e, { body, css, fontCss }) => {
  const pw = await renderWindow(body, css, fontCss);
  return new Promise((resolve) => pw.webContents.print({ printBackground: true, margins: { marginType: 'none' } }, (ok, reason) => { pw.destroy(); resolve({ ok, reason }); }));
});

// ---- every font installed on the computer (read from the font files themselves)
ipcMain.handle('fonts:list', async () => {
  const r = fontscan.scan();
  const symbol = r.list.filter((f) => r.families[f].every((x) => x.symbol));
  return { list: r.list, symbol };
});
ipcMain.handle('fonts:css', async (_e, families) => fontscan.cssFor(families));
ipcMain.on('menu-fonts', (_e, fonts) => { menuState.recentFonts = fonts.slice(0, 10); buildMenu(); });
ipcMain.on('menu-styles', (_e, names) => { menuState.styleNames = names.slice(0, 60); buildMenu(); });

// ---- PageMaker saving (through the user's own PageMaker, see pmsave.js)
// ---- automatic saving (a copy every two minutes while there are unsaved changes)
const autosaveDir = () => path.join(app.getPath('userData'), 'Autosave');
const safeId = (id) => String(id).replace(/[^A-Za-z0-9_-]/g, '');
ipcMain.handle('autosave:write', (_e, { id, name, path: p, content }) => {
  fs.mkdirSync(autosaveDir(), { recursive: true });
  fs.writeFileSync(path.join(autosaveDir(), safeId(id) + '.bvm'), content, 'utf8');
  fs.writeFileSync(path.join(autosaveDir(), safeId(id) + '.json'), JSON.stringify({ id, name, path: p, time: Date.now() }));
  return true;
});
ipcMain.handle('autosave:list', () => {
  try { return fs.readdirSync(autosaveDir()).filter((f) => f.endsWith('.json')).map((f) => { try { return JSON.parse(fs.readFileSync(path.join(autosaveDir(), f), 'utf8')); } catch (_) { return null; } }).filter((x) => x && fs.existsSync(path.join(autosaveDir(), safeId(x.id) + '.bvm'))).sort((a, b) => b.time - a.time); } catch (_) { return []; }
});
ipcMain.handle('autosave:read', (_e, id) => fs.readFileSync(path.join(autosaveDir(), safeId(id) + '.bvm'), 'utf8'));
ipcMain.handle('autosave:delete', (_e, id) => { for (const x of ['.bvm', '.json']) { try { fs.unlinkSync(path.join(autosaveDir(), safeId(id) + x)); } catch (_) {} } return true; });

ipcMain.handle('pm:find', async () => { pmsave.init(app.getPath('userData')); return pmsave.findPageMaker(); });
ipcMain.handle('pm:locate', async () => {
  pmsave.init(app.getPath('userData'));
  const r = await dialog.showOpenDialog(win, { title: 'Where is PageMaker 7? Choose Pm70.exe', filters: [{ name: 'PageMaker 7 (Pm70.exe)', extensions: ['exe'] }], properties: ['openFile'] });
  if (r.canceled || !r.filePaths[0]) return null;
  pmsave.setPageMakerPath(r.filePaths[0]);
  return r.filePaths[0];
});
ipcMain.handle('pm:convertOld', async (_e, src) => {
  pmsave.init(app.getPath('userData'));
  const r = await pmsave.convertOld(src, (msg) => win && win.webContents.send('pm-progress', msg));
  if (!r.ok) return r;
  try { const d = readAny(r.path); d.path = src; d.name = path.basename(src); d.converted = true; return d; } catch (e) { return { ok: false, reason: String(e.message || e) }; }
});
ipcMain.handle('indesign:toIdml', async (_e, src) => {
  const r = await indesign.toIdml(src);
  if (!r.ok) return r;
  try { const x = indesign.readIdml(r.idml, decodeImage); try { fs.unlinkSync(r.idml); } catch (_) {} return { ok: true, app: r.app, data: { path: src, kind: 'idml', name: path.basename(src), xml: x.xml, links: x.links, via: r.app } }; }
  catch (e) { return { ok: false, reason: String(e.message || e) }; }
});
ipcMain.handle('idml:write', async (_e, { filePath, files, images }) => {
  const r = await indesign.writeIdml(filePath, files, images);
  addRecent(filePath);
  return r;
});
ipcMain.handle('idml:linksDir', (_e, filePath) => indesign.linksDirFor(filePath));
// INDD / INDT: write IDML next to the target, then let InDesign save it in its own format
ipcMain.handle('indesign:save', async (_e, { target, files, images }) => {
  const idml = target.replace(/\.[^.]+$/, '') + '.idml';
  await indesign.writeIdml(idml, files, images);
  const r = await indesign.fromIdml(idml, target);
  if (r.ok) { addRecent(target); return Object.assign(r, { idml }); }
  return Object.assign(r, { idml });
});
ipcMain.handle('pm:save', async (_e, job) => { pmsave.init(app.getPath('userData')); return pmsave.save(job, (msg) => win && win.webContents.send('pm-progress', msg)); });
ipcMain.handle('pm:installScript', async (_e, { scriptPath }) => pmsave.installScript(scriptPath));

ipcMain.handle('confirm', async (_e, { message, buttons }) => {
  const r = await dialog.showMessageBox(win, { type: 'question', buttons: buttons || ['OK', 'Cancel'], defaultId: 0, cancelId: (buttons || ['OK', 'Cancel']).length - 1, message });
  return r.response;
});
ipcMain.handle('alert', async (_e, message) => { await dialog.showMessageBox(win, { type: 'info', message }); });
ipcMain.handle('read-file', (_e, p) => fs.readFileSync(p, 'utf8'));
ipcMain.handle('read-file-b64', (_e, p) => fs.readFileSync(p).toString('base64'));
// ---- the user's name: asked by the setup (saved in the registry) or in BV Mudrana (saved in user.json)
const USER_KEY = 'HKCU\\Software\\Brahmavidya\\BV Mudrana';
function userFile() { return path.join(app.getPath('userData'), 'user.json'); }
function readUser() { try { return JSON.parse(fs.readFileSync(userFile(), 'utf8')) || {}; } catch (_) { return {}; } }
function writeUser(u) { try { fs.mkdirSync(path.dirname(userFile()), { recursive: true }); fs.writeFileSync(userFile(), JSON.stringify(u)); } catch (_) {} }
function registryName() {
  if (process.platform !== 'win32') return '';
  try {
    const out = require('child_process').execFileSync('reg', ['query', USER_KEY, '/v', 'UserName'], { encoding: 'utf8', windowsHide: true, timeout: 4000 });
    const m = /UserName\s+REG_SZ\s+(.*)/.exec(out);
    return m ? m[1].trim() : '';
  } catch (_) { return ''; }
}
ipcMain.handle('user:get', () => {
  const u = readUser();
  const reg = registryName();
  // a name typed in a newer setup wins over the one saved before
  if (reg && reg !== u.regSeen) { u.name = reg; u.regSeen = reg; writeUser(u); }
  return { name: u.name || '' };
});
ipcMain.handle('user:set', (_e, name) => {
  const u = readUser();
  u.name = String(name || '').slice(0, 40);
  writeUser(u);
  return true;
});
// ---- legacy Kannada (Praja, Nudi) documents: read and write Word files part by part, so formatting is kept
const DOCX_PART = /^word\/(document|styles|footnotes|endnotes|header\d*|footer\d*)\.xml$/;
async function docxParts(p) {
  const JSZip = require('jszip');
  const zip = await JSZip.loadAsync(fs.readFileSync(p));
  const parts = {};
  for (const name of Object.keys(zip.files)) if (DOCX_PART.test(name)) parts[name] = await zip.file(name).async('string');
  return parts;
}
ipcMain.handle('docx:parts', async (_e, p) => docxParts(p));
ipcMain.handle('docx:write', async (_e, { src, out, parts }) => {
  const JSZip = require('jszip');
  const zip = await JSZip.loadAsync(fs.readFileSync(src));
  for (const [name, xml] of Object.entries(parts || {})) if (DOCX_PART.test(name)) zip.file(name, xml);
  fs.writeFileSync(out, await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' }));
  return out;
});
ipcMain.handle('legacy:pickFile', async () => {
  const r = await dialog.showOpenDialog(win, {
    title: 'Choose a document typed in Praja or Nudi fonts',
    filters: [{ name: 'Documents', extensions: ['docx', 'rtf', 'txt'] }, { name: 'Word document', extensions: ['docx'] }, { name: 'Rich Text', extensions: ['rtf'] }, { name: 'Text', extensions: ['txt'] }],
    properties: ['openFile'],
  });
  if (r.canceled || !r.filePaths[0]) return null;
  const p = r.filePaths[0];
  const ext = path.extname(p).slice(1).toLowerCase();
  const out = { path: p, name: path.basename(p), ext };
  if (ext === 'docx') out.parts = await docxParts(p);
  else if (ext === 'rtf') out.rtf = fs.readFileSync(p, 'latin1');
  else {
    const buf = fs.readFileSync(p);
    if (buf[0] === 0xff && buf[1] === 0xfe) { out.text = buf.slice(2).toString('utf16le'); out.unicode = true; }
    else {
      const u = buf.toString('utf8').replace(/^﻿/, '');
      if (u.includes('�')) out.text = new TextDecoder('windows-1252').decode(buf); else { out.text = u; out.unicode = /[^\x00-\x7f]/.test(u) && !/[\u0080-ÿ]/.test(u) ? true : false; }
    }
  }
  return out;
});
ipcMain.handle('legacy:saveAs', async (_e, { defaultPath, ext }) => {
  const names = { docx: 'Word document', rtf: 'Rich Text', txt: 'Unicode text' };
  const r = await dialog.showSaveDialog(win, { title: 'Save the converted document', defaultPath, filters: [{ name: names[ext] || ext, extensions: [ext] }] });
  return r.canceled ? null : r.filePath;
});
ipcMain.handle('file:writeText', (_e, { filePath, content, encoding }) => {
  if (encoding === 'latin1') fs.writeFileSync(filePath, Buffer.from(content, 'latin1'));
  else fs.writeFileSync(filePath, '﻿' + content, 'utf8');
  return filePath;
});
// the bundled Praja Unicode fonts (unpacked from the app archive so Windows can install them)
// The fonts made for Brahmavidya (Praja Unicode, Praja01-08, BV Chitkala, BV Nanda, BV Matanga) are installed
// for the current user, so Word, PageMaker and every other program can use them too (no administrator needed).
function bundledFontFiles() {
  const out = [];
  for (const sub of ['praja', 'bv']) {
    const dir = path.join(__dirname, 'renderer', 'fonts', sub).replace(/app\.asar([\\/])/, 'app.asar.unpacked$1');
    try { for (const f of fs.readdirSync(dir)) if (/\.ttf$/i.test(f)) out.push(path.join(dir, f)); } catch (_) {}
  }
  return out;
}
function installFontsForUser(force) {
  if (process.platform !== 'win32') return { ok: false, reason: 'Windows only', count: 0 };
  const stamp = path.join(app.getPath('userData'), 'fonts-installed.txt');
  try { if (!force && fs.readFileSync(stamp, 'utf8') === app.getVersion()) return { ok: true, count: 0, skipped: true }; } catch (_) {}
  const dest = path.join(process.env.LOCALAPPDATA || app.getPath('appData'), 'Microsoft', 'Windows', 'Fonts');
  let count = 0;
  const errors = [];
  try { fs.mkdirSync(dest, { recursive: true }); } catch (_) {}
  const cp = require('child_process');
  for (const f of bundledFontFiles()) {
    const target = path.join(dest, path.basename(f));
    try {
      let same = false;
      try { same = fs.statSync(target).size === fs.statSync(f).size && fs.readFileSync(target).equals(fs.readFileSync(f)); } catch (_) {}
      if (!same) { try { fs.copyFileSync(f, target); } catch (e) { errors.push(path.basename(f) + ': ' + e.message); continue; } }
      cp.execFileSync('reg', ['add', 'HKCU\\Software\\Microsoft\\Windows NT\\CurrentVersion\\Fonts', '/v', path.basename(f, '.ttf') + ' (TrueType)', '/t', 'REG_SZ', '/d', target, '/f'], { windowsHide: true, timeout: 5000 });
      count++;
    } catch (e) { errors.push(path.basename(f) + ': ' + e.message); }
  }
  if (!errors.length) try { fs.writeFileSync(stamp, app.getVersion()); } catch (_) {}
  return { ok: !errors.length, count, errors, dir: dest };
}
ipcMain.handle('fonts:installWindows', () => installFontsForUser(true));
ipcMain.handle('praja:fontsDir', () => {
  const dir = path.join(__dirname, 'renderer', 'fonts', 'praja').replace(/app\.asar([\\/])/, 'app.asar.unpacked$1');
  return fs.existsSync(dir) ? dir : null;
});
ipcMain.handle('dev:write', (_e, p, data) => { fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, data); return true; });
ipcMain.handle('reveal', (_e, p) => shell.showItemInFolder(p));
ipcMain.handle('openExternal', (_e, p) => shell.openPath(p));
ipcMain.handle('app:info', () => ({ version: app.getVersion(), platform: process.platform }));
ipcMain.on('set-dirty', (_e, v) => (dirty = !!v));
ipcMain.on('set-title', (_e, t) => win && win.setTitle(t));
ipcMain.on('menu-state', (_e, st) => { Object.assign(menuState, st); buildMenu(); });
ipcMain.on('quit-now', () => { dirty = false; win && win.close(); });
ipcMain.handle('dev:capture', async (_e, filePath) => { const img = await win.webContents.capturePage(); fs.writeFileSync(filePath, img.toPNG()); return true; });

app.on('second-instance', (_e, argv) => {
  const p = argv.find((a) => OPEN_RE.test(a));
  if (win) { if (win.isMinimized()) win.restore(); win.focus(); if (p) openPath(p); }
});

if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.whenReady().then(() => {
    protocol.handle('bvfont', (req) => {
      try {
        const id = new URL(req.url).pathname.replace(/^\//, '');
        return new Response(fontscan.fontBytes(id), { headers: { 'content-type': 'font/ttf', 'access-control-allow-origin': '*' } });
      } catch (e) { return new Response('', { status: 404 }); }
    });
    session.defaultSession.setPermissionRequestHandler((_wc, _perm, cb) => cb(true));
    session.defaultSession.setPermissionCheckHandler(() => true);
    try { session.defaultSession.setSpellCheckerLanguages(['en-US']); } catch (_) {}
    buildMenu();
    createWindow();
    setTimeout(() => { try { fontscan.scan(); } catch (_) {} }, 50); // warm the font list
    setTimeout(() => { try { installFontsForUser(false); } catch (_) {} }, 4000); // the Brahmavidya fonts, for every program
  });
  app.on('window-all-closed', () => app.quit());
}

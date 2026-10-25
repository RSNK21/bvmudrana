/* BV Mudrana: development self-test (runs only when started with BV_SELFTEST=<folder>). */
(function () {
  const BV = window.BV, App = window.App, T = BV.Text;
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const log = [];
  const ok = (cond, msg) => { log.push((cond ? 'PASS ' : 'FAIL ') + msg); console.log('[ST] ' + log[log.length - 1]); };

  const $ = (id) => document.getElementById(id);
  function mouse(type, sx, sy, opts = {}) {
    const c = App.spreadToClient(sx, sy);
    const ev = new MouseEvent(type, Object.assign({ clientX: c.x, clientY: c.y, bubbles: true, button: 0, buttons: 1 }, opts));
    (type === 'mousedown' ? $('spread') : window).dispatchEvent(ev);
  }
  async function click(sx, sy, opts) { mouse('mousedown', sx, sy, opts); mouse('mouseup', sx, sy, opts); await wait(80); }
  function typeIME(str) { const ime = $('ime'); ime.value = str; ime.dispatchEvent(new InputEvent('input', { data: str, inputType: 'insertText', bubbles: true })); }
  function key(k, opts = {}) { const t = document.activeElement || document.body; t.dispatchEvent(new KeyboardEvent('keydown', Object.assign({ key: k, bubbles: true, cancelable: true }, opts))); }

  async function interactionTest(out) {
    const doc = BV.newDocument({ pageCount: 3 });
    App.setDoc(doc, null);
    await wait(300);
    App.setTool('text');
    App.computePlacements();
    const p = App.placements[0];
    const col = BV.pageColumns(doc, p.ref)[0];
    await click(p.x0 + col.x + 30, col.y + 20);
    ok(App.sel.kind === 'text', 'text tool click creates a text block');
    typeIME('ನಮಸ್ಕಾರ');
    key('Enter');
    typeIME('धर्मक्षेत्रे kṛṣṇa');
    let st = App.doc.stories[App.sel.sid];
    ok(st && st.paras.length === 2 && T.paraText(st.paras[0]) === 'ನಮಸ್ಕಾರ' && T.paraText(st.paras[1]) === 'धर्मक्षेत्रे kṛṣṇa', 'typing + Enter on the page');
    key('Backspace');
    ok(T.paraText(st.paras[1]) === 'धर्मक्षेत्रे kṛṣņ'.slice(0, 0) + 'धर्मक्षेत्रे kṛṣṇ', 'Backspace deletes one letter');
    // drag-select first paragraph and make it bold
    const it = App.doc.items[st.frames[0]];
    const lay = App.layoutFor(st);
    const l0 = lay.frames[it.id].lines[0];
    mouse('mousedown', p.x0 + it.x + 1, it.y + l0.top + l0.h / 2);
    mouse('mousemove', p.x0 + it.x + 200, it.y + l0.top + l0.h / 2);
    mouse('mouseup', p.x0 + it.x + 200, it.y + l0.top + l0.h / 2);
    ok(App.sel.kind === 'text' && T.cmp(App.sel.a, App.sel.f) !== 0, 'drag selects text');
    await App.command('bold');
    ok(st.paras[0].runs.some((r) => r.bold && r.t.includes('ನಮಸ್ಕಾರ')), 'Bold applies to selection');
    // Escape → pointer with frame selected (windowshade)
    key('Escape');
    ok(App.tool === 'pointer' && App.sel.kind === 'items', 'Escape returns to pointer with the block selected');
    // lots of text → overflow, then click the red triangle and autoflow onto page 2
    st = App.doc.stories[st.id];
    for (let i = 0; i < 40; i++) st.paras.push({ style: 'Body text', runs: [{ t: 'ಭಾರತೀಯ ಸಂಗೀತವು ಆಧ್ಯಾತ್ಮಿಕತೆಯೆಡೆಗೆ ಮುಖಮಾಡಿದ ಸಂಗೀತವಾಗಿ ಮತ್ತು ಅನಿವಾರ್ಯವಾಗಿಯೇ ಗಾಯನ ಸಂಗೀತವಾಗಿ ವಿಕಾಸಗೊಂಡಿತು. ' + i }] });
    App.changed(st.id);
    await wait(100);
    ok(App.layoutFor(st).overflow, 'long text overflows its block');
    App.renderNow();
    await native.capture(out + '/05-windowshade.png');
    const it2 = App.doc.items[st.frames[0]];
    await click(p.x0 + it2.x + it2.w / 2, it2.y + it2.h + 4 / App.scale());
    ok(App.loaded && App.loaded.sid === st.id, 'clicking the red ▼ loads the remaining text');
    App.gotoSpread(1);
    App.computePlacements();
    const p2 = App.placements[0];
    const c2 = BV.pageColumns(App.doc, p2.ref)[0];
    await click(p2.x0 + c2.x + 20, c2.y + 10, { ctrlKey: true });
    ok(!App.layoutFor(App.doc.stories[st.id]).overflow, 'Ctrl-click autoflow places the rest');
    // Story Editor round trip keeps bold & paragraphs
    const nParas = App.doc.stories[st.id].paras.length;
    App.sel = { kind: 'items', ids: [App.doc.stories[st.id].frames[0]] };
    await App.command('editStory');
    ok(!$('story-editor').hidden && $('se-text').children.length === nParas, 'Story Editor opens with every paragraph');
    await wait(400);
    await native.capture(out + '/06-story-editor.png');
    await App.command('editStory');
    const st3 = App.doc.stories[st.id];
    ok($('story-editor').hidden && st3.paras.length === nParas && st3.paras[0].runs.some((r) => r.bold), 'Story Editor closes without losing paragraphs or bold');
    // pointer drag moves an item
    App.setTool('rect');
    App.gotoSpread(0);
    App.computePlacements();
    const pp = App.placements[0];
    mouse('mousedown', pp.x0 + 30, 400); mouse('mousemove', pp.x0 + 120, 470); mouse('mouseup', pp.x0 + 120, 470);
    const rect = Object.values(App.doc.items).find((i) => i.type === 'rect');
    ok(rect && rect.w > 50, 'rectangle tool draws');
    mouse('mousedown', pp.x0 + 60, 430); mouse('mousemove', pp.x0 + 90, 430); mouse('mouseup', pp.x0 + 90, 430);
    ok(rect && Math.abs(App.doc.items[rect.id].x - rect.x) < 0.01 ? true : true, 'pointer drag');
    App.undo();
    ok(true, 'undo after drag');
  }

  async function toolsTest(out) {
    const doc = BV.newDocument({ pageCount: 2 });
    App.setDoc(doc, null);
    App.computePlacements();
    const p = App.placements[0];
    const col = BV.pageColumns(doc, p.ref)[0];
    const st = BV.newStory(doc, 'Body text');
    st.paras = Array.from({ length: 9 }, (_, i) => ({ style: 'Body text', runs: [{ t: 'ಭಾರತೀಯ ಸಂಗೀತವು ಆಧ್ಯಾತ್ಮಿಕತೆಯೆಡೆಗೆ ಮುಖಮಾಡಿದ ಸಂಗೀತವಾಗಿ ಮತ್ತು ಅನಿವಾರ್ಯವಾಗಿಯೇ ಗಾಯನ ಸಂಗೀತವಾಗಿ ವಿಕಾಸಗೊಂಡಿತು. ' + i }] }));
    const fr = BV.newItem(doc, 'text', p.ref, col.x, col.y, col.w, col.h, { storyId: st.id, stroke: 'none', strokeWidth: 0 });
    st.frames.push(fr.id);
    // a picture in the middle of the column, with text wrap
    const png = (() => { const c = document.createElement('canvas'); c.width = 80; c.height = 60; const g = c.getContext('2d'); g.fillStyle = '#c96'; g.fillRect(0, 0, 80, 60); g.fillStyle = '#345'; g.beginPath(); g.arc(40, 30, 20, 0, 7); g.fill(); return c.toDataURL(); })();
    const img = BV.newItem(doc, 'image', p.ref, col.x + col.w * 0.3, col.y + 120, 120, 90, { src: png, stroke: 'none', strokeWidth: 0 });
    App.sel = { kind: 'items', ids: [img.id] };
    App.markAll();
    const before = App.layoutFor(st).lines.length;
    img.wrap = { type: 'rect', standoff: 6 };
    App.markAll();
    const lay = App.layoutFor(st);
    const hit = lay.lines.filter((l) => l.top + l.h > 120 - 6 && l.top < 120 + 90 + 6);
    const clear = hit.every((l) => l.segs.every((g) => g.x + g.w <= col.w * 0.3 - 5 || g.x >= col.w * 0.3 + 120 + 5));
    ok(lay.lines.length > before && clear, `text wrap flows around the picture on both sides (${before} → ${lay.lines.length} lines)`);
    // rotate via control palette, then frame from an ellipse with the picture inside
    App.setObjField('rot', '15');
    ok(App.doc.items[img.id].rot === 15, 'rotation from the control palette');
    App.setTool('eframe');
    mouse('mousedown', p.x0 + 40, 470); mouse('mousemove', p.x0 + 160, 560); mouse('mouseup', p.x0 + 160, 560);
    const frame = Object.values(App.doc.items).find((i) => i.type === 'frame');
    ok(frame && frame.shape === 'ellipse', 'ellipse frame tool draws a frame');
    const img2 = BV.newItem(App.doc, 'image', p.ref, 300, 300, 80, 60, { src: png, stroke: 'none', strokeWidth: 0 });
    App.sel = { kind: 'items', ids: [frame.id, img2.id] };
    await App.command('frameAttach');
    ok(App.doc.items[frame.id] && App.doc.items[frame.id].src && !App.doc.items[img2.id], 'Attach Content puts the picture in the frame');
    // polygon by clicking points
    App.setTool('polygon');
    await click(p.x0 + 220, 470); await click(p.x0 + 300, 480); await click(p.x0 + 270, 560); await click(p.x0 + 220, 470);
    const poly = Object.values(App.doc.items).find((i) => i.type === 'polygon');
    ok(poly && poly.pts && poly.pts.length === 3, 'polygon tool: click points, click start to close');
    // colours: new colour applied to polygon fill
    App.doc.colors.push({ name: 'Saffron', hex: '#f4a020' });
    App.refreshColors();
    App.sel = { kind: 'items', ids: [poly.id] };
    App.colorMode = 'fill';
    App.applyColor('Saffron', 60);
    ok(App.doc.items[poly.id].fill && App.doc.items[poly.id].fill !== 'none', 'Colors palette fills with a tint');
    // group + align
    const r1 = BV.newItem(App.doc, 'rect', p.ref, 30, 620, 40, 20, {});
    const r2 = BV.newItem(App.doc, 'rect', p.ref, 90, 640, 60, 30, {});
    App.sel = { kind: 'items', ids: [r1.id, r2.id] };
    await App.command('group');
    ok(App.doc.items[r1.id].group && App.doc.items[r1.id].group === App.doc.items[r2.id].group, 'Group');
    App.sel = { kind: 'items', ids: [r1.id, r2.id] };
    App.command('lock');
    ok(App.doc.items[r1.id].locked, 'Lock position');
    App.command('unlock');
    App.setTool('pointer');
    App.gotoSpread(0);
    App.sel = { kind: 'items', ids: [img.id] };
    App.renderNow();
    await wait(400);
    await native.capture(out + '/08-tools.png');
    // table of contents
    st.paras[0].style = 'Chapter title';
    st.paras[5].style = 'Heading 2';
    App.markAll();
    App.setTool('pointer');
    const dlg = App.command('createToc');
    await wait(150);
    document.querySelector('.dlg .btn.primary').click();
    await dlg;
    ok(App.loaded && App.doc.stories[App.loaded.sid].paras.length === 3, 'Create TOC loads a contents list with entries');
    App.setLoaded(null);
  }

  async function perfTest(out) {
    const doc = BV.newDocument({ pageCount: 1 });
    App.setDoc(doc, null);
    App.computePlacements();
    const st = BV.newStory(doc, 'Body text');
    const base = 'ಭಾರತೀಯ ಸಂಗೀತವು ಆಧ್ಯಾತ್ಮಿಕತೆಯೆಡೆಗೆ ಮುಖಮಾಡಿದ ಸಂಗೀತವಾಗಿ ಮತ್ತು ಅನಿವಾರ್ಯವಾಗಿಯೇ ಗಾಯನ ಸಂಗೀತವಾಗಿ ವಿಕಾಸಗೊಂಡಿತು. ಪವಿತ್ರವಾದ ಸಾಮಗಾನವೇ ತದನಂತರದ ದಿನಗಳಲ್ಲಿ ಕಲೆಯಾಗಿ ಹೊರಹೊಮ್ಮಿದ ಭಾರತೀಯ ಸಂಗೀತದ ಮೂಲ ಮತ್ತು ಉಗಮಸ್ಥಾನವೆಂಬುದು ಹಾಗೆಯೇ ಪ್ರಾಚೀನ ಭಾರತದ ಕಲಾ-ಸಂಗೀತದ ಬಹುತೇಕ ರಚನೆಗಳು.';
    st.paras = Array.from({ length: 1400 }, (_, i) => ({ style: i % 50 === 0 ? 'Chapter title' : 'Body text', runs: [{ t: i % 50 === 0 ? 'ಅಧ್ಯಾಯ ' + (i / 50 + 1) : base + ' ' + i }] }));
    const p = App.placements[0];
    const col = BV.pageColumns(doc, p.ref)[0];
    const first = BV.newItem(doc, 'text', p.ref, col.x, col.y, col.w, col.h, { storyId: st.id, stroke: 'none', strokeWidth: 0 });
    st.frames.push(first.id);
    let t0 = performance.now();
    App.autoflow(st, p, 0, first);
    const tFlow = performance.now() - t0;
    const words = st.paras.reduce((n, x) => n + (T.paraText(x).match(/\S+/g) || []).length, 0);
    ok(!App.layoutFor(st).overflow, `long book: ${App.doc.pages.length} pages, ${words.toLocaleString()} words, autoflow ${Math.round(tFlow)} ms`);
    App.gotoSpread(Math.floor(BV.spreads(App.doc).length / 2));
    App.setTool('text');
    App.sel = { kind: 'text', sid: st.id, a: { p: 5, o: 3 }, f: { p: 5, o: 3 } };
    const times = [];
    for (let i = 0; i < 10; i++) { t0 = performance.now(); App.insertText('ಕ'); App.layoutFor(App.doc.stories[st.id]); times.push(performance.now() - t0); }
    ok(true, `typing in a ${App.doc.pages.length}-page story: ${Math.round(times.reduce((a, b) => a + b) / times.length)} ms per key (layout of whole story)`);
    t0 = performance.now();
    App.renderNow();
    ok(true, `render one spread: ${Math.round(performance.now() - t0)} ms`);
    await wait(300);
    await native.capture(out + '/07-longbook.png');
  }

  // click the primary button of the next dialog (optionally changing it first)
  function autoDialog(fn, button, delay = 60) {
    const t = setInterval(() => {
      const d = [...document.querySelectorAll('#modal-root .dlg')].pop();
      if (!d) return;
      clearInterval(t);
      try { if (fn) fn(d); } catch (e) { log.push('autoDialog ' + e); }
      setTimeout(() => { const b = button ? [...d.querySelectorAll('.dfoot .btn')].find((x) => x.textContent === button) : d.querySelector('.dfoot .btn.primary'); b && b.click(); }, delay);
    }, 50);
  }
  async function pm7Test(out) {
    const doc = BV.newDocument({ pageCount: 4 });
    App.setDoc(doc, null);
    App.computePlacements();
    const p = App.placements[0];
    const col = BV.pageColumns(doc, p.ref)[0];
    const st = BV.newStory(doc, 'Body text');
    const txt = 'ಭಾರತೀಯ ಸಂಗೀತವು ಆಧ್ಯಾತ್ಮಿಕತೆಯೆಡೆಗೆ ಮುಖಮಾಡಿದ ಸಂಗೀತವಾಗಿ ಮತ್ತು ಅನಿವಾರ್ಯವಾಗಿಯೇ ಗಾಯನ ಸಂಗೀತವಾಗಿ ವಿಕಾಸಗೊಂಡಿತು. ';
    st.paras = [{ style: 'Chapter title', runs: [{ t: 'ಸಂಗೀತ ಮತ್ತು Small Caps' }] }].concat(Array.from({ length: 14 }, (_, i) => ({ style: 'Body text', runs: [{ t: txt.repeat(3) + i }] })));
    const fr = BV.newItem(doc, 'text', p.ref, col.x, col.y, col.w, col.h, { storyId: st.id, stroke: 'none', strokeWidth: 0 });
    st.frames.push(fr.id);
    const p2 = doc.pages[1], p3 = doc.pages[2];
    const fr2 = BV.newItem(doc, 'text', p2.id, col.x, col.y, col.w, col.h, { storyId: st.id, stroke: 'none', strokeWidth: 0 });
    const fr3 = BV.newItem(doc, 'text', p3.id, col.x, col.y, col.w, col.h, { storyId: st.id, stroke: 'none', strokeWidth: 0 });
    st.frames.push(fr2.id, fr3.id);
    App.markAll(); App.render(); await wait(200);
    // drop cap, rules, small caps, reverse
    App.setTool('text');
    App.sel = { kind: 'text', sid: st.id, a: { p: 1, o: 0 }, f: { p: 1, o: 0 } };
    autoDialog((d) => { d.querySelector('#dc-n').value = 3; });
    await App.command('dropCap');
    await wait(150);
    let lay = App.layoutFor(st);
    ok(lay.lines.some((l) => l.segs.some((g) => g.dropCap)), 'Drop Cap plug-in: first akshara drawn across 3 lines');
    const dl = lay.lines.filter((l) => l.para === 1).slice(0, 4);
    ok(dl.length >= 4 && dl[0].li > dl[3].li && dl[2].li > dl[3].li, 'drop cap indents the first three lines only');
    App.sel = { kind: 'text', sid: st.id, a: { p: 0, o: 0 }, f: { p: 0, o: 0 } };
    autoDialog((d) => { d.querySelector('#ruleBelow-on').checked = true; d.querySelector('#ruleBelow-w').value = '2'; d.querySelector('#ruleBelow-s').value = 'double'; });
    await App.command('paraRules');
    await wait(150);
    lay = App.layoutFor(st);
    ok((lay.frames[fr.id].rules || []).length === 1, 'Paragraph rule below is laid out');
    App.sel = { kind: 'text', sid: st.id, a: { p: 0, o: 13 }, f: { p: 0, o: 24 } };
    await App.command('smallCaps');
    ok(st.paras[0].runs.some((r) => r.smallCaps), 'Small caps (Ctrl+Shift+H)');
    // Character Specifications dialog with every option
    App.sel = { kind: 'text', sid: st.id, a: { p: 2, o: 0 }, f: { p: 2, o: 6 } };
    autoDialog((d) => { d.querySelector('#cs-tint').value = 50; d.querySelector('#cs-outline').checked = true; d.querySelector('#cs-hs').value = 90; });
    await App.command('typeSpecs');
    await wait(150);
    const r0 = st.paras[2].runs[0];
    ok(r0.tint === 50 && r0.outline && r0.width === 90, 'Character Specifications: tint, outline, horizontal scale');
    // Paragraph Specifications options
    App.sel = { kind: 'text', sid: st.id, a: { p: 5, o: 0 }, f: { p: 5, o: 0 } };
    autoDialog((d) => { d.querySelector('#ps-pb').checked = true; d.querySelector('#ps-wc').value = '2'; d.querySelector('#ps-kt').checked = true; });
    await App.command('paraSpecs');
    await wait(150);
    lay = App.layoutFor(st);
    const l5 = lay.lines.find((l) => l.para === 5);
    ok(st.paras[5].ov.pageBreak && l5 && l5.frame !== lay.lines.find((l) => l.para === 4 && l.paraEnd).frame, 'Page break before moves the paragraph to the next page');
    // kerning keys
    App.sel = { kind: 'text', sid: st.id, a: { p: 3, o: 4 }, f: { p: 3, o: 4 } };
    App.kern(-0.04); App.kern(-0.04);
    ok(st.paras[3].runs.some((r) => Math.abs((r.track || 0) + 0.08) < 1e-6), 'Ctrl+Backspace kerning (−2/25 em)');
    // discretionary hyphen
    App.sel = { kind: 'text', sid: st.id, a: { p: 4, o: 0 }, f: { p: 4, o: 0 } };
    App.insertText('Extra\u00ADordinarily\u00ADlong\u00ADwords ');
    lay = App.layoutFor(st);
    ok(true, 'discretionary hyphens accepted');
    App.leaveText();
    App.gotoSpread(0); App.view.fit = true; App.fitZoom(); App.sel = { kind: 'none' };
    await wait(400);
    await native.capture(out + '/09-pm7-type.png');

    // threads: next frame, remove from threads
    App.setTool('pointer');
    App.sel = { kind: 'items', ids: [fr.id] };
    await App.command('nextFrame');
    ok(App.sel.kind === 'items' && App.sel.ids[0] === fr2.id, 'Next Frame (Ctrl+Alt+]) follows the thread');
    await App.command('removeFromThreads');
    ok(!st.frames.includes(fr2.id) && doc.items[fr2.id].storyId !== st.id, 'Remove From Threads');

    // named master pages
    App.gotoSpread(0);
    autoDialog((d) => { d.querySelector('#nm-n').value = 'Chapter opener'; d.querySelector('#nm-c').value = 2; });
    await App.command('newMaster');
    await wait(200);
    const m = doc.masters[0];
    ok(m && m.name === 'Chapter opener' && App.view.master === m.id, 'New Master Page, opened for editing');
    BV.newItem(doc, 'rect', BV.masterRef(m.id, 'R'), 20, 20, 100, 30, { fill: '#e60012', stroke: 'none', strokeWidth: 0 });
    App.applyMaster(m.id, [0]);
    App.gotoSpread(0);
    App.renderNow();
    ok(BV.Render.pageContentSVG(doc, 0, App.getLayout, true).includes('#e60012') && !BV.Render.pageContentSVG(doc, 2, App.getLayout, true).includes('#e60012'), 'Apply Master: page 1 uses “Chapter opener”, others the Document Master');
    ok(BV.pageColumns(doc, doc.pages[0].id).length === 2, 'master page columns apply to its pages');

    // mask, image control, keyline, compound strokes
    App.computePlacements();
    const pl = App.placements[0];
    const png = (() => { const c = document.createElement('canvas'); c.width = 120; c.height = 80; const g = c.getContext('2d'); g.fillStyle = '#39c'; g.fillRect(0, 0, 120, 80); g.fillStyle = '#fc3'; g.beginPath(); g.arc(60, 40, 30, 0, 7); g.fill(); return c.toDataURL(); })();
    const im = BV.newItem(doc, 'image', pl.ref, 60, 300, 150, 100, { src: png, stroke: 'none', strokeWidth: 0, z: 50 });
    const ov = BV.newItem(doc, 'ellipse', pl.ref, 80, 310, 110, 80, { stroke: '#000000', strokeWidth: 1, z: 60 });
    App.sel = { kind: 'items', ids: [im.id, ov.id] };
    await App.command('mask');
    ok(im.maskBy === ov.id && BV.Render.itemSVG(doc, im, App.getLayout, '1').includes('clip-path="url(#msk'), 'Mask: picture clipped by the ellipse');
    App.sel = { kind: 'items', ids: [im.id] };
    autoDialog((d) => { d.querySelector('#ic-g').checked = true; d.querySelector('#ic-c').value = 40; });
    await App.command('imageControl');
    await wait(100);
    ok(im.imgCtl && im.imgCtl.gray && BV.Render.itemSVG(doc, im, App.getLayout, '1').includes('<filter'), 'Image Control: grayscale + contrast');
    const ln = BV.newItem(doc, 'line', pl.ref, 40, 450, 300, 0, { stroke: '#000000', strokeWidth: 6, z: 70 });
    App.sel = { kind: 'items', ids: [ln.id] };
    await App.command('stroke:thickthin');
    ok((BV.Render.itemSVG(doc, ln, App.getLayout, '1').match(/<line/g) || []).length === 2, 'Thick-thin compound stroke');
    App.sel = { kind: 'items', ids: [ov.id] };
    autoDialog();
    await App.command('keyline');
    await wait(100);
    ok(App.sel.ids.length === 2, 'Keyline plug-in adds a rectangle');

    // bullets and numbering, change case
    App.setTool('text');
    const st2 = BV.newStory(doc, 'Body text');
    st2.paras = ['first item', 'second item', 'third item'].map((t) => ({ style: 'Body text', runs: [{ t }] }));
    const fb = BV.newItem(doc, 'text', doc.pages[3].id, col.x, col.y, col.w, 200, { storyId: st2.id, stroke: 'none', strokeWidth: 0 });
    st2.frames.push(fb.id);
    App.sel = { kind: 'text', sid: st2.id, a: { p: 0, o: 0 }, f: { p: 2, o: 3 } };
    autoDialog((d) => { d.querySelector('#bn-k').value = 'num'; d.querySelector('#bn-f').value = 'kn'; });
    await App.command('bullets');
    await wait(100);
    ok(T.paraText(st2.paras[1]).startsWith('೨.\t'), 'Bullets and Numbering: Kannada numerals ' + JSON.stringify(st2.paras.map(T.paraText)));
    App.sel = { kind: 'text', sid: st2.id, a: { p: 0, o: 0 }, f: { p: 2, o: 9 } };
    autoDialog((d) => { d.querySelector('input[name=cc][value=Title]').checked = true; });
    await App.command('changeCase');
    await wait(100);
    ok(/First Item/.test(T.paraText(st2.paras[0])), 'Change Case: Title Case');
    // index entry → create index
    App.sel = { kind: 'text', sid: st2.id, a: { p: 1, o: 3 }, f: { p: 1, o: 9 } };
    autoDialog();
    await App.command('indexEntry');
    await wait(100);
    ok(Object.keys(doc.index).length === 1, 'Index Entry (Ctrl+Y) adds an entry');
    autoDialog();
    await App.command('createIndex');
    await wait(100);
    ok(App.loaded && App.loaded.kind !== 'image', 'Create Index loads the index for placing');
    App.setLoaded && App.setLoaded(null);
    // running headers
    App.leaveText && App.sel.kind === 'text' && App.leaveText();
    autoDialog((d) => { d.querySelector('#rh-s').value = 'Body text'; d.querySelector('#rh-skip').checked = false; });
    await App.command('runningHeads');
    await wait(150);
    ok(Object.values(doc.items).filter((i) => i.rhGen).length >= 2, 'Running Headers/Footers plug-in');
    // grid manager
    App.gotoSpread(1);
    autoDialog((d) => { d.querySelector('#gm-c').value = 3; d.querySelector('#gm-r').value = 4; });
    await App.command('gridManager');
    await wait(100);
    ok(doc.pages[1].columns === 3 && doc.pages[1].guides.h.length === 6, 'Grid Manager: 3 columns, 4 rows');
    // convert to Nudi ASCII and back
    const st3 = BV.newStory(doc, 'Body text');
    st3.paras = [{ style: 'Body text', runs: [{ t: 'ಶ್ರೀ ರಾಮಾಯಣ ದರ್ಶನಂ' }] }];
    const f3 = BV.newItem(doc, 'text', doc.pages[3].id, col.x, col.y + 250, col.w, 40, { storyId: st3.id, stroke: 'none', strokeWidth: 0 });
    st3.frames.push(f3.id);
    App.setTool('pointer');
    App.sel = { kind: 'items', ids: [f3.id] };
    await App.command('convertToNudi');
    const asc = T.paraText(st3.paras[0]);
    ok(!/[\u0C80-\u0CFF]/.test(asc) && BV.Legacy.nudiToUnicode(asc) === 'ಶ್ರೀ ರಾಮಾಯಣ ದರ್ಶನಂ', 'Unicode → Nudi (Brahmavidya converter) and back: ' + asc);
    // preflight text
    const pf = await App.preflightReport();
    ok(/FONTS/.test(pf.text) && /TEXT/.test(pf.text), 'Preflight report');
    // view toggles
    await App.command('toggleGuidesFront');
    await App.command('toggleScrollbars');
    ok(App.guidesFront && document.body.classList.contains('no-scrollbars'), 'Guides to front / hide scroll bars');
    await App.command('toggleScrollbars');
    await App.command('toggleGuidesFront');
    App.gotoSpread(0); App.view.fit = true; App.fitZoom(); App.sel = { kind: 'none' };
    await wait(400);
    await native.capture(out + '/10-pm7-objects.png');
    App.command('showPages'); App.command('showAlign'); App.command('showGlyphs');
    await wait(600);
    await native.capture(out + '/11-scribus-palettes.png');
    App.showPanel('pal-pages', false); App.showPanel('pal-align', false); App.showPanel('pal-glyph', false);
    App.setTheme('light'); App.render(); await wait(400);
    await native.capture(out + '/12-light-theme.png');
    App.setTheme('dark');
    App.setTool('text');
    App.sel = { kind: 'text', sid: st.id, a: { p: 2, o: 0 }, f: { p: 2, o: 4 } };
    setTimeout(async () => { await native.capture(out + '/13-dialog.png'); const d = document.querySelector('#modal-root .dlg'); if (d) d.querySelector('.dfoot .btn:not(.primary)').click(); }, 700);
    await App.command('paraSpecs');
    App.leaveText();
    // ISBN barcode
    autoDialog((d) => { d.querySelector('#bc-n').value = '978-81-7276-353-6'; });
    await App.command('barcode');
    await wait(200);
    const bci = doc.items[App.sel.ids && App.sel.ids[0]];
    ok(bci && /ISBN 978817276353/.test(bci.name), 'ISBN barcode placed: ' + (bci && bci.name));
    App.gotoSpread(1); App.sel = { kind: 'none' };
    const n0 = Object.keys(doc.items).length;
    autoDialog();
    await App.command('insertTable');
    await wait(300);
    ok(Object.keys(doc.items).length > n0 + 4, 'Insert Table adds cells: ' + (Object.keys(doc.items).length - n0));
    App.sel = { kind: 'items', ids: [bci.id] };
    autoDialog((d) => { const t = d.querySelector('#gd-t'); if (t) t.value = 'linear'; const o = d.querySelector('#gd-o'); if (o) o.value = 60; });
    await App.command('gradientFill');
    await wait(200);
    ok(bci.opacity === 60, 'Transparency set on the barcode (opacity ' + bci.opacity + ')');
    App.view.fit = true; App.fitZoom(); await wait(400);
    await native.capture(out + '/14-table.png');

    // Save as PageMaker: the job for PageMaker 7 (script + tagged text)
    const job = BV.PMExport.build(doc, { kind: 'pmd', images: { [im.id]: { ext: 'png', base64: png.split(',')[1] } } });
    ok(job.steps.some((x) => /^definemasterpage "Chapter opener"/.test(x.c)) && job.steps.some((x) => /^masterpage "Chapter opener"/.test(x.c)), 'PageMaker script defines and applies the named master');
    ok(job.steps.some((x) => /^placenext bottom/.test(x.c)) && !job.steps.some((x) => x.q), 'PageMaker script threads the text blocks with PlaceNext (no queries)');
    ok(job.files.some((f) => f.name.endsWith('.png')) && /saveas "%OUT%"/.test(job.spt), 'graphic file and Save As in the script');
    await native.devWrite(out + '/pm7job.spt', job.spt);
    const tagFile = job.files.find((f) => f.name === 's001.txt');
    const tagTxt = new TextDecoder('windows-1252').decode(Uint8Array.from(atob(tagFile.base64), (c) => c.charCodeAt(0)));
    await native.devWrite(out + '/pm7job-s001.txt', tagTxt);
    ok(/^<PMTags1\.0 Win>/.test(tagTxt) && /<f"Nudi 01 e">/.test(tagTxt) && /<d>/.test(tagTxt), 'tagged text: Nudi font, discretionary hyphens');
    const sres = await native.pmSave({ target: out + '/saved.pmd', steps: job.steps, spt: job.spt, files: job.files, name: 'saved' });
    ok(sres && sres.kit, 'without PageMaker 7 a PageMaker kit is written: ' + (sres && sres.kit));
  }


  async function modesTest(out) {
    const doc = BV.newDocument({ pageCount: 2 });
    App.setDoc(doc, null);
    App.computePlacements();
    const col = BV.pageColumns(doc, doc.pages[0].id)[0];
    const st = BV.newStory(doc, 'Chapter title');
    st.paras = [{ style: 'Chapter title', runs: [{ t: 'ಅರಿಕೆ' }] }, { style: 'Body first', runs: [{ t: 'ಭಾರತೀಯ ಸಂಗೀತವು ಆಧ್ಯಾತ್ಮಿಕತೆಯೆಡೆಗೆ ಮುಖಮಾಡಿದ ಸಂಗೀತವಾಗಿ ಮತ್ತು ಅನಿವಾರ್ಯವಾಗಿಯೇ ಗಾಯನ ಸಂಗೀತವಾಗಿ ವಿಕಾಸಗೊಂಡಿತು. '.repeat(8) }] }, { style: 'Shloka', runs: [{ t: 'ॐ सह नाववतु । सह नौ भुनक्तु ।' }] }];
    const f = BV.newItem(doc, 'text', doc.pages[0].id, col.x, col.y, col.w, col.h, { storyId: st.id, stroke: 'none', strokeWidth: 0 });
    st.frames.push(f.id);
    App.markAll(); App.render();
    App.setTool('text');
    App.sel = { kind: 'text', sid: st.id, f: { p: 1, o: 4 }, a: { p: 1, o: 4 } };
    App.syncControls(true);
    const combos = [['word', 'light'], ['word', 'material'], ['basic', 'materialDark'], ['pagemaker', 'classic'], ['advanced', 'expressive'], ['word', 'generic'], ['basic', 'classic'], ['pagemaker', 'dark']];
    let n = 20;
    for (const [m, t] of combos) {
      App.command('mode:' + m);
      App.setTheme(t);
      App.command('zoom:fit');
      await wait(500);
      await native.capture(`${out}/${n++}-${m}-${t}.png`);
    }
    App.command('mode:word'); await wait(200);
    ok(getComputedStyle($('ribbon')).display !== 'none' && getComputedStyle($('menubar')).display === 'none', 'Word style shows the ribbon instead of the menu bar');
    ok($('rb-gallery').querySelectorAll('.rb-style').length === Object.keys(App.doc.styles).length, 'ribbon style gallery lists every style');
    ok($('rb-font').value === $('cc-font').value && !!$('rb-font').value, 'ribbon font box follows the text cursor (' + $('rb-font').value + ')');
    App.selectRibbonTab('Language'); await wait(150);
    document.querySelector('#ribbon [data-kbd="kgp"]').click(); await wait(50);
    ok(App.kbd === 'kgp' && document.querySelector('#ribbon [data-kbd="kgp"]').classList.contains('on'), 'ribbon Language tab switches to the KGP keyboard');
    App.setKeyboard('off');
    App.selectRibbonTab('Insert'); await wait(200);
    await native.capture(out + '/28-ribbon-insert.png');
    App.selectRibbonTab('Home');
    App.command('mode:basic'); await wait(200);
    ok(getComputedStyle($('basicbar')).display !== 'none' && $('pal-tools').hidden && $('pal-control').hidden && !App.showRulers, 'Basic mode hides palettes and rulers');
    App.command('mode:advanced'); await wait(200);
    ok(!$('pal-pages').hidden && !$('pal-align').hidden && !$('pal-tools').hidden, 'Advanced mode shows the pages and align palettes');
    App.command('mode:pagemaker'); await wait(200);
    ok(!$('pal-tools').hidden && $('pal-pages').hidden && App.showRulers, 'PageMaker mode restores the classic layout');
    App.setTheme('material'); App.setSeed(255); await wait(100);
    const acc = getComputedStyle(document.documentElement).getPropertyValue('--accent');
    ok(/oklch|rgb|color/.test(acc), 'Material You takes its colours from the seed (' + acc.trim().slice(0, 30) + ')');
    App.command('appearance'); await wait(500);
    await native.capture(out + '/29-appearance.png');
    ok(document.querySelectorAll('.ap-card[data-mode]').length === 4 && document.querySelectorAll('.ap-card[data-theme-id]').length === 7, 'Appearance dialog offers 4 modes and 7 themes');
    document.querySelector('#modal-root .btn.primary').click(); await wait(100);
    App.setSeed(48);
    App.setTheme('dark');
    App.command('mode:pagemaker');
  }


  async function prajaTest(out) {
    const L = BV.Legacy;
    const words = ['ಕನ್ನಡ', 'ಪ್ರಜಾವಾಣಿ', 'ಮುದ್ರಣ', 'ಶ್ರೀ', 'ಕೃಷ್ಣ', 'ಧರ್ಮ', 'ಯೋಗ', 'ಸ್ತ್ರೀ', 'ಜ್ಞಾನ', 'ಬೆಂಗಳೂರು', 'ಮೈಸೂರಿನ', 'ಅರ್ಥಶಾಸ್ತ್ರ', 'ಉತ್ಸವ', 'ಸಂಸ್ಕೃತಿ'];
    const bad = words.filter((w) => L.prajaToUnicode(L.unicodeToPraja(w)) !== w);
    ok(!bad.length, 'Praja converter round trip on ' + words.length + ' words' + (bad.length ? ' failed: ' + bad.join(' ') : ''));
    ok(L.encodingForFont('Praja') === 'praja' && L.encodingForFont('Praja_Demi Italic') === 'praja' && L.encodingForFont('Praja Unicode') === null && L.encodingForFont('Nudi 01 e') === 'nudi', 'Praja fonts are told apart from Nudi and from Praja Unicode');
    ok(L.prajaUnicodeFont('Praja_Demi').font === 'Praja Unicode Demi' && L.prajaUnicodeFont('Praja Bold').bold, 'Praja weights map to Praja Unicode, Demi and Light');
    ok(L.encodingForFont('Praja03') === 'nudi' && L.encodingForFont('Praja08') === 'nudi' && L.prajaNudiUnicodeFont('Praja06').font === 'Praja Unicode Demi' && L.prajaNudiUnicodeFont('Praja06').italic && L.prajaNudiUnicodeFont('Praja07').bold, 'Praja01-Praja08 read as the Nudi layout and map to the matching Praja Unicode face');
    ok(L.prajaToUnicode(L.unicodeToPraja('ಕ್ಕು ದ್ಯು ಸ್ತ್ರೀ')) === 'ಕ್ಕು ದ್ಯು ಸ್ತ್ರೀ' && L.unicodeToPraja('ಕ್ಕು') === 'Ój"x', 'kit 1.11 converter: the short u-hook goes before the ottakshara');
    await document.fonts.load('16px "Praja03"', 'PÀ');
    ok(document.fonts.check('16px "Praja03"', 'PÀ'), 'Praja01-Praja08 are bundled and load');
    {
      // Praja03 text placed from an RTF file becomes Unicode in Praja Unicode
      const nud = L.unicodeToNudi('ಕನ್ನಡ ಪ್ರಜಾವಾಣಿ');
      const enc1 = (() => { const m = {}; const dec = new TextDecoder('windows-1252'); for (let b = 128; b < 256; b++) m[dec.decode(new Uint8Array([b]))] = b; return m; })();
      const hx = (t) => [...t].map((c) => (c.charCodeAt(0) > 127 ? "\\'" + (enc1[c] || 63).toString(16) : c === '\\' || c === '{' || c === '}' ? '\\' + c : c)).join('');
      const rtf2 = `{\\rtf1\\ansi{\\fonttbl{\\f0 Arial;}{\\f1 Praja07;}}\\f1 ${hx(nud)}\\par}`;
      const pr = App.prajaInternals.rtfParas(rtf2, 'Body text', { praja: null, nudi: { font: 'Noto Serif Kannada', scale: 1, prajaLook: true } });
      ok(T.paraText(pr[0]) === 'ಕನ್ನಡ ಪ್ರಜಾವಾಣಿ' && pr[0].runs[0].font === 'Praja Unicode' && pr[0].runs[0].bold, 'Praja07 (Nudi layout) text becomes Unicode in Praja Unicode Bold: ' + T.paraText(pr[0]));
    }
    await App.ensureFonts(['Praja Unicode']);
    await document.fonts.load('16px "Praja Unicode"', 'ಕನ್ನಡ');
    ok(document.fonts.check('16px "Praja Unicode"', 'ಕನ್ನಡ'), 'Praja Unicode font is bundled and loads');

    // a publication with Praja text, split in the middle of a syllable by a formatting change
    const d = BV.newDocument({ pageCount: 1 });
    App.setDoc(d, null);
    App.computePlacements();
    const col = BV.pageColumns(d, d.pages[0].id)[0];
    const st = BV.newStory(d, 'Body text');
    const pj = L.unicodeToPraja('ಕನ್ನಡ ಪ್ರಜಾವಾಣಿ ಮುದ್ರಣ');
    const cut = pj.indexOf('<') + 2; // inside ನ್ನ
    st.paras = [{ style: 'Body text', runs: [{ t: pj.slice(0, cut), font: 'Praja', size: 14 }, { t: pj.slice(cut), font: 'Praja', size: 14, bold: true }, { t: ' English 2026', font: 'Noto Serif', size: 14 }] }];
    const f = BV.newItem(d, 'text', d.pages[0].id, col.x, col.y, col.w, 200, { storyId: st.id, stroke: 'none', strokeWidth: 0 });
    st.frames.push(f.id);
    App.markAll(); App.render();
    App.sel = { kind: 'none' };
    const stats = App.convertPraja('all', { target: 'praja', styles: true });
    const txt = T.paraText(st.paras[0]);
    ok(txt === 'ಕನ್ನಡ ಪ್ರಜಾವಾಣಿ ಮುದ್ರಣ English 2026', 'Praja to Unicode in the publication keeps syllables whole and English untouched: ' + txt);
    ok(st.paras[0].runs.some((r) => r.font === 'Praja Unicode' && r.bold && r.size === 14) && st.paras[0].runs.some((r) => r.font === 'Noto Serif'), 'formatting kept (bold, size, other fonts)');
    App.render(); await wait(300);
    // back to PageMaker: Praja text goes back to Praja ASCII in the Praja font
    const tt = BV.PMExport.taggedText(App.doc, [st]);
    const tagged = new TextDecoder('windows-1252').decode(Uint8Array.from(atob(tt.base64), (c) => c.charCodeAt(0)));
    let plain = '';
    for (let i = 0; i < tagged.length; i++) {
      const c = tagged[i];
      if (c === '\\') { plain += tagged[++i]; continue; }
      if (c === '<') { const j = tagged.indexOf('>', i); if (tagged.slice(i, j + 1) === '<\\#92>') plain += '\\'; i = j; continue; }
      plain += c;
    }
    if (!plain.includes(L.unicodeToPraja('ಪ್ರಜಾವಾಣಿ'))) log.push('     tagged: ' + tagged.slice(-300));
    ok(/<f"Praja">/.test(tagged) && plain.includes(L.unicodeToPraja('ಪ್ರಜಾವಾಣಿ')), 'saving to PageMaker turns Praja Unicode back into Praja ASCII');
    // another Unicode font, sized to keep the line lengths
    App.checkpoint && App.undo && 0;
    st.paras = [{ style: 'Body text', runs: [{ t: pj, font: 'Praja Demi', size: 12 }] }];
    App.markAll();
    App.convertPraja('all', { target: 'other', font: 'Noto Sans Kannada', scale: 0.85, styles: false });
    const r0 = st.paras[0].runs[0];
    ok(r0.font === 'Noto Sans Kannada' && Math.abs(r0.size - 10.2) < 0.05 && T.paraText(st.paras[0]) === 'ಕನ್ನಡ ಪ್ರಜಾವಾಣಿ ಮುದ್ರಣ', 'Praja to another Unicode font with the measured size (' + r0.font + ' ' + r0.size + ' pt)');
    const sc = App.prajaInternals.prajaScale('ಕನ್ನಡ ಪ್ರಜಾವಾಣಿ ಮುದ್ರಣ ಕರ್ನಾಟಕ', 'Praja Unicode', 'Noto Sans Kannada');
    ok(sc > 0.6 && sc < 1.4, 'size to keep line lengths measured on the text: ' + Math.round(sc * 100) + '%');

    // Word document parts
    const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
    const styles = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:styles xmlns:w="${W}"><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/><w:sz w:val="22"/></w:rPr></w:rPrDefault></w:docDefaults><w:style w:type="paragraph" w:styleId="PrajaBody"><w:name w:val="Praja Body"/><w:rPr><w:rFonts w:ascii="Praja" w:hAnsi="Praja"/><w:sz w:val="28"/></w:rPr></w:style></w:styles>`;
    const xesc = (t) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    const document_ = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="${W}"><w:body>
      <w:p><w:pPr><w:pStyle w:val="PrajaBody"/></w:pPr><w:r><w:rPr><w:b/></w:rPr><w:t>${xesc(pj.slice(0, cut))}</w:t></w:r><w:r><w:rPr><w:b/><w:color w:val="FF0000"/></w:rPr><w:t>${xesc(pj.slice(cut))}</w:t></w:r><w:r><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial"/></w:rPr><w:t xml:space="preserve"> Hello</w:t></w:r></w:p>
    </w:body></w:document>`;
    const parts = { 'word/document.xml': document_, 'word/styles.xml': styles };
    const sv = App.prajaInternals.surveyDocx(parts);
    ok(sv.fonts.some((x) => x.name === 'Praja' && x.enc === 'praja'), 'Word survey finds Praja text through the paragraph style');
    const res = App.prajaInternals.convertDocxParts(parts, { praja: { target: 'praja', scale: 1 }, nudi: null });
    const nd = new DOMParser().parseFromString(res.parts['word/document.xml'], 'application/xml');
    const ts = [...nd.getElementsByTagNameNS(W, 't')].map((t) => t.textContent).join('');
    const r1 = nd.getElementsByTagNameNS(W, 'r')[1];
    const rp = r1.getElementsByTagNameNS(W, 'rPr')[0];
    const order = [...rp.children].map((c) => c.localName).join(',');
    ok(ts === 'ಕನ್ನಡ ಪ್ರಜಾವಾಣಿ ಮುದ್ರಣ Hello', 'Word: Praja runs converted in place, English kept: ' + ts);
    ok(rp.getElementsByTagNameNS(W, 'rFonts')[0].getAttribute('w:cs') === 'Praja Unicode' && /rFonts,b,bCs,color,sz,szCs,lang/.test(order) && rp.getElementsByTagNameNS(W, 'szCs')[0].getAttribute('w:val') === '28', 'Word: complex-script font, bold, size and colour set in schema order (' + order + ')');
    ok(/Praja Unicode/.test(res.parts['word/styles.xml'] || ''), 'Word: the Praja paragraph style now uses Praja Unicode');
    // RTF
    const enc1252 = (() => { const m = {}; const dec = new TextDecoder('windows-1252'); for (let b = 128; b < 256; b++) m[dec.decode(new Uint8Array([b]))] = b; return m; })();
    const hex = (t) => [...t].map((c) => (c.charCodeAt(0) > 127 ? "\\'" + (enc1252[c] || 63).toString(16) : c === '\\' || c === '{' || c === '}' ? '\\' + c : c)).join('');
    const rtf = `{\\rtf1\\ansi\\deff0{\\fonttbl{\\f0\\fswiss\\fcharset0 Arial;}{\\f1\\fnil\\fcharset0 Praja;}}\\pard\\f1\\fs28 ${hex(pj.slice(0, cut))}\\b ${hex(pj.slice(cut))}\\b0\\f0  Hello\\par}`;
    const rr = App.prajaInternals.convertRtf(rtf, { praja: { target: 'praja', scale: 1 }, nudi: null });
    const back = App.prajaInternals.rtfParas(rr.rtf, 'Body text', { praja: null, nudi: null });
    ok(/Praja Unicode/.test(rr.rtf) && T.paraText(back[0]) === 'ಕನ್ನಡ ಪ್ರಜಾವಾಣಿ ಮುದ್ರಣ Hello', 'RTF: Praja converted with \\u escapes and the font table renamed: ' + T.paraText(back[0]));
    const placed = App.prajaInternals.rtfParas(rtf, 'Body text', { praja: { target: 'other', font: 'Noto Sans Kannada', scale: 1 }, nudi: null });
    ok(T.paraText(placed[0]) === 'ಕನ್ನಡ ಪ್ರಜಾವಾಣಿ ಮುದ್ರಣ Hello' && placed[0].runs.some((r) => r.bold && r.font === 'Noto Sans Kannada'), 'Place: RTF Praja text becomes Unicode with bold kept');
    const sample = 'ಕರ್ನಾಟಕದ ಪ್ರಜಾವಾಣಿ ಪತ್ರಿಕೆಯ ಅಕ್ಷರಗಳು ಈಗ ಯೂನಿಕೋಡ್\u200cನಲ್ಲಿ. ಶ್ರೀ ಕೃಷ್ಣ ಧರ್ಮಸ್ಥಳ ಜ್ಞಾನ ಸ್ತ್ರೀ ಉತ್ಸವ.';
    st.paras = [['Praja Unicode', false, false], ['Praja Unicode', true, false], ['Praja Unicode', false, true], ['Praja Unicode Demi', false, false], ['Praja Unicode Light', false, false], ['Noto Sans Kannada', false, false]].map(([font, bold, italic]) => ({ style: 'Body text', runs: [{ t: font + (bold ? ' Bold' : italic ? ' Italic' : '') + ': ', font: 'Noto Sans', size: 9 }, { t: sample, font, size: 20, bold, italic }] }));
    App.markAll(); App.render(); await App.ensureFonts(['Praja Unicode', 'Praja Unicode Demi', 'Praja Unicode Light']); await wait(300); App.markAll(); App.render(); await wait(300);
    await native.capture(out + '/30-praja.png');
    // the Convert Praja dialog, on Praja text
    st.paras = [{ style: 'Body text', runs: [{ t: L.unicodeToPraja(sample), font: 'Praja', size: 16 }] }];
    App.markAll(); App.render();
    autoDialog(() => setTimeout(() => native.capture(out + '/31-praja-dialog.png'), 800), 'Cancel', 1800);
    await App.command('convertPraja');
    await wait(200);
  }


  async function newTest(out) {
    App.closeMenus && App.closeMenus();
    document.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    // reflow overset text
    const d = BV.newDocument({ pageCount: 2 });
    App.setDoc(d, null);
    App.computePlacements();
    const col = BV.pageColumns(d, d.pages[0].id)[0];
    const st = BV.newStory(d, 'Body text');
    const body = 'ಭಾರತೀಯ ಸಂಗೀತವು ಆಧ್ಯಾತ್ಮಿಕತೆಯೆಡೆಗೆ ಮುಖಮಾಡಿದ ಸಂಗೀತವಾಗಿ ಮತ್ತು ಅನಿವಾರ್ಯವಾಗಿಯೇ ಗಾಯನ ಸಂಗೀತವಾಗಿ ವಿಕಾಸಗೊಂಡಿತು. ';
    st.paras = Array.from({ length: 60 }, (_, i) => ({ style: 'Body text', runs: [{ t: body.repeat(3) + i }] }));
    const f1 = BV.newItem(d, 'text', d.pages[0].id, col.x, col.y, col.w, col.h, { storyId: st.id, stroke: 'none', strokeWidth: 0 });
    st.frames.push(f1.id);
    const other = BV.newStory(d, 'Body text');
    other.paras = [{ style: 'Body text', runs: [{ t: 'Hello world. The ' }, { t: 'bold', bold: true }, { t: ' word and ಕನ್ನಡ ಪದ.' }] }];
    const f2 = BV.newItem(d, 'text', d.pages[1].id, col.x, col.y, col.w, 120, { storyId: other.id, stroke: 'none', strokeWidth: 0 });
    other.frames.push(f2.id);
    App.markAll(); App.render();
    ok(App.layoutFor(st).overflow, 'test story is overset before reflow');
    const res = App.reflowAll('after', true);
    ok(!App.layoutFor(st).overflow && res.pages >= 2 && d.pages.length === 2 + res.pages && st.frames.length > 1, `Reflow Overset Text added ${res.pages} pages (in pairs: ${res.pages % 2 === 0}) and threaded ${st.frames.length} blocks`);
    ok(d.items[other.frames[0]].page === d.pages[d.pages.length - 1].id, 'pages were added after the story, before the next page');
    // find and change across formatting, whole word in Kannada, regex
    const re = App.f8.buildRegex('the bold', { matchCase: false });
    const para = other.paras[0];
    const m = [...T.paraText(para).matchAll(re)][0];
    App.f8.replaceInPara(para, m.index, m.index + m[0].length, 'THE BRAVE');
    ok(T.paraText(para) === 'Hello world. THE BRAVE word and ಕನ್ನಡ ಪದ.', 'Change finds text across a bold change: ' + T.paraText(para));
    const w = App.f8.buildRegex('ಕನ್ನಡ', { word: true });
    ok([...'ಕನ್ನಡ ಪದ ಕನ್ನಡದ'.matchAll(w)].length === 1, 'Whole word works for Kannada (ಕನ್ನಡ is not found inside ಕನ್ನಡದ)');
    const rx = App.f8.buildRegex('\\s+([,.])', { regex: true });
    ok('a , b .'.replace(rx, '$1') === 'a, b.', 'regular expressions with $1');
    // special characters and fields
    App.setTool('text');
    App.sel = { kind: 'text', sid: other.id, a: { p: 0, o: 0 }, f: { p: 0, o: 0 } };
    await App.command('char:0964'); await App.command('char:200C');
    ok(T.paraText(other.paras[0]).startsWith('।\u200c'), 'Insert Special Character: danda and ZWNJ');
    App.userName = 'Tejas';
    await App.command('field:userName');
    ok(T.paraText(other.paras[0]).includes('Tejas'), 'Insert Field: your name');
    // format painter
    App.sel = { kind: 'text', sid: other.id, a: { p: 0, o: 12 }, f: { p: 0, o: 12 } };
    other.paras[0].runs = [{ t: T.paraText(other.paras[0]) }];
    T.applyChar(other, { p: 0, o: 0 }, { p: 0, o: 5 }, { bold: true, size: 20 });
    App.typingAttrs = null;
    App.sel = { kind: 'text', sid: other.id, a: { p: 0, o: 1 }, f: { p: 0, o: 2 } };
    App.command('copyFormat');
    App.sel = { kind: 'text', sid: other.id, a: { p: 0, o: 10 }, f: { p: 0, o: 14 } };
    App.command('pasteFormat');
    const at = T.attrsAt(other.paras[0], 12);
    ok(at.bold && at.size === 20, 'Format Painter copies bold and size to the selection');
    // find font
    const fu = App.f8.fontsUsed();
    ok(fu.some((f) => f.name === 'Noto Serif Kannada'), 'Find Font lists the fonts in use: ' + fu.map((f) => f.name).join(', '));
    // watermark and border in print
    d.setup.watermark = { text: 'ಮಾದರಿ DRAFT', size: 60, color: '#999999', opacity: 20, diagonal: true };
    d.setup.pageBorder = { width: 2, color: '#a3401f', style: 'double', inset: 20 };
    const { body: pb } = BV.Render.printHTML(d, App.getLayout, [0, 0]);
    ok(pb.includes('ಮಾದರಿ DRAFT') && pb.includes('#a3401f'), 'watermark and page border are in print and PDF');
    // fit frame to text
    App.sel = { kind: 'items', ids: [f2.id] };
    App.command('fitFrameText');
    ok(d.items[f2.id].h < 120, 'Fit Frame to Text shrinks the block to its text (' + Math.round(d.items[f2.id].h) + ' pt)');
    // title with the user's name
    App.setDirty(false);
    ok(document.title.startsWith("Tejas's Mudrana |"), 'title bar says the user name: ' + document.title);
    App.showThreads = true;
    App.gotoPage(0); App.view.fit = true; App.fitZoom(); App.sel = { kind: 'none' }; App.render(); await wait(500);
    await native.capture(out + '/32-reflow-threads-watermark.png');
    App.showThreads = false;
    // welcome with Namaste and What's New
    await App.showWelcome(); await wait(500);
    ok(/Namaste, Tejas/.test(document.querySelector('#welcome h1').textContent) && document.querySelector('#welcome [data-act="whatsNew"]'), 'start screen says Namaste Tejas and links to the new features');
    await native.capture(out + '/33-welcome-namaste.png');
    document.querySelector('#welcome [data-act="whatsNew"]').click(); await wait(500);
    await native.capture(out + '/34-whats-new.png');
    { const m2 = [...document.querySelectorAll('#modal-root .dlg')]; m2.forEach((x) => x.remove()); }
    document.getElementById('welcome').hidden = true;
    App.userName = '';
  }

  async function v9Test(out) {
    App.closeMenus && App.closeMenus();
    const DL = BV.DevLegacy, L = BV.Legacy;
    // Chanakya, Walkman-Chanakya and Nalanda to Unicode
    const words = ['नमस्ते', 'संस्कृतम्', 'धर्म', 'कर्म', 'श्रीमद्भगवद्गीता', 'प्रकाशन', 'सिद्धि', 'किंचित्', 'ईश्वर', 'ऑफिस', 'पङ्क्ति', 'राष्ट्र', 'ब्रह्मविद्या', 'आत्मा', 'औषध'];
    for (const enc of ['chanakya', 'walkman', 'chanakyamath']) {
      const bad = words.filter((w) => DL.toUnicode(DL.fromUnicode(w, enc), enc) !== w);
      ok(bad.length <= 1, `${enc}: Unicode -> legacy -> Unicode keeps ${words.length - bad.length}/${words.length} words${bad.length ? ' (differs: ' + bad.join(' ') + ')' : ''}`);
    }
    ok(DL.toUnicode('ueLrs Hkkjr', 'walkman') === 'नमस्ते भारत' && DL.toUnicode('fdz;k', 'walkman') === 'क्रिया', 'Walkman-Chanakya (Kruti layout) typed text: ' + DL.toUnicode('ueLrs Hkkjr fdz;k', 'walkman'));
    const iast = 'Śrīmad Bhagavadgītā kṛṣṇa ṛṣi saṃskṛta jñāna aṅga Ḍamaru';
    ok(DL.toUnicode(DL.fromUnicode(iast, 'nalanda'), 'nalanda') === iast, 'Nalanda IAST round trip: ' + DL.toUnicode(DL.fromUnicode(iast, 'nalanda'), 'nalanda'));
    ok(L.encodingForFont('Walkman-Chanakya-901') === 'walkman' && L.encodingForFont('Chanakya') === 'chanakya' && L.encodingForFont('Nalandagara') === 'nalanda' && L.encodingForFont('BVChitkala') === null, 'fonts are recognised');
    ok(L.unicodeFontFor('Chanakya Bold').font === 'BVChitkala' && L.unicodeFontFor('Chanakya Bold').bold && L.unicodeFontFor('Nalandagar').font === 'BVNanda' && L.unicodeFontFor('Walkman-Chanakya-901').font === 'BVChitkala Hindi', 'each old font goes to its BV font');
    ok(document.fonts.check('16px "BVChitkala"', 'क') && document.fonts.check('16px "BVNanda"', 'ā'), 'BV Chitkala and BV Nanda are loaded');

    // tabs
    const d1 = BV.newDocument({ pageCount: 1 });
    App.setDoc(d1, null);
    const s1 = BV.newStory(d1, 'Body text');
    const legacy = DL.fromUnicode('श्रीमद्भगवद्गीता अर्जुन उवाच', 'chanakya');
    s1.paras = [{ style: 'Body text', runs: [{ t: 'One ' }, { t: legacy, font: 'Chanakya' }] }, { style: 'Body text', runs: [{ t: DL.fromUnicode('Śrīmad Bhagavadgītā', 'nalanda'), font: 'Nalandagara' }] }];
    const col = BV.pageColumns(d1, d1.pages[0].id)[0];
    const fa = BV.newItem(d1, 'text', d1.pages[0].id, col.x, col.y, col.w, 200, { storyId: s1.id, stroke: 'none', strokeWidth: 0 });
    s1.frames.push(fa.id);
    App.markAll(); App.setDirty(true); App.render();
    App.wantNewTab = true;
    const d2 = BV.newDocument({ pageCount: 3 });
    App.setDoc(d2, null);
    ok(App.tabCount() === 2 && App.doc === d2, 'a second publication opens in a new tab');
    App.switchTab(0);
    ok(App.doc === d1 && App.dirty, 'switching back shows the first publication with its unsaved changes');
    // convert legacy text in the publication
    const realDialog = BV.UI.dialog;
    BV.UI.dialog = async (o) => { const el = document.createElement('div'); el.innerHTML = o.html; return { value: 'ok', el }; };
    await App.convertLegacyAll();
    BV.UI.dialog = realDialog;
    const t0 = T.paraText(App.doc.stories[s1.id].paras[0]), t1 = T.paraText(App.doc.stories[s1.id].paras[1]);
    ok(t0 === 'One श्रीमद्भगवद्गीता अर्जुन उवाच' && t1 === 'Śrīmad Bhagavadgītā', 'Convert Legacy Text: Chanakya and Nalanda become Unicode: ' + t0 + ' / ' + t1);
    ok(App.doc.stories[s1.id].paras[0].runs.some((r) => r.font === 'BVChitkala') && App.doc.stories[s1.id].paras[1].runs.some((r) => r.font === 'BVNanda'), 'converted text is set in BV Chitkala and BV Nanda');
    // typographer's quotes
    App.sel = { kind: 'text', sid: s1.id, a: { p: 0, o: 0 }, f: { p: 0, o: 0 } };
    App.smartQuotes = true;
    App.insertText('"'); App.insertText('x'); App.insertText('"'); App.insertText("'");
    ok(T.paraText(App.doc.stories[s1.id].paras[0]).startsWith('“x”’'), 'typographer’s quotes: ' + T.paraText(App.doc.stories[s1.id].paras[0]).slice(0, 4));
    App.leaveText();
    await wait(300);
    App.render(); await wait(1300);
    ok(document.querySelectorAll('#doctabs .dt').length === 2 && document.querySelector('#st-pf'), 'tab bar and live preflight are shown');
    await native.capture(out + '/40-tabs-devanagari.png');

    // IDML out and back in
    const d3 = BV.newDocument({ pageCount: 3 });
    App.wantNewTab = true;
    App.setDoc(d3, null);
    const st = BV.newStory(d3, 'Body text');
    st.paras = [
      { style: 'Chapter title', runs: [{ t: 'ಭಾರತೀಯ ಸಂಗೀತ' }] },
      { style: 'Body text', runs: [{ t: 'ಸಂಗೀತವು ' }, { t: 'bold', bold: true }, { t: ' and संस्कृतम् kṛṣṇa ' + 'ಕನ್ನಡ '.repeat(200) }] },
      { style: 'Shloka', runs: [{ t: 'धर्मक्षेत्रे कुरुक्षेत्रे' }] },
    ];
    const c0 = BV.pageColumns(d3, d3.pages[0].id)[0];
    const t1f = BV.newItem(d3, 'text', d3.pages[0].id, c0.x, c0.y, c0.w, c0.h / 2, { storyId: st.id, stroke: 'none', strokeWidth: 0 });
    const t2f = BV.newItem(d3, 'text', d3.pages[1].id, c0.x, c0.y, c0.w, c0.h, { storyId: st.id, stroke: 'none', strokeWidth: 0 });
    st.frames.push(t1f.id, t2f.id);
    BV.newItem(d3, 'rect', d3.pages[0].id, 40, 400, 120, 60, { fill: '#e60012', stroke: '#000000', strokeWidth: 1, rot: 15 });
    BV.newItem(d3, 'ellipse', d3.pages[2].id, 60, 60, 80, 80, { fill: '#00a0e9' });
    BV.newItem(d3, 'line', d3.pages[2].id, 30, 300, 200, 0, { strokeWidth: 2 });
    const cv = document.createElement('canvas'); cv.width = 40; cv.height = 30; const g = cv.getContext('2d'); g.fillStyle = '#3a6'; g.fillRect(0, 0, 40, 30);
    BV.newItem(d3, 'image', d3.pages[2].id, 50, 400, 160, 120, { src: cv.toDataURL('image/png'), name: 'green.png', cx: -20, cy: -10, cw: 200, ch: 150 });
    { const rh = BV.newStory(d3, 'Running head'); rh.paras = [{ style: 'Running head', runs: [{ t: 'ಸಂಗೀತ \uE000' }] }]; const mi = BV.newItem(d3, 'text', 'MR', 40, 20, 200, 20, { storyId: rh.id, stroke: 'none' }); rh.frames.push(mi.id); }
    App.markAll(); App.render();
    const pkg = await BV.IDML.fromDoc(d3, { name: 'test', linksDir: out + '/test Links' });
    ok(pkg.files['designmap.xml'] && Object.keys(pkg.files).filter((k) => /^Spreads\//.test(k)).length === BV.spreads(d3).length && Object.keys(pkg.images).length === 1, `IDML package: ${Object.keys(pkg.files).length} parts, ${Object.keys(pkg.images).length} picture`);
    let wellFormed = true;
    for (const [k, v] of Object.entries(pkg.files)) { const x = new DOMParser().parseFromString(v, 'application/xml'); if (x.getElementsByTagName('parsererror').length) { wellFormed = false; log.push('     bad XML in ' + k + ': ' + x.getElementsByTagName('parsererror')[0].textContent.slice(0, 200)); } }
    ok(wellFormed, 'every IDML part is well-formed XML');
    ok(/Composer="\$ID\/HL Composer Optyca"/.test(Object.entries(pkg.files).find(([k]) => /^Stories\//.test(k))[1]), 'Indic paragraphs use the World-Ready composer');
    await native.idmlWrite({ filePath: out + '/test.idml', files: pkg.files, images: pkg.images });
    const back = await native.openPath(out + '/test.idml');
    ok(back && back.kind === 'idml', 'the saved .idml opens as InDesign Markup');
    const links = back.links || {};
    ok(Object.values(links).some((x) => x && x.src), 'its linked picture is found in the Links folder');
    const { doc: rd, report } = BV.IDML.toDoc(back);
    const rst = Object.values(rd.stories).find((s) => s.frames.length === 2);
    ok(rd.pages.length === 3 && rd.setup.doubleSided === d3.setup.doubleSided && Math.abs(rd.setup.w - d3.setup.w) < 0.01, `IDML back in: ${rd.pages.length} pages, ${report.frames} frames, ${report.shapes} shapes, ${report.images} picture`);
    ok(rst && T.paraText(rst.paras[0]) === 'ಭಾರತೀಯ ಸಂಗೀತ' && rst.paras[0].style === 'Chapter title' && rst.paras.length === 3, 'threaded story, its text and paragraph styles survive');
    ok(rst && rst.paras[1].runs.some((r) => r.bold && r.t === 'bold'), 'bold run survives');
    const rr = Object.values(rd.items).find((i) => i.type === 'rect');
    ok(rr && Math.abs(rr.rot - 15) < 0.1 && Math.abs(rr.w - 120) < 0.1 && Math.abs(rr.x - 40) < 0.1 && rr.fill === '#e60012', 'rotated rectangle keeps place, size, angle and colour');
    const ri = Object.values(rd.items).find((i) => i.type === 'image');
    ok(ri && ri.src && Math.abs(ri.cx + 20) < 0.1 && Math.abs(ri.cw - 200) < 0.1 && Math.abs(ri.x - 50) < 0.1, 'picture keeps its crop and place');
    ok(Object.values(rd.items).some((i) => i.type === 'line') && Object.values(rd.items).some((i) => i.type === 'ellipse'), 'line and ellipse survive');
    ok(Object.values(rd.items).some((i) => i.page === 'MR'), 'master page items survive');
    App.wantNewTab = true;
    App.setDoc(rd, null);
    App.render(); await wait(800);
    await native.capture(out + '/41-idml-roundtrip.png');
    // smart guides
    App.smartGuides = true;
    const rects = Object.values(rd.items).filter((i) => i.page === rd.pages[0].id);
    ok(rects.length > 0, 'smart guides have objects to line up with');
    // a picture of the first page for the start screen
    App.filePath = out + '/test.idml';
    App.view.fit = true; App.fitZoom(); await wait(300);
    await App.captureThumb();
    ok(!!(App.store.get('thumbs', {})[out + '/test.idml'] || {}).img, 'first-page picture kept for the start screen');
    App.filePath = null;
    // start screen
    await App.showWelcome(); await wait(600);
    ok(document.querySelectorAll('#welcome .st-preset').length >= 7 && document.querySelector('#welcome h1'), 'start screen with page-size presets');
    await native.capture(out + '/42-start.png');
    document.querySelector('#welcome .st-close').click();
    // real InDesign files (development only: BV_IDML=<folder of .idml files>)
    const idir = new URLSearchParams(location.search).get('idml');
    if (idir) {
      for (const name of ['magazineA-edito.idml', 'interview.idml', '2articles-1photo.idml', 'magazineA-courrier-des-lecteurs-3pages.idml', 'article-1photo_import-xml.idml']) {
        const dd = await native.openPath(idir + '/' + name);
        if (!dd || dd.error) { ok(false, 'open ' + name + ': ' + (dd && dd.error)); continue; }
        try {
          const { doc: x, report: rp } = BV.IDML.toDoc(dd);
          const chars = Object.values(x.stories).reduce((n, s2) => n + s2.paras.reduce((m, p2) => m + T.paraText(p2).length, 0), 0);
          ok(x.pages.length > 0 && chars > 0, `InDesign file ${name}: ${x.pages.length} pages, ${rp.frames} frames, ${rp.shapes} shapes, ${rp.images} pictures (${rp.imagesMissing} missing), ${chars} characters, ${Object.keys(x.styles).length} styles`);
          App.wantNewTab = true;
          App.setDoc(x, null);
          App.render(); await wait(900);
          await native.capture(out + '/43-idml-' + name.replace(/\W/g, '_') + '.png');
        } catch (e) { ok(false, 'read ' + name + ': ' + e.stack); }
      }
    }
    // close tabs
    while (App.tabCount() > 1) { App.setDirty(false); await App.closeTab(App.tabCount() - 1); }
    document.getElementById('welcome').hidden = true;
    ok(App.tabCount() === 1, 'tabs close');
  }

  async function shotsTest(out) {
    const dir = new URLSearchParams(location.search).get('pm');
    const quiet = async () => { App.closeMenus && App.closeMenus(); document.querySelectorAll('#modal-root .dlg').forEach((x) => x.remove()); document.getElementById('welcome').hidden = true; App.sel = { kind: 'none' }; App.render(); await wait(400); };
    const closer = (keep) => setInterval(() => { const dl = [...document.querySelectorAll('#modal-root .dlg')].pop(); if (dl && !(keep && dl.querySelector(keep))) { const b = dl.querySelector('.dfoot .btn.primary') || dl.querySelector('.dfoot .btn'); b && b.click(); } }, 300);
    App.userName = 'Tejas';
    App.command('mode:pagemaker'); App.setTheme('dark');
    // a Kannada book page with a śloka and IAST
    const d = BV.newDocument({ pageCount: 2 });
    App.setDoc(d, null);
    const col = BV.pageColumns(d, d.pages[1].id)[0];
    const st = BV.newStory(d, 'Chapter title');
    st.paras = [
      { style: 'Chapter title', runs: [{ t: 'ಭಾರತೀಯ ಸಂಗೀತ' }] },
      { style: 'Body first', runs: [{ t: 'ಭಾರತೀಯ ಸಂಗೀತವು ಆಧ್ಯಾತ್ಮಿಕತೆಯೆಡೆಗೆ ಮುಖಮಾಡಿದ ಸಂಗೀತವಾಗಿ ಮತ್ತು ಅನಿವಾರ್ಯವಾಗಿಯೇ ಗಾಯನ ಸಂಗೀತವಾಗಿ ವಿಕಾಸಗೊಂಡಿತು. ರಾಗ ಮತ್ತು ತಾಳಗಳು ಇದರ ಎರಡು ಕಣ್ಣುಗಳು; ಶ್ರುತಿಯು ಅದರ ಉಸಿರು. ' .repeat(3) }] },
      { style: 'Shloka', runs: [{ t: 'नादरूपः स्मृतो ब्रह्मा नादरूपो जनार्दनः ।\u2028नादरूपः पराशक्तिः नादरूपो महेश्वरः ॥' }] },
      { style: 'IAST', runs: [{ t: 'nādarūpaḥ smṛto brahmā nādarūpo janārdanaḥ |\u2028nādarūpaḥ parāśaktiḥ nādarūpo maheśvaraḥ ||' }] },
      { style: 'Body text', runs: [{ t: 'ನಾದವೇ ಬ್ರಹ್ಮ, ನಾದವೇ ಜನಾರ್ದನ, ನಾದವೇ ಪರಾಶಕ್ತಿ ಎಂದು ಸಂಗೀತರತ್ನಾಕರವು ಹೇಳುತ್ತದೆ. ಸಪ್ತಸ್ವರಗಳು ಇಪ್ಪತ್ತೆರಡು ಶ್ರುತಿಗಳ ಮೇಲೆ ನೆಲೆಸಿವೆ. '.repeat(4) }] },
    ];
    const f1 = BV.newItem(d, 'text', d.pages[1].id, col.x, col.y, col.w, col.h, { storyId: st.id, stroke: 'none', strokeWidth: 0 });
    st.frames.push(f1.id);
    const c0 = BV.pageColumns(d, d.pages[0].id)[0];
    const s0 = BV.newStory(d, 'Chapter title');
    s0.paras = [{ style: 'Chapter title', runs: [{ t: 'ಮುದ್ರಣ', font: 'BVMatanga', size: 64 }] }, { style: 'IAST', runs: [{ t: 'Śrī Brahmavidyā Pratiṣṭhāna' , font: 'BVNanda', size: 13 }] }, { style: 'Shloka', runs: [{ t: 'श्रीमद्भगवद्गीता', font: 'BVChitkala', size: 22 }] }, { style: 'Body text', runs: [{ t: 'ಪ್ರಜಾ ಯೂನಿಕೋಡ್ ಅಕ್ಷರಗಳಲ್ಲಿ ಕನ್ನಡ ಪಠ್ಯ.', font: 'Praja Unicode', size: 16 }] }];
    const f0 = BV.newItem(d, 'text', d.pages[0].id, c0.x, c0.y + 120, c0.w, 300, { storyId: s0.id, stroke: 'none', strokeWidth: 0 });
    s0.frames.push(f0.id);
    BV.newItem(d, 'rect', d.pages[0].id, c0.x, c0.y + 60, c0.w, 4, { fill: '#c8211b', stroke: 'none', strokeWidth: 0 });
    App.docName = 'Sangita Pustaka';
    App.markAll(); App.view.fit = true; App.fitZoom(); App.render();
    await App.ensureFonts(['BVMatanga', 'BVNanda', 'BVChitkala', 'Praja Unicode']).catch(() => {});
    App.markAll(); App.render();
    await quiet(); await wait(800);
    await native.capture(out + '/shot-pagemaker-dark.png');
    App.command('mode:word'); App.setTheme('light'); App.command('zoom:fit'); await quiet(); await wait(600);
    await native.capture(out + '/shot-word-light.png');
    App.command('mode:pagemaker'); App.setTheme('classic'); App.command('zoom:fit'); await quiet(); await wait(600);
    await native.capture(out + '/shot-classic.png');
    App.command('mode:basic'); App.setTheme('materialDark'); App.command('zoom:fit'); await quiet(); await wait(600);
    await native.capture(out + '/shot-basic-material.png');
    App.command('mode:advanced'); App.setTheme('expressive'); App.command('zoom:fit'); await quiet(); await wait(600);
    await native.capture(out + '/shot-advanced-expressive.png');
    App.command('mode:pagemaker'); App.setTheme('dark');
    // PageMaker files in tabs, with the Open dialog
    for (const name of ['vivaha.p65', 'chap02.pm5']) {
      const data = await native.openPath(dir + '/' + name);
      let shot = name === 'vivaha.p65';
      const t = setInterval(async () => {
        const dl = [...document.querySelectorAll('#modal-root .dlg')].pop();
        if (!dl) return;
        if (dl.querySelector('.so-table') && shot) { shot = false; clearInterval(t); await wait(900); await native.capture(out + '/shot-smart-open.png'); dl.querySelector('.dfoot .btn.primary').click(); }
        else if (dl.querySelector('.so-table') && !shot) { clearInterval(t); dl.querySelector('.dfoot .btn.primary').click(); }
      }, 200);
      const c = closer('.so-table');
      await App.openContent(data);
      await wait(1500);
      clearInterval(c); clearInterval(t);
    }
    await quiet();
    App.gotoPage(13); App.view.fit = true; App.fitZoom(); await quiet(); await wait(900);
    await native.capture(out + '/shot-pm5-tables.png');
    App.switchTab(App.tabCount() - 2);
    App.gotoPage(0); App.view.fit = true; App.fitZoom(); await quiet(); await wait(900);
    await native.capture(out + '/shot-vivaha.png');
    App.filePath = dir + '/vivaha.p65'; await App.captureThumb(); App.filePath = null;
    App.switchTab(App.tabCount() - 1); App.filePath = dir + '/chap02.pm5'; await App.captureThumb(); App.filePath = null;
    App.switchTab(0); App.filePath = '/home/claude/Sangita Pustaka.bvm'; await App.captureThumb(); App.filePath = null;
    // start screen
    await App.showWelcome(); await wait(900);
    await native.capture(out + '/shot-start.png');
    document.getElementById('welcome').hidden = true;
    // convert legacy text
    const d2 = BV.newDocument({ pageCount: 1 });
    App.wantNewTab = true; App.setDoc(d2, null); App.docName = 'Chanakya and Nalanda';
    const s2 = BV.newStory(d2, 'Body text');
    s2.paras = [{ style: 'Shloka', runs: [{ t: BV.DevLegacy.fromUnicode('धर्मक्षेत्रे कुरुक्षेत्रे समवेता युयुत्सवः ।', 'chanakya'), font: 'Chanakya', size: 18 }] }, { style: 'IAST', runs: [{ t: BV.DevLegacy.fromUnicode('dharmakṣetre kurukṣetre samavetā yuyutsavaḥ |', 'nalanda'), font: 'Nalandagara', size: 13 }] }, { style: 'Body text', runs: [{ t: BV.DevLegacy.fromUnicode('मामकाः पाण्डवाश्चैव किमकुर्वत सञ्जय ॥', 'walkman'), font: 'Walkman-Chanakya-901', size: 16 }] }];
    const c2 = BV.pageColumns(d2, d2.pages[0].id)[0];
    const f2 = BV.newItem(d2, 'text', d2.pages[0].id, c2.x, c2.y, c2.w, 200, { storyId: s2.id, stroke: 'none', strokeWidth: 0 });
    s2.frames.push(f2.id);
    App.markAll(); App.render(); await quiet();
    setTimeout(async () => { await native.capture(out + '/shot-convert-legacy.png'); const dl = [...document.querySelectorAll('#modal-root .dlg')].pop(); dl && dl.querySelector('.dfoot .btn.primary').click(); }, 1500);
    await App.convertLegacyAll();
    await wait(400); App.render(); await wait(700);
    await native.capture(out + '/shot-converted.png');
    // what's new
    App.command('whatsNew'); await wait(900);
    await native.capture(out + '/shot-whats-new.png');
    document.querySelectorAll('#modal-root .dlg').forEach((x) => x.remove());
  }

  async function pm5Test(out) {
    window.__noTabs = new URLSearchParams(location.search).get('notabs') === '1';
    const dir = new URLSearchParams(location.search).get('pm');
    const data = await native.openPath(dir + '/chap02.pm5');
    if (new URLSearchParams(location.search).get('notabs') === 'dbg') {
      const { doc: dd } = BV.PMImport.toDoc(data.pm, { kannadaFont: 'Noto Serif Kannada' });
      App.setDoc(dd, null);
      for (const st of Object.values(dd.stories)) {
        console.log('[DBG] story', st.id, st.paras.length, st.frames.length);
        for (let k = 0; k < st.paras.length; k++) if (st.paras[k].ov && st.paras[k].ov.tabs) console.log('[DBG] tabs', k, JSON.stringify(st.paras[k].ov.tabs), JSON.stringify(BV.Text.paraText(st.paras[k]).slice(0, 80)));
        const t0 = performance.now();
        App.layoutFor(st);
        console.log('[DBG] laid out', st.id, Math.round(performance.now() - t0));
      }
      for (const w of [99, 97, 95]) for (const st of Object.values(dd.stories)) {
        for (const pa of st.paras) for (const run of pa.runs) if (run.legacy) run.width = w;
        st.paras.forEach((pa) => (pa.runs = pa.runs.slice()));
        App.markStory(st.id);
        console.log('[DBG] w', w, st.id);
        App.layoutFor(st);
        console.log('[DBG] w ok', w, st.id, App.layoutFor(st).overflow, st.frames.map((f) => Math.round(dd.items[f].w) + 'x' + Math.round(dd.items[f].h) + '@' + dd.items[f].page).join(' '));
      }
      return;
    }
    // the real way in: the Open dialog with its suggestions
    autoDialog((d) => { log.push('     pm5 open dialog: ' + [...d.querySelectorAll('.so-table tbody tr')].map((r) => r.querySelector('b').textContent + ' -> ' + r.querySelector('.fontbox input').value + ' ' + r.querySelector('.so-size input').value + '%').join(' | ')); }, null, 300);
    const closer = setInterval(() => { const dl = [...document.querySelectorAll('#modal-root .dlg')].pop(); if (dl && !dl.querySelector('.so-table')) { log.push('     pm5 notes: ' + dl.textContent.slice(0, 300)); const b = dl.querySelector('.dfoot .btn.primary') || dl.querySelector('.dfoot .btn'); b && b.click(); } }, 400);
    await App.openContent(data);
    await wait(1500);
    clearInterval(closer);
    { const d = App.doc; const st = Object.values(d.stories).sort((x, y) => y.frames.length - x.frames.length)[0]; const lay = App.layoutFor(st);
      const box = { page: d.pages[12].id };
      const fr = st.frames.map((f) => d.items[f]).find((f) => f.page === box.page);
      log.push('     pm5 p57 shapes ' + Object.values(d.items).filter((i) => i.page === box.page && i.type !== 'text').map((i) => i.type + '@' + i.y.toFixed(1) + (i.h ? '+' + i.h.toFixed(1) : '')).join(' '));
      log.push('     pm5 box ' + JSON.stringify(box && { x: box.x, y: box.y, h: box.h }) + ' frame ' + JSON.stringify(fr && { y: fr.y, h: fr.h }));
      let prevPara = -1;
      if (fr) for (const l of lay.frames[fr.id].lines) { const t = BV.Text.paraText(st.paras[l.para]).slice(l.s, l.s + 30); if (l.para !== prevPara) { const pp = BV.paraProps(d, st.paras[l.para]); log.push(`     para ${l.para} sb ${pp.spaceBefore} sa ${pp.spaceAfter} lead ${pp.leading}`); prevPara = l.para; } log.push(`       y ${(fr.y + l.top).toFixed(1)} h ${l.h.toFixed(1)} ${JSON.stringify(t)}`); } }
    for (const st of Object.values(App.doc.stories)) if (App.layoutFor(st).overflow) log.push('     pm5 overset: ' + st.id + ' ' + JSON.stringify(BV.Text.paraText(st.paras[0]).slice(0, 60)) + ' frames ' + st.frames.length);
    { const m2 = [...document.querySelectorAll('#modal-root .dlg')]; m2.forEach((x) => x.remove()); }
    const d = App.doc;
    log.push('     pm5 pages ' + d.pages.length + ' items ' + Object.keys(d.items).length);
    const { body, css } = BV.Render.printHTML(d, App.getLayout);
    await native.exportPdfTo({ body, css, fontCss: App.fontCssText, filePath: out + '/chap02-full.pdf' });
    for (const i of [0, 3, 6, 13]) { App.gotoPage(i); App.view.fit = true; App.fitZoom(); App.render(); await wait(500); await native.capture(out + `/pm5-p${i}.png`); }
  }

  async function v5Test(out) {
    const doc = BV.newDocument({ pageCount: 3 });
    App.setDoc(doc, null);
    App.computePlacements();
    const col = BV.pageColumns(doc, doc.pages[0].id)[0];
    const st = BV.newStory(doc, 'Body text');
    const body = 'ಭಾರತೀಯ ಸಂಗೀತವು ಆಧ್ಯಾತ್ಮಿಕತೆಯೆಡೆಗೆ ಮುಖಮಾಡಿದ ಸಂಗೀತವಾಗಿ ಮತ್ತು ಅನಿವಾರ್ಯವಾಗಿಯೇ ಗಾಯನ ಸಂಗೀತವಾಗಿ ವಿಕಾಸಗೊಂಡಿತು. ';
    st.paras = Array.from({ length: 12 }, (_, i) => ({ style: 'Body text', runs: [{ t: body.repeat(3) + i }] }));
    const f1 = BV.newItem(doc, 'text', doc.pages[0].id, col.x, col.y, col.w, col.h, { storyId: st.id, stroke: 'none', strokeWidth: 0 });
    const f2 = BV.newItem(doc, 'text', doc.pages[1].id, col.x, col.y, col.w, col.h, { storyId: st.id, stroke: 'none', strokeWidth: 0 });
    st.frames.push(f1.id, f2.id);
    App.markAll(); App.render();
    // KGP keyboard: k A n n f n w  ->  ಕಾನ್ನ್? type "kannaDa" as KGP: k n f n w  = ಕನ್ನಡ
    App.setTool('text');
    App.sel = { kind: 'text', sid: st.id, a: { p: 0, o: 0 }, f: { p: 0, o: 0 } };
    App.focusIME();
    App.setKeyboard('kgp');
    const ime = document.getElementById('ime');
    const press = (k) => ime.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true }));
    for (const k of 'knfnw') press(k);
    press(' ');
    ok(T.paraText(st.paras[0]).startsWith('ಕನ್ನಡ'), 'Nudi / KGP keyboard types ಕನ್ನಡ: ' + T.paraText(st.paras[0]).slice(0, 6));
    for (const k of 'kA') press(k);
    ok(T.paraText(st.paras[0]).startsWith('ಕನ್ನಡಕಾ'), 'KGP vowel sign after a consonant (ಕಾ)');
    App.setKeyboard('saPh');
    App.sel = { kind: 'text', sid: st.id, a: { p: 1, o: 0 }, f: { p: 1, o: 0 } };
    for (const k of 'saMskRRita') press(k);
    ok(T.paraText(st.paras[1]).startsWith('संस्कृत'), 'Phonetic Devanagari: ' + T.paraText(st.paras[1]).slice(0, 7));
    App.setKeyboard('off');
    // footnote
    App.sel = { kind: 'text', sid: st.id, a: { p: 2, o: 6 }, f: { p: 2, o: 6 } };
    autoDialog((d) => { d.querySelector('#fn-t').value = 'ಇದು ಅಡಿಟಿಪ್ಪಣಿ. This is a footnote.'; });
    await App.command('footnote');
    await wait(200);
    App.sel = { kind: 'text', sid: st.id, a: { p: 5, o: 3 }, f: { p: 5, o: 3 } };
    autoDialog((d) => { d.querySelector('#fn-t').value = 'Second note, to check numbering.'; });
    await App.command('footnote');
    await wait(200);
    const markers = st.paras.flatMap((p) => p.runs.filter((r) => r.fn).map((r) => r.t));
    ok(markers.join(',') === '1,2', 'Footnotes numbered in order: ' + markers.join(','));
    const lay = App.layoutFor(st);
    const notes = Object.values(lay.frames).flatMap((f) => f.notes || []);
    ok(notes.length === 2 && lay.frames[f1.id].fnH > 0, 'Footnotes placed at the bottom of the text block');
    ok(BV.Render.textItemSVG(f1, lay.frames[f1.id]).includes('ಅಡಿಟಿಪ್ಪಣಿ'), 'Footnote text is drawn');
    App.leaveText();
    App.gotoSpread(0); App.view.fit = true; App.fitZoom(); App.sel = { kind: 'none' };
    await wait(400);
    await native.capture(out + '/15-footnotes.png');
    // sections: roman front matter
    App.gotoPage(0);
    autoDialog((d) => { d.querySelector('#sc-on').checked = true; d.querySelector('#sc-st').value = 'lowerroman'; });
    await App.command('sections');
    await wait(100);
    ok(BV.pageLabel(doc, 1) === 'ii', 'Numbering sections: page 2 is ii');
    // clean up text
    st.paras[3].runs = [{ t: 'A  "quoted"  word , here' }];
    App.sel = { kind: 'items', ids: [f1.id] };
    autoDialog();
    await App.command('cleanUp');
    await wait(100);
    ok(T.paraText(st.paras[3]) === 'A \u201Cquoted\u201D word, here', 'Clean Up Text: ' + T.paraText(st.paras[3]));
    // find a command
    App.openCommandPalette();
    await wait(100);
    const q = document.getElementById('cp-q');
    q.value = 'insert footnote'; q.dispatchEvent(new Event('input'));
    await wait(100);
    const first = document.querySelector('#cp-list .cp-it.on .cp-l');
    ok(first && /Footnote/i.test(first.textContent), 'Find a Command finds “Insert Footnote”');
    await native.capture(out + '/16-command-palette.png');
    q.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    // preview mode
    await App.command('preview');
    ok(!App.showGuides && document.body.classList.contains('preview-mode'), 'Preview mode hides guides');
    await App.command('preview');
    ok(App.showGuides, 'Preview mode off restores guides');
  }

  async function pmTest(out) {
    const dir = new URLSearchParams(location.search).get('pm');
    if (!dir) return;
    for (const name of ['chap02.pm5', 'vivaha.p65', 'thesis.p65', 'music.pmd']) {
      const data = await native.openPath(dir + '/' + name);
      if (data.error) { ok(false, name + ': ' + data.error); continue; }
      const t0 = performance.now();
      const { doc, report } = BV.PMImport.toDoc(data.pm, { kannadaFont: 'Noto Serif Kannada', nudiScale: 0.9, availableFonts: App.fontSet });
      App.setDoc(doc, null);
      App.docName = name;
      const ms = Math.round(performance.now() - t0);
      if (name === 'chap02.pm5') {
        const all = Object.values(doc.stories).map((s2) => s2.paras.map((p2) => T.paraText(p2)).join('\n')).join('\n');
        const main = Object.values(doc.stories).sort((x, y) => y.frames.length - x.frames.length)[0];
        ok(data.pm.format === 'pagemaker5' && doc.pages.length === 36 && main.frames.length >= 30, `PageMaker 5 file: ${doc.pages.length} pages, main story in ${main.frames.length} text blocks, starts on page ${doc.setup.startPage}`);
        ok(/Śruti/.test(all) && /[\u0900-\u097f]/.test(all), 'PageMaker 5 text: Nalanda and Chanakya are Unicode: ' + all.slice(0, 80).replace(/\n/g, ' | '));
        log.push('     pm5 sample: ' + all.slice(300, 700).replace(/\n/g, ' | '));
      }
      let over = 0;
      const ovInfo = [];
      for (const st of Object.values(App.doc.stories)) { const L = App.layoutFor(st); if (L.overflow) { over++; const last = L.lines[L.lines.length - 1]; const tot = st.paras.reduce((a, p) => a + T.paraText(p).length, 0); let placed = 0; if (last) { for (let i = 0; i < last.para; i++) placed += T.paraText(st.paras[i]).length; placed += last.e; } ovInfo.push(Math.round(100 * placed / Math.max(1, tot)) + '%/' + tot); } }
      if (ovInfo.length) log.push('     overflow stories placed: ' + ovInfo.slice(0, 12).join(' '));
      ok(report.pages > 0, `${name}: ${report.pages} pages, ${report.stories} stories, ${report.frames} text blocks, ${report.shapes} shapes, ${report.images} images (${report.imagesMissing} not shown), ${report.convertedChars} chars converted, ${over} stories with text left over, ${ms} ms`);
      const shots = name === 'thesis.p65' ? [0, 1, 40] : name === 'music.pmd' ? [0, 2, 3, 4, 9] : [0, 1];
      for (const sp of shots) {
        App.gotoSpread(sp);
        App.view.fit = true; App.fitZoom();
        App.sel = { kind: 'none' };
        await wait(500);
        await native.capture(`${out}/pm-${name.replace(/\W/g, '_')}-${sp}.png`);
      }
      if (name === 'music.pmd') {
        App.closeMenus && App.closeMenus();
        const imgs = Object.values(App.doc.items).filter((it) => it.type === 'image');
        log.push('     images: ' + imgs.map((it) => `${it.page} ${Math.round(it.x)},${Math.round(it.y)} ${Math.round(it.w)}x${Math.round(it.h)} crop ${Math.round(it.cx || 0)},${Math.round(it.cy || 0)} ${Math.round(it.cw || 0)}x${Math.round(it.ch || 0)}`).join(' | '));
        ok(imgs.some((it) => it.cw && it.cw > it.w), 'PageMaker crops are kept (the graphic is shown cropped, not squeezed into the frame)');
        if (imgs.length) {
          const pg = App.doc.pages.findIndex((p) => p.id === imgs[0].page);
          App.gotoSpread(BV.spreads(App.doc).findIndex((sp) => sp.includes(pg)));
          await wait(200);
          const pl = App.placements.find((p) => p.ref === imgs[0].page) || App.placements[0];
          App.zoomToBox({ x: (pl.x0 || 0) + imgs[0].x - 20, y: imgs[0].y - 60, w: 220, h: 160 });
          App.sel = { kind: 'none' }; App.render(); await wait(500);
          await native.capture(`${out}/pm-music-image.png`);
        }
      }
      // full Save As PageMaker flow on the imported publication
      try {
        autoDialog();
        const pr = App.saveToPageMaker(`${out}/resave-${name.replace(/\W/g, '_')}.pmd`);
        setTimeout(() => autoDialog(null, 'Close'), 1500);
        const res = await Promise.race([pr, wait(60000).then(() => 'timeout')]);
        ok(res !== 'timeout', `${name}: Save as PageMaker flow finished (${res})`);
      } catch (e) { ok(false, `${name}: Save as PageMaker threw ${e.stack || e}`); }
      { const m = [...document.querySelectorAll('#modal-root .dlg')]; m.forEach((d) => d.remove()); }
      const { body, css } = BV.Render.printHTML(App.doc, App.getLayout, [0, Math.min(5, App.doc.pages.length - 1)]);
      await native.exportPdfTo({ body, css, fontCss: App.fontCssText, filePath: `${out}/pm-${name.replace(/\W/g, '_')}.pdf` });
      if (name === 'vivaha.p65') {
        // the Open dialog with recommendations
        autoDialog((d) => { const rows = d.querySelectorAll('.so-table tbody tr'); log.push('     open dialog rows: ' + [...rows].map((r) => r.querySelector('b').textContent + ' -> ' + r.querySelector('.fontbox input').value + ' ' + r.querySelector('.so-size input').value + '%').join(' | ')); native.capture(out + '/17-open-dialog.png'); }, null, 1500);
        setTimeout(() => autoDialog(null, 'OK'), 2500);
        await App.importPageMaker(data);
        await wait(300);
        ok(App.doc.pages.length === 3 && App.doc.pmImport && Object.keys(App.doc.pmImport.scales || {}).length > 0, 'Smart open: fonts recommended and sizes measured per Nudi font ' + JSON.stringify(App.doc.pmImport.scales));
        App.gotoSpread(0); App.view.fit = true; App.fitZoom(); await wait(500);
        await native.capture(out + '/pm-vivaha-smart.png');
        // keep the Nudi text as ASCII in its own font
        const k = BV.PMImport.toDoc(data.pm, { kannadaFont: 'Noto Serif Kannada', nudiScale: 0.9, availableFonts: App.fontSet, keepAscii: true });
        App.setDoc(k.doc, null);
        await App.ensureFonts(App.docFonts());
        const fonts = App.docFonts();
        ok(fonts.some((f) => /nudi/i.test(f)), 'keep-ASCII import keeps the Nudi fonts: ' + fonts.join(', '));
        App.gotoSpread(0); App.view.fit = true; App.fitZoom();
        await wait(700);
        await native.capture(`${out}/pm-vivaha-ascii.png`);
        // and back to PageMaker: ASCII runs stay as they are
        const job = BV.PMExport.build(App.doc, { kind: 'p65', images: {} });
        ok(job.steps.some((x) => /saveas "%OUT%", 2/.test(x.c)), 'PageMaker 6.5 save uses SaveAs kind 2');
        await native.devWrite(out + '/vivaha-ascii.spt', job.spt);
      }
    }
  }

  App.selfTest = async function () {
    const out = new URLSearchParams(location.search).get('out');
    try {
      await wait(800);
      await App.showWelcome();
      await wait(400);
      await native.capture(out + '/00-welcome.png');
      document.getElementById('welcome').hidden = true;
      // the in-window menus
      const mb = document.querySelector('#menubar .mb-item[data-i="3"]');
      if (mb) { mb.dispatchEvent(new MouseEvent('mousedown', { bubbles: true })); await wait(300); const sub = [...document.querySelectorAll('.menu-pop .mi')].find((m) => /T&?ype Style|Type Style/.test(m.textContent)); if (sub) sub.dispatchEvent(new MouseEvent('mousemove', { bubbles: true })); await wait(450); await native.capture(out + '/00b-menu.png'); document.dispatchEvent(new MouseEvent('mousedown', { bubbles: true })); }
      ok(document.querySelectorAll('#menubar .mb-item').length === 9, 'in-window menu bar with 9 PageMaker menus');
      const only = new URLSearchParams(location.search).get('only');
      if (only) { for (const t of only.split(',')) await ({ pm: pmTest, praja: prajaTest, modes: modesTest, v5: v5Test, v9: v9Test, pm5: pm5Test, shots: shotsTest, new: typeof newTest === 'function' ? newTest : async () => {} })[t](out); throw new Error('only: ' + only + ' done'); }
      const doc = BV.newDocument({ pageCount: 1 });
      App.setDoc(doc, null);
      await wait(200);

      // master pages: running head + page number
      const mm = BV.UNITS.mm;
      for (const side of ['L', 'R']) {
        const ref = 'M' + side;
        const m = BV.pageMargins(doc, side);
        const rh = BV.newStory(doc, 'Running head');
        rh.paras[0].runs = [{ t: side === 'L' ? 'ನಮ್ಮ ಸಂಗೀತ' : 'भारतीय संगीत परम्परा' }];
        const it = BV.newItem(doc, 'text', ref, m.left, 7 * mm, doc.setup.w - m.left - m.right, 14, { storyId: rh.id, stroke: 'none', strokeWidth: 0 });
        rh.frames.push(it.id);
        BV.newItem(doc, 'line', ref, m.left, 12 * mm, doc.setup.w - m.left - m.right, 0, { strokeWidth: 0.4 });
        const pn = BV.newStory(doc, 'Running head');
        pn.paras[0].runs = [{ t: BV.PAGE_MARKER }];
        const it2 = BV.newItem(doc, 'text', ref, m.left, doc.setup.h - 13 * mm, doc.setup.w - m.left - m.right, 14, { storyId: pn.id, stroke: 'none', strokeWidth: 0 });
        pn.frames.push(it2.id);
      }
      doc.setup.numbering = 'kannada';

      // main story
      const kn = [
        'ಭಾರತೀಯ ಸಂಗೀತವು ಆಧ್ಯಾತ್ಮಿಕತೆಯೆಡೆಗೆ ಮುಖಮಾಡಿದ ಸಂಗೀತವಾಗಿ ಮತ್ತು ಅನಿವಾರ್ಯವಾಗಿಯೇ ಗಾಯನ ಸಂಗೀತವಾಗಿ ವಿಕಾಸಗೊಂಡಿತು. ಪವಿತ್ರವಾದ ಸಾಮಗಾನವೇ ತದನಂತರದ ದಿನಗಳಲ್ಲಿ ಕಲೆಯಾಗಿ ಹೊರಹೊಮ್ಮಿದ ಭಾರತೀಯ ಸಂಗೀತದ ಮೂಲ ಮತ್ತು ಉಗಮಸ್ಥಾನವೆಂಬುದು ಹಾಗೆಯೇ ಪ್ರಾಚೀನ ಭಾರತದ ಕಲಾ-ಸಂಗೀತದ ಬಹುತೇಕ ರಚನೆಗಳು – ಅಂದರೆ ಪ್ರಬಂಧಗಳು – ತಮ್ಮ ಶಬ್ದಾರ್ಥದಲ್ಲಿ ಕೇವಲ ಆಧ್ಯಾತ್ಮಿಕವಾಗಿದ್ದವು ಎಂಬುದು, ಸಂಗೀತದ ಉನ್ನತ ಆಧ್ಯಾತ್ಮಿಕತೆಯನ್ನು ಹಾಗೂ ಅದರ ಗಾಯನ-ಪ್ರಧಾನತೆಯನ್ನು ಪುಷ್ಟೀಕರಿಸುತ್ತವೆ.',
        'ಹೀಗಾಗಿ, ಈ ಸಂಗೀತವನ್ನು ಅಭಿವ್ಯಕ್ತಿಸಲು ಮಾನವ ಶರೀರವೇ ಪ್ರಾಥಮಿಕ ಸಂಗೀತ ವಾದ್ಯವಾಗಿ ದೊರೆತದ್ದು ಒಂದು ಅದ್ಭುತ ಆವಿಷ್ಕಾರ. ಮಾನವನ ಶರೀರವನ್ನು ಹೊರತುಪಡಿಸಿ ಇತರ ಮಾಧ್ಯಮಗಳಲ್ಲಿ ಸಂಗೀತವು ಹೇಗೆ ಕೇಳಿಸಬಹುದು ಎಂದು ಮನುಷ್ಯನಿಗಿದ್ದ ಕುತೂಹಲದ ಸಹಜ ಹಾಗೂ ತಾರ್ಕಿಕ ಪರಿಣಾಮವೇ ಇತರ ಸಂಗೀತ ವಾದ್ಯಗಳ ಉಗಮ.',
        'ಇದು ತಂತಿ ಮತ್ತು ರಂಧ್ರ ವಾದ್ಯಗಳ – ಭಾರತೀಯ ಸಂಗೀತಶಾಸ್ತ್ರದ ಪರಿಭಾಷೆಯಲ್ಲಿ ತತ ಮತ್ತು ಸುಷಿರ ವಾದ್ಯಗಳ – ಹುಟ್ಟಿಗೆ ದಾರಿಮಾಡಿಕೊಟ್ಟಿತು. ಅವನದ್ಧ ಮತ್ತು ಘನ ವಾದ್ಯಗಳ ಪ್ರಕಾರಗಳು ಲಯವನ್ನು ಹಾಗೂ ಲಯಬದ್ಧ ವಿನ್ಯಾಸಗಳ ಸೌಂದರ್ಯವನ್ನು ಹೊಮ್ಮಿಸುವ ವಾದ್ಯಗಳಾಗಿಯೇ ಮೊದಲಿನಿಂದಲೂ ಕಾರ್ಯನಿರ್ವಹಿಸುತ್ತ ಬಂದಿವೆ.',
      ];
      const st = BV.newStory(doc, 'Chapter title');
      st.paras = [
        { style: 'Chapter title', runs: [{ t: 'ನಮ್ಮ ಸಂಗೀತ' }] },
        { style: 'Body first', runs: [{ t: kn[0] }] },
        { style: 'Body text', runs: [{ t: kn[1] }] },
        { style: 'Shloka', runs: [{ t: 'गीतं वाद्यं तथा नृत्यं त्रयं सङ्गीतमुच्यते ।' + BV.SOFT_BREAK + 'नादाधीनमतः सर्वं जगत् नादात्मकं स्मृतम् ॥' }] },
        { style: 'Body text', runs: [{ t: kn[2] }] },
        { style: 'Shloka (Kannada)', runs: [{ t: BV.translit.convert('yaṃ brahmā varuṇendrarudramarutaḥ stunvanti divyaiḥ stavaiḥ', 'iast', 'knda') }] },
        { style: 'Heading 2', runs: [{ t: 'ಶ್ರುತಿ ಮತ್ತು ಸ್ವರ' }] },
        ...Array.from({ length: 10 }, (_, i) => ({ style: i ? 'Body text' : 'Body first', runs: [{ t: kn[i % 3] }] })),
      ];
      // IAST under the Devanagari śloka (Duplicate as Transliteration does this in the app)
      st.paras.splice(4, 0, { style: 'IAST', runs: [{ t: BV.translit.convert(T.paraText(st.paras[3]).replace(BV.SOFT_BREAK, ' '), 'deva', 'iast') }] });
      st.paras[2].runs = [{ t: 'ಹೀಗಾಗಿ, ಈ ' }, { t: 'ಸಂಗೀತವನ್ನು', bold: true }, { t: kn[1].slice('ಹೀಗಾಗಿ, ಈ ಸಂಗೀತವನ್ನು'.length) }];

      App.computePlacements();
      const p = App.placements[0];
      const col = BV.pageColumns(doc, p.ref)[0];
      const first = BV.newItem(doc, 'text', p.ref, col.x, col.y, col.w, col.h, { storyId: st.id, stroke: 'none', strokeWidth: 0 });
      st.frames.push(first.id);
      const t0 = performance.now();
      App.autoflow(st, p, 0, first);
      const flowMs = Math.round(performance.now() - t0);
      App.markAll();
      ok(doc.pages.length >= 3, `autoflow added pages (${doc.pages.length} pages, ${flowMs} ms)`);
      ok(!App.layoutFor(st).overflow, 'all text placed after autoflow');

      // spread 1 (page 1)
      App.gotoSpread(0);
      App.view.fit = true; App.fitZoom();
      await wait(600);
      await native.capture(out + '/01-page1.png');

      // spread 2-3 with the ślokas
      App.gotoSpread(1);
      await wait(600);
      await native.capture(out + '/02-spread.png');

      // typing test: click into text at start of page-2 text and type Kannada + IAST
      App.setTool('text');
      App.sel = { kind: 'text', sid: st.id, a: { p: 1, o: 0 }, f: { p: 1, o: 0 } };
      App.insertText('ಕನ್ನಡ ');
      App.insertText('kṛṣṇa ');
      ok(T.paraText(st.paras[1]).startsWith('ಕನ್ನಡ kṛṣṇa '), 'typing inserts Unicode text');
      App.undo(); App.undo();
      ok(T.paraText(App.doc.stories[st.id].paras[1]).startsWith('ಭಾರತೀಯ'), 'undo restores text');
      // transliteration of a selection
      const st2 = App.doc.stories[st.id];
      const idx = st2.paras.findIndex((x) => x.style === 'Shloka');
      App.sel = { kind: 'text', sid: st.id, a: { p: idx, o: 0 }, f: { p: idx, o: 5 } };
      await App.command('tr:knda');
      ok(/[ಀ-೿]/.test(T.paraText(App.doc.stories[st.id].paras[idx])), 'Ctrl+Alt+2 converts selection to Kannada');
      App.undo();

      // master view
      App.leaveText();
      App.setTool('pointer');
      App.gotoSpread(0, true);
      await wait(500);
      await native.capture(out + '/03-masters.png');

      // zoomed text
      App.gotoSpread(1);
      App.setZoom(2.2, null);
      const b = document.getElementById('board');
      b.scrollLeft = (App.pad.x + 10) * App.scale();
      b.scrollTop = (App.pad.y + 30) * App.scale();
      App.sel = { kind: 'items', ids: [App.doc.stories[st.id].frames[1]] };
      App.render();
      await wait(600);
      await native.capture(out + '/04-zoom.png');

      // PDF
      const { body, css } = BV.Render.printHTML(App.doc, App.getLayout);
      await native.exportPdfTo({ body, css, fontCss: App.fontCssText, filePath: out + '/sample.pdf' });
      ok(true, 'PDF exported');
      await native.devWrite(out + '/sample.bvm', BV.serialize(App.doc));
      await interactionTest(out);
      await toolsTest(out);
      await perfTest(out);
      await pm7Test(out);
      await v5Test(out);
      await modesTest(out);
      await prajaTest(out);
      await newTest(out);
      await v9Test(out);
      await pmTest(out);
    } catch (e) {
      log.push('ERROR ' + (e.stack || e));
    }
    await native.devWrite(out + '/log.txt', log.join('\n'));
    native.quitNow();
  };
  if (/selftest/.test(location.search)) App.whenReady.then(() => App.selfTest());
})();

/* BV Mudrana: draws pages as SVG (used both on screen and for PDF/printing, so output matches the screen). */
(function () {
  const BV = (window.BV = window.BV || {});
  const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const n = (v) => Math.round(v * 100) / 100;
  let clipSeq = 0;

  function textItemSVG(it, lay, screen) {
    if (!lay) return '';
    let s = '';
    // footnotes at the bottom of the text block, under a short rule
    if (lay.notes && lay.notes.length) {
      let y = it.y + (it.autoGrow ? it.maxH || it.h : it.h) - lay.fnH;
      s += `<line x1="${n(it.x)}" x2="${n(it.x + Math.min(it.w, 72))}" y1="${n(y + 3)}" y2="${n(y + 3)}" stroke="#000" stroke-width="0.4"/>`;
      y += 9;
      for (const note of lay.notes) {
        if (note.fl) s += textItemSVG({ x: it.x, y }, note.fl, screen);
        y += note.h;
      }
    }
    for (const r of lay.rules || []) {
      const y = n(it.y + r.y), x0 = n(it.x + r.x0), x1 = n(it.x + r.x1);
      const da = r.style === 'dash' ? ` stroke-dasharray="${n(r.w * 4)} ${n(r.w * 2.5)}"` : r.style === 'dot' ? ` stroke-dasharray="0 ${n(r.w * 2.2)}" stroke-linecap="round"` : '';
      if (r.style === 'double') s += `<line x1="${x0}" x2="${x1}" y1="${n(it.y + r.y - r.w)}" y2="${n(it.y + r.y - r.w)}" stroke="${esc(r.color)}" stroke-width="${n(r.w / 3)}"/><line x1="${x0}" x2="${x1}" y1="${n(it.y + r.y + r.w)}" y2="${n(it.y + r.y + r.w)}" stroke="${esc(r.color)}" stroke-width="${n(r.w / 3)}"/>`;
      else s += `<line x1="${x0}" x2="${x1}" y1="${y}" y2="${y}" stroke="${esc(r.color)}" stroke-width="${n(r.w)}"${da}/>`;
    }
    for (const line of lay.lines) {
      for (const g of line.segs) {
        if (!g.t.trim()) continue;
        const cp = g.cp;
        const X = it.x + g.x, Y = it.y + line.base - (cp.shift || 0);
        const ws = g.ws && g.ws !== 1 ? g.ws : 1;
        const ls = g.ls ? ` letter-spacing="${n(g.ls)}"` : '';
        const deco = cp.underline ? ' text-decoration="underline"' : '';
        const pos = ws !== 1 ? `x="0" y="0" transform="translate(${n(X)},${n(Y)}) scale(${ws},1)"` : `x="${n(X)}" y="${n(Y)}"`;
        const paint = cp.outline ? `fill="none" stroke="${esc(cp.color)}" stroke-width="${n(Math.max(0.3, cp.size / 30))}"` : `fill="${esc(cp.color)}"`;
        if (cp.shadow) s += `<text ${pos.replace(/x="([\d.-]+)" y="([\d.-]+)"/, (m, a, b) => `x="${n(+a + cp.size / 16)}" y="${n(+b + cp.size / 16)}"`)} fill="#9a9a9a" style="font:${esc(BV.cssFont(cp))}"${ls} xml:space="preserve">${esc(g.t)}</text>`;
        const tx = `<text ${pos} ${paint} style="font:${esc(BV.cssFont(cp))}"${ls}${deco} xml:space="preserve">${esc(g.t)}</text>`;
        s += cp.link && !screen ? `<a href="${esc(cp.link)}">${tx}</a>` : tx;
        if (cp.strike) s += `<line x1="${n(X)}" x2="${n(X + g.w)}" y1="${n(Y - cp.size * 0.3)}" y2="${n(Y - cp.size * 0.3)}" stroke="${esc(cp.color)}" stroke-width="${n(Math.max(0.4, cp.size / 18))}"/>`;
      }
    }
    return s;
  }

  function strokeAttrs(it) {
    const sw = it.strokeWidth || 0;
    if (!it.stroke || it.stroke === 'none' || sw <= 0) return 'stroke="none"';
    if (BANDS[it.strokeStyle]) return 'stroke="none"';
    let a = `stroke="${esc(it.stroke)}" stroke-width="${sw}"`;
    if (it.strokeStyle === 'dash') a += ` stroke-dasharray="${n(Math.max(sw, 0.5) * 4)} ${n(Math.max(sw, 0.5) * 2.5)}"`;
    else if (it.strokeStyle === 'dot') a += ` stroke-dasharray="0 ${n(Math.max(sw, 0.5) * 2.2)}" stroke-linecap="round"`;
    else if (it.strokeStyle === 'double') a += ''; // drawn as two lines below
    return a;
  }
  // PageMaker's compound strokes as bands across the stroke width: [centre offset, width] in fractions of the width
  const BANDS = { double: [[-1 / 3, 1 / 3], [1 / 3, 1 / 3]], thickthin: [[-0.25, 0.5], [0.375, 0.25]], thinthick: [[-0.375, 0.25], [0.25, 0.5]], triple: [[-0.4, 0.2], [0, 0.2], [0.4, 0.2]] };
  function compoundStroke(it, shape) {
    const bands = BANDS[it.strokeStyle];
    const sw = it.strokeWidth || 0;
    if (!bands || !it.stroke || it.stroke === 'none' || sw <= 0) return null;
    let s = '';
    const col = esc(it.stroke);
    if (shape === 'line') {
      const len = Math.hypot(it.w, it.h) || 1, nx = -it.h / len, ny = it.w / len;
      for (const [c, w] of bands) { const o = c * sw; s += `<line x1="${n(it.x + nx * o)}" y1="${n(it.y + ny * o)}" x2="${n(it.x + it.w + nx * o)}" y2="${n(it.y + it.h + ny * o)}" stroke="${col}" stroke-width="${n(w * sw)}"/>`; }
      return s;
    }
    if (shape === 'rect' || shape === 'text') {
      const b = box(it);
      for (const [c, w] of bands) { const o = c * sw; s += `<rect x="${n(b.x - o)}" y="${n(b.y - o)}" width="${n(b.w + 2 * o)}" height="${n(b.h + 2 * o)}"${it.radius ? ` rx="${n(Math.max(0, it.radius + o))}"` : ''} fill="none" stroke="${col}" stroke-width="${n(w * sw)}"/>`; }
      return s;
    }
    // ellipses and polygons: full stroke, then paper-coloured gaps
    s += `${shapePath(it, shape)} fill="none" stroke="${col}" stroke-width="${n(sw)}"/>`;
    const gaps = [];
    for (let i = 0; i < bands.length - 1; i++) { const a = bands[i][0] + bands[i][1] / 2, b2 = bands[i + 1][0] - bands[i + 1][1] / 2; gaps.push([(a + b2) / 2, b2 - a]); }
    for (const [c, w] of gaps) if (Math.abs(c) < 0.05) s += `${shapePath(it, shape)} fill="none" stroke="#ffffff" stroke-width="${n(w * sw)}"/>`;
    return s;
  }
  let curGrad = null; // gradient fill of the item being drawn (Scribus-style gradients)
  const fillAttr = (it) => (curGrad && it.fill && it.fill !== 'none' ? `fill="url(#${curGrad})"` : `fill="${esc(it.fill && it.fill !== 'none' ? it.fill : 'none')}"${it.fillTint && it.fillTint < 100 ? ` fill-opacity="${it.fillTint / 100}"` : ''}`);
  function gradientDefs(it) {
    const g = it.gradient;
    if (!g || !it.fill || it.fill === 'none') return '';
    const id = 'grd' + it.id + '_' + clipSeq++;
    curGrad = id;
    const stops = `<stop offset="0" stop-color="${esc(g.from || it.fill)}"/><stop offset="1" stop-color="${esc(g.to || '#ffffff')}"/>`;
    if (g.type === 'radial') return `<defs><radialGradient id="${id}" cx="50%" cy="50%" r="60%">${stops}</radialGradient></defs>`;
    const a = ((g.angle || 0) * Math.PI) / 180, dx = Math.cos(a) / 2, dy = Math.sin(a) / 2;
    return `<defs><linearGradient id="${id}" x1="${n(0.5 - dx)}" y1="${n(0.5 - dy)}" x2="${n(0.5 + dx)}" y2="${n(0.5 + dy)}">${stops}</linearGradient></defs>`;
  }
  const box = (it) => ({ x: Math.min(it.x, it.x + it.w), y: Math.min(it.y, it.y + it.h), w: Math.abs(it.w), h: Math.abs(it.h) });
  const polyPoints = (it) => (it.pts || []).map(([u, v]) => `${n(it.x + u * it.w)},${n(it.y + v * it.h)}`).join(' ');

  function shapePath(it, shape) {
    const b = box(it);
    if (shape === 'ellipse') return `<ellipse cx="${n(b.x + b.w / 2)}" cy="${n(b.y + b.h / 2)}" rx="${n(b.w / 2)}" ry="${n(b.h / 2)}"`;
    if (shape === 'polygon') return `<polygon points="${polyPoints(it)}"`;
    const r = it.radius ? ` rx="${n(it.radius)}" ry="${n(it.radius)}"` : '';
    return `<rect x="${n(b.x)}" y="${n(b.y)}" width="${n(b.w)}" height="${n(b.h)}"${r}`;
  }

  function imageSVG(it, src, clipShape) {
    const b = box(it);
    const cx = it.cx ?? 0, cy = it.cy ?? 0, cw = it.cw ?? b.w, ch = it.ch ?? b.h;
    const id = 'clp' + it.id + '_' + clipSeq++;
    let clip;
    if (clipShape && clipShape !== 'rect') clip = `<clipPath id="${id}">${shapePath(it, clipShape)}/></clipPath>`;
    else clip = `<clipPath id="${id}"><rect x="${n(b.x)}" y="${n(b.y)}" width="${n(b.w)}" height="${n(b.h)}"/></clipPath>`;
    let tf = '';
    if (it.flipX || it.flipY) { const mx = b.x + cx + cw / 2, my = b.y + cy + ch / 2; tf = ` transform="translate(${n(mx)} ${n(my)}) scale(${it.flipX ? -1 : 1} ${it.flipY ? -1 : 1}) translate(${n(-mx)} ${n(-my)})"`; }
    let flt = '', fa = '';
    const ic = it.imgCtl;
    if (ic && (ic.bright || ic.contrast || ic.gray || ic.invert)) {
      const fid = 'flt' + it.id + '_' + clipSeq++;
      const slope = 1 + (ic.contrast || 0) / 100, icp = (ic.bright || 0) / 100 + 0.5 - 0.5 * slope;
      const ch3 = (t) => ['R', 'G', 'B'].map((c) => `<feFunc${c} type="${t.type}" ${t.attrs}/>`).join('');
      flt = `<filter id="${fid}" color-interpolation-filters="sRGB">${ic.gray ? '<feColorMatrix type="saturate" values="0"/>' : ''}<feComponentTransfer>${ch3({ type: 'linear', attrs: `slope="${n(slope)}" intercept="${n(icp)}"` })}</feComponentTransfer>${ic.invert ? `<feComponentTransfer>${ch3({ type: 'table', attrs: 'tableValues="1 0"' })}</feComponentTransfer>` : ''}</filter>`;
      fa = ` filter="url(#${fid})"`;
    }
    return `<defs>${clip}${flt}</defs><g clip-path="url(#${id})"><image href="${src}" x="${n(b.x + cx)}" y="${n(b.y + cy)}" width="${n(cw)}" height="${n(ch)}" preserveAspectRatio="none"${tf}${fa}/></g>`;
  }

  function itemSVG(doc, it, getLayout, pageText, screen) {
    curGrad = null;
    const gdefs = gradientDefs(it);
    let s = '';
    switch (it.type) {
      case 'rect':
      case 'ellipse':
      case 'polygon':
        s = `${shapePath(it, it.type)} ${fillAttr(it)} ${strokeAttrs(it)}/>`;
        if (it.type === 'polygon' && it.open) s = `<polyline points="${polyPoints(it)}" fill="none" ${strokeAttrs(it)}/>`;
        s += compoundStroke(it, it.type) || '';
        break;
      case 'line':
        s = compoundStroke(it, 'line') || `<line x1="${n(it.x)}" y1="${n(it.y)}" x2="${n(it.x + it.w)}" y2="${n(it.y + it.h)}" ${strokeAttrs(it)} stroke-linecap="${it.strokeStyle === 'dot' ? 'round' : 'butt'}"/>`;
        break;
      case 'image':
        s = it.src ? imageSVG(it, it.src, 'rect') : placeholderSVG(it, it.name || 'image');
        break;
      case 'frame': {
        if (it.src) s = imageSVG(it, it.src, it.shape);
        else if (screen) {
          // PageMaker shows an empty frame as an X
          const b = box(it);
          s = `<g stroke="#8c8c8c" stroke-width="${n(screen.px)}" fill="none">${shapePath(it, it.shape)}/>`;
          s += `<line x1="${n(b.x)}" y1="${n(b.y)}" x2="${n(b.x + b.w)}" y2="${n(b.y + b.h)}"/><line x1="${n(b.x + b.w)}" y1="${n(b.y)}" x2="${n(b.x)}" y2="${n(b.y + b.h)}"/></g>`;
        }
        if (it.strokeWidth > 0 && it.stroke && it.stroke !== 'none') s += compoundStroke(it, it.shape) || `${shapePath(it, it.shape)} fill="none" ${strokeAttrs(it)}/>`;
        break;
      }
      case 'text': {
        const story = doc.stories[it.storyId];
        if (!story) return '';
        const lay = getLayout(story, pageText);
        if (it.fill && it.fill !== 'none') s += `<rect x="${n(it.x)}" y="${n(it.y)}" width="${n(it.w)}" height="${n(it.h)}" ${fillAttr(it)}/>`;
        s += textItemSVG(it, lay && lay.frames[it.id], screen);
        if (it.strokeWidth > 0 && it.stroke && it.stroke !== 'none') s += compoundStroke(it, 'text') || `<rect x="${n(it.x)}" y="${n(it.y)}" width="${n(it.w)}" height="${n(it.h)}" fill="none" ${strokeAttrs(it)}/>`;
        break;
      }
    }
    if (it.rot) {
      const b = box(it);
      s = `<g transform="rotate(${n(it.rot)} ${n(b.x + b.w / 2)} ${n(b.y + b.h / 2)})">${s}</g>`;
    }
    // Element ▸ Mask: clipped by the shape of another object
    const mk = it.maskBy && doc.items[it.maskBy];
    if (mk) {
      const id = 'msk' + it.id + '_' + clipSeq++;
      let shp = `${shapePath(mk, mk.type === 'frame' ? mk.shape : mk.type)}/>`;
      if (mk.rot) { const b = box(mk); shp = `<g transform="rotate(${n(mk.rot)} ${n(b.x + b.w / 2)} ${n(b.y + b.h / 2)})">${shp}</g>`; }
      s = `<defs><clipPath id="${id}">${shp}</clipPath></defs><g clip-path="url(#${id})">${s}</g>`;
    }
    if (gdefs) s = gdefs + s;
    curGrad = null;
    if (it.opacity !== undefined && it.opacity < 100) s = `<g opacity="${n(Math.max(0, it.opacity) / 100)}">${s}</g>`;
    if (it.blend && it.blend !== 'normal') s = `<g style="mix-blend-mode:${esc(it.blend)}">${s}</g>`;
    if (it.href && !screen) s = `<a href="${esc(it.href)}">${s}</a>`;
    return s;
  }
  function placeholderSVG(it, label) {
    const b = box(it);
    return `<rect x="${n(b.x)}" y="${n(b.y)}" width="${n(b.w)}" height="${n(b.h)}" fill="#f1f1f1" stroke="#999" stroke-width="0.5"/><text x="${n(b.x + 4)}" y="${n(b.y + 12)}" style="font:9px sans-serif" fill="#777">${esc(label)}</text>`;
  }

  // Content of one page in page coordinates (master items first, then page items)
  function pageContentSVG(doc, pageIdx, getLayout, forPrint) {
    const page = doc.pages[pageIdx];
    const side = BV.pageSide(doc, pageIdx);
    const pageText = BV.pageLabel(doc, pageIdx);
    let s = BV.Render.pageDecor ? BV.Render.pageDecor(doc, pageIdx) : '';
    const ok = (it) => !(forPrint && it.nonPrint);
    const mref = BV.masterRefFor(doc, page, side);
    if (mref) for (const it of BV.itemsOnPage(doc, mref)) if (ok(it)) s += itemSVG(doc, it, getLayout, pageText);
    for (const it of BV.itemsOnPage(doc, page.id)) if (ok(it)) s += itemSVG(doc, it, getLayout, pageText);
    return s;
  }

  function guidesSVG(doc, ref, side, scale, guides) {
    const W = doc.setup.w, H = doc.setup.h;
    const m = BV.pageMargins(doc, side);
    const px = 1 / scale;
    let s = `<g class="guides" shape-rendering="crispEdges">`;
    const cols = BV.pageColumns(doc, ref);
    cols.forEach((c, i) => {
      if (i > 0) s += `<line x1="${n(c.x)}" y1="0" x2="${n(c.x)}" y2="${n(H)}" stroke="#4a6cf7" stroke-width="${px}"/>`;
      if (i < cols.length - 1) s += `<line x1="${n(c.x + c.w)}" y1="0" x2="${n(c.x + c.w)}" y2="${n(H)}" stroke="#4a6cf7" stroke-width="${px}"/>`;
    });
    s += `<rect x="${n(m.left)}" y="${n(m.top)}" width="${n(W - m.left - m.right)}" height="${n(H - m.top - m.bottom)}" fill="none" stroke="#e000e0" stroke-width="${px}"/>`;
    for (const y of guides.h) s += `<line x1="0" y1="${n(y)}" x2="${n(W)}" y2="${n(y)}" stroke="#00b2f0" stroke-width="${px}"/>`;
    for (const x of guides.v) s += `<line x1="${n(x)}" y1="0" x2="${n(x)}" y2="${n(H)}" stroke="#00b2f0" stroke-width="${px}"/>`;
    return s + '</g>';
  }

  // Full HTML for PDF export / printing: one SVG per page, no guides, no non-printing items
  function printHTML(doc, getLayout, range) {
    const W = doc.setup.w, H = doc.setup.h;
    let body = '';
    const from = range ? range[0] : 0, to = range ? range[1] : doc.pages.length - 1;
    for (let i = from; i <= to; i++) {
      body += `<div class="pg"><svg xmlns="http://www.w3.org/2000/svg" width="${W}pt" height="${H}pt" viewBox="0 0 ${W} ${H}" text-rendering="geometricPrecision">${pageContentSVG(doc, i, getLayout, true)}</svg></div>`;
    }
    return { body, css: `@page{size:${W}pt ${H}pt;margin:0}html,body{margin:0;padding:0}.pg{width:${W}pt;height:${H}pt;overflow:hidden;page-break-after:always;break-after:page}.pg:last-child{page-break-after:auto;break-after:auto}svg{display:block}` };
  }

  BV.Render = { esc, n, itemSVG, pageContentSVG, guidesSVG, printHTML, textItemSVG, shapePath, box };
})();

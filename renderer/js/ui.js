/* BV Mudrana: small dialog helpers */
(function () {
  const BV = (window.BV = window.BV || {});
  const root = () => document.getElementById('modal-root');

  // Opens a modal. `build(el)` fills the body. Resolves with the clicked button value (null on cancel).
  function dialog({ title, html = '', buttons = [{ label: 'OK', value: 'ok', primary: true }, { label: 'Cancel', value: null }], onOpen, validate, width }) {
    return new Promise((resolve) => {
      const prevFocus = document.activeElement;
      const dlg = document.createElement('div');
      dlg.className = 'dlg';
      dlg.setAttribute('role', 'dialog');
      dlg.setAttribute('aria-modal', 'true');
      dlg.setAttribute('aria-label', title);
      if (width) dlg.style.width = width + 'px';
      dlg.innerHTML = `<h2>${BV.Render.esc(title)}</h2><div class="dbody">${html}</div><div class="dfoot"></div>`;
      const foot = dlg.querySelector('.dfoot');
      const finish = (v) => {
        if (v !== null && validate) { const err = validate(dlg, v); if (err) { BV.UI.alert(err); return; } }
        dlg.remove();
        document.removeEventListener('keydown', onKey, true);
        if (prevFocus && prevFocus.focus) prevFocus.focus();
        resolve(v === null ? null : { value: v, el: dlg });
      };
      buttons.forEach((b) => {
        const btn = document.createElement('button');
        btn.className = 'btn' + (b.primary ? ' primary' : '');
        btn.textContent = b.label;
        btn.onclick = () => finish(b.value);
        foot.appendChild(btn);
      });
      const onKey = (e) => {
        if (!root().contains(dlg)) return;
        if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); finish(null); }
        else if (e.key === 'Enter' && e.target.tagName !== 'TEXTAREA' && e.target.tagName !== 'BUTTON') {
          const p = buttons.find((b) => b.primary);
          if (p) { e.preventDefault(); e.stopPropagation(); finish(p.value); }
        }
      };
      document.addEventListener('keydown', onKey, true);
      root().appendChild(dlg);
      if (onOpen) onOpen(dlg);
      const first = dlg.querySelector('input,select,textarea') || dlg.querySelector('.btn.primary');
      if (first) { first.focus(); if (first.select) first.select(); }
    });
  }

  const alert = (msg) => dialog({ title: 'BV Mudrana', html: `<p class="note" style="font-size:12px;color:var(--ink)">${BV.Render.esc(msg)}</p>`, buttons: [{ label: 'OK', value: 'ok', primary: true }] });
  const confirm = async (msg, ok = 'OK') => !!(await dialog({ title: 'BV Mudrana', html: `<p class="note" style="font-size:12px;color:var(--ink)">${BV.Render.esc(msg)}</p>`, buttons: [{ label: ok, value: 'ok', primary: true }, { label: 'Cancel', value: null }] }));
  async function prompt(title, label, value = '') {
    const r = await dialog({ title, html: `<div class="row"><label for="pr-v">${BV.Render.esc(label)}</label><input type="text" id="pr-v" value="${BV.Render.esc(value)}"></div>` });
    return r ? r.el.querySelector('#pr-v').value : null;
  }
  const val = (el, id) => el.querySelector('#' + id).value;
  const num = (el, id) => { const v = parseFloat(el.querySelector('#' + id).value); return isNaN(v) ? 0 : v; };
  const checked = (el, id) => el.querySelector('#' + id).checked;

  let toastTimer = 0;
  function status(msg, ms = 4000) {
    const el = document.getElementById('st-msg');
    el.textContent = msg;
    clearTimeout(toastTimer);
    if (ms) toastTimer = setTimeout(() => (el.textContent = ''), ms);
  }

  BV.UI = { dialog, alert, confirm, prompt, val, num, checked, status };
})();

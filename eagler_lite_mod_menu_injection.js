/* EAGLER_LITE_MOD_MENU_V3
 * Browser-level mod menu for a compiled Eaglercraft WASM-GC client.
 * No polling, observers, game-memory access, packet changes, or render loops.
 */
(() => {
  'use strict';
  if (window.__eaglerLiteModMenuV3) return;
  window.__eaglerLiteModMenuV3 = true;

  const STORAGE_KEY = 'eagler-lite-mod-menu-v3';
  const ARMOR_SLOTS = [['helmet', 'H'], ['chestplate', 'C'], ['leggings', 'L'], ['boots', 'B']];
  const defaults = {
    crosshair: false,
    keystrokes: false,
    armorHud: false,
    armorSide: 'right',
    armorScale: 100,
    armor: { helmet: '', chestplate: '', leggings: '', boots: '' },
    accent: '#4bd5ff',
    scale: 100,
    left: null,
    top: 66
  };
  const state = {
    settings: { ...defaults, armor: { ...defaults.armor } },
    panel: null,
    crosshairNode: null,
    keysNode: null,
    armorNode: null,
    keyState: new Set()
  };

  function loadSettings() {
    try {
      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
      state.settings = { ...defaults, ...stored, armor: { ...defaults.armor, ...(stored.armor || {}) } };
    } catch (_) { state.settings = { ...defaults, armor: { ...defaults.armor } }; }
  }

  function saveSettings() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state.settings)); } catch (_) { /* optional persistence */ }
  }

  function escapeText(value) {
    return String(value).replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
  }

  function normalizeArmorValue(value) {
    const digits = String(value || '').replace(/[^0-9]/g, '').slice(0, 5);
    return digits === '' ? '' : String(Math.min(99999, Number(digits)));
  }

  function makeStyle() {
    const style = document.createElement('style');
    style.id = 'eagler-lite-mod-menu-style';
    style.textContent = `
      .elm-panel{position:fixed;z-index:2147483000;width:350px;min-width:285px;min-height:270px;resize:both;overflow:auto;color:#ebf8ff;background:#0a1019eF;border:1px solid var(--elm-accent,#4bd5ff);border-radius:11px;box-shadow:0 18px 52px #000b;font:13px/1.35 Arial,sans-serif;backdrop-filter:blur(5px)}
      .elm-panel[hidden]{display:none}.elm-head{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:11px 12px;cursor:move;background:linear-gradient(90deg,#102333,#0d1420);border-bottom:1px solid #2b5b70;border-radius:11px 11px 0 0}.elm-brand{font-weight:800;letter-spacing:.4px;color:var(--elm-accent,#4bd5ff)}.elm-sub{font-size:10px;color:#91a8b5}.elm-close{border:0;background:transparent;color:#d9f3ff;font-size:18px;cursor:pointer}.elm-body{padding:12px}.elm-section{margin:0 0 12px;padding:10px;border:1px solid #223a4a;background:#071019b8;border-radius:7px}.elm-section h3{margin:0 0 7px;color:#b8e9ff;font-size:11px;letter-spacing:.8px;text-transform:uppercase}.elm-row{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:5px 0}.elm-detail{font-size:11px;color:#8eabba}.elm-toggle{position:relative;display:inline-flex;align-items:center;width:38px;height:20px;border:1px solid #466a7a;border-radius:12px;background:#172531;cursor:pointer}.elm-toggle::after{content:'';position:absolute;left:3px;width:14px;height:14px;border-radius:50%;background:#95aeba;transition:transform .12s}.elm-toggle.on{border-color:var(--elm-accent,#4bd5ff);background:#104a5f}.elm-toggle.on::after{background:#eafaff;transform:translateX(18px)}.elm-select,.elm-color,.elm-number{box-sizing:border-box;padding:5px;color:#e8f7ff;background:#0a141d;border:1px solid #3c6577;border-radius:4px}.elm-color{width:38px;height:26px;padding:1px}.elm-number{width:58px;text-align:right}.elm-actions{display:flex;gap:8px;flex-wrap:wrap}.elm-button{padding:7px 9px;border:1px solid #4f98b8;border-radius:5px;background:#103a4b;color:#e8faff;font:inherit;font-weight:700;cursor:pointer}.elm-button:hover{border-color:var(--elm-accent,#4bd5ff)}.elm-note{margin:0;color:#9ab5c3;font-size:11px}.elm-caution strong{color:#f3d183}.elm-status{min-height:17px;margin-top:7px;color:#87cbe5;font-size:11px}.elm-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:5px 10px}.elm-small-row{display:flex;align-items:center;justify-content:space-between;gap:5px;color:#b9d4df;font-size:11px}
      .elm-crosshair{position:fixed;z-index:2147482990;left:50%;top:50%;width:18px;height:18px;margin:-9px 0 0 -9px;pointer-events:none}.elm-crosshair::before,.elm-crosshair::after{content:'';position:absolute;background:var(--elm-crosshair,#4bd5ff);filter:drop-shadow(0 0 1px #000)}.elm-crosshair::before{left:8px;top:0;width:2px;height:18px}.elm-crosshair::after{left:0;top:8px;width:18px;height:2px}
      .elm-keys{position:fixed;z-index:2147482990;left:14px;bottom:98px;display:grid;grid-template-columns:repeat(3,30px);gap:3px;pointer-events:none}.elm-key{display:grid;place-items:center;height:27px;border:1px solid #426174;background:#0a141dcb;color:#c5dce8;font:bold 11px Arial;border-radius:3px}.elm-key.w{grid-column:2}.elm-key.space{grid-column:1/4}.elm-key.on{border-color:var(--elm-accent,#4bd5ff);background:#126080;color:#fff}
      .elm-armor{position:fixed;z-index:2147482990;top:50%;display:flex;flex-direction:column;gap:4px;pointer-events:none;filter:drop-shadow(1px 1px 0 #000)}.elm-armor-right{right:14px}.elm-armor-left{left:14px}.elm-armor-row{display:grid;grid-template-columns:21px minmax(34px,auto);align-items:center;gap:4px;color:#effbff;font:bold 12px Arial}.elm-armor-slot{display:grid;place-items:center;width:19px;height:19px;border:1px solid var(--elm-accent,#4bd5ff);border-radius:3px;background:#122331;color:var(--elm-accent,#4bd5ff);font-size:10px}.elm-armor-value{min-width:32px;padding:2px 4px;border-radius:3px;background:#071019d9;text-align:right}.elm-armor-value.empty{color:#95aeb8}
    `;
    document.head.appendChild(style);
  }

  function applyAccent() {
    const accent = state.settings.accent || defaults.accent;
    state.panel?.style.setProperty('--elm-accent', accent);
    state.crosshairNode?.style.setProperty('--elm-crosshair', accent);
    state.keysNode?.style.setProperty('--elm-accent', accent);
    state.armorNode?.style.setProperty('--elm-accent', accent);
  }

  function applyScale() {
    if (state.panel) state.panel.style.zoom = `${Math.min(135, Math.max(80, Number(state.settings.scale) || 100))}%`;
  }

  function syncToggle(name) {
    const node = state.panel?.querySelector(`[data-elm-toggle="${name}"]`);
    if (!node) return;
    node.classList.toggle('on', Boolean(state.settings[name]));
    node.setAttribute('aria-checked', String(Boolean(state.settings[name])));
  }

  function ensureCrosshair() {
    if (!state.settings.crosshair) {
      state.crosshairNode?.remove();
      state.crosshairNode = null;
      return;
    }
    if (!state.crosshairNode) {
      state.crosshairNode = document.createElement('div');
      state.crosshairNode.className = 'elm-crosshair';
      state.crosshairNode.setAttribute('aria-hidden', 'true');
      document.body.appendChild(state.crosshairNode);
    }
    applyAccent();
  }

  function refreshKeys() {
    if (!state.keysNode) return;
    for (const keyNode of state.keysNode.querySelectorAll('[data-elm-key]')) keyNode.classList.toggle('on', state.keyState.has(keyNode.dataset.elmKey));
  }

  function ensureKeystrokes() {
    if (!state.settings.keystrokes) {
      state.keysNode?.remove();
      state.keysNode = null;
      return;
    }
    if (!state.keysNode) {
      state.keysNode = document.createElement('div');
      state.keysNode.className = 'elm-keys';
      state.keysNode.setAttribute('aria-hidden', 'true');
      state.keysNode.innerHTML = '<span class="elm-key w" data-elm-key="KeyW">W</span><span class="elm-key" data-elm-key="KeyA">A</span><span class="elm-key" data-elm-key="KeyS">S</span><span class="elm-key" data-elm-key="KeyD">D</span><span class="elm-key space" data-elm-key="Space">SPACE</span>';
      document.body.appendChild(state.keysNode);
    }
    applyAccent();
    refreshKeys();
  }

  function renderArmorHud() {
    if (!state.armorNode) return;
    state.armorNode.className = `elm-armor elm-armor-${state.settings.armorSide === 'left' ? 'left' : 'right'}`;
    state.armorNode.style.zoom = `${Math.min(135, Math.max(80, Number(state.settings.armorScale) || 100))}%`;
    state.armorNode.innerHTML = ARMOR_SLOTS.map(([slot, label]) => {
      const value = normalizeArmorValue(state.settings.armor[slot]);
      return `<div class="elm-armor-row"><span class="elm-armor-slot">${label}</span><span class="elm-armor-value${value ? '' : ' empty'}">${value || '—'}</span></div>`;
    }).join('');
    applyAccent();
  }

  function ensureArmorHud() {
    if (!state.settings.armorHud) {
      state.armorNode?.remove();
      state.armorNode = null;
      return;
    }
    if (!state.armorNode) {
      state.armorNode = document.createElement('div');
      state.armorNode.setAttribute('aria-hidden', 'true');
      document.body.appendChild(state.armorNode);
    }
    renderArmorHud();
  }

  function applyModules() {
    ensureCrosshair();
    ensureKeystrokes();
    ensureArmorHud();
    syncToggle('crosshair');
    syncToggle('keystrokes');
    syncToggle('armorHud');
    applyAccent();
    applyScale();
  }

  function setStatus(text) {
    const status = state.panel?.querySelector('[data-elm-status]');
    if (status) status.textContent = text;
  }

  function setupDrag(header) {
    header.addEventListener('pointerdown', (event) => {
      if (event.button !== 0 || event.target.closest('button,select,input')) return;
      const panel = state.panel;
      const startLeft = panel.offsetLeft;
      const startTop = panel.offsetTop;
      const startX = event.clientX;
      const startY = event.clientY;
      const move = (moveEvent) => {
        panel.style.left = `${Math.max(0, startLeft + moveEvent.clientX - startX)}px`;
        panel.style.top = `${Math.max(0, startTop + moveEvent.clientY - startY)}px`;
        panel.style.right = 'auto';
      };
      const release = () => {
        state.settings.left = Math.round(panel.offsetLeft);
        state.settings.top = Math.round(panel.offsetTop);
        saveSettings();
        document.removeEventListener('pointermove', move);
        document.removeEventListener('pointerup', release);
      };
      document.addEventListener('pointermove', move);
      document.addEventListener('pointerup', release, { once: true });
    });
  }

  async function copySettings() {
    try {
      await navigator.clipboard.writeText(JSON.stringify({ ...state.settings }, null, 2));
      setStatus('Menu settings copied.');
    } catch (_) { setStatus('Copy is unavailable in this browser context.'); }
  }

  function fullScreen() {
    const target = document.documentElement;
    if (!document.fullscreenElement) target.requestFullscreen?.().catch(() => setStatus('Fullscreen was blocked by the browser.'));
    else document.exitFullscreen?.();
  }

  function armorInputsMarkup() {
    return ARMOR_SLOTS.map(([slot, label]) => `<label class="elm-small-row"><span>${label} manual value</span><input class="elm-number" data-elm-armor="${slot}" inputmode="numeric" maxlength="5" value="${escapeText(normalizeArmorValue(state.settings.armor[slot]))}" placeholder="—"></label>`).join('');
  }

  function buildPanel() {
    if (state.panel) return state.panel;
    loadSettings();
    makeStyle();
    const panel = document.createElement('section');
    panel.className = 'elm-panel';
    panel.hidden = true;
    panel.setAttribute('aria-label', 'Eagler Lite mod menu');
    panel.innerHTML = `
      <div class="elm-head"><div><div class="elm-brand">EAGLER LITE</div><div class="elm-sub">Browser modules · Right Shift</div></div><button class="elm-close" type="button" title="Close">×</button></div>
      <div class="elm-body">
        <section class="elm-section"><h3>Working browser modules</h3>
          <div class="elm-row"><div><strong>Custom Crosshair</strong><div class="elm-detail">Center-screen browser crosshair</div></div><button class="elm-toggle" data-elm-toggle="crosshair" type="button" role="switch" aria-checked="false"></button></div>
          <div class="elm-row"><div><strong>Keystrokes</strong><div class="elm-detail">WASD and Space key display</div></div><button class="elm-toggle" data-elm-toggle="keystrokes" type="button" role="switch" aria-checked="false"></button></div>
          <div class="elm-row"><div><strong>Armor HUD</strong><div class="elm-detail">Four-slot manual armor tracker</div></div><button class="elm-toggle" data-elm-toggle="armorHud" type="button" role="switch" aria-checked="false"></button></div>
        </section>
        <section class="elm-section"><h3>Armor HUD options</h3>
          <div class="elm-row"><span>Side</span><select class="elm-select" data-elm-armor-side><option value="right">Right</option><option value="left">Left</option></select></div>
          <div class="elm-row"><span>HUD scale</span><select class="elm-select" data-elm-armor-scale><option value="80">80%</option><option value="90">90%</option><option value="100">100%</option><option value="110">110%</option><option value="125">125%</option><option value="135">135%</option></select></div>
          <div class="elm-grid">${armorInputsMarkup()}</div>
          <p class="elm-note elm-caution"><strong>Manual values only:</strong> this compiled client cannot read equipped armor or durability. Enter the displayed values yourself; blanks show “—”.</p>
        </section>
        <section class="elm-section"><h3>Menu customize</h3>
          <div class="elm-row"><span>Accent color</span><input class="elm-color" data-elm-accent type="color" value="${escapeText(state.settings.accent)}"></div>
          <div class="elm-row"><span>Menu scale</span><select class="elm-select" data-elm-scale><option value="80">80%</option><option value="90">90%</option><option value="100">100%</option><option value="110">110%</option><option value="125">125%</option><option value="135">135%</option></select></div>
          <p class="elm-note">Drag the title bar to move the menu. Drag its lower-right corner to resize it.</p>
        </section>
        <section class="elm-section elm-caution"><h3>Game-data boundary</h3><p class="elm-note"><strong>Total XP:</strong> unavailable as live browser data in this compiled client. The native game still renders its own XP bar and level.</p></section>
        <div class="elm-actions"><button class="elm-button" data-elm-fullscreen type="button">Fullscreen</button><button class="elm-button" data-elm-copy type="button">Copy Settings</button></div><div class="elm-status" data-elm-status>Ready. Modules update only from user input events.</div>
      </div>`;
    document.body.appendChild(panel);
    state.panel = panel;
    if (Number.isFinite(state.settings.left)) { panel.style.left = `${state.settings.left}px`; panel.style.right = 'auto'; }
    panel.style.top = `${Number(state.settings.top) || defaults.top}px`;
    const scale = panel.querySelector('[data-elm-scale]');
    const armorSide = panel.querySelector('[data-elm-armor-side]');
    const armorScale = panel.querySelector('[data-elm-armor-scale]');
    scale.value = String(state.settings.scale);
    armorSide.value = state.settings.armorSide === 'left' ? 'left' : 'right';
    armorScale.value = String(state.settings.armorScale);
    setupDrag(panel.querySelector('.elm-head'));
    panel.querySelector('.elm-close').addEventListener('click', () => { panel.hidden = true; });
    panel.querySelector('[data-elm-fullscreen]').addEventListener('click', fullScreen);
    panel.querySelector('[data-elm-copy]').addEventListener('click', copySettings);
    for (const button of panel.querySelectorAll('[data-elm-toggle]')) {
      button.addEventListener('click', () => {
        const key = button.dataset.elmToggle;
        state.settings[key] = !state.settings[key];
        saveSettings();
        applyModules();
      });
    }
    panel.querySelector('[data-elm-accent]').addEventListener('input', (event) => {
      state.settings.accent = event.target.value;
      saveSettings();
      applyAccent();
    });
    scale.addEventListener('change', (event) => {
      state.settings.scale = Number(event.target.value);
      saveSettings();
      applyScale();
    });
    armorSide.addEventListener('change', (event) => {
      state.settings.armorSide = event.target.value === 'left' ? 'left' : 'right';
      saveSettings();
      renderArmorHud();
    });
    armorScale.addEventListener('change', (event) => {
      state.settings.armorScale = Number(event.target.value);
      saveSettings();
      renderArmorHud();
    });
    for (const input of panel.querySelectorAll('[data-elm-armor]')) {
      input.addEventListener('input', (event) => {
        const slot = event.target.dataset.elmArmor;
        const value = normalizeArmorValue(event.target.value);
        event.target.value = value;
        state.settings.armor[slot] = value;
        saveSettings();
        renderArmorHud();
      });
    }
    applyModules();
    return panel;
  }

  function toggleMenu() {
    const panel = buildPanel();
    panel.hidden = !panel.hidden;
  }

  window.addEventListener('keydown', (event) => {
    if (event.code === 'ShiftRight' && !event.repeat) {
      const target = event.target;
      if (!(target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT'))) toggleMenu();
    }
    if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'Space'].includes(event.code)) {
      state.keyState.add(event.code);
      refreshKeys();
    }
  }, { passive: true });

  window.addEventListener('keyup', (event) => {
    if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'Space'].includes(event.code)) {
      state.keyState.delete(event.code);
      refreshKeys();
    }
  }, { passive: true });

  window.EaglerLiteModMenu = { version: '3.0.0-manual-armor', toggle: toggleMenu, close: () => { if (state.panel) state.panel.hidden = true; } };
})();

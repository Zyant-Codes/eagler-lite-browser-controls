/* EAGLER_LITE_MOD_MENU_V2
 * Browser-level mod menu for a compiled Eaglercraft WASM-GC client.
 * No polling, observers, game-memory access, packet changes, or render loops.
 */
(() => {
  'use strict';
  if (window.__eaglerLiteModMenuV2) return;
  window.__eaglerLiteModMenuV2 = true;

  const STORAGE_KEY = 'eagler-lite-mod-menu-v2';
  const defaults = {
    crosshair: false,
    keystrokes: false,
    accent: '#4bd5ff',
    scale: 100,
    left: null,
    top: 66
  };
  const state = {
    settings: { ...defaults },
    panel: null,
    crosshairNode: null,
    keysNode: null,
    keyState: new Set()
  };

  function loadSettings() {
    try {
      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
      state.settings = { ...defaults, ...stored };
    } catch (_) { state.settings = { ...defaults }; }
  }

  function saveSettings() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state.settings)); } catch (_) { /* optional persistence */ }
  }

  function escapeText(value) {
    return String(value).replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
  }

  function makeStyle() {
    const style = document.createElement('style');
    style.id = 'eagler-lite-mod-menu-style';
    style.textContent = `
      .elm-panel{position:fixed;z-index:2147483000;width:350px;min-width:285px;min-height:270px;resize:both;overflow:auto;color:#ebf8ff;background:#0a1019eF;border:1px solid var(--elm-accent,#4bd5ff);border-radius:11px;box-shadow:0 18px 52px #000b;font:13px/1.35 Arial,sans-serif;backdrop-filter:blur(5px)}
      .elm-panel[hidden]{display:none}.elm-head{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:11px 12px;cursor:move;background:linear-gradient(90deg,#102333,#0d1420);border-bottom:1px solid #2b5b70;border-radius:11px 11px 0 0}.elm-brand{font-weight:800;letter-spacing:.4px;color:var(--elm-accent,#4bd5ff)}.elm-sub{font-size:10px;color:#91a8b5}.elm-close{border:0;background:transparent;color:#d9f3ff;font-size:18px;cursor:pointer}.elm-body{padding:12px}.elm-section{margin:0 0 12px;padding:10px;border:1px solid #223a4a;background:#071019b8;border-radius:7px}.elm-section h3{margin:0 0 7px;color:#b8e9ff;font-size:11px;letter-spacing:.8px;text-transform:uppercase}.elm-row{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:5px 0}.elm-detail{font-size:11px;color:#8eabba}.elm-toggle{position:relative;display:inline-flex;align-items:center;width:38px;height:20px;border:1px solid #466a7a;border-radius:12px;background:#172531;cursor:pointer}.elm-toggle::after{content:'';position:absolute;left:3px;width:14px;height:14px;border-radius:50%;background:#95aeba;transition:transform .12s}.elm-toggle.on{border-color:var(--elm-accent,#4bd5ff);background:#104a5f}.elm-toggle.on::after{background:#eafaff;transform:translateX(18px)}.elm-select,.elm-color{box-sizing:border-box;padding:5px;color:#e8f7ff;background:#0a141d;border:1px solid #3c6577;border-radius:4px}.elm-color{width:38px;height:26px;padding:1px}.elm-actions{display:flex;gap:8px;flex-wrap:wrap}.elm-button{padding:7px 9px;border:1px solid #4f98b8;border-radius:5px;background:#103a4b;color:#e8faff;font:inherit;font-weight:700;cursor:pointer}.elm-button:hover{border-color:var(--elm-accent,#4bd5ff)}.elm-note{margin:0;color:#9ab5c3;font-size:11px}.elm-disabled{opacity:.55}.elm-disabled strong{color:#f3d183}.elm-status{min-height:17px;margin-top:7px;color:#87cbe5;font-size:11px}
      .elm-crosshair{position:fixed;z-index:2147482990;left:50%;top:50%;width:18px;height:18px;margin:-9px 0 0 -9px;pointer-events:none}.elm-crosshair::before,.elm-crosshair::after{content:'';position:absolute;background:var(--elm-crosshair,#4bd5ff);filter:drop-shadow(0 0 1px #000)}.elm-crosshair::before{left:8px;top:0;width:2px;height:18px}.elm-crosshair::after{left:0;top:8px;width:18px;height:2px}
      .elm-keys{position:fixed;z-index:2147482990;left:14px;bottom:98px;display:grid;grid-template-columns:repeat(3,30px);gap:3px;pointer-events:none}.elm-key{display:grid;place-items:center;height:27px;border:1px solid #426174;background:#0a141dcb;color:#c5dce8;font:bold 11px Arial;border-radius:3px}.elm-key.w{grid-column:2}.elm-key.space{grid-column:1/4}.elm-key.on{border-color:var(--elm-accent,#4bd5ff);background:#126080;color:#fff}
    `;
    document.head.appendChild(style);
  }

  function applyAccent() {
    const accent = state.settings.accent || defaults.accent;
    state.panel?.style.setProperty('--elm-accent', accent);
    state.crosshairNode?.style.setProperty('--elm-crosshair', accent);
    state.keysNode?.style.setProperty('--elm-accent', accent);
  }

  function applyScale() {
    if (!state.panel) return;
    state.panel.style.zoom = `${Math.min(135, Math.max(80, Number(state.settings.scale) || 100))}%`;
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
    for (const keyNode of state.keysNode.querySelectorAll('[data-elm-key]')) {
      keyNode.classList.toggle('on', state.keyState.has(keyNode.dataset.elmKey));
    }
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

  function applyModules() {
    ensureCrosshair();
    ensureKeystrokes();
    syncToggle('crosshair');
    syncToggle('keystrokes');
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
    const safe = { ...state.settings };
    try {
      await navigator.clipboard.writeText(JSON.stringify(safe, null, 2));
      setStatus('Menu settings copied.');
    } catch (_) {
      setStatus('Copy is unavailable in this browser context.');
    }
  }

  function fullScreen() {
    const target = document.documentElement;
    if (!document.fullscreenElement) target.requestFullscreen?.().catch(() => setStatus('Fullscreen was blocked by the browser.'));
    else document.exitFullscreen?.();
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
        </section>
        <section class="elm-section"><h3>Customize</h3>
          <div class="elm-row"><span>Accent color</span><input class="elm-color" data-elm-accent type="color" value="${escapeText(state.settings.accent)}"></div>
          <div class="elm-row"><span>Menu scale</span><select class="elm-select" data-elm-scale><option value="80">80%</option><option value="90">90%</option><option value="100">100%</option><option value="110">110%</option><option value="125">125%</option><option value="135">135%</option></select></div>
          <p class="elm-note">Drag the title bar to move it. Drag the lower-right corner to resize it.</p>
        </section>
        <section class="elm-section elm-disabled"><h3>Game-data modules</h3>
          <p class="elm-note"><strong>Armor HUD / total XP:</strong> not available in this compiled client. The page has no supported access to live inventory, durability, or experience values, so no fake values are shown.</p>
        </section>
        <div class="elm-actions"><button class="elm-button" data-elm-fullscreen type="button">Fullscreen</button><button class="elm-button" data-elm-copy type="button">Copy Settings</button></div><div class="elm-status" data-elm-status>Ready. Modules update only from events.</div>
      </div>`;
    document.body.appendChild(panel);
    state.panel = panel;
    if (Number.isFinite(state.settings.left)) { panel.style.left = `${state.settings.left}px`; panel.style.right = 'auto'; }
    panel.style.top = `${Number(state.settings.top) || defaults.top}px`;
    const scale = panel.querySelector('[data-elm-scale]');
    scale.value = String(state.settings.scale);
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

  window.EaglerLiteModMenu = { version: '2.0.0', toggle: toggleMenu, close: () => { if (state.panel) state.panel.hidden = true; } };
})();

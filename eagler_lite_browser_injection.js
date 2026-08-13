/*
 * Eagler Lite Browser Controls v1
 * Browser-level overlay only. It does not access the compiled game's renderer,
 * entities, network session, input handling, or server packets.
 */
(function () {
  'use strict';
  if (window.__eaglerLiteBrowserControlsV1) return;
  window.__eaglerLiteBrowserControlsV1 = true;

  var STORE = 'eagler-lite-browser-controls-v1';
  var state = {
    fpsWidget: false,
    compactMenu: true,
    panelWidth: 338,
    panelHeight: 470
  };
  try {
    Object.assign(state, JSON.parse(localStorage.getItem(STORE) || '{}'));
  } catch (_) {}

  var panel = null;
  var fpsWidget = null;
  var fpsLoopActive = false;
  var observer = null;
  var lastFrameTime = 0;
  var fpsFrames = 0;
  var measuredFps = 0;

  function save() {
    try { localStorage.setItem(STORE, JSON.stringify(state)); } catch (_) {}
  }

  function setText(id, value) {
    var el = document.getElementById(id);
    if (el) el.textContent = value;
  }

  function renderToggle(id, enabled) {
    var toggle = document.getElementById(id);
    if (!toggle) return;
    toggle.setAttribute('aria-checked', enabled ? 'true' : 'false');
    toggle.classList.toggle('elbc-on', enabled);
  }

  function addStyle() {
    if (document.getElementById('elbc-style')) return;
    var style = document.createElement('style');
    style.id = 'elbc-style';
    style.textContent = [
      '#elbc-panel,#elbc-fps{box-sizing:border-box;font-family:Arial,Helvetica,sans-serif;color:#e8f7ff}',
      '#elbc-panel{display:none;position:fixed;z-index:2147483647;right:14px;top:52px;width:338px;height:470px;min-width:270px;min-height:300px;max-width:calc(100vw - 28px);max-height:calc(100vh - 66px);resize:both;overflow:auto;background:#0b121d;border:1px solid #2d9dd2;border-radius:10px;box-shadow:0 18px 48px rgba(0,0,0,.58);font-size:13px;line-height:1.35}',
      '#elbc-panel.elbc-open{display:block}',
      '#elbc-head{display:flex;align-items:center;justify-content:space-between;padding:10px 12px;background:#102a3a;border-bottom:1px solid #1f698b;position:sticky;top:0;z-index:2}',
      '#elbc-title{font-weight:700;letter-spacing:.2px;color:#7fe6ff}#elbc-sub{font-size:11px;color:#9db8c8}',
      '#elbc-close{background:transparent;border:0;color:#e8f7ff;font-size:20px;cursor:pointer;line-height:18px}',
      '#elbc-body{padding:10px}.elbc-tabs{display:flex;gap:5px;margin-bottom:10px}.elbc-tab{border:1px solid #24526a;background:#10202c;color:#b8d5e4;border-radius:5px;padding:5px 8px;font:inherit;cursor:pointer}.elbc-tab.elbc-active{background:#1b6b90;border-color:#6ad9ff;color:#fff}',
      '.elbc-page{display:none}.elbc-page.elbc-active{display:block}.elbc-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px}.elbc-card{background:#101c27;border:1px solid #1c3c4e;border-radius:7px;padding:9px;min-height:88px}.elbc-card h3{font-size:12px;margin:0 0 4px;color:#83deff}.elbc-card p{margin:0;color:#a7bcc8;font-size:11px}.elbc-row{display:flex;align-items:center;justify-content:space-between;gap:7px;margin-top:8px}',
      '.elbc-switch{width:34px;height:18px;border-radius:10px;border:1px solid #5a7584;background:#263944;cursor:pointer;position:relative;flex:0 0 auto}.elbc-switch:after{content:"";position:absolute;width:12px;height:12px;border-radius:50%;background:#d8e7ee;left:2px;top:2px}.elbc-switch.elbc-on{background:#1676a0;border-color:#66dfff}.elbc-switch.elbc-on:after{left:18px;background:#fff}',
      '.elbc-button{border:1px solid #2f8fb9;background:#144c68;color:#effaff;border-radius:5px;padding:6px 8px;font:inherit;font-size:12px;cursor:pointer}.elbc-button:hover{background:#1b6082}.elbc-note{margin-top:9px;padding:8px;background:#0d2532;border-left:3px solid #47c9f3;color:#bde7f5;font-size:11px}.elbc-list{padding-left:17px;margin:5px 0}.elbc-list li{margin:3px 0}',
      '#elbc-fps{display:none;position:fixed;z-index:2147483646;top:9px;left:10px;border:1px solid #3bbfe8;border-radius:4px;background:rgba(6,15,22,.84);padding:4px 7px;font-size:12px;font-weight:700;text-shadow:1px 1px 0 #000;pointer-events:none}',
      '#elbc-fps.elbc-visible{display:block}'
    ].join('');
    document.head.appendChild(style);
  }

  function buildPanel() {
    if (!document.body || (panel && document.body.contains(panel))) return;
    addStyle();
    panel = document.createElement('section');
    panel.id = 'elbc-panel';
    panel.tabIndex = -1;
    panel.style.width = state.panelWidth + 'px';
    panel.style.height = state.panelHeight + 'px';
    panel.setAttribute('aria-label', 'Eagler Lite Browser Controls');
    panel.innerHTML =
      '<header id="elbc-head"><div><div id="elbc-title">Eagler Lite Controls</div><div id="elbc-sub">Browser-level controls · Right Shift</div></div><button id="elbc-close" aria-label="Close">×</button></header>' +
      '<main id="elbc-body">' +
        '<nav class="elbc-tabs" aria-label="Menu pages">' +
          '<button class="elbc-tab elbc-active" data-elbc-page="performance">Performance</button>' +
          '<button class="elbc-tab" data-elbc-page="display">Display</button>' +
          '<button class="elbc-tab" data-elbc-page="about">About</button>' +
        '</nav>' +
        '<div class="elbc-page elbc-active" data-elbc-view="performance"><div class="elbc-grid">' +
          '<article class="elbc-card"><h3>Browser FPS</h3><p>Shows a browser-frame estimate only when enabled.</p><div class="elbc-row"><span id="elbc-fps-value">Off</span><button id="elbc-fps-switch" class="elbc-switch" role="switch" aria-checked="false" aria-label="Toggle browser FPS display"></button></div></article>' +
          '<article class="elbc-card"><h3>Full Screen</h3><p>Uses Chrome full screen for more display room.</p><div class="elbc-row"><button id="elbc-fullscreen" class="elbc-button">Enter Full Screen</button></div></article>' +
          '<article class="elbc-card"><h3>Native FPS Profile</h3><p>Copies the lightest normal-quality game settings.</p><div class="elbc-row"><button id="elbc-copy-profile" class="elbc-button">Copy Settings</button></div></article>' +
          '<article class="elbc-card"><h3>UI Motion</h3><p>No animated cards, live HUD, polling, or background timers.</p><div class="elbc-row"><span>Always low overhead</span></div></article>' +
        '</div><div class="elbc-note">The built-in game renderer is compiled separately. This injection cannot truthfully toggle in-game particles, rain, glint, FOV, entity modules, shield/crystal logic, or ping.</div></div>' +
        '<div class="elbc-page" data-elbc-view="display"><div class="elbc-grid">' +
          '<article class="elbc-card"><h3>Compact Menu</h3><p>Reduces panel copy and card height.</p><div class="elbc-row"><span id="elbc-compact-value">On</span><button id="elbc-compact-switch" class="elbc-switch" role="switch" aria-checked="false" aria-label="Toggle compact menu"></button></div></article>' +
          '<article class="elbc-card"><h3>Resizable Panel</h3><p>Drag the lower-right panel corner to resize it.</p><div class="elbc-row"><span>Native CSS resize</span></div></article>' +
        '</div><div class="elbc-note">For real low fire and small held items, use an actual compatible resource pack. Those visual assets cannot be forced into the compiled runtime by a page script.</div></div>' +
        '<div class="elbc-page" data-elbc-view="about"><h3 style="margin:0 0 6px;color:#83deff">What this injection is</h3><p>This is a self-contained browser overlay injected before the closing head tag. It has one Right Shift listener and starts the browser FPS sampler only if you enable the FPS widget.</p><ul class="elbc-list"><li>No game-state reader</li><li>No packet/network access</li><li>No automated movement or clicks</li><li>No persistent animation loop while disabled</li></ul></div>' +
      '</main>';
    document.body.appendChild(panel);

    fpsWidget = document.createElement('div');
    fpsWidget.id = 'elbc-fps';
    fpsWidget.textContent = 'Browser FPS: —';
    document.body.appendChild(fpsWidget);

    document.getElementById('elbc-close').addEventListener('click', function () { panel.classList.remove('elbc-open'); });
    document.getElementById('elbc-fps-switch').addEventListener('click', function () { state.fpsWidget = !state.fpsWidget; applyState(); save(); });
    document.getElementById('elbc-fullscreen').addEventListener('click', function () {
      if (document.fullscreenElement) document.exitFullscreen && document.exitFullscreen();
      else if (document.documentElement.requestFullscreen) document.documentElement.requestFullscreen().catch(function () {});
    });
    document.getElementById('elbc-copy-profile').addEventListener('click', function () {
      var text = 'Render distance 4–6; Fast graphics; Smooth lighting Off; Clouds Off; Particles Minimal; Entity distance 50%; Mipmap 0; V-Sync Off; 60 FPS cap.';
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).catch(function () {});
    });
    document.getElementById('elbc-compact-switch').addEventListener('click', function () { state.compactMenu = !state.compactMenu; applyState(); save(); });
    Array.prototype.forEach.call(panel.querySelectorAll('.elbc-tab'), function (tab) {
      tab.addEventListener('click', function () {
        var page = tab.getAttribute('data-elbc-page');
        Array.prototype.forEach.call(panel.querySelectorAll('.elbc-tab'), function (item) { item.classList.toggle('elbc-active', item === tab); });
        Array.prototype.forEach.call(panel.querySelectorAll('.elbc-page'), function (item) { item.classList.toggle('elbc-active', item.getAttribute('data-elbc-view') === page); });
      });
    });
    new ResizeObserver(function () {
      state.panelWidth = Math.round(panel.getBoundingClientRect().width);
      state.panelHeight = Math.round(panel.getBoundingClientRect().height);
      save();
    }).observe(panel);
    applyState();
  }

  function applyState() {
    renderToggle('elbc-fps-switch', state.fpsWidget);
    renderToggle('elbc-compact-switch', state.compactMenu);
    setText('elbc-fps-value', state.fpsWidget ? (measuredFps ? measuredFps + ' FPS' : 'Measuring…') : 'Off');
    setText('elbc-compact-value', state.compactMenu ? 'On' : 'Off');
    if (panel) panel.classList.toggle('elbc-compact', state.compactMenu);
    if (fpsWidget) fpsWidget.classList.toggle('elbc-visible', state.fpsWidget);
    if (state.fpsWidget) startFpsLoop();
  }

  function startFpsLoop() {
    if (fpsLoopActive) return;
    fpsLoopActive = true;
    lastFrameTime = performance.now();
    fpsFrames = 0;
    function frame(now) {
      if (!state.fpsWidget) { fpsLoopActive = false; return; }
      fpsFrames++;
      if (now - lastFrameTime >= 1000) {
        measuredFps = Math.round((fpsFrames * 1000) / (now - lastFrameTime));
        fpsFrames = 0;
        lastFrameTime = now;
        if (fpsWidget) fpsWidget.textContent = 'Browser FPS: ' + measuredFps;
        setText('elbc-fps-value', measuredFps + ' FPS');
      }
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }

  function mount() {
    buildPanel();
  }

  function togglePanel() {
    mount();
    if (!panel) return;
    panel.classList.toggle('elbc-open');
    if (panel.classList.contains('elbc-open')) panel.focus();
  }

  window.addEventListener('keydown', function (event) {
    if (event.code === 'ShiftRight' && !event.repeat) {
      togglePanel();
      event.preventDefault();
      event.stopPropagation();
    }
  }, true);

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount, { once: true }); else mount();
  window.addEventListener('load', function () {
    mount();
    observer = new MutationObserver(function () { mount(); });
    observer.observe(document.documentElement, { childList: true, subtree: true });
    window.setTimeout(function () { if (observer) observer.disconnect(); }, 5000);
  }, { once: true });
}());

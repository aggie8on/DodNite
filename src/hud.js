// DOM heads-up display drawn in "pen" style (multiplied over the paper canvas).
export class HUD {
  constructor(root) {
    this.root = root;
    root.innerHTML = `
      <div class="scope" id="scope"><div class="mask"></div><div class="ring"></div><div class="cx"></div><div class="cy"></div><div class="dot"></div></div>
      <div class="focus-meter" id="focusmeter"><div class="fm-label">EDGE</div><div class="fm-tube"><div class="fm-fill" id="fmfill"></div><i class="fm-f1"></i><i class="fm-f2"></i><i class="fm-f3"></i></div><div class="fm-ready" id="fmready">EDGE READY</div></div>
      <div class="focus-mark" id="focusmark"><i></i><i></i><i></i><i></i></div>
      <div class="crosshair" id="crosshair"><i class="ch-t"></i><i class="ch-b"></i><i class="ch-l"></i><i class="ch-r"></i><i class="ch-dot"></i></div>
      <div class="grapple-ret" id="gret"></div><div class="gstam" id="gstam" hidden><i id="gstamfill"></i></div>
      <div class="hitmarker" id="hitmarker"><i></i><i></i></div>
      <div class="dmg-ind" id="dmg"></div>
      <div class="hud-tl"><div class="score">POINTS <b id="score">0</b></div><div class="combo" id="combo"></div></div>
      <div class="hud-tr"><div class="wave">ROUND <b id="wave">1</b></div><div class="modifier" id="modifier"></div><div class="left"><b id="left">0</b>  THREATS</div><div class="timer" id="timer"></div><div class="pvpscore" id="pvpscore" hidden></div></div><div class="board" id="board" hidden></div>
      <div class="bossbar" id="bossbar"><div class="bossname" id="bossname"></div><div class="bar big"><div class="fill red" id="bossfill"></div></div></div>
      <div class="hud-bl">
        <div class="health"><span>VITAL</span><div class="bar"><div class="fill" id="hpfill"></div></div><span id="hpnum">100</span></div>
        <div class="ammo"><b id="mag">30</b><span id="reserve">/120</span><span class="reloading" id="reloading"></span><span class="nades" id="nades" title="Charges"></span></div>
        <div class="tally" id="tally"></div>
      </div>
      <div class="hud-br"><div class="slots" id="slots"></div><div class="weapon" id="weapon">Pulse Carbine</div><div class="hint" id="hint"></div></div>
      <div class="tip" id="tip"></div>
      <div class="message"><div class="msg-main" id="msg"></div><div class="msg-sub" id="msgsub"></div></div>
      <div class="killfeed" id="killfeed"></div>
      <div class="screen" id="screen"><div class="panel" id="panel"></div></div>`;
    const q = (id) => root.querySelector('#' + id);
    this.el = { crosshair: q('crosshair'), gret: q('gret'), hitmarker: q('hitmarker'), dmg: q('dmg'), score: q('score'), combo: q('combo'), wave: q('wave'), modifier: q('modifier'), left: q('left'), timer: q('timer'), hpfill: q('hpfill'), hpnum: q('hpnum'), mag: q('mag'), reserve: q('reserve'), reloading: q('reloading'), tally: q('tally'), weapon: q('weapon'), hint: q('hint'), slots: q('slots'), tip: q('tip'), msg: q('msg'), msgsub: q('msgsub'), killfeed: q('killfeed'), screen: q('screen'), panel: q('panel'), nades: q('nades'), scope: q('scope'), focusmark: q('focusmark'), focusmeter: q('focusmeter'), fmfill: q('fmfill'), bossbar: q('bossbar'), bossname: q('bossname'), bossfill: q('bossfill'), pvpscore: q('pvpscore'), board: q('board'), gstam: q('gstam'), gstamfill: q('gstamfill') };
    this._msgT = 0; this._scope = false; this._nades = -1; this._pad = false; this.onDevice = null; this._fmShow = false; this._fmFrac = -1; this._fmReady = false; this._lastTally = -1; this._lastSlots = ''; this._ads = false; this._mode = ''; this.onScreenClick = null; this._tipT = 0;
    this.el.screen.addEventListener('click', () => { if (this.onScreenClick) this.onScreenClick(); });
  }
  // katana charge gauge: fills with katana kills, catches fire when a focus slash is ready
  setFocusMeter(show, frac, ready, label = 'Katana') {
    const m = this.el.focusmeter;
    if (show !== this._fmShow) { this._fmShow = show; m.classList.toggle('on', show); }
    if (!show) return;
    if (label !== this._fmLabel) { this._fmLabel = label; m.querySelector('.fm-label').textContent = label; }
    const f = Math.max(0, Math.min(1, frac));
    if (Math.abs(f - (this._fmFrac ?? -1)) > 0.005) { this._fmFrac = f; this.el.fmfill.style.height = (f * 100).toFixed(1) + '%'; }
    if (ready !== this._fmReady) { this._fmReady = ready; m.classList.toggle('ready', ready); }
  }
  setGrenades(n) { if (n === this._nades) return; this._nades = n; let h = ''; for (let i = 0; i < n; i++) h += '<i></i>'; this.el.nades.innerHTML = h; }
  // control labels follow whatever you touched last
  setDevice(pad) { if (pad === this._pad) return; this._pad = pad; this.root.classList.toggle('pad', pad); if (this.onDevice) this.onDevice(pad); }
  key(action) { return (this._pad ? PAD_KEYS : KB_KEYS)[action] || action; }
  setScope(on) { if (on === this._scope) return; this._scope = on; this.el.scope.classList.toggle('on', on); }
  setFocusMark(x, y) {
    const m = this.el.focusmark;
    if (x == null) { m.classList.remove('on'); return; }
    m.classList.add('on'); m.style.transform = `translate(${x.toFixed(0)}px, ${y.toFixed(0)}px)`;
  }
  setSpread(px) { this.el.crosshair.style.setProperty('--s', px.toFixed(1) + 'px'); }
  setCrosshairMode(mode) { this._mode = mode; this._applyCross(); }
  setAds(on) { if (on === this._ads) return; this._ads = on; this._applyCross(); }
  _applyCross() { this.el.crosshair.className = 'crosshair ' + this._mode + (this._ads ? ' ads' : ''); }
  setGrappleStamina(f) { const show = f < 0.995; if (this.el.gstam.hidden === show) this.el.gstam.hidden = !show; if (show) { this.el.gstamfill.style.width = (f * 100).toFixed(0) + '%'; this.el.gstam.classList.toggle('low', f < 0.2); } }
  grappleTarget(state) { this.el.gret.className = 'grapple-ret' + (state === 1 ? ' on' : state === 2 ? ' on attached' : ''); }
  hitmarker(kill = false, crit = false) { const h = this.el.hitmarker; h.className = 'hitmarker' + (kill ? ' kill' : '') + (crit ? ' crit' : ''); void h.offsetWidth; h.classList.add('show'); }
  setAmmo(mag, reserve, magSize, reloading = false) {
    this.el.mag.textContent = mag; this.el.reserve.textContent = '/' + reserve; this.el.reloading.textContent = reloading ? ' Reloading…' : '';
    if (mag !== this._lastTally) { this._lastTally = mag; let s = ''; for (let i = 0; i < Math.min(mag, 40); i++) s += '<i></i>'; this.el.tally.innerHTML = s; }
  }
  setKatana() { this.el.mag.textContent = '∞'; this.el.reserve.textContent = ''; this.el.reloading.textContent = ''; if (this._lastTally !== -1) { this.el.tally.innerHTML = ''; this._lastTally = -1; } }
  setSlots(slots) {
    const key = slots.map((s) => `${s.name}|${s.active ? 1 : 0}|${s.ammo}`).join(';'); if (key === this._lastSlots) return; this._lastSlots = key;
    this.el.slots.innerHTML = slots.map((s, i) => `<div class="slot${s.active ? ' active' : ''}${s.empty ? ' empty' : ''}"><span class="num">${i + 1}</span>${s.name}<span class="sammo">${s.ammo}</span></div>`).join('');
  }
  setHealth(hp, max) { const f = Math.max(0, hp / max); this.el.hpfill.style.width = (f * 100).toFixed(1) + '%'; this.el.hpnum.textContent = Math.ceil(hp); this.root.classList.toggle('low', f < 0.3); }
  setBoard(html) { const on = !!html; this.el.board.hidden = !on; if (on) this.el.board.innerHTML = html; }
  setPvpScore(html) { const on = !!html; this.el.pvpscore.hidden = !on; if (on) this.el.pvpscore.innerHTML = html; this.el.wave.parentElement.hidden = on; this.el.left.parentElement.hidden = on; }
  setWave(n, left) { this.el.wave.textContent = n; this.el.left.textContent = left; }
  setModifier(text) { this.el.modifier.textContent = text || ''; }
  setTimer(text) { this.el.timer.textContent = text || ''; }
  setScore(score, combo) { this.el.score.textContent = score; this.el.combo.textContent = combo > 1 ? 'Combo x' + combo : ''; }
  setWeapon(name, hint) { this.el.weapon.textContent = name; this.el.hint.textContent = hint || ''; }
  setBoss(name, frac) { if (frac == null) { this.el.bossbar.classList.remove('show'); return; } this.el.bossbar.classList.add('show'); this.el.bossname.textContent = name; this.el.bossfill.style.width = (Math.max(0, frac) * 100).toFixed(1) + '%'; }
  tip(text, dur = 5) { this.el.tip.innerHTML = text; this.el.tip.classList.add('show'); this._tipT = dur; }
  message(main, sub = '', dur = 2.2) { const m = this.el.msg; m.textContent = main; m.classList.remove('show'); void m.offsetWidth; m.classList.add('show'); this.el.msgsub.textContent = sub; this._msgT = dur; }
  kill(text, pts) {
    const d = document.createElement('div'); d.innerHTML = pts > 0 ? `${text} <span class="pts">+${pts}</span>` : text; this.el.killfeed.appendChild(d);
    setTimeout(() => d.remove(), 1700); while (this.el.killfeed.children.length > 6) this.el.killfeed.firstChild.remove();
  }
  damageFrom(angle) { const i = document.createElement('i'); i.style.transform = `rotate(${(angle * 180 / Math.PI).toFixed(1)}deg)`; this.el.dmg.appendChild(i); setTimeout(() => i.remove(), 1000); }
  showScreen(html) { this.el.panel.innerHTML = html; this.el.screen.classList.add('show'); }
  hideScreen() { this.el.screen.classList.remove('show'); }
  setGameplayVisible(v) { this.root.classList.toggle('nogame', !v); }
  update(dt) {
    if (this._msgT > 0) { this._msgT -= dt; if (this._msgT <= 0) { this.el.msg.classList.remove('show'); this.el.msgsub.textContent = ''; } }
    if (this._tipT > 0) { this._tipT -= dt; if (this._tipT <= 0) this.el.tip.classList.remove('show'); }
  }
}

export const KB_KEYS = { fire: 'LMB', aim: 'RMB', block: 'RMB', jump: 'Space', sprint: 'Shift', slide: 'C', dash: 'C', grapple: 'Q', melee: 'F', reload: 'R', grenade: 'G', focus: 'Press both mouse buttons (or X)', next: 'wheel', pause: 'Esc', confirm: 'Space', score: 'Tab' };
export const PAD_KEYS = { fire: 'R2', aim: 'L2', block: 'L2', jump: '✕', sprint: 'L3', slide: '○', dash: '○', grapple: 'L1', melee: 'R1', reload: '□', grenade: 'R3', focus: 'L2 + R2', next: '△', pause: 'Options', confirm: '✕', score: 'Create' };
export const START_CONTROLS_HTML = `
<div class="start-controls" aria-label="Controls">
  <div class="control-device">
    <div class="device-title">DESKTOP RIG</div>
    <div class="device-art">
      <svg class="real-illustration keyboard-illustration" viewBox="0 0 560 270" role="img" aria-label="Mouse and keyboard illustration">
        <defs>
          <linearGradient id="kbBody" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#e9e6da"/></linearGradient>
          <linearGradient id="mouseBody" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#e8e5db"/></linearGradient>
        </defs>
        <g class="illustration-ink">
          <g transform="translate(18 28) rotate(-7)">
            <path class="device-fill" d="M42 8C16 8 3 28 5 62c2 35 16 55 40 55s38-20 39-54C85 29 69 8 42 8Z"/>
            <path d="M7 55c20-6 56-6 76 0M43 11v43"/>
            <rect class="orange-detail" x="37" y="24" width="12" height="19" rx="6"/>
          </g>
          <g transform="translate(120 48) rotate(-2)">
            <path class="device-fill" d="M12 8c2-5 7-7 14-7h350c8 0 13 4 15 11l19 162c1 9-5 14-14 14H25c-9 0-14-5-15-14Z"/>
            <path d="M28 25h338"/>
            <g class="key">
              <rect x="30" y="38" width="29" height="21"/><rect x="65" y="38" width="29" height="21"/><rect x="100" y="38" width="29" height="21"/><rect x="135" y="38" width="29" height="21"/><rect x="170" y="38" width="29" height="21"/><rect x="205" y="38" width="29" height="21"/><rect x="240" y="38" width="29" height="21"/><rect x="275" y="38" width="29" height="21"/><rect x="310" y="38" width="29" height="21"/>
              <rect class="hot" x="30" y="68" width="38" height="25"/><rect class="hot" x="73" y="68" width="38" height="25"/><rect class="hot" x="116" y="68" width="38" height="25"/>
              <rect x="159" y="68" width="38" height="25"/><rect x="202" y="68" width="38" height="25"/><rect x="245" y="68" width="38" height="25"/><rect x="288" y="68" width="51" height="25"/>
              <rect x="30" y="102" width="49" height="25"/><rect x="84" y="102" width="38" height="25"/><rect x="127" y="102" width="38" height="25"/><rect x="170" y="102" width="38" height="25"/><rect x="213" y="102" width="38" height="25"/><rect x="256" y="102" width="38" height="25"/><rect class="hot" x="299" y="102" width="40" height="25"/>
              <rect x="30" y="136" width="48" height="25"/><rect x="83" y="136" width="48" height="25"/><rect x="136" y="136" width="48" height="25"/><rect class="hot" x="192" y="136" width="120" height="25"/><rect x="319" y="136" width="20" height="25"/>
            </g>
          </g>
        </g>
      </svg>
    </div>
    <div class="control-labels">
      <div><span class="key-pill">W A S D</span><span>MOVE</span><span class="key-pill">MOUSE</span><span>LOOK</span></div>
      <div><span class="key-pill">LMB</span><span>FIRE</span><span class="key-pill">RMB</span><span>AIM / BLOCK</span></div>
      <div><span class="key-pill">SPACE</span><span>JUMP</span><span class="key-pill">SHIFT</span><span>SPRINT</span></div>
      <div><span class="key-pill">C</span><span>SLIDE / DASH</span><span class="key-pill">Q</span><span>GRAPPLE</span></div>
    </div>
  </div>
  <div class="control-device">
    <div class="device-title">GAMEPAD</div>
    <div class="device-art">
      <svg class="real-illustration controller-illustration" viewBox="0 0 560 270" role="img" aria-label="PS5 controller illustration">
        <defs>
          <linearGradient id="padBody" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#e5e4df"/></linearGradient>
        </defs>
        <g class="illustration-ink" transform="translate(50 38)">
          <path class="device-fill" d="M55 66C70 31 102 15 140 24c35 8 67 10 100 0 38-9 70 7 85 42 15 34 23 78 17 105-4 19-20 28-34 11l-31-39c-10-13-23-18-41-15-35 6-70 6-105 0-18-3-31 2-41 15l-31 39c-14 17-30 8-34-11-6-27 2-71 17-105Z"/>
          <path d="M83 92h53M109 66v52"/>
          <circle cx="169" cy="91" r="27"/><circle cx="239" cy="91" r="27"/>
          <circle cx="316" cy="72" r="10"/><circle cx="345" cy="91" r="10"/><circle cx="316" cy="110" r="10"/><circle cx="287" cy="91" r="10"/>
          <path class="orange-detail" d="M108 151q13-11 26 0M292 151q13-11 26 0"/>
          <path d="M190 42h30M205 27v30"/>
        </g>
      </svg>
    </div>
    <div class="control-labels">
      <div><span class="key-pill">L2</span><span>AIM / BLOCK</span><span class="key-pill">R2</span><span>FIRE</span></div>
      <div><span class="key-pill">L3</span><span>SPRINT</span><span class="key-pill">○</span><span>SLIDE / DASH</span></div>
      <div><span class="key-pill">✕</span><span>JUMP</span><span class="key-pill">□</span><span>RELOAD</span></div>
      <div><span class="key-pill">L1</span><span>GRAPPLE</span><span class="key-pill">△</span><span>NEXT WEAPON</span></div>
    </div>
  </div>
</div>
<div class="control-footer"><span>CLICK OR PRESS ANY KEY</span><span>•</span><span>MOVE WITH WASD / LEFT STICK</span></div>`;


export const CONTROLS_HTML = `
<div class="cols">
  <div><div class="colhead">DESKTOP</div>
    <div><b>WASD</b> Move &nbsp; <b>Mouse</b> Look &nbsp; <b>Shift</b> Sprint</div>
    <div><b>LMB</b> Fire / Slash &nbsp; <b>RMB</b> Aim / Block</div>
    <div><b>Space</b> Jump(press again on wall = Wall Jump)</div>
    <div>press again in air <b>Space</b> = Double Jump</div>
    <div><b>C / Ctrl</b> Ground Slide  -  Air Dash</div>
    <div><b>Q / E</b> Grapple:Tap to swing,Hold to reel in,jump launch</div>
    <div><b>F</b> Edge slash &nbsp; <b>R</b> Reload &nbsp; <b>M</b> Music</div>
    <div><b>G</b> Grenades  -  Hold to throw farther</div>
    <div><b>Tab</b> Scoreboard(Online) &nbsp; <b>Esc</b> Pause</div>
    <div><b>Press both mouse buttons</b> Dash slash when full</div>
    <div><b>1-4 / wheel</b> Pulse Carbine  ·  Scattergun  ·  Longshot  ·  Edgeblade</div>
  </div>
  <div><div class="colhead">GAMEPAD</div>
    <div><b>Left Stick</b> Move &nbsp; <b>Right Stick</b> Look &nbsp; <b>L3</b> Sprint</div>
    <div><b>R2</b> Fire / Slash &nbsp; <b>L2</b> Aim / Block</div>
    <div><b>✕</b> Jump &nbsp; <b>○</b> Slide  -  Air Dash</div>
    <div><b>L1</b> Grapple(Hold to reel in,✕ Launch)</div>
    <div><b>L2 + R2</b> Edge Dash slash when full</div>
    <div><b>R1</b> Edge slash,then auto-switch back to guns</div>
    <div><b>□</b> Reload &nbsp; <b>△</b> Next weapon</div>
    <div><b>R3 / D-pad Up</b> Grenades  -  Hold to throw farther</div>
    <div><b>Create</b> Scoreboard(Online) &nbsp; <b>Options</b> Pause</div>
  </div>
</div>`;

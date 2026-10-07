// DOM heads-up display drawn in "pen" style (multiplied over the paper canvas).
export class HUD {
  constructor(root) {
    this.root = root;
    root.innerHTML = `
      <div class="scope" id="scope"><div class="mask"></div><div class="ring"></div><div class="cx"></div><div class="cy"></div><div class="dot"></div></div>
      <div class="focus-meter" id="focusmeter"><div class="fm-label">太刀</div><div class="fm-tube"><div class="fm-fill" id="fmfill"></div><i class="fm-f1"></i><i class="fm-f2"></i><i class="fm-f3"></i></div><div class="fm-ready" id="fmready">拔刀就绪</div></div>
      <div class="focus-mark" id="focusmark"><i></i><i></i><i></i><i></i></div>
      <div class="crosshair" id="crosshair"><i class="ch-t"></i><i class="ch-b"></i><i class="ch-l"></i><i class="ch-r"></i><i class="ch-dot"></i></div>
      <div class="grapple-ret" id="gret"></div><div class="gstam" id="gstam" hidden><i id="gstamfill"></i></div>
      <div class="hitmarker" id="hitmarker"><i></i><i></i></div>
      <div class="dmg-ind" id="dmg"></div>
      <div class="hud-tl"><div class="score">分数 <b id="score">0</b></div><div class="combo" id="combo"></div></div>
      <div class="hud-tr"><div class="wave">波次 <b id="wave">1</b></div><div class="modifier" id="modifier"></div><div class="left"><b id="left">0</b> 个敌人待消灭</div><div class="timer" id="timer"></div><div class="pvpscore" id="pvpscore" hidden></div></div><div class="board" id="board" hidden></div>
      <div class="bossbar" id="bossbar"><div class="bossname" id="bossname"></div><div class="bar big"><div class="fill red" id="bossfill"></div></div></div>
      <div class="hud-bl">
        <div class="health"><span>生命</span><div class="bar"><div class="fill" id="hpfill"></div></div><span id="hpnum">100</span></div>
        <div class="ammo"><b id="mag">30</b><span id="reserve">/120</span><span class="reloading" id="reloading"></span><span class="nades" id="nades" title="手雷"></span></div>
        <div class="tally" id="tally"></div>
      </div>
      <div class="hud-br"><div class="slots" id="slots"></div><div class="weapon" id="weapon">步枪</div><div class="hint" id="hint"></div></div>
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
  setFocusMeter(show, frac, ready, label = '太刀') {
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
    this.el.mag.textContent = mag; this.el.reserve.textContent = '/' + reserve; this.el.reloading.textContent = reloading ? ' 换弹中…' : '';
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
  setScore(score, combo) { this.el.score.textContent = score; this.el.combo.textContent = combo > 1 ? '连击 x' + combo : ''; }
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

export const KB_KEYS = { fire: 'LMB', aim: 'RMB', block: 'RMB', jump: 'Space', sprint: 'Shift', slide: 'C', dash: 'C', grapple: 'Q', melee: 'F', reload: 'R', grenade: 'G', focus: '左右键同按（或 X）', next: '滚轮', pause: 'Esc', confirm: 'Space', score: 'Tab' };
export const PAD_KEYS = { fire: 'R2', aim: 'L2', block: 'L2', jump: '✕', sprint: 'L3', slide: '○', dash: '○', grapple: 'L1', melee: 'R1', reload: '□', grenade: 'R3', focus: 'L2 + R2', next: '△', pause: 'Options', confirm: '✕', score: 'Create' };
export const START_CONTROLS_HTML = `
<div class="start-controls" aria-label="Controls">
  <div class="control-device keyboard-device">
    <div class="device-title">MOUSE + KEYBOARD</div>
    <div class="device-art"><svg class="doodle-keyboard" viewBox="0 0 520 250" role="img" aria-label="Doodle keyboard and mouse">
      <g class="mouse" transform="translate(40 25) rotate(-7)"><path d="M38 14 C13 15 2 34 5 65 C8 101 23 119 47 118 C72 117 86 95 84 62 C82 30 66 13 38 14Z"/><path d="M8 56 C28 50 61 50 82 57"/><path d="M45 18 L45 56"/><rect x="39" y="29" width="12" height="18" rx="5"/></g>
      <g class="keyboard" transform="translate(132 56) rotate(-2)"><path d="M8 12 Q12 3 23 4 L360 4 Q373 5 378 16 L397 170 Q399 184 385 187 L24 187 Q10 186 9 173Z"/>
        <g class="keys"><rect x="27" y="22" width="34" height="24"/><rect x="66" y="22" width="34" height="24"/><rect x="105" y="22" width="34" height="24"/><rect x="144" y="22" width="34" height="24"/><rect x="183" y="22" width="34" height="24"/><rect x="222" y="22" width="34" height="24"/><rect x="261" y="22" width="34" height="24"/><rect x="300" y="22" width="34" height="24"/>
          <rect class="hot" x="27" y="54" width="38" height="27"/><rect class="hot" x="70" y="54" width="38" height="27"/><rect class="hot" x="113" y="54" width="38" height="27"/><rect x="156" y="54" width="38" height="27"/><rect x="199" y="54" width="38" height="27"/><rect x="242" y="54" width="38" height="27"/><rect x="285" y="54" width="48" height="27"/>
          <rect x="27" y="88" width="52" height="27"/><rect x="84" y="88" width="38" height="27"/><rect x="127" y="88" width="38" height="27"/><rect x="170" y="88" width="38" height="27"/><rect x="213" y="88" width="38" height="27"/><rect x="256" y="88" width="38" height="27"/><rect class="hot" x="299" y="88" width="34" height="27"/>
          <rect x="27" y="122" width="48" height="27"/><rect x="80" y="122" width="48" height="27"/><rect x="133" y="122" width="48" height="27"/><rect class="hot" x="186" y="122" width="115" height="27"/><rect x="306" y="122" width="27" height="27"/></g>
        <text x="39" y="73">W</text><text x="82" y="73">A</text><text x="125" y="73">S</text><text x="311" y="106">R</text><text x="226" y="140">SPACE</text></g>
      <g class="leader-lines"><path d="M175 91 C125 78 83 83 25 102"/><path d="M266 145 C335 126 403 119 493 100"/><path d="M238 178 C310 190 387 192 490 181"/></g>
      <g class="callout"><text x="10" y="110">WASD · MOVE</text><text x="352" y="97">R · RELOAD</text><text x="365" y="183">SPACE · JUMP</text></g>
    </svg></div>
    <div class="control-row"><span class="key-pill">LMB</span><span>FIRE</span><span class="key-pill">RMB</span><span>AIM / BLOCK</span></div>
    <div class="control-row"><span class="key-pill">SHIFT</span><span>SPRINT</span><span class="key-pill">C</span><span>SLIDE / DASH</span></div>
    <div class="control-row"><span class="key-pill">Q</span><span>GRAPPLE</span><span class="key-pill">G</span><span>GRENADE</span></div>
  </div>
  <div class="control-device pad-device">
    <div class="device-title">PS5 CONTROLLER</div>
    <div class="device-art"><svg class="doodle-pad" viewBox="0 0 520 250" role="img" aria-label="Doodle PS5 controller">
      <g class="pad" transform="translate(70 40) rotate(-2 190 85)"><path d="M50 62 C67 28 96 17 137 25 C164 31 212 31 239 25 C280 17 309 28 326 62 C342 94 351 133 345 165 C341 187 326 196 312 180 L279 143 C267 129 253 125 235 128 C202 134 165 134 132 128 C114 125 100 129 88 143 L55 180 C41 196 26 187 22 165 C16 133 25 94 50 62Z"/><path d="M87 91 h54 M114 64 v54"/><circle cx="269" cy="73" r="11"/><circle cx="301" cy="91" r="11"/><circle cx="269" cy="109" r="11"/><circle cx="237" cy="91" r="11"/><circle cx="166" cy="83" r="27"/><circle cx="236" cy="83" r="27"/><path class="hot-dot" d="M113 158 q12 -10 24 0"/><path class="hot-dot" d="M275 158 q12 -10 24 0"/></g>
      <g class="leader-lines"><path d="M180 120 C120 90 67 80 15 70"/><path d="M355 106 C405 83 447 78 508 70"/><path d="M300 192 C363 211 425 216 505 208"/><path d="M135 192 C94 211 54 216 12 208"/></g>
      <g class="callout"><text x="8" y="66">L3 · SPRINT</text><text x="400" y="66">R2 · FIRE</text><text x="415" y="211">✕ · JUMP</text><text x="8" y="211">L2 · AIM</text></g>
    </svg></div>
    <div class="control-row"><span class="key-pill">L2</span><span>AIM / BLOCK</span><span class="key-pill">R2</span><span>FIRE</span></div>
    <div class="control-row"><span class="key-pill">L3</span><span>SPRINT</span><span class="key-pill">○</span><span>SLIDE / DASH</span></div>
    <div class="control-row"><span class="key-pill">✕</span><span>JUMP</span><span class="key-pill">□</span><span>RELOAD</span></div>
  </div>
</div>
<div class="control-footer"><span>WASD / STICKS TO MOVE</span><span>•</span><span>SPACE / ✕ TO JUMP</span><span>•</span><span>CLICK OR PRESS TO START</span></div>`;

export const CONTROLS_HTML = `
<div class="cols">
  <div><div class="colhead">鼠标 + 键盘</div>
    <div><b>WASD</b> 移动 &nbsp; <b>鼠标</b> 视角 &nbsp; <b>Shift</b> 疾跑</div>
    <div><b>LMB</b> 开火 / 挥砍 &nbsp; <b>RMB</b> 开镜瞄准 / 格挡</div>
    <div><b>Space</b> 跳跃（在墙上再按 = 蹬墙跳）</div>
    <div>空中再按 <b>Space</b> = 二段跳</div>
    <div><b>C / Ctrl</b> 地面滑铲 · 空中冲刺</div>
    <div><b>Q / E</b> 抓钩：点按摆荡，长按收绳，跳跃起飞</div>
    <div><b>F</b> 太刀快速挥砍 &nbsp; <b>R</b> 换弹 &nbsp; <b>M</b> 音乐</div>
    <div><b>G</b> 手雷 · 按住可扔得更远</div>
    <div><b>Tab</b> 计分板（联机） &nbsp; <b>Esc</b> 暂停</div>
    <div><b>左右键同按</b> 能量满后施展冲刺斩</div>
    <div><b>1-4 / 滚轮</b> 步枪 · 霰弹枪 · 狙击枪 · 太刀</div>
  </div>
  <div><div class="colhead">PS5 手柄</div>
    <div><b>左摇杆</b> 移动 &nbsp; <b>右摇杆</b> 视角 &nbsp; <b>L3</b> 疾跑</div>
    <div><b>R2</b> 开火 / 挥砍 &nbsp; <b>L2</b> 瞄准 / 格挡</div>
    <div><b>✕</b> 跳跃 &nbsp; <b>○</b> 滑铲 · 空中冲刺</div>
    <div><b>L1</b> 抓钩（长按收绳，✕ 起飞）</div>
    <div><b>L2 + R2</b> 太刀能量满后施展冲刺斩</div>
    <div><b>R1</b> 太刀快速挥砍，随后自动切回枪械</div>
    <div><b>□</b> 换弹 &nbsp; <b>△</b> 下一把武器</div>
    <div><b>R3 / 十字键上</b> 手雷 · 按住可扔得更远</div>
    <div><b>Create</b> 计分板（联机） &nbsp; <b>Options</b> 暂停</div>
  </div>
</div>`;

// Lightweight room voice chat. Audio is peer-to-peer; PeerJS only brokers the WebRTC call.
export class VoiceChat {
  constructor(net, onState = null) {
    this.net = net;
    this.onState = onState;
    this.stream = null;
    this.enabled = false;
    this.muted = false;
    this.calls = new Map();
    this.ready = new Set();
    this.audio = new Map();
    this._bound = false;
    net.setVoiceHandler((call) => this._incoming(call));
    net.on('voice', (d, from) => this._signal(d, from));
  }

  _state() {
    if (this.onState) this.onState({ enabled: this.enabled, muted: this.muted, peers: this.ready.size });
  }

  async toggle() {
    if (!this.net.active) return;
    if (!this.enabled) return this.enable();
    this.muted = !this.muted;
    if (this.stream) for (const t of this.stream.getAudioTracks()) t.enabled = !this.muted;
    this._state();
  }

  async enable() {
    if (this.enabled) return;
    if (!navigator.mediaDevices?.getUserMedia) throw new Error('Voice chat is not supported by this browser');
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }
      });
    } catch (e) {
      throw new Error('Microphone blocked · allow microphone access to use voice chat');
    }
    this.enabled = true;
    this.muted = false;
    this.ready.add(this.net.id);
    this.net.broadcast('voice', { action: 'ready' });
    for (const id of this.ready) if (id !== this.net.id) this._maybeCall(id);
    this._state();
  }

  _signal(d, from) {
    if (!d || !from || from === this.net.id) return;
    if (d.action === 'ready') {
      this.ready.add(from);
      if (this.enabled) this._maybeCall(from);
      this._state();
    } else if (d.action === 'off') {
      this.ready.delete(from);
      this._closeCall(from);
      this._state();
    }
  }

  _maybeCall(id) {
    if (!this.enabled || !this.stream || !id || id === this.net.id || this.calls.has(id)) return;
    // One side initiates each pair so both browsers never create duplicate calls.
    if (String(this.net.id) > String(id)) return;
    const call = this.net.callVoice(id, this.stream);
    if (!call) return;
    this.calls.set(id, call);
    this._wireCall(id, call);
  }

  _incoming(call) {
    if (!call || !call.metadata?.voice) return;
    const id = call.peer;
    if (!this.enabled || !this.stream) {
      try { call.close(); } catch (e) {}
      return;
    }
    this._closeCall(id);
    this.calls.set(id, call);
    try { call.answer(this.stream); } catch (e) { this._closeCall(id); return; }
    this._wireCall(id, call);
  }

  _wireCall(id, call) {
    call.on('stream', (stream) => {
      let a = this.audio.get(id);
      if (!a) {
        a = document.createElement('audio');
        a.autoplay = true;
        a.playsInline = true;
        a.dataset.voice = id;
        a.setAttribute('aria-hidden', 'true');
        a.style.display = 'none';
        document.body.appendChild(a);
        this.audio.set(id, a);
      }
      a.srcObject = stream;
      const p = a.play();
      if (p?.catch) p.catch(() => {});
    });
    call.on('close', () => {
      if (this.calls.get(id) === call) this.calls.delete(id);
      this._removeAudio(id);
    });
    call.on('error', () => {
      if (this.calls.get(id) === call) this.calls.delete(id);
    });
  }

  _closeCall(id) {
    const c = this.calls.get(id);
    if (c) { try { c.close(); } catch (e) {} this.calls.delete(id); }
    this._removeAudio(id);
  }

  _removeAudio(id) {
    const a = this.audio.get(id);
    if (a) { try { a.srcObject = null; } catch (e) {} a.remove(); this.audio.delete(id); }
  }

  stop() {
    if (this.enabled) {
      try { this.net.broadcast('voice', { action: 'off' }); } catch (e) {}
    }
    for (const id of [...this.calls.keys()]) this._closeCall(id);
    for (const a of this.audio.values()) a.remove();
    this.audio.clear();
    if (this.stream) for (const t of this.stream.getTracks()) t.stop();
    this.stream = null; this.enabled = false; this.muted = false; this.ready.clear();
    this._state();
  }
}

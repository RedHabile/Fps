// ─────────────────────────────────────────────────────────────
//  VALENCE — Audio procédural (WebAudio, zéro asset)
// ─────────────────────────────────────────────────────────────

export class SFX {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noiseBuf: AudioBuffer | null = null;
  private ambientNodes: AudioNode[] = [];
  volume = 0.8;

  init() {
    if (this.ctx) return;
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.volume;
    this.master.connect(this.ctx.destination);
    // Buffer de bruit réutilisable
    const len = this.ctx.sampleRate * 1.2;
    this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  }

  setVolume(v: number) {
    this.volume = v;
    if (this.master) this.master.gain.value = v;
  }

  private get ok() { return !!this.ctx && !!this.master; }
  private t() { return this.ctx!.currentTime; }

  private noise(dur: number, filterFreq: number, gain: number, type: BiquadFilterType = 'lowpass', when = 0) {
    if (!this.ok) return null;
    const src = this.ctx!.createBufferSource();
    src.buffer = this.noiseBuf;
    src.loop = true;
    const f = this.ctx!.createBiquadFilter();
    f.type = type; f.frequency.value = filterFreq;
    const g = this.ctx!.createGain();
    g.gain.setValueAtTime(gain, this.t() + when);
    g.gain.exponentialRampToValueAtTime(0.0001, this.t() + when + dur);
    src.connect(f).connect(g).connect(this.master!);
    src.start(this.t() + when); src.stop(this.t() + when + dur + 0.05);
    return { src, f, g };
  }

  private tone(freq: number, dur: number, gain: number, type: OscillatorType = 'square', slideTo?: number, when = 0) {
    if (!this.ok) return;
    const o = this.ctx!.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, this.t() + when);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, this.t() + when + dur);
    const g = this.ctx!.createGain();
    g.gain.setValueAtTime(gain, this.t() + when);
    g.gain.exponentialRampToValueAtTime(0.0001, this.t() + when + dur);
    o.connect(g).connect(this.master!);
    o.start(this.t() + when); o.stop(this.t() + when + dur + 0.05);
  }

  // ── Coups de feu ──────────────────────────────────────────
  shot(kind: 'rifle' | 'smg' | 'pistol' | 'sniper' | 'shotgun' | 'lmg' | 'bot') {
    if (!this.ok) return;
    const base = { rifle: 1, smg: 0.7, pistol: 0.6, sniper: 1.4, shotgun: 1.25, lmg: 1.15, bot: 0.5 }[kind];
    this.noise(0.09 * base + 0.05, 3200, 0.5 * base, 'bandpass');
    this.noise(0.16 * base, 900, 0.6 * base, 'lowpass');
    this.tone(160 - base * 40, 0.11, 0.34 * base, 'triangle', 55);
    if (kind === 'sniper') { this.noise(0.4, 420, 0.65, 'lowpass'); this.tone(90, 0.35, 0.4, 'sine', 38); }
    if (kind === 'shotgun') { this.noise(0.3, 260, 0.75, 'lowpass'); this.tone(70, 0.26, 0.45, 'sine', 32); }
    if (kind === 'lmg') { this.noise(0.2, 520, 0.5, 'lowpass'); this.tone(110, 0.14, 0.3, 'square', 48); }
  }

  /** douille qui tinte au sol */
  shell() {
    const d = 0.05 + Math.random() * 0.03;
    this.tone(2400 + Math.random() * 900, d, 0.06, 'triangle', 1500, 0.08);
    this.tone(3600 + Math.random() * 800, d * 0.7, 0.04, 'sine', 2200, 0.14);
  }
  pump() { this.tone(300, 0.07, 0.17, 'square'); this.tone(520, 0.06, 0.15, 'square', undefined, 0.16); }

  dryFire() { this.tone(900, 0.05, 0.12, 'square'); }
  reload() {
    this.tone(500, 0.05, 0.14, 'square');
    this.tone(340, 0.05, 0.14, 'square', undefined, 0.12);
    this.tone(720, 0.06, 0.16, 'square', undefined, 0.55);
  }
  footstep() { this.noise(0.06, 400 + Math.random() * 200, 0.05, 'lowpass'); }
  crack() { this.noise(0.05, 5000, 0.3, 'highpass'); }

  hit(head: boolean) {
    this.tone(head ? 1900 : 1400, 0.05, 0.25, 'square');
    if (head) this.tone(2400, 0.05, 0.2, 'square', undefined, 0.03);
  }

  kill() {
    // Carillon emblématique 3 notes montantes
    const notes = [659, 880, 1174];
    notes.forEach((n, i) => this.tone(n, 0.16, 0.22, 'triangle', undefined, i * 0.07));
    this.noise(0.25, 6000, 0.1, 'highpass');
  }

  buyOk() { this.tone(880, 0.08, 0.18, 'triangle'); this.tone(1174, 0.1, 0.18, 'triangle', undefined, 0.07); }
  buyNo() { this.tone(220, 0.15, 0.2, 'sawtooth', 160); }

  roundStart() {
    this.tone(196, 0.5, 0.3, 'sawtooth', 196);
    this.tone(392, 0.5, 0.22, 'sawtooth', 392, 0.02);
    this.noise(0.5, 800, 0.14, 'lowpass', 0.02);
  }
  roundWin() {
    [523, 659, 784, 1046].forEach((n, i) => this.tone(n, 0.22, 0.2, 'triangle', undefined, i * 0.09));
  }
  roundLose() {
    [392, 330, 262].forEach((n, i) => this.tone(n, 0.3, 0.2, 'sawtooth', undefined, i * 0.12));
  }
  matchWin() {
    [523, 659, 784, 1046, 1318].forEach((n, i) => this.tone(n, 0.4, 0.22, 'triangle', undefined, i * 0.11));
  }
  matchLose() {
    [330, 277, 220, 165].forEach((n, i) => this.tone(n, 0.5, 0.2, 'sawtooth', undefined, i * 0.16));
  }
  uiHover() { this.tone(1200, 0.03, 0.05, 'sine'); }
  uiClick() { this.tone(800, 0.05, 0.12, 'square'); }

  startAmbient() {
    if (!this.ok || this.ambientNodes.length) return;
    const src = this.ctx!.createBufferSource();
    src.buffer = this.noiseBuf; src.loop = true;
    const f = this.ctx!.createBiquadFilter();
    f.type = 'lowpass'; f.frequency.value = 220;
    const g = this.ctx!.createGain(); g.gain.value = 0.035;
    const lfo = this.ctx!.createOscillator();
    lfo.frequency.value = 0.11;
    const lfoG = this.ctx!.createGain(); lfoG.gain.value = 0.02;
    lfo.connect(lfoG).connect(g.gain);
    src.connect(f).connect(g).connect(this.master!);
    src.start(); lfo.start();
    this.ambientNodes = [src, lfo, g, f];
  }
}

export const sfx = new SFX();

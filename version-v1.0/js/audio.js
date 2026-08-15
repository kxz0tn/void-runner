/**
 * VOID RUNNER — Procedural audio
 * Copyright (c) 2026 VOID RUNNER contributors
 * SPDX-License-Identifier: MIT
 *
 * Every sound is synthesized on the AudioContext graph. No samples, no
 * files, no copyrighted material. Browsers require a user gesture before
 * resume(); the game calls unlock() from the title-screen click.
 */
(function (global) {
  "use strict";

  var VR = (global.VR = global.VR || {});

  function AudioEngine() {
    this.ctx = null;
    this.master = null;
    this.ready = false;
    this.muted = false;
    this._engine = null;
    this._wind = null;
    this._drone = null;
    this._earth = null;
    this._scrape = null;
    this._rpm = 0;
    this._started = false;
    this._boostAmt = 0;
  }

  AudioEngine.prototype.unlock = function () {
    if (this.ready) {
      if (this.ctx && this.ctx.state === "suspended") this.ctx.resume();
      return;
    }
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try {
      this.ctx = new AC();
    } catch (e) {
      return;
    }
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.42;
    this.master.connect(this.ctx.destination);
    this._buildBeds();
    this.ready = true;
    this.ctx.resume();
  };

  AudioEngine.prototype.setMuted = function (m) {
    this.muted = !!m;
    if (this.master) this.master.gain.value = this.muted ? 0 : 0.42;
  };

  AudioEngine.prototype._now = function () {
    return this.ctx ? this.ctx.currentTime : 0;
  };

  AudioEngine.prototype._gain = function (parent, value) {
    var g = this.ctx.createGain();
    g.gain.value = value;
    g.connect(parent || this.master);
    return g;
  };

  AudioEngine.prototype._osc = function (type, freq, dest) {
    var o = this.ctx.createOscillator();
    o.type = type;
    o.frequency.value = freq;
    o.connect(dest);
    return o;
  };

  /** Pink-ish noise buffer reused for wind, scrape, impacts, shrieks. */
  AudioEngine.prototype._noiseBuffer = function (seconds) {
    var len = Math.floor((this.ctx.sampleRate * seconds) | 0);
    var buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    var d = buf.getChannelData(0);
    var b0 = 0, b1 = 0, b2 = 0, white, i;
    for (i = 0; i < len; i++) {
      white = Math.random() * 2 - 1;
      b0 = 0.99765 * b0 + white * 0.099046;
      b1 = 0.963 * b1 + white * 0.2965164;
      b2 = 0.57 * b2 + white * 1.0526913;
      d[i] = b0 + b1 + b2 + white * 0.1848;
    }
    return buf;
  };

  AudioEngine.prototype._noiseSrc = function (loop, dest) {
    var s = this.ctx.createBufferSource();
    if (!this._nbuf) this._nbuf = this._noiseBuffer(1.4);
    s.buffer = this._nbuf;
    s.loop = !!loop;
    s.connect(dest);
    return s;
  };

  AudioEngine.prototype._buildBeds = function () {
    var ctx = this.ctx;
    var filt, g, o1, o2, o3;

    /* Engine: detuned saw + square into a moving lowpass. */
    this._engineGain = this._gain(this.master, 0);
    filt = ctx.createBiquadFilter();
    filt.type = "lowpass";
    filt.frequency.value = 280;
    filt.Q.value = 3.2;
    filt.connect(this._engineGain);
    this._engineFilt = filt;
    o1 = this._osc("sawtooth", 48, filt);
    o2 = this._osc("square", 51.5, filt);
    this._engineOscA = o1;
    this._engineOscB = o2;
    o1.start();
    o2.start();

    /* Regolith scrape: filtered noise, gain follows slip. */
    this._scrapeGain = this._gain(this.master, 0);
    filt = ctx.createBiquadFilter();
    filt.type = "bandpass";
    filt.frequency.value = 900;
    filt.Q.value = 0.7;
    filt.connect(this._scrapeGain);
    this._scrapeFilt = filt;
    this._scrape = this._noiseSrc(true, filt);
    this._scrape.start();

    /* Moon wind. */
    this._windGain = this._gain(this.master, 0.045);
    filt = ctx.createBiquadFilter();
    filt.type = "lowpass";
    filt.frequency.value = 420;
    filt.connect(this._windGain);
    this._wind = this._noiseSrc(true, filt);
    this._wind.start();

    /* Sub-bass bed: almost subsonic sine. */
    this._earth = this._osc("sine", 38, this._gain(this.master, 0.035));
    this._earth.start();

    /* Chassis rumble — gain follows vibration / engine load. */
    this._rumbleGain = this._gain(this.master, 0);
    this._rumbleOsc = this._osc("sawtooth", 36, this._rumbleGain);
    this._rumbleOsc.start();

    /* Overdrive layer sits on top of the engine bed. */
    this._boostGain = this._gain(this.master, 0);
    this._boostOsc = this._osc("sawtooth", 92, this._boostGain);
    this._boostOsc.start();

    /* Generative drone — two beating sines, no melody. */
    g = this._gain(this.master, 0.028);
    o1 = this._osc("sine", 55, g);
    o2 = this._osc("sine", 82.4, g);
    o3 = this._osc("triangle", 110.2, this._gain(g, 0.25));
    o1.start();
    o2.start();
    o3.start();
    this._drone = { a: o1, b: o2, c: o3, g: g };

    this._started = true;
  };

  AudioEngine.prototype.update = function (dt, vehicle, playing) {
    if (!this.ready || !this._started) return;
    var t = this._now();
    var speed = vehicle ? vehicle.speed : 0;
    var slip = vehicle ? vehicle.slip : 0;
    var throttle = vehicle ? Math.max(0, vehicle.throttle) : 0;
    var load = vehicle ? vehicle.engineLoad || 0 : 0;
    var boost = vehicle ? vehicle.boostT || 0 : 0;
    var vib = vehicle ? vehicle.vib || 0 : 0;
    var kind = vehicle ? vehicle.surfKind : "mare";
    var scrapeF = kind === "rim" || kind === "ridge" ? 1400 : kind === "pad" ? 700 : 880;
    var targetRpm = playing ? 40 + speed * 3.1 + throttle * 28 + load * 18 + boost * 22 : 36;
    this._rpm = VR.math.damp(this._rpm, targetRpm, 4.5, dt);
    this._boostAmt = VR.math.damp(this._boostAmt, playing ? boost : 0, 6, dt);
    if (this._engineOscA) {
      this._engineOscA.frequency.setTargetAtTime(this._rpm, t, 0.05);
      this._engineOscB.frequency.setTargetAtTime(this._rpm * 1.07, t, 0.05);
      this._engineFilt.frequency.setTargetAtTime(220 + this._rpm * 7.5 + throttle * 180 + load * 160 + boost * 240, t, 0.06);
      this._engineGain.gain.setTargetAtTime(playing ? 0.045 + speed * 0.0032 + throttle * 0.05 + load * 0.03 : 0.012, t, 0.08);
    }
    if (this._scrapeGain) {
      this._scrapeGain.gain.setTargetAtTime(playing ? Math.min(0.14, slip * 0.15 + speed * 0.001 + (kind === "rim" ? 0.02 : 0)) : 0, t, 0.05);
    }
    if (this._scrapeFilt) this._scrapeFilt.frequency.setTargetAtTime(scrapeF, t, 0.08);
    if (this._rumbleGain) {
      this._rumbleGain.gain.setTargetAtTime(playing ? Math.min(0.055, vib * 1.8 + load * 0.02) : 0, t, 0.06);
    }
    if (this._boostGain) {
      this._boostGain.gain.setTargetAtTime(playing ? this._boostAmt * 0.055 : 0, t, 0.05);
    }
    if (this._boostOsc) this._boostOsc.frequency.setTargetAtTime(84 + this._boostAmt * 40, t, 0.08);
    if (this._windGain) {
      this._windGain.gain.setTargetAtTime(playing ? 0.04 + speed * 0.0018 + boost * 0.02 : 0.02, t, 0.1);
    }
    if (this._drone && playing) {
      var wobble = 55 + Math.sin(t * 0.07) * 2.2;
      this._drone.a.frequency.setTargetAtTime(wobble, t, 0.4);
      this._drone.b.frequency.setTargetAtTime(82 + Math.sin(t * 0.05 + 1.2) * 1.6, t, 0.4);
    }
    if (playing && vehicle && vehicle.landImpulse > 2.8) this.land(vehicle.landImpulse);
  };

  AudioEngine.prototype.ui = function (kind) {
    if (!this.ready) return;
    var t = this._now();
    var o = this._osc(kind === "confirm" ? "square" : "triangle", kind === "confirm" ? 880 : 520, this._gain(this.master, 0.0001));
    var g = o.context ? null : null;
    g = o;
    var dest = this._gain(this.master, 0.0001);
    /* reconnect cleanly */
    try {
      o.disconnect();
    } catch (e) {}
    var env = this.ctx.createGain();
    env.gain.setValueAtTime(0.0001, t);
    env.gain.exponentialRampToValueAtTime(kind === "confirm" ? 0.12 : 0.06, t + 0.01);
    env.gain.exponentialRampToValueAtTime(0.0001, t + (kind === "confirm" ? 0.18 : 0.09));
    o = this._osc(kind === "confirm" ? "square" : "triangle", kind === "confirm" ? 920 : 640, env);
    env.connect(this.master);
    o.start(t);
    o.stop(t + 0.22);
    if (kind === "confirm") {
      var o2 = this._osc("square", 1380, env);
      o2.start(t + 0.04);
      o2.stop(t + 0.16);
    }
    void dest;
    void g;
  };

  AudioEngine.prototype.shot = function () {
    if (!this.ready) return;
    var t = this._now();
    var env = this.ctx.createGain();
    env.gain.setValueAtTime(0.11, t);
    env.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
    env.connect(this.master);
    var o = this._osc("square", 980, env);
    o.frequency.exponentialRampToValueAtTime(240, t + 0.1);
    o.start(t);
    o.stop(t + 0.13);
    var o2 = this._osc("triangle", 1560, env);
    o2.start(t);
    o2.stop(t + 0.08);
  };

  AudioEngine.prototype.pulse = function () {
    if (!this.ready) return;
    var t = this._now();
    var env = this.ctx.createGain();
    var filt = this.ctx.createBiquadFilter();
    filt.type = "bandpass";
    filt.frequency.setValueAtTime(1400, t);
    filt.frequency.exponentialRampToValueAtTime(280, t + 0.22);
    filt.Q.value = 2.4;
    env.gain.setValueAtTime(0.16, t);
    env.gain.exponentialRampToValueAtTime(0.0001, t + 0.28);
    filt.connect(env);
    env.connect(this.master);
    var o = this._osc("sawtooth", 220, filt);
    o.frequency.exponentialRampToValueAtTime(70, t + 0.24);
    o.start(t);
    o.stop(t + 0.3);
    var n = this._noiseSrc(false, filt);
    n.start(t);
    n.stop(t + 0.18);
  };

  AudioEngine.prototype.land = function (force) {
    if (!this.ready) return;
    var t = this._now();
    var amt = Math.min(1, (force || 4) / 14);
    var env = this.ctx.createGain();
    env.gain.setValueAtTime(0.08 + amt * 0.2, t);
    env.gain.exponentialRampToValueAtTime(0.0001, t + 0.28 + amt * 0.2);
    env.connect(this.master);
    var o = this._osc("sine", 42 + amt * 10, env);
    o.frequency.exponentialRampToValueAtTime(22, t + 0.22);
    o.start(t);
    o.stop(t + 0.4);
    var filt = this.ctx.createBiquadFilter();
    filt.type = "lowpass";
    filt.frequency.value = 380;
    filt.connect(env);
    var n = this._noiseSrc(false, filt);
    n.start(t);
    n.stop(t + 0.16);
  };

  AudioEngine.prototype.impact = function (heavy) {
    if (!this.ready) return;
    var t = this._now();
    var env = this.ctx.createGain();
    env.gain.setValueAtTime(heavy ? 0.28 : 0.14, t);
    env.gain.exponentialRampToValueAtTime(0.0001, t + (heavy ? 0.45 : 0.22));
    env.connect(this.master);
    var o = this._osc("sine", heavy ? 48 : 80, env);
    o.frequency.exponentialRampToValueAtTime(28, t + 0.2);
    o.start(t);
    o.stop(t + 0.4);
    var filt = this.ctx.createBiquadFilter();
    filt.type = "lowpass";
    filt.frequency.value = heavy ? 500 : 900;
    filt.connect(env);
    var n = this._noiseSrc(false, filt);
    n.start(t);
    n.stop(t + 0.2);
  };

  AudioEngine.prototype.shriek = function (kind) {
    if (!this.ready) return;
    var t = this._now();
    var base = kind === "brute" ? 90 : kind === "flyer" ? 420 : 260;
    var env = this.ctx.createGain();
    env.gain.setValueAtTime(0.09, t);
    env.gain.exponentialRampToValueAtTime(0.0001, t + 0.32);
    env.connect(this.master);
    var o = this._osc("sawtooth", base, env);
    o.frequency.setValueAtTime(base, t);
    o.frequency.exponentialRampToValueAtTime(base * (kind === "brute" ? 0.5 : 1.8), t + 0.26);
    o.start(t);
    o.stop(t + 0.34);
  };

  AudioEngine.prototype.orb = function () {
    if (!this.ready) return;
    var t = this._now();
    var env = this.ctx.createGain();
    env.gain.setValueAtTime(0.09, t);
    env.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
    env.connect(this.master);
    var o = this._osc("triangle", 660, env);
    o.frequency.exponentialRampToValueAtTime(1320, t + 0.16);
    o.start(t);
    o.stop(t + 0.28);
    var o2 = this._osc("sine", 990, env);
    o2.start(t + 0.04);
    o2.stop(t + 0.22);
  };

  AudioEngine.prototype.die = function () {
    if (!this.ready) return;
    var t = this._now();
    var env = this.ctx.createGain();
    env.gain.setValueAtTime(0.22, t);
    env.gain.exponentialRampToValueAtTime(0.0001, t + 1.4);
    env.connect(this.master);
    var o = this._osc("sawtooth", 110, env);
    o.frequency.exponentialRampToValueAtTime(28, t + 1.2);
    o.start(t);
    o.stop(t + 1.4);
    var n = this._noiseSrc(false, env);
    n.start(t);
    n.stop(t + 0.5);
  };

  AudioEngine.prototype.storm = function () {
    if (!this.ready) return;
    var t = this._now();
    var env = this.ctx.createGain();
    env.gain.setValueAtTime(0.12, t);
    env.gain.exponentialRampToValueAtTime(0.0001, t + 0.8);
    var filt = this.ctx.createBiquadFilter();
    filt.type = "highpass";
    filt.frequency.value = 700;
    filt.connect(env);
    env.connect(this.master);
    var n = this._noiseSrc(false, filt);
    n.start(t);
    n.stop(t + 0.7);
  };

  VR.AudioEngine = AudioEngine;
})(typeof window !== "undefined" ? window : globalThis);

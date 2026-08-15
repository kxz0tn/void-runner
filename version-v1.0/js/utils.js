/**
 * VOID RUNNER — Math, noise, pooling
 * Copyright (c) 2026 VOID RUNNER contributors
 * SPDX-License-Identifier: MIT
 *
 * Deterministic hash noise is used everywhere (terrain, craters, structures)
 * so the world is infinite, stable across sessions, and never needs assets.
 */
(function (global) {
  "use strict";

  var VR = (global.VR = global.VR || {});

  var TAU = Math.PI * 2;

  function clamp(v, a, b) {
    return v < a ? a : v > b ? b : v;
  }

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  function saturate(v) {
    return v < 0 ? 0 : v > 1 ? 1 : v;
  }

  function smoothstep(e0, e1, x) {
    var t = saturate((x - e0) / (e1 - e0));
    return t * t * (3 - 2 * t);
  }

  function damp(cur, tgt, lambda, dt) {
    return lerp(cur, tgt, 1 - Math.exp(-lambda * dt));
  }

  function wrapAngle(a) {
    while (a > Math.PI) a -= TAU;
    while (a < -Math.PI) a += TAU;
    return a;
  }

  function lerpAngle(a, b, t) {
    return a + wrapAngle(b - a) * t;
  }

  /** Integer mix — same cell always yields the same [0,1) value. */
  function hash(x, y, z) {
    var n = (x | 0) * 374761393 + (y | 0) * 668265263 + ((z | 0) + 1) * 1274126177;
    n = (n ^ (n >>> 13)) | 0;
    n = Math.imul(n, 1274126177);
    return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
  }

  function fade(t) {
    return t * t * t * (t * (t * 6 - 15) + 10);
  }

  /** Value-noise, bilinear, used as the cheap FBM building block. */
  function valueNoise(x, y) {
    var xi = Math.floor(x);
    var yi = Math.floor(y);
    var xf = x - xi;
    var yf = y - yi;
    var u = fade(xf);
    var v = fade(yf);
    var a = hash(xi, yi, 1);
    var b = hash(xi + 1, yi, 1);
    var c = hash(xi, yi + 1, 1);
    var d = hash(xi + 1, yi + 1, 1);
    return lerp(lerp(a, b, u), lerp(c, d, u), v);
  }

  function fbm(x, y, oct) {
    var sum = 0;
    var amp = 0.5;
    var freq = 1;
    var i;
    oct = oct || 5;
    for (i = 0; i < oct; i++) {
      sum += (valueNoise(x * freq, y * freq) * 2 - 1) * amp;
      amp *= 0.5;
      freq *= 2.03;
    }
    return sum;
  }

  /** Tiny seeded LCG for non-world randomness (particles, audio grain). */
  function RNG(seed) {
    this.s = (seed >>> 0) || 1;
  }
  RNG.prototype.next = function () {
    this.s = (Math.imul(this.s, 1664525) + 1013904223) >>> 0;
    return this.s / 4294967296;
  };
  RNG.prototype.range = function (a, b) {
    return a + (b - a) * this.next();
  };
  RNG.prototype.sign = function () {
    return this.next() < 0.5 ? -1 : 1;
  };

  /**
   * Fixed-size object pool. Aliens, orbs, pulses and particles never
   * allocate during gameplay — they recycle.
   */
  function Pool(factory, count) {
    this.factory = factory;
    this.items = [];
    var i;
    for (i = 0; i < count; i++) this.items.push(factory());
  }
  Pool.prototype.obtain = function () {
    var i, it;
    for (i = 0; i < this.items.length; i++) {
      it = this.items[i];
      if (!it.alive) return it;
    }
    it = this.factory();
    this.items.push(it);
    return it;
  };
  Pool.prototype.forAlive = function (fn) {
    var i, it;
    for (i = 0; i < this.items.length; i++) {
      it = this.items[i];
      if (it.alive) fn(it, i);
    }
  };

  function formatScore(n) {
    n = Math.floor(n);
    return (n < 0 ? 0 : n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  }

  function formatTime(sec) {
    var s = Math.max(0, Math.floor(sec));
    var m = Math.floor(s / 60);
    var r = s % 60;
    return (m < 10 ? "0" : "") + m + ":" + (r < 10 ? "0" : "") + r;
  }

  VR.math = {
    TAU: TAU,
    clamp: clamp,
    lerp: lerp,
    saturate: saturate,
    smoothstep: smoothstep,
    damp: damp,
    wrapAngle: wrapAngle,
    lerpAngle: lerpAngle,
    hash: hash,
    valueNoise: valueNoise,
    fbm: fbm,
    RNG: RNG,
    Pool: Pool,
    formatScore: formatScore,
    formatTime: formatTime
  };
})(typeof window !== "undefined" ? window : globalThis);

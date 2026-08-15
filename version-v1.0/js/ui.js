/**
 * VOID RUNNER — HUD + menus
 * Copyright (c) 2026 VOID RUNNER contributors
 * SPDX-License-Identifier: MIT
 *
 * DOM overlays on top of the WebGL canvas. The HUD is holographic
 * chrome; menus are full-frame CRT cards. Minimap is a 2D canvas.
 */
(function (global) {
  "use strict";

  var VR = (global.VR = global.VR || {});
  var M = VR.math;

  function UI(game) {
    this.game = game;
    this.el = {
      boot: document.getElementById("boot"),
      title: document.getElementById("title"),
      pause: document.getElementById("pause"),
      over: document.getElementById("over"),
      hud: document.getElementById("hud"),
      score: document.getElementById("hud-score"),
      dist: document.getElementById("hud-dist"),
      time: document.getElementById("hud-time"),
      speed: document.getElementById("hud-speed"),
      shield: document.getElementById("bar-shield"),
      hull: document.getElementById("bar-hull"),
      threat: document.getElementById("hud-threat"),
      wave: document.getElementById("hud-wave"),
      multi: document.getElementById("hud-multi"),
      toast: document.getElementById("toast"),
      hiscore: document.getElementById("hiscore"),
      hiscoreOver: document.getElementById("over-hiscore"),
      overScore: document.getElementById("over-score"),
      overDist: document.getElementById("over-dist"),
      overTime: document.getElementById("over-time"),
      overKills: document.getElementById("over-kills"),
      flavor: document.getElementById("over-flavor"),
      damage: document.getElementById("fx-damage"),
      flash: document.getElementById("fx-flash"),
      minimap: document.getElementById("minimap"),
      sil: document.getElementById("silhouette")
    };
    this.mapCtx = this.el.minimap ? this.el.minimap.getContext("2d") : null;
    this.silCtx = this.el.sil ? this.el.sil.getContext("2d") : null;
    this._toastT = 0;
    this._hi = VR.UI.loadHighScore();
    this.refreshHigh();
    this._drawSilhouette();
    this._bind();
    var ver = document.getElementById("ver-tag");
    if (ver) ver.textContent = "v" + VR.VERSION;
  }

  UI.loadHighScore = function () {
    try {
      var n = parseInt(localStorage.getItem(VR.STORAGE_KEY) || "0", 10);
      return isFinite(n) ? n : 0;
    } catch (e) {
      return 0;
    }
  };

  UI.saveHighScore = function (n) {
    try {
      var prev = UI.loadHighScore();
      if (n > prev) localStorage.setItem(VR.STORAGE_KEY, String(Math.floor(n)));
      return Math.max(prev, n);
    } catch (e) {
      return n;
    }
  };

  UI.prototype._bind = function () {
    var g = this.game;
    var start = document.getElementById("btn-start");
    var resume = document.getElementById("btn-resume");
    var retry = document.getElementById("btn-retry");
    var menu = document.getElementById("btn-menu");
    var menuPause = document.getElementById("btn-menu-pause");
    var restart = document.getElementById("btn-restart");
    var mutePause = document.getElementById("btn-mute-pause");
    var how = document.getElementById("btn-how");
    var fs = document.getElementById("btn-fs");
    if (start) start.addEventListener("click", function () { g.startRun(); });
    if (resume) resume.addEventListener("click", function () { g.togglePause(false); });
    if (retry) retry.addEventListener("click", function () { g.startRun(); });
    if (menu) menu.addEventListener("click", function () { g.gotoTitle(); });
    if (menuPause) menuPause.addEventListener("click", function () { g.gotoTitle(); });
    if (restart) restart.addEventListener("click", function () { g.startRun(); });
    if (mutePause) {
      mutePause.addEventListener("click", function () {
        g.audio.setMuted(!g.audio.muted);
        mutePause.textContent = g.audio.muted ? "Unmute" : "Mute";
        g.ui.toast(g.audio.muted ? "AUDIO MUTE" : "AUDIO LIVE");
      });
    }
    if (how) {
      how.addEventListener("click", function () {
        var box = document.getElementById("how-box");
        if (box) box.classList.toggle("hidden");
      });
    }
    if (fs) {
      fs.addEventListener("click", function () {
        var el = document.documentElement;
        if (!document.fullscreenElement) {
          if (el.requestFullscreen) el.requestFullscreen();
        } else if (document.exitFullscreen) {
          document.exitFullscreen();
        }
      });
    }
  };

  UI.prototype.refreshHigh = function () {
    this._hi = UI.loadHighScore();
    if (this.el.hiscore) this.el.hiscore.textContent = M.formatScore(this._hi);
  };

  UI.prototype.hideAll = function () {
    ["boot", "title", "pause", "over"].forEach(function (k) {
      var el = document.getElementById(k);
      if (el) el.classList.add("hidden");
    });
  };

  UI.prototype.showTitle = function () {
    this.hideAll();
    document.body.classList.add("menu-open");
    if (this.el.title) this.el.title.classList.remove("hidden");
    if (this.el.hud) this.el.hud.classList.remove("on");
    this.refreshHigh();
  };

  UI.prototype.showPlay = function () {
    this.hideAll();
    document.body.classList.remove("menu-open");
    if (this.el.hud) this.el.hud.classList.add("on");
  };

  UI.prototype.showPause = function (on) {
    if (this.el.pause) this.el.pause.classList.toggle("hidden", !on);
    document.body.classList.toggle("menu-open", on);
    var mute = document.getElementById("btn-mute-pause");
    if (mute && this.game && this.game.audio) {
      mute.textContent = this.game.audio.muted ? "Unmute" : "Mute";
    }
  };

  UI.prototype.showOver = function (stats) {
    this.hideAll();
    document.body.classList.add("menu-open");
    if (this.el.over) this.el.over.classList.remove("hidden");
    if (this.el.hud) this.el.hud.classList.remove("on");
    var hi = UI.saveHighScore(stats.score);
    if (this.el.overScore) this.el.overScore.textContent = M.formatScore(stats.score);
    if (this.el.overDist) this.el.overDist.textContent = Math.floor(stats.distance) + " M";
    if (this.el.overTime) this.el.overTime.textContent = M.formatTime(stats.time);
    if (this.el.overKills) this.el.overKills.textContent = String(stats.kills);
    if (this.el.hiscoreOver) this.el.hiscoreOver.textContent = M.formatScore(hi);
    if (this.el.flavor) this.el.flavor.textContent = UI.flavor(stats);
  };

  UI.flavor = function (s) {
    if (s.score > 40000) return "The void blinked first. VOID HAULER remains unlisted.";
    if (s.kills > 40) return "Pack broken. Crystalline remains mark a new meridian.";
    if (s.distance > 2500) return "A long white scar across the mare. They are still following.";
    if (s.time < 20) return "Contact at the pad. The run ends where it began.";
    if (s.kills === 0) return "No shots fired. The moon keeps its silence — and your hull.";
    return "Signal lost. Hull integrity zero. The Earth still watches.";
  };

  UI.prototype.toast = function (msg) {
    if (!this.el.toast) return;
    this.el.toast.textContent = msg;
    this.el.toast.classList.add("show");
    this._toastT = 1.6;
  };

  UI.prototype.flash = function () {
    var el = this.el.flash;
    if (!el) return;
    el.style.opacity = "0.35";
    setTimeout(function () {
      el.style.opacity = "0";
    }, 70);
  };

  UI.prototype.update = function (dt, state) {
    if (this._toastT > 0) {
      this._toastT -= dt;
      if (this._toastT <= 0 && this.el.toast) this.el.toast.classList.remove("show");
    }
    if (!state || !state.playing) return;

    if (this.el.score) this.el.score.textContent = M.formatScore(state.score);
    if (this.el.dist) this.el.dist.textContent = Math.floor(state.distance) + " M";
    if (this.el.time) this.el.time.textContent = M.formatTime(state.time);
    if (this.el.speed) this.el.speed.textContent = String(Math.floor(state.speed * 3.6));
    if (this.el.shield) this.el.shield.style.transform = "scaleX(" + M.saturate(state.shield / state.shieldMax) + ")";
    if (this.el.hull) this.el.hull.style.transform = "scaleX(" + M.saturate(state.hull / state.hullMax) + ")";
    if (this.el.wave) this.el.wave.textContent = String(state.wave);
    if (this.el.multi) this.el.multi.textContent = state.multi > 1 ? "x" + state.multi.toFixed(1) : "";
    if (this.el.threat) {
      this.el.threat.textContent = state.threat;
      this.el.threat.classList.toggle("hot", state.wave >= 4 || state.near > 2);
    }
    if (this.el.damage) {
      this.el.damage.style.opacity = String(M.saturate(state.hurt * 0.85 + (1 - state.hull / state.hullMax) * 0.15));
    }
    this._drawMap(state);
  };

  UI.prototype._drawMap = function (state) {
    var ctx = this.mapCtx;
    var c = this.el.minimap;
    if (!ctx || !c) return;
    var w = c.width;
    var h = c.height;
    var scale = 1.15;
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = "rgba(255,255,255,0.35)";
    ctx.strokeRect(0.5, 0.5, w - 1, h - 1);
    ctx.save();
    ctx.translate(w / 2, h / 2);
    ctx.rotate(-state.yaw);
    var i, sx, sz, r;
    ctx.strokeStyle = "rgba(255,255,255,0.12)";
    for (i = 1; i <= 3; i++) {
      r = i * 22;
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.fillStyle = "rgba(255,255,255,0.28)";
    for (i = 0; i < state.structures.length; i++) {
      sx = (state.structures[i].x - state.x) * scale;
      sz = (state.structures[i].z - state.z) * scale;
      if (Math.abs(sx) > w || Math.abs(sz) > h) continue;
      ctx.fillRect(sx - 1.5, sz - 1.5, 3, 3);
    }
    if (state.orbs) {
      ctx.strokeStyle = "#fff";
      for (i = 0; i < state.orbs.length; i++) {
        sx = (state.orbs[i].x - state.x) * scale;
        sz = (state.orbs[i].z - state.z) * scale;
        ctx.strokeRect(sx - 2, sz - 2, 4, 4);
      }
    }
    ctx.fillStyle = "#fff";
    for (i = 0; i < state.aliens.length; i++) {
      sx = (state.aliens[i].x - state.x) * scale;
      sz = (state.aliens[i].z - state.z) * scale;
      ctx.fillRect(sx - 1.5, sz - 1.5, 3, 3);
    }
    ctx.restore();
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.moveTo(w / 2, h / 2 - 6);
    ctx.lineTo(w / 2 + 4, h / 2 + 5);
    ctx.lineTo(w / 2 - 4, h / 2 + 5);
    ctx.closePath();
    ctx.fill();
  };

  UI.prototype._drawSilhouette = function () {
    var ctx = this.silCtx;
    var c = this.el.sil;
    if (!ctx || !c) return;
    var w = c.width;
    var h = c.height;
    ctx.clearRect(0, 0, w, h);
    ctx.strokeStyle = "rgba(255,255,255,0.7)";
    ctx.lineWidth = 1;
    /* Hauler: cab, cargo, six wheels. */
    ctx.strokeRect(34, h * 0.36, 38, h * 0.32);
    ctx.strokeRect(70, h * 0.32, 48, h * 0.38);
    ctx.strokeRect(24, h * 0.2, 10, 8);
    ctx.strokeRect(24, h * 0.72, 10, 8);
    ctx.strokeRect(72, h * 0.18, 10, 8);
    ctx.strokeRect(72, h * 0.74, 10, 8);
    ctx.strokeRect(112, h * 0.18, 10, 8);
    ctx.strokeRect(112, h * 0.74, 10, 8);
  };

  VR.UI = UI;
})(typeof window !== "undefined" ? window : globalThis);

/**
 * VOID RUNNER — Game loop + state
 * Copyright (c) 2026 VOID RUNNER contributors
 * SPDX-License-Identifier: MIT
 *
 * Owns the renderer, wires every subsystem, and is the only place that
 * mutates run stats (score, hull, wave). States: boot → title → play
 * ⇄ pause → over.
 */
(function (global) {
  "use strict";

  var VR = (global.VR = global.VR || {});
  var M = VR.math;
  var CFG = VR.CONFIG;

  function Game(canvas) {
    this.canvas = canvas;
    this.quality = VR.detectQuality();
    this.state = "boot";
    this.clock = new THREE.Clock();
    this._pauseEdge = false;
    this._startEdge = false;
    this._fireEdge = false;
    this._muteEdge = false;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(
      CFG.camera.fov,
      1,
      CFG.camera.near,
      CFG.camera.far
    );

    this.renderer = new THREE.WebGLRenderer({
      canvas: canvas,
      antialias: this.quality !== "low",
      alpha: false,
      powerPreference: "high-performance"
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.shadowMap.enabled = this.quality !== "low";
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.setClearColor(0x000000, 1);
    this.renderer.autoClear = true;

    this.input = new VR.Input(canvas);
    this.audio = new VR.AudioEngine();
    this.sky = new VR.Sky(this.scene);
    this.sky.setQuality(this.quality);
    this.terrain = new VR.Terrain(this.scene, this.quality);
    this.vehicle = new VR.Vehicle(this.scene);
    this.cameraRig = new VR.CameraRig(this.camera, this.vehicle);
    this.aliens = new VR.AlienSystem(this.scene, this.quality);
    this.orbs = new VR.OrbSystem(this.scene);
    this.combat = new VR.Combat(this.scene, this.vehicle);
    this.hazards = new VR.HazardSystem(this.scene);
    this.particles = new VR.Particles(this.scene, this.quality);
    this.postfx = new VR.PostFX(this.renderer, this.scene, this.camera, this.quality);
    this.ui = new VR.UI(this);

    this.shield = CFG.player.shieldMax;
    this.hull = CFG.player.hullMax;
    this.iframe = 0;
    this.regenDelay = 0;
    this.score = 0;
    this.distance = 0;
    this.time = 0;
    this.multi = 1;
    this.multiT = 0;
    this.hurt = 0;
    this._lastPos = new THREE.Vector3();
    this._dustAcc = 0;
    this._moteAcc = 0;
    this._autoDrive = false;

    this._onResize = this.resize.bind(this);
    window.addEventListener("resize", this._onResize);
    this.resize();

    this._loop = this.loop.bind(this);
    this._hideBoot();
    this.gotoTitle();
    requestAnimationFrame(this._loop);
  }

  Game.prototype._hideBoot = function () {
    var boot = document.getElementById("boot");
    if (boot) boot.classList.add("hidden");
  };

  Game.prototype.resize = function () {
    var w = window.innerWidth;
    var h = window.innerHeight;
    var pr = Math.min(
      window.devicePixelRatio || 1,
      this.quality === "low" ? CFG.renderer.lowPixelRatio : CFG.renderer.maxPixelRatio
    );
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setPixelRatio(pr);
    this.renderer.setSize(w, h, false);
    this.postfx.setSize(Math.floor(w * pr), Math.floor(h * pr));
    var map = document.getElementById("minimap");
    if (map) {
      var s = map.clientWidth || 148;
      if (map.width !== s) {
        map.width = s;
        map.height = s;
      }
    }
    var sil = document.getElementById("silhouette");
    if (sil && sil.width !== 148) {
      sil.width = 148;
      sil.height = 44;
    }
  };

  Game.prototype.gotoTitle = function () {
    this.state = "title";
    this.cameraRig.setMode("title");
    this.vehicle.reset();
    this.aliens.reset();
    this.orbs.reset();
    this.combat.reset();
    this.hazards.reset();
    this.ui.showTitle();
    this.audio.unlock();
    this.audio.ui("blip");
    try {
      if (document.exitPointerLock) document.exitPointerLock();
    } catch (e) {}
  };

  Game.prototype.startRun = function () {
    this.audio.unlock();
    this.audio.ui("confirm");
    this.vehicle.reset();
    this.aliens.reset();
    this.orbs.reset();
    this.combat.reset();
    this.hazards.reset();
    this.shield = CFG.player.shieldMax;
    this.hull = CFG.player.hullMax;
    this.iframe = 0;
    this.regenDelay = 0;
    this.score = 0;
    this.distance = 0;
    this.time = 0;
    this.multi = 1;
    this.multiT = 0;
    this.hurt = 0;
    this._lastPos.copy(this.vehicle.pos);
    this.terrain.rebuild(0, 0);
    this.cameraRig.setMode("play");
    this.cameraRig.snapBehind();
    this.state = "play";
    this.ui.showPlay();
    this.ui.toast("VOID HAULER — DRIVE");
    this.ui.flash();
    if (/[?&]drive=1/.test(location.search || "")) {
      this._autoDrive = true;
      var fake = { throttle: 1, steer: 0.18, handbrake: false, fire: false, boost: false };
      var t;
      for (t = 0; t < 1.8; t += 0.016) {
        this.vehicle.update(0.016, fake, this.terrain, false);
        this.time += 0.016;
      }
      this.cameraRig.snapBehind();
    }
  };

  Game.prototype.togglePause = function (force) {
    if (this.state !== "play" && this.state !== "pause") return;
    var on = typeof force === "boolean" ? force : this.state !== "pause";
    if (on) {
      this.state = "pause";
      this.ui.showPause(true);
      this.audio.ui("blip");
      try {
        if (document.exitPointerLock) document.exitPointerLock();
      } catch (e) {}
    } else {
      this.state = "play";
      this.ui.showPause(false);
      this.audio.ui("confirm");
    }
  };

  Game.prototype._gameOver = function () {
    if (this.state !== "play") return;
    this.state = "over";
    this.cameraRig.setMode("over");
    this.audio.die();
    this.postfx.addGlitch(1.2);
    this.ui.showOver({
      score: this.score,
      distance: this.distance,
      time: this.time,
      kills: this.aliens.kills
    });
    try {
      if (document.exitPointerLock) document.exitPointerLock();
    } catch (e) {}
  };

  Game.prototype.applyDamage = function (amt, nx, nz, force) {
    if (this.iframe > 0 || this.state !== "play") return;
    var rest = amt;
    if (this.shield > 0) {
      var absorb = Math.min(this.shield, rest);
      this.shield -= absorb;
      rest -= absorb;
    }
    if (rest > 0) this.hull -= rest;
    this.iframe = CFG.combat.iframe;
    this.regenDelay = CFG.player.shieldRegenDelay;
    this.hurt = 1;
    this.vehicle.knock(nx || 0, nz || 0, force || 12);
    this.cameraRig.addShake(amt > 16 ? 1.1 : 0.65);
    this.postfx.addGlitch(0.7);
    this.audio.impact(amt > 16);
    this.particles.burst(this.vehicle.pos.x, this.vehicle.pos.y + 0.8, this.vehicle.pos.z, 6, 12);
    if (this.hull <= 0) {
      this.hull = 0;
      this._gameOver();
    }
  };

  Game.prototype._scoreKill = function (kind) {
    var table = {
      scout: CFG.score.perKillScout,
      brute: CFG.score.perKillBrute,
      flyer: CFG.score.perKillFlyer
    };
    var pts = (table[kind] || 100) * this.multi;
    this.score += pts;
    this.ui.toast("+" + Math.floor(pts));
    this.ui.flash();
    this.cameraRig.addShake(0.45);
    this.postfx.addGlitch(0.35);
  };

  Game.prototype.loop = function () {
    var dt = Math.min(0.05, this.clock.getDelta());
    var input = this.input.frame();
    var playing = this.state === "play";

    if (input.pause && !this._pauseEdge) {
      if (this.state === "play") this.togglePause(true);
      else if (this.state === "pause") this.togglePause(false);
      else if (this.state === "over") this.gotoTitle();
    }
    this._pauseEdge = input.pause;

    if (input.start && !this._startEdge) {
      if (this.state === "title" || this.state === "over") this.startRun();
    }
    this._startEdge = input.start;

    if (input.mute && !this._muteEdge) {
      this.audio.setMuted(!this.audio.muted);
      this.ui.toast(this.audio.muted ? "AUDIO MUTE" : "AUDIO LIVE");
    }
    this._muteEdge = input.mute;

    if (this.state === "title" || this.state === "over") {
      this.vehicle.idleDisplay(dt);
    }

    if (playing) {
      this._tickPlay(dt, input);
    }

    this.cameraRig.update(dt, input, playing || this.state === "pause");
    this.sky.update(dt, this.vehicle.pos);
    this.audio.update(dt, this.vehicle, playing);
    this.particles.update(dt);
    this.ui.update(dt, this._hudState(playing));

    this.postfx.render(dt, this.cameraRig.shake, {
      speedN: M.saturate(this.vehicle.speed / CFG.vehicle.maxSpeed),
      boost: this.vehicle.boostT,
      dust: (this.vehicle.surfDust || 0.9) * M.saturate(this.vehicle.speed / 18),
      hurt: this.hurt
    });
    requestAnimationFrame(this._loop);
  };

  Game.prototype._tickPlay = function (dt, input) {
    var v = this.vehicle;
    if (this._autoDrive) {
      input.throttle = 1;
      input.steer = Math.sin(this.time * 0.55) * 0.32;
      if (this.time > 1.2 && this.time < 2.6) input.fire = true;
    }
    var boosting = input.boost && v.boostFuel > 0;

    v.update(dt, input, this.terrain, boosting);
    this.terrain.maybeRebuild(v.pos.x, v.pos.z);
    this.terrain.stream(v.pos.x, v.pos.z, false);

    if (input.fire) {
      if (this.combat.tryFire(this.audio)) {
        var mz = v.muzzleWorld();
        this.particles.burst(mz.x, mz.y, mz.z, 3.5, 7);
        this.cameraRig.addShake(0.07);
      }
    }

    var kills = this.combat.update(dt, this.aliens, this.particles, this.audio);
    var ki;
    for (ki = 0; ki < kills.length; ki++) this._scoreKill(kills[ki]);

    this.aliens.update(dt, v, this.terrain, this.particles, this.audio, this.aliens.wave);
    this.orbs.update(dt, v, this.terrain);

    var collected = this.orbs.collectNear(v, 3.2);
    var ci, kind;
    for (ci = 0; ci < collected.length; ci++) {
      kind = collected[ci];
      this.audio.orb();
      this.score += CFG.score.perOrb * this.multi;
      this.particles.burst(v.pos.x, v.pos.y + 1, v.pos.z, 4, 10);
      if (kind === "boost") {
        v.giveBoost(4.6);
        this.ui.toast("OVERDRIVE");
      } else if (kind === "shield") {
        this.shield = Math.min(CFG.player.shieldMax, this.shield + 50);
        this.ui.toast("SHIELD RESEED");
      } else if (kind === "rapid") {
        this.combat.rapidT = 9;
        this.ui.toast("RAPID FIRE");
      } else {
        this.multi = Math.min(4, this.multi + 0.5);
        this.multiT = 12;
        this.ui.toast("MULTIPLIER x" + this.multi.toFixed(1));
      }
    }

    var hz = this.hazards.update(dt, v, this.terrain, this.particles, this.audio, this.aliens.wave);
    var hi, hx;
    for (hi = 0; hi < hz.length; hi++) {
      hx = hz[hi];
      this.applyDamage(hx.dmg, hx.x, hx.z, hx.force);
    }

    /* Alien contact. */
    var self = this;
    var near = 0;
    this.aliens.forAlive(function (a) {
      var dx = v.pos.x - a.x;
      var dz = v.pos.z - a.z;
      var d = Math.hypot(dx, dz);
      if (d < 42) near++;
      if (d < a.radius + CFG.vehicle.radius && Math.abs(v.pos.y - a.y) < 2.4 && a.attackCd <= 0) {
        a.attackCd = 0.7;
        self.applyDamage(a.dmg, dx, dz, a.kind === "brute" ? 22 : 12);
        /* Ramming a scout at speed can shatter it. */
        if (a.kind === "scout" && v.speed > 16) {
          if (self.aliens.hit(a, 40, self.particles)) {
            self.aliens.kill(a, self.particles, self.audio);
            self._scoreKill("scout");
          }
        }
      }
    });

    this.iframe = Math.max(0, this.iframe - dt);
    this.hurt = Math.max(0, this.hurt - dt * 1.8);
    this.regenDelay = Math.max(0, this.regenDelay - dt);
    if (this.regenDelay <= 0 && this.shield < CFG.player.shieldMax) {
      this.shield = Math.min(CFG.player.shieldMax, this.shield + CFG.player.shieldRegen * dt);
    }
    this.multiT = Math.max(0, this.multiT - dt);
    if (this.multiT <= 0) this.multi = 1;

    var step = Math.hypot(v.pos.x - this._lastPos.x, v.pos.z - this._lastPos.z);
    this.distance += step;
    this._lastPos.copy(v.pos);
    this.time += dt;
    this.score += step * CFG.score.perMeter * this.multi;
    this.score += dt * CFG.score.perSecond * this.multi;

    this.particles.setHeadlights(
      v.pos.x + v.heading.x * 2.2,
      v.pos.y + 0.85,
      v.pos.z + v.heading.z * 2.2,
      v.heading.x,
      -0.1,
      v.heading.z,
      (CFG.dust && CFG.dust.headlight) || 1
    );

    var dustRate = (CFG.dust && CFG.dust.wheelRate) || 0.03;
    if (this.quality === "low") dustRate *= 1.6;
    else if (this.quality === "med") dustRate *= 1.2;
    var wantDust = v.grounded && (v.speed > 3.2 || v.slip > 1.2 || Math.abs(v.accelLong) > 7);
    this._dustAcc += dt;
    if (!wantDust) this._dustAcc = Math.min(this._dustAcc, dustRate);
    if (wantDust && this._dustAcc > dustRate) {
      this._dustAcc = 0;
      var wi, wh;
      var stride = this.quality === "low" ? 2 : 1;
      for (wi = 0; wi < v.wheels.length; wi += stride) {
        wh = v.wheels[wi];
        if (!wh.grounded) continue;
        this.particles.wheelDust(
          wh.wx,
          wh.wy,
          wh.wz,
          v.heading.x,
          v.heading.z,
          v.right.x,
          v.right.z,
          v.speed,
          v.latV,
          v.accelLong,
          (v.surfDust || 0.9) * (wh.dust || 1),
          v.boostT
        );
      }
    }
    this._moteAcc += dt;
    if (v.grounded && v.speed > 8 && v.surfDust > 0.55 && this._moteAcc > 0.11) {
      this.particles.beamMotes(v.pos.x, v.pos.y, v.pos.z, v.heading.x, v.heading.z, v.surfDust);
      this._moteAcc = 0;
    }
    if (v.landImpulse > 2.4) {
      this.particles.landDust(v.pos.x, v.pos.y, v.pos.z, v.landImpulse, v.surfDust);
      this.cameraRig.addShake(Math.min(1.15, v.landImpulse * 0.075));
    }
    if (v.collideImpulse > 6.5) {
      this.particles.burst(v.pos.x, v.pos.y + 0.6, v.pos.z, 4 + v.collideImpulse * 0.15, 10);
      this.audio.impact(v.collideImpulse > 12);
      this.cameraRig.addShake(Math.min(0.85, v.collideImpulse * 0.04));
    }
    if (v.boostT > 0.2) this.particles.boost(v.pos.x, v.pos.y, v.pos.z, v.heading.x, v.heading.z);
    v.setHullVisual(this.hull / CFG.player.hullMax);
    v._smokeAcc = (v._smokeAcc || 0) + dt;
    if (this.hull < CFG.player.hullMax * 0.45 && v._smokeAcc > 0.09) {
      this.particles.smoke(
        v.pos.x - v.heading.x * 2.4,
        v.pos.y + 2.5,
        v.pos.z - v.heading.z * 2.4
      );
      v._smokeAcc = 0;
    }

    this._near = near;
    void input;
  };

  Game.prototype._hudState = function (playing) {
    var aliens = [];
    var structs = [];
    if (playing) {
      this.aliens.forAlive(function (a) {
        aliens.push({ x: a.x, z: a.z });
      });
      structs = this.terrain.nearby(this.vehicle.pos.x, this.vehicle.pos.z, 90);
    }
    var threat = "QUIET";
    if (this.aliens.wave >= 6) threat = "WHITEOUT";
    else if (this.aliens.wave >= 4) threat = "SWARM";
    else if (this.aliens.wave >= 2) threat = "CONTACT";
    return {
      playing: playing,
      score: this.score,
      distance: this.distance,
      time: this.time,
      speed: this.vehicle.speed,
      shield: this.shield,
      shieldMax: CFG.player.shieldMax,
      hull: this.hull,
      hullMax: CFG.player.hullMax,
      wave: this.aliens.wave,
      multi: this.multi,
      threat: threat,
      near: this._near || 0,
      hurt: this.hurt,
      yaw: this.vehicle.yaw,
      x: this.vehicle.pos.x,
      z: this.vehicle.pos.z,
      aliens: aliens,
      structures: structs,
      orbs: playing ? this.orbs.listAlive() : []
    };
  };

  VR.Game = Game;
})(typeof window !== "undefined" ? window : globalThis);

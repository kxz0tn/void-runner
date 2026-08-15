/**
 * VOID RUNNER — Forward energy bolts
 * Copyright (c) 2026 VOID RUNNER contributors
 * SPDX-License-Identifier: MIT
 *
 * Discrete white projectiles spawned at the hauler muzzle. Hold-fire is
 * gated by cooldown. Hits use a simple swept-sphere against robot radii.
 */
(function (global) {
  "use strict";

  var VR = (global.VR = global.VR || {});
  var M = VR.math;
  var C = VR.CONFIG.combat;

  function Combat(scene, vehicle) {
    this.scene = scene;
    this.vehicle = vehicle;
    this.cd = 0;
    this.rapidT = 0;
    this.mat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.95,
      depthWrite: false
    });
    var self = this;
    this.pool = new M.Pool(function () {
      return self._create();
    }, 14);
  }

  Combat.prototype._create = function () {
    var g = new THREE.Group();
    var core = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6), this.mat.clone());
    var shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.09, 1.35, 6), this.mat.clone());
    shaft.rotation.x = Math.PI / 2;
    shaft.position.z = 0.35;
    g.add(core);
    g.add(shaft);
    g.visible = false;
    this.scene.add(g);
    return {
      alive: false,
      mesh: g,
      core: core,
      x: 0,
      y: 0,
      z: 0,
      vx: 0,
      vz: 0,
      vy: 0,
      life: 0,
      maxLife: C.pulseLife
    };
  };

  Combat.prototype.reset = function () {
    var i, p;
    this.cd = 0;
    this.rapidT = 0;
    for (i = 0; i < this.pool.items.length; i++) {
      p = this.pool.items[i];
      p.alive = false;
      p.mesh.visible = false;
    }
  };

  Combat.prototype.tryFire = function (audio) {
    if (this.cd > 0) return false;
    var v = this.vehicle;
    var p = this.pool.obtain();
    var hx = -Math.sin(v.yaw);
    var hz = -Math.cos(v.yaw);
    var m = v.muzzleWorld();
    p.alive = true;
    p.mesh.visible = true;
    p.x = m.x;
    p.y = m.y;
    p.z = m.z;
    p.vx = hx * C.pulseSpeed + v.vel.x * 0.35;
    p.vz = hz * C.pulseSpeed + v.vel.z * 0.35;
    p.vy = 0;
    p.life = C.pulseLife;
    p.maxLife = C.pulseLife;
    p.mesh.position.set(p.x, p.y, p.z);
    p.mesh.rotation.y = v.yaw;
    this.cd = C.pulseCooldown * (this.rapidT > 0 ? C.rapidScale : 1);
    v.pulseFlash = 1;
    if (audio) {
      if (audio.shot) audio.shot();
      else audio.pulse();
    }
    return true;
  };

  Combat.prototype.update = function (dt, aliens, particles, audio) {
    this.cd = Math.max(0, this.cd - dt);
    this.rapidT = Math.max(0, this.rapidT - dt);
    var killed = [];
    var r = C.pulseRadius;
    var r2 = r * r;
    this.pool.forAlive(function (p) {
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
      p.mesh.position.set(p.x, p.y, p.z);
      var fade = Math.max(0.15, p.life / p.maxLife);
      if (p.core && p.core.material) p.core.material.opacity = fade;
      if (p.life <= 0) {
        p.alive = false;
        p.mesh.visible = false;
        return;
      }
      aliens.forAlive(function (a) {
        if (!p.alive || !a.alive) return;
        var dx = a.x - p.x;
        var dy = a.y - p.y;
        var dz = a.z - p.z;
        var hitR = a.radius + r;
        if (dx * dx + dz * dz + dy * dy * 0.45 < hitR * hitR) {
          p.alive = false;
          p.mesh.visible = false;
          if (particles) particles.burst(p.x, p.y, p.z, 6, 12);
          if (aliens.hit(a, C.pulseDamage, particles, p.vx, p.vz)) {
            aliens.kill(a, particles, audio);
            killed.push(a.kind);
          }
        }
      });
      void r2;
    });
    return killed;
  };

  VR.Combat = Combat;
})(typeof window !== "undefined" ? window : globalThis);

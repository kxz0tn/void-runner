/**
 * VOID RUNNER — Environmental hazards
 * Copyright (c) 2026 VOID RUNNER contributors
 * SPDX-License-Identifier: MIT
 *
 * Falling debris and expanding energy-storm rings. Both are pooled and
 * only unlock after the early waves so the opening drive stays readable.
 */
(function (global) {
  "use strict";

  var VR = (global.VR = global.VR || {});
  var M = VR.math;

  function HazardSystem(scene) {
    this.scene = scene;
    this.meteorAcc = 8;
    this.stormAcc = 14;
    this.matRock = new THREE.MeshStandardMaterial({
      color: 0x2a2a2a,
      roughness: 0.7,
      metalness: 0.25,
      flatShading: true
    });
    this.matRing = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.55,
      side: THREE.DoubleSide,
      depthWrite: false
    });
    var self = this;
    this.meteors = new M.Pool(function () {
      return self._meteor();
    }, 10);
    this.storms = new M.Pool(function () {
      return self._storm();
    }, 4);
  }

  HazardSystem.prototype._meteor = function () {
    var mesh = new THREE.Mesh(new THREE.IcosahedronGeometry(0.8, 0), this.matRock);
    mesh.castShadow = true;
    mesh.visible = false;
    this.scene.add(mesh);
    return { alive: false, mesh: mesh, x: 0, y: 0, z: 0, vy: 0, r: 1.2 };
  };

  HazardSystem.prototype._storm = function () {
    var mesh = new THREE.Mesh(new THREE.RingGeometry(0.8, 1.15, 40), this.matRing.clone());
    mesh.rotation.x = -Math.PI / 2;
    mesh.visible = false;
    this.scene.add(mesh);
    return { alive: false, mesh: mesh, x: 0, y: 0, z: 0, rad: 1, max: 28, life: 0 };
  };

  HazardSystem.prototype.reset = function () {
    var i, o;
    this.meteorAcc = 10;
    this.stormAcc = 16;
    for (i = 0; i < this.meteors.items.length; i++) {
      o = this.meteors.items[i];
      o.alive = false;
      o.mesh.visible = false;
    }
    for (i = 0; i < this.storms.items.length; i++) {
      o = this.storms.items[i];
      o.alive = false;
      o.mesh.visible = false;
    }
  };

  HazardSystem.prototype.update = function (dt, vehicle, terrain, particles, audio, wave) {
    var hits = [];
    var ang, dist, x, z, m, s, ground, dx, dz, d;

    if (wave >= 3) {
      this.meteorAcc -= dt;
      if (this.meteorAcc <= 0) {
        ang = Math.random() * Math.PI * 2;
        dist = 8 + Math.random() * 36;
        x = vehicle.pos.x + Math.cos(ang) * dist;
        z = vehicle.pos.z + Math.sin(ang) * dist;
        m = this.meteors.obtain();
        m.alive = true;
        m.mesh.visible = true;
        m.x = x;
        m.z = z;
        m.y = terrain.heightAt(x, z) + 38 + Math.random() * 16;
        m.vy = -18 - Math.random() * 10;
        m.r = 1.1 + Math.random() * 0.6;
        m.mesh.scale.setScalar(m.r);
        this.meteorAcc = Math.max(1.6, 5.5 - wave * 0.35);
      }
    }

    if (wave >= 4) {
      this.stormAcc -= dt;
      if (this.stormAcc <= 0) {
        ang = Math.random() * Math.PI * 2;
        dist = 10 + Math.random() * 24;
        s = this.storms.obtain();
        s.alive = true;
        s.mesh.visible = true;
        s.x = vehicle.pos.x + Math.cos(ang) * dist;
        s.z = vehicle.pos.z + Math.sin(ang) * dist;
        s.y = terrain.heightAt(s.x, s.z) + 0.4;
        s.rad = 1.2;
        s.max = 22 + wave * 2;
        s.life = 2.4;
        s.hit = false;
        this.stormAcc = Math.max(6, 14 - wave * 0.6);
        if (audio) audio.storm();
      }
    }

    this.meteors.forAlive(function (met) {
      met.y += met.vy * dt;
      met.vy -= 10 * dt;
      met.mesh.position.set(met.x, met.y, met.z);
      met.mesh.rotation.x += dt * 3;
      met.mesh.rotation.z += dt * 2;
      ground = terrain.heightAt(met.x, met.z);
      if (met.y <= ground + met.r) {
        met.alive = false;
        met.mesh.visible = false;
        if (particles) particles.burst(met.x, ground + 0.5, met.z, 9, 18);
        dx = vehicle.pos.x - met.x;
        dz = vehicle.pos.z - met.z;
        d = Math.hypot(dx, dz);
        if (d < 6.5) {
          hits.push({ kind: "meteor", dmg: 18, x: dx, z: dz, force: 18 });
        }
      }
    });

    this.storms.forAlive(function (st) {
      st.life -= dt;
      st.rad += dt * 14;
      st.mesh.position.set(st.x, st.y, st.z);
      st.mesh.scale.setScalar(st.rad);
      st.mesh.material.opacity = Math.max(0, st.life / 2.4) * 0.55;
      dx = vehicle.pos.x - st.x;
      dz = vehicle.pos.z - st.z;
      d = Math.hypot(dx, dz);
      if (!st.hit && Math.abs(d - st.rad) < 1.6) {
        st.hit = true;
        hits.push({ kind: "storm", dmg: 14, x: dx, z: dz, force: 10 });
      }
      if (st.life <= 0 || st.rad > st.max) {
        st.alive = false;
        st.mesh.visible = false;
      }
    });

    return hits;
  };

  VR.HazardSystem = HazardSystem;
})(typeof window !== "undefined" ? window : globalThis);

/**
 * VOID RUNNER — Energy orbs
 * Copyright (c) 2026 VOID RUNNER contributors
 * SPDX-License-Identifier: MIT
 *
 * BOOST / SHIELD / RAPID. They bob, slowly attract when close, and
 * sit on the mare height so they never clip underground.
 */
(function (global) {
  "use strict";

  var VR = (global.VR = global.VR || {});
  var M = VR.math;

  function OrbSystem(scene) {
    this.scene = scene;
    this.acc = 2;
    this.mat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.92
    });
    this.wire = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.5 });
    var self = this;
    this.pool = new M.Pool(function () {
      return self._create();
    }, 8);
  }

  OrbSystem.prototype._create = function () {
    var root = new THREE.Group();
    var mesh = new THREE.Mesh(new THREE.OctahedronGeometry(0.55, 0), this.mat);
    var edge = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.OctahedronGeometry(0.7, 0)), this.wire);
    var light = new THREE.PointLight(0xffffff, 0.95, 10, 2);
    root.add(mesh);
    root.add(edge);
    root.add(light);
    root.visible = false;
    this.scene.add(root);
    return { alive: false, root: root, mesh: mesh, kind: "boost", x: 0, y: 0, z: 0, vx: 0, vz: 0, t: 0 };
  };

  OrbSystem.prototype.reset = function () {
    var i, o;
    this.acc = 3;
    for (i = 0; i < this.pool.items.length; i++) {
      o = this.pool.items[i];
      o.alive = false;
      o.root.visible = false;
    }
  };

  OrbSystem.prototype._spawn = function (x, y, z, kind) {
    var o = this.pool.obtain();
    o.alive = true;
    o.root.visible = true;
    o.x = x;
    o.y = y;
    o.z = z;
    o.vx = 0;
    o.vz = 0;
    o.kind = kind;
    o.t = Math.random() * 5;
    o.root.position.set(x, y, z);
  };

  OrbSystem.prototype.update = function (dt, vehicle, terrain) {
    this.acc -= dt;
    var alive = 0, i;
    for (i = 0; i < this.pool.items.length; i++) if (this.pool.items[i].alive) alive++;
    if (this.acc <= 0 && alive < 5) {
      var ang = Math.random() * Math.PI * 2;
      var dist = 26 + Math.random() * 50;
      var x = vehicle.pos.x + Math.cos(ang) * dist;
      var z = vehicle.pos.z + Math.sin(ang) * dist;
      var kinds = ["boost", "shield", "rapid"];
      this._spawn(x, terrain.heightAt(x, z) + 2.1, z, kinds[(Math.random() * 3) | 0]);
      this.acc = 6 + Math.random() * 5;
    }
    this.pool.forAlive(function (orb) {
      var dx = vehicle.pos.x - orb.x;
      var dz = vehicle.pos.z - orb.z;
      var d = Math.hypot(dx, dz) || 1;
      if (d < 14) {
        orb.vx += (dx / d) * 18 * dt;
        orb.vz += (dz / d) * 18 * dt;
      }
      orb.vx *= 0.92;
      orb.vz *= 0.92;
      orb.x += orb.vx * dt;
      orb.z += orb.vz * dt;
      orb.t += dt;
      orb.y = terrain.heightAt(orb.x, orb.z) + 2.1;
      orb.root.position.set(orb.x, orb.y + Math.sin(orb.t * 2.4) * 0.32, orb.z);
      orb.root.rotation.y += dt * 1.6;
      orb.mesh.rotation.x += dt * 0.8;
    });
  };

  OrbSystem.prototype.collectNear = function (vehicle, radius) {
    var got = [];
    var r2 = radius * radius;
    this.pool.forAlive(function (o) {
      var dx = o.x - vehicle.pos.x;
      var dz = o.z - vehicle.pos.z;
      var dy = o.root.position.y - vehicle.pos.y;
      if (dx * dx + dz * dz + dy * dy < r2) {
        o.alive = false;
        o.root.visible = false;
        got.push(o.kind);
      }
    });
    return got;
  };

  OrbSystem.prototype.listAlive = function () {
    var out = [];
    this.pool.forAlive(function (o) {
      out.push({ x: o.x, z: o.z, kind: o.kind });
    });
    return out;
  };

  VR.OrbSystem = OrbSystem;
})(typeof window !== "undefined" ? window : globalThis);

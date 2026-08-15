/**
 * VOID RUNNER — Robotic hostiles
 * Copyright (c) 2026 VOID RUNNER contributors
 * SPDX-License-Identifier: MIT
 *
 * Humanoid walkers (brute), leaping hunters (flyer), and mini crawlers
 * (scout). All mechanical: plates, pistons, white cores. No organics.
 */
(function (global) {
  "use strict";

  var VR = (global.VR = global.VR || {});
  var M = VR.math;

  function AlienSystem(scene, quality) {
    this.scene = scene;
    this.quality = quality || "high";
    this.time = 0;
    this.wave = 1;
    this.spawnAcc = 0;
    this.kills = 0;
    this.killsBy = { scout: 0, brute: 0, flyer: 0 };
    this._shared = this._makeMaterials();
    this._templates = {
      scout: this._template("scout"),
      brute: this._template("brute"),
      flyer: this._template("flyer")
    };
    var cap = quality === "low" ? 12 : VR.CONFIG.aliens.maxAlive;
    var self = this;
    this.pool = new M.Pool(function () {
      return self._create();
    }, cap);
  }

  AlienSystem.prototype._makeMaterials = function () {
    return {
      hull: new THREE.MeshStandardMaterial({
        color: 0x141414,
        metalness: 0.88,
        roughness: 0.26,
        flatShading: true
      }),
      plate: new THREE.MeshStandardMaterial({
        color: 0x2a2a2a,
        metalness: 0.8,
        roughness: 0.32,
        flatShading: true
      }),
      dark: new THREE.MeshStandardMaterial({
        color: 0x070707,
        metalness: 0.5,
        roughness: 0.55,
        flatShading: true
      }),
      core: new THREE.MeshBasicMaterial({ color: 0xffffff })
    };
  };

  AlienSystem.prototype._box = function (root, mat, w, h, d, x, y, z, rx, ry) {
    var m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z);
    if (rx) m.rotation.x = rx;
    if (ry) m.rotation.y = ry;
    m.castShadow = true;
    root.add(m);
    return m;
  };

  /** Mini crawler — low chassis, four pistons, chest lamp. */
  AlienSystem.prototype._buildScout = function (root, mats) {
    this._box(root, mats.hull, 0.55, 0.28, 0.7, 0, 0.38, 0);
    var core = this._box(root, mats.core, 0.16, 0.16, 0.16, 0, 0.42, 0.08);
    this._box(root, mats.dark, 0.28, 0.14, 0.22, 0, 0.52, -0.22);
    var legs = [];
    var i, g, sx, sz;
    for (i = 0; i < 4; i++) {
      sx = i < 2 ? -0.28 : 0.28;
      sz = i % 2 ? 0.22 : -0.22;
      g = new THREE.Group();
      g.position.set(sx, 0.28, sz);
      this._box(g, mats.plate, 0.1, 0.42, 0.1, sx > 0 ? 0.16 : -0.16, -0.12, 0);
      root.add(g);
      legs.push(g);
    }
    return { kind: "scout", legs: legs, core: core, lightNeed: 0.45 };
  };

  /** Humanoid walker — torso, head, two arms, two piston legs. */
  AlienSystem.prototype._buildBrute = function (root, mats) {
    this._box(root, mats.hull, 0.85, 1.15, 0.55, 0, 1.55, 0);
    this._box(root, mats.plate, 0.95, 0.22, 0.4, 0, 2.15, 0.02);
    this._box(root, mats.dark, 0.38, 0.38, 0.38, 0, 2.42, 0);
    this._box(root, mats.core, 0.28, 0.06, 0.06, 0, 2.44, -0.2);
    var core = this._box(root, mats.core, 0.22, 0.28, 0.12, 0, 1.55, -0.28);
    this._box(root, mats.plate, 0.22, 0.7, 0.22, -0.58, 1.55, 0);
    this._box(root, mats.plate, 0.22, 0.7, 0.22, 0.58, 1.55, 0);
    var legs = [];
    var i, g, sx;
    for (i = 0; i < 2; i++) {
      sx = i === 0 ? -0.28 : 0.28;
      g = new THREE.Group();
      g.position.set(sx, 0.95, 0);
      this._box(g, mats.hull, 0.26, 0.95, 0.26, 0, -0.35, 0);
      this._box(g, mats.plate, 0.3, 0.12, 0.4, 0, -0.82, 0.04);
      root.add(g);
      legs.push(g);
    }
    return { kind: "brute", legs: legs, core: core, lightNeed: 0.8 };
  };

  /** Sprinting hunter — leaner humanoid, longer stride. */
  AlienSystem.prototype._buildFlyer = function (root, mats) {
    this._box(root, mats.hull, 0.62, 0.95, 0.42, 0, 1.35, 0);
    this._box(root, mats.dark, 0.3, 0.3, 0.3, 0, 2.0, 0.02);
    this._box(root, mats.core, 0.22, 0.05, 0.05, 0, 2.02, -0.16);
    var core = this._box(root, mats.core, 0.16, 0.2, 0.1, 0, 1.35, -0.22);
    this._box(root, mats.plate, 0.16, 0.65, 0.16, -0.42, 1.3, 0);
    this._box(root, mats.plate, 0.16, 0.65, 0.16, 0.42, 1.3, 0);
    var legs = [];
    var i, g, sx;
    for (i = 0; i < 2; i++) {
      sx = i === 0 ? -0.2 : 0.2;
      g = new THREE.Group();
      g.position.set(sx, 0.8, 0);
      this._box(g, mats.hull, 0.18, 0.85, 0.18, 0, -0.28, 0);
      root.add(g);
      legs.push(g);
    }
    return { kind: "flyer", legs: legs, core: core, lightNeed: 0.6 };
  };

  AlienSystem.prototype._template = function (kind) {
    var root = new THREE.Group();
    var built;
    if (kind === "brute") built = this._buildBrute(root, this._shared);
    else if (kind === "flyer") built = this._buildFlyer(root, this._shared);
    else built = this._buildScout(root, this._shared);
    root.userData.lightNeed = built.lightNeed;
    root.visible = false;
    return root;
  };

  AlienSystem.prototype._create = function () {
    var root = new THREE.Group();
    root.visible = false;
    this.scene.add(root);
    var light = new THREE.PointLight(0xffffff, 0, 8, 2);
    root.add(light);
    return {
      alive: false,
      root: root,
      light: light,
      body: null,
      parts: { kind: "scout", legs: [], core: null, lightNeed: 0.4 },
      kind: "scout",
      mode: "pursue",
      x: 0,
      y: 0,
      z: 0,
      vx: 0,
      vz: 0,
      hp: 1,
      maxHp: 1,
      speed: 10,
      radius: 1.1,
      dmg: 8,
      yaw: 0,
      phase: Math.random() * 6,
      stagger: 0,
      attackCd: 0,
      flank: Math.random() < 0.5 ? -1 : 1,
      modeT: 0,
      corpse: 0,
      vy: 0,
      spinX: 0,
      spinZ: 0,
      lean: 0
    };
  };

  AlienSystem.prototype._harvestParts = function (body) {
    var legs = [];
    var core = null;
    body.children.forEach(function (ch) {
      if (ch.isGroup) legs.push(ch);
    });
    body.traverse(function (o) {
      if (o.isMesh && o.material && o.material.isMeshBasicMaterial) core = o;
    });
    return { legs: legs, core: core };
  };

  AlienSystem.prototype._dress = function (a, kind) {
    if (a.body) a.root.remove(a.body);
    a.body = this._templates[kind].clone(true);
    a.body.visible = true;
    a.root.add(a.body);
    var harvested = this._harvestParts(a.body);
    a.parts = {
      kind: kind,
      legs: harvested.legs,
      core: harvested.core,
      lightNeed: this._templates[kind].userData.lightNeed
    };
    a.kind = kind;
    a.light.intensity = a.parts.lightNeed;
  };

  AlienSystem.prototype._obtainFree = function () {
    var i, it;
    for (i = 0; i < this.pool.items.length; i++) {
      it = this.pool.items[i];
      if (!it.alive && !(it.corpse > 0)) return it;
    }
    return this.pool.obtain();
  };

  AlienSystem.prototype.spawn = function (kind, x, y, z) {
    var a = this._obtainFree();
    this._dress(a, kind);
    a.alive = true;
    a.root.visible = true;
    a.x = x;
    a.y = y;
    a.z = z;
    a.vx = a.vz = 0;
    a.stagger = 0;
    a.attackCd = 0.4;
    a.flank = Math.random() < 0.5 ? -1 : 1;
    a.phase = Math.random() * 6;
    a.modeT = 0;
    a.corpse = 0;
    a.lean = 0;
    a.vy = 0;
    a.root.rotation.x = 0;
    a.root.rotation.z = 0;
    if (kind === "brute") {
      a.hp = a.maxHp = 120;
      a.speed = VR.CONFIG.aliens.bruteSpeed;
      a.radius = 1.15;
      a.dmg = 24;
      a.mode = "pursue";
    } else if (kind === "flyer") {
      a.hp = a.maxHp = 55;
      a.speed = VR.CONFIG.aliens.flyerSpeed;
      a.radius = 0.95;
      a.dmg = 14;
      a.mode = "flank";
    } else {
      a.hp = a.maxHp = 22;
      a.speed = VR.CONFIG.aliens.scoutSpeed;
      a.radius = 0.75;
      a.dmg = 8;
      a.mode = "swarm";
    }
    a.root.position.set(x, y, z);
    return a;
  };

  AlienSystem.prototype.kill = function (a, particles, audio) {
    if (!a.alive) return;
    a.alive = false;
    a.corpse = 0.62;
    a.root.visible = true;
    a.vy = 5.2 + Math.random() * 3.4;
    a.spinX = (Math.random() - 0.5) * 10;
    a.spinZ = (Math.random() - 0.5) * 8;
    a.vx *= 1.35;
    a.vz *= 1.35;
    this.kills++;
    this.killsBy[a.kind] = (this.killsBy[a.kind] || 0) + 1;
    if (particles) particles.burst(a.x, a.y + 0.8, a.z, 12, a.kind === "brute" ? 32 : 16);
    if (audio) audio.shriek(a.kind);
  };

  AlienSystem.prototype.hit = function (a, dmg, particles, kx, kz) {
    if (!a.alive) return false;
    a.hp -= dmg;
    a.stagger = a.kind === "brute" ? 0.22 : 0.38;
    a.lean = 0.45;
    if (kx != null && kz != null) {
      var len = Math.hypot(kx, kz) || 1;
      a.vx += (kx / len) * 7;
      a.vz += (kz / len) * 7;
    }
    if (particles) particles.burst(a.x, a.y + 0.7, a.z, 5, 10);
    return a.hp <= 0;
  };

  AlienSystem.prototype.reset = function () {
    var i, a;
    this.time = 0;
    this.wave = 1;
    this.spawnAcc = 1.5;
    this.kills = 0;
    this.killsBy = { scout: 0, brute: 0, flyer: 0 };
    for (i = 0; i < this.pool.items.length; i++) {
      a = this.pool.items[i];
      a.alive = false;
      a.corpse = 0;
      a.root.visible = false;
      a.root.rotation.x = 0;
      a.root.rotation.z = 0;
    }
  };

  AlienSystem.prototype._pickKind = function (wave) {
    var r = Math.random();
    if (wave < 2) return r < 0.7 ? "scout" : "flyer";
    if (wave < 4) return r < 0.45 ? "scout" : r < 0.8 ? "flyer" : "brute";
    if (r < 0.35) return "scout";
    if (r < 0.62) return "flyer";
    return "brute";
  };

  AlienSystem.prototype._countAlive = function () {
    var n = 0, i;
    for (i = 0; i < this.pool.items.length; i++) if (this.pool.items[i].alive) n++;
    return n;
  };

  AlienSystem.prototype.update = function (dt, vehicle, terrain) {
    this.time += dt;
    this.wave = 1 + Math.floor(this.time / 24);
    var cfg = VR.CONFIG.aliens;
    var interval = Math.max(cfg.minSpawn, cfg.baseSpawn - this.time * 0.01);
    var cap = Math.min(cfg.maxAlive, 5 + this.wave * 2);
    var speedMul = 1 + Math.min(0.65, this.time / 170);
    var i, a, dx, dz, dist, nx, nz, fx, fz, sepX, sepZ, j, b, d2, tx, tz, hy, steer, predX, predZ, col, spd;

    this.spawnAcc -= dt;
    if (this.spawnAcc <= 0 && this._countAlive() < cap) {
      this._spawnAround(vehicle, terrain);
      this.spawnAcc = interval * (0.7 + Math.random() * 0.5);
    }

    for (i = 0; i < this.pool.items.length; i++) {
      a = this.pool.items[i];
      if (a.corpse > 0) {
        this._updateCorpse(a, dt, terrain);
        continue;
      }
      if (!a.alive) continue;
      a.phase += dt;
      a.modeT += dt;
      a.stagger = Math.max(0, a.stagger - dt);
      a.attackCd = Math.max(0, a.attackCd - dt);

      dx = vehicle.pos.x - a.x;
      dz = vehicle.pos.z - a.z;
      dist = Math.hypot(dx, dz) || 0.001;

      if (a.kind === "brute" && a.mode !== "charge" && dist < 28 && a.modeT > 1.8) {
        a.mode = "charge";
        a.modeT = 0;
      } else if (a.mode === "charge" && a.modeT > 1.7) {
        a.mode = "pursue";
        a.modeT = 0;
      }

      predX = vehicle.pos.x + vehicle.vel.x * 0.5;
      predZ = vehicle.pos.z + vehicle.vel.z * 0.5;
      fx = 0;
      fz = 0;
      if (a.mode === "flank" || a.kind === "scout") {
        fx = -((vehicle.pos.z - a.z) / dist) * a.flank * (a.kind === "scout" ? cfg.flank * 0.7 : cfg.flank);
        fz = ((vehicle.pos.x - a.x) / dist) * a.flank * (a.kind === "scout" ? cfg.flank * 0.7 : cfg.flank);
      }
      /* Pack weave — slow sine on the flank axis so paths are not rails. */
      fx += -((vehicle.pos.z - a.z) / dist) * Math.sin(a.phase * 1.35 + a.flank) * 3.4;
      fz += ((vehicle.pos.x - a.x) / dist) * Math.sin(a.phase * 1.35 + a.flank) * 3.4;
      tx = (a.mode === "charge" ? vehicle.pos.x : predX) + fx;
      tz = (a.mode === "charge" ? vehicle.pos.z : predZ) + fz;
      dx = tx - a.x;
      dz = tz - a.z;
      dist = Math.hypot(dx, dz) || 0.001;
      nx = dx / dist;
      nz = dz / dist;

      sepX = 0;
      sepZ = 0;
      for (j = 0; j < this.pool.items.length; j++) {
        b = this.pool.items[j];
        if (!b.alive || b === a) continue;
        d2 = (b.x - a.x) * (b.x - a.x) + (b.z - a.z) * (b.z - a.z);
        if (d2 < cfg.packSep * cfg.packSep && d2 > 0.01) {
          sepX -= (b.x - a.x) / d2;
          sepZ -= (b.z - a.z) / d2;
        }
      }

      spd = a.speed * speedMul;
      if (a.mode === "charge") {
        /* Wind-up then burst so a charge reads instead of a speed swap. */
        spd *= a.modeT < 0.38 ? 0.42 : 1.72;
      }
      steer = a.stagger > 0 ? 0.2 : 1;
      a.vx = M.damp(a.vx, (nx + sepX * 5) * spd * steer, 3.2, dt);
      a.vz = M.damp(a.vz, (nz + sepZ * 5) * spd * steer, 3.2, dt);
      a.x += a.vx * dt;
      a.z += a.vz * dt;

      hy = terrain.heightAt(a.x, a.z);
      a.y = M.damp(a.y, hy, 12, dt);
      a.lean = M.damp(a.lean, 0, 7, dt);

      col = terrain.collideCircle(a.x, a.z, a.radius);
      if (col) {
        a.x += col.x;
        a.z += col.z;
      }

      a.yaw = Math.atan2(-a.vx, -a.vz);
      a.root.position.set(a.x, a.y, a.z);
      a.root.rotation.y = a.yaw;
      a.root.rotation.z = a.lean * a.flank;
      if (a.parts && a.parts.legs) {
        for (j = 0; j < a.parts.legs.length; j++) {
          a.parts.legs[j].rotation.z = Math.sin(a.phase * (a.kind === "scout" ? 10 : 6) + j * 1.6) * (a.kind === "brute" ? 0.22 : 0.38);
        }
      }
      if (a.parts && a.parts.core) {
        a.parts.core.scale.setScalar(0.88 + Math.sin(a.phase * 7) * 0.16);
      }
    }
  };

  AlienSystem.prototype._updateCorpse = function (a, dt, terrain) {
    a.corpse -= dt;
    a.vy -= 18 * dt;
    a.x += a.vx * dt;
    a.z += a.vz * dt;
    a.y += a.vy * dt;
    var floor = terrain.heightAt(a.x, a.z);
    if (a.y < floor) {
      a.y = floor;
      a.vy *= -0.25;
      a.vx *= 0.7;
      a.vz *= 0.7;
    }
    a.root.position.set(a.x, a.y, a.z);
    a.root.rotation.x += a.spinX * dt;
    a.root.rotation.z += a.spinZ * dt;
    if (a.corpse <= 0) {
      a.corpse = 0;
      a.root.visible = false;
      a.root.rotation.x = 0;
      a.root.rotation.z = 0;
    }
  };

  AlienSystem.prototype._spawnAround = function (vehicle, terrain) {
    var ang = Math.random() * Math.PI * 2;
    var dist = 72 + Math.random() * 36;
    var x = vehicle.pos.x + Math.cos(ang) * dist;
    var z = vehicle.pos.z + Math.sin(ang) * dist;
    var kind = this._pickKind(this.wave);
    this.spawn(kind, x, terrain.heightAt(x, z), z);
  };

  AlienSystem.prototype.forAlive = function (fn) {
    this.pool.forAlive(fn);
  };

  VR.AlienSystem = AlienSystem;
})(typeof window !== "undefined" ? window : globalThis);

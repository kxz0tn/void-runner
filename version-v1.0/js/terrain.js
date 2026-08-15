/**
 * VOID RUNNER — Lunar base + collision
 * Copyright (c) 2026 VOID RUNNER contributors
 * SPDX-License-Identifier: MIT
 *
 * Mare + modular base. Every upright structure and every rock is a
 * solid circle collider. Pads and road decals are drive-on only.
 */
(function (global) {
  "use strict";

  var VR = (global.VR = global.VR || {});
  var M = VR.math;
  var P = VR.PALETTE;

  function Terrain(scene, quality) {
    this.scene = scene;
    this.quality = quality || "high";
    this.size = VR.CONFIG.world.terrainSize;
    this.seg = quality === "low" ? 88 : VR.CONFIG.world.terrainSeg;
    this.cx = 0;
    this.cz = 0;
    this.structures = [];
    this.colliders = [];
    this._chunks = Object.create(null);

    this._buildMaterials();
    this._buildMesh();
    this._buildRocks();
    this.rebuild(0, 0);
    this.stream(0, 0, true);
  }

  Terrain.prototype._buildMaterials = function () {
    this.matGround = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.94,
      metalness: 0.03,
      flatShading: true,
      fog: true,
      vertexColors: true
    });
    this.matStruct = new THREE.MeshStandardMaterial({
      color: 0x171717,
      roughness: 0.38,
      metalness: 0.82,
      flatShading: true
    });
    this.matPanel = new THREE.MeshStandardMaterial({
      color: 0x2c2c2c,
      roughness: 0.42,
      metalness: 0.72,
      flatShading: true
    });
    this.matGlow = new THREE.MeshBasicMaterial({
      color: P.white,
      transparent: true,
      opacity: 0.92
    });
    this.matRock = new THREE.MeshStandardMaterial({
      color: 0x4a4a4a,
      roughness: 0.9,
      metalness: 0.1,
      flatShading: true
    });
  };

  Terrain.prototype.heightAt = function (x, z) {
    var macro = M.fbm(x * 0.0024, z * 0.0024, 5);
    var ridge = 1 - Math.abs(M.fbm(x * 0.0065 + 12, z * 0.0065, 4));
    var h = macro * 11.5 + Math.pow(ridge, 2.1) * 7.5;
    h += M.fbm(x * 0.018, z * 0.018, 3) * 2.4;
    h += M.fbm(x * 0.055, z * 0.055, 2) * 0.55;
    /* Fine pebble / rippled-regolith — continuous, low amplitude so
       high-speed sampling does not pop. */
    h += M.fbm(x * 0.11, z * 0.11, 2) * 0.2;
    h += M.fbm(x * 0.26, z * 0.26, 1) * 0.055;
    h += this._craters(x, z);
    var d0 = Math.hypot(x, z);
    if (d0 < 62) h = M.lerp(h, 0.1, M.smoothstep(62, 20, d0));
    return h;
  };

  /**
   * Surface classification for grip / dust / spring softness.
   * Uses the same crater field as heightAt so physics and mesh agree.
   */
  Terrain.prototype.surfaceAt = function (x, z) {
    var crater = this._craters(x, z);
    var ridge = 1 - Math.abs(M.fbm(x * 0.0065 + 12, z * 0.0065, 3));
    var d0 = Math.hypot(x, z);
    if (d0 < 28) return { kind: "pad", grip: 1.08, dust: 0.2, soft: 0.42 };
    if (crater < -1.5) return { kind: "crater", grip: 0.76, dust: 1.4, soft: 1.24 };
    if (crater > 0.62) return { kind: "rim", grip: 0.64, dust: 0.4, soft: 0.5 };
    if (ridge > 0.74) return { kind: "ridge", grip: 0.84, dust: 0.5, soft: 0.68 };
    return { kind: "mare", grip: 1, dust: 0.9, soft: 1 };
  };

  Terrain.prototype._craters = function (x, z) {
    var cs = VR.CONFIG.world.craterCell;
    var ix = Math.floor(x / cs);
    var iz = Math.floor(z / cs);
    var h = 0;
    var i, j, cx, cz, rng, ox, oz, r, d, n, depth, rim, bowl;
    for (i = -2; i <= 2; i++) {
      for (j = -2; j <= 2; j++) {
        cx = ix + i;
        cz = iz + j;
        rng = M.hash(cx, cz, 9);
        if (rng < 0.56) continue;
        ox = (cx + 0.5) * cs + (M.hash(cx, cz, 1) - 0.5) * cs * 0.46;
        oz = (cz + 0.5) * cs + (M.hash(cx, cz, 2) - 0.5) * cs * 0.46;
        r = 5 + M.hash(cx, cz, 3) * 26;
        d = Math.hypot(x - ox, z - oz);
        if (d >= r) continue;
        n = d / r;
        /* Wider, softer bowl + broader rim gaussian — overlapping
           craters blend instead of forming cliffs. */
        bowl = Math.pow(1 - n * n, 1.38);
        depth = (2.4 + M.hash(cx, cz, 4) * 8.6) * bowl;
        rim = Math.exp(-Math.pow((n - 0.86) / 0.145, 2)) * (1.45 + M.hash(cx, cz, 5) * 1.85);
        h -= depth * 0.88;
        h += rim;
      }
    }
    return h;
  };

  Terrain.prototype.normalAt = function (x, z) {
    var e = 0.72;
    return new THREE.Vector3(
      this.heightAt(x - e, z) - this.heightAt(x + e, z),
      2 * e,
      this.heightAt(x, z - e) - this.heightAt(x, z + e)
    ).normalize();
  };

  Terrain.prototype._buildMesh = function () {
    this.geo = new THREE.PlaneGeometry(this.size, this.size, this.seg, this.seg);
    this.geo.rotateX(-Math.PI / 2);
    this.geo.setAttribute(
      "color",
      new THREE.BufferAttribute(new Float32Array(this.geo.attributes.position.count * 3), 3)
    );
    this.mesh = new THREE.Mesh(this.geo, this.matGround);
    this.mesh.receiveShadow = true;
    this.mesh.matrixAutoUpdate = false;
    this.scene.add(this.mesh);
    this._pos = this.geo.attributes.position;
  };

  Terrain.prototype._buildRocks = function () {
    var n = this.quality === "low" ? 160 : 340;
    this.rocks = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 0), this.matRock, n);
    this.rocks.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.rocks.castShadow = this.quality !== "low";
    this.rocks.receiveShadow = true;
    this.rocks.count = n;
    this.rocks.frustumCulled = false;
    this.scene.add(this.rocks);
    this._rockDummy = new THREE.Object3D();
    this._rockCount = n;
    this.rockColliders = [];
  };

  Terrain.prototype.rebuild = function (cx, cz) {
    this.cx = cx;
    this.cz = cz;
    var pos = this._pos;
    var arr = pos.array;
    var col = this.geo.attributes.color.array;
    var i, x, z, y, shade, hy, crater;
    for (i = 0; i < pos.count; i++) {
      x = arr[i * 3] + cx;
      z = arr[i * 3 + 2] + cz;
      arr[i * 3 + 1] = this.heightAt(x, z);
    }
    pos.needsUpdate = true;
    this.geo.computeVertexNormals();
    var nrm = this.geo.attributes.normal.array;
    for (i = 0; i < pos.count; i++) {
      x = arr[i * 3] + cx;
      z = arr[i * 3 + 2] + cz;
      y = arr[i * 3 + 1];
      hy = nrm[i * 3 + 1];
      crater = this._craters(x, z);
      shade = 0.3 + Math.max(0, hy) * 0.36 + M.clamp(y * 0.01, -0.07, 0.14);
      if (crater < -1.2) shade -= 0.1;
      if (crater > 0.8) shade += 0.08;
      shade += (M.hash((x * 3) | 0, (z * 3) | 0, 21) - 0.5) * 0.06;
      col[i * 3] = col[i * 3 + 1] = col[i * 3 + 2] = M.clamp(shade, 0.16, 0.74);
    }
    this.geo.attributes.color.needsUpdate = true;
    this.mesh.position.set(cx, 0, cz);
    this.mesh.updateMatrix();
    this._scatterRocks(cx, cz);
  };

  Terrain.prototype._scatterRocks = function (cx, cz) {
    var i, x, z, y, s, dummy, seed;
    dummy = this._rockDummy;
    this.rockColliders = [];
    for (i = 0; i < this._rockCount; i++) {
      seed = i * 17 + 3;
      x = cx + (M.hash(seed, 1, 2) - 0.5) * this.size * 0.92;
      z = cz + (M.hash(seed, 4, 5) - 0.5) * this.size * 0.92;
      if (Math.hypot(x, z) < 30) {
        dummy.position.set(0, -50, 0);
        dummy.updateMatrix();
        this.rocks.setMatrixAt(i, dummy.matrix);
        continue;
      }
      y = this.heightAt(x, z);
      s = 0.45 + M.hash(seed, 8, 1) * 2.6;
      dummy.position.set(x, y + s * 0.28, z);
      dummy.rotation.set(M.hash(seed, 2, 2) * 2, M.hash(seed, 3, 3) * 6, M.hash(seed, 4, 4) * 2);
      dummy.scale.set(s, s * (0.55 + M.hash(seed, 6, 6) * 0.7), s);
      dummy.updateMatrix();
      this.rocks.setMatrixAt(i, dummy.matrix);
      this.rockColliders.push({ x: x, z: z, r: s * 0.85, solid: true });
    }
    this.rocks.instanceMatrix.needsUpdate = true;
  };

  Terrain.prototype.maybeRebuild = function (x, z) {
    if (Math.abs(x - this.cx) > 95 || Math.abs(z - this.cz) > 95) this.rebuild(x, z);
  };

  Terrain.prototype._box = function (group, w, h, d, x, y, z, rx, ry, rz, mat) {
    var mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat || this.matStruct);
    mesh.position.set(x, y, z);
    if (rx) mesh.rotation.x = rx;
    if (ry) mesh.rotation.y = ry;
    if (rz) mesh.rotation.z = rz;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
    return mesh;
  };

  Terrain.prototype._cyl = function (group, rt, rb, h, x, y, z, mat) {
    var mesh = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, 10), mat || this.matStruct);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
    return mesh;
  };

  Terrain.prototype._makePylon = function () {
    var g = new THREE.Group();
    this._box(g, 1.1, 18, 1.1, 0, 9, 0);
    this._box(g, 2.6, 0.35, 2.6, 0, 0.18, 0, 0, 0, 0, this.matPanel);
    this._box(g, 3.4, 0.22, 0.18, 0, 16.8, 0, 0, 0, 0, this.matGlow);
    this._box(g, 0.18, 0.22, 3.4, 0, 16.8, 0, 0, 0, 0, this.matGlow);
    return g;
  };

  Terrain.prototype._makeHangar = function () {
    var g = new THREE.Group();
    this._box(g, 18, 0.45, 20, 0, 0.22, 0, 0, 0, 0, this.matPanel);
    this._box(g, 0.85, 9.2, 20, -8.6, 4.8, 0);
    this._box(g, 0.85, 9.2, 20, 8.6, 4.8, 0);
    this._box(g, 18, 0.55, 20.4, 0, 9.5, 0);
    this._box(g, 16, 0.1, 0.1, 0, 8.7, 10, 0, 0, 0, this.matGlow);
    return g;
  };

  Terrain.prototype._makePad = function () {
    var g = new THREE.Group();
    this._box(g, 22, 0.28, 22, 0, 0.14, 0, 0, 0, 0, this.matPanel);
    this._box(g, 16, 0.08, 0.16, 0, 0.36, 0, 0, 0, 0, this.matGlow);
    this._box(g, 0.16, 0.08, 16, 0, 0.36, 0, 0, 0, 0, this.matGlow);
    return g;
  };

  Terrain.prototype._makeHabitat = function () {
    var g = new THREE.Group();
    this._cyl(g, 4.2, 4.2, 4.6, 0, 2.3, 0, this.matStruct);
    this._cyl(g, 2.4, 2.4, 2.8, 4.6, 3.2, 0, this.matPanel);
    this._box(g, 0.16, 1.6, 2.2, -4.25, 2.2, 0, 0, 0, 0, this.matGlow);
    return g;
  };

  Terrain.prototype._makeSolar = function () {
    var g = new THREE.Group();
    this._box(g, 0.25, 3.2, 0.25, 0, 1.6, 0);
    this._box(g, 7.5, 0.12, 3.4, 0, 3.35, 0, 0.55, 0, 0, this.matPanel);
    this._box(g, 7.2, 0.04, 0.08, 0, 3.42, 0, 0.55, 0, 0, this.matGlow);
    return g;
  };

  Terrain.prototype._makeDish = function () {
    var g = new THREE.Group();
    this._box(g, 0.55, 10, 0.55, 0, 5, 0);
    this._cyl(g, 3.2, 0.4, 0.35, 0, 10.4, 0, this.matPanel);
    this._box(g, 0.15, 1.4, 0.15, 0, 11.3, 0, 0, 0, 0, this.matGlow);
    this._box(g, 2.8, 0.4, 2.8, 0, 0.2, 0, 0, 0, 0, this.matPanel);
    return g;
  };

  Terrain.prototype._makeTank = function () {
    var g = new THREE.Group();
    this._cyl(g, 2.4, 2.4, 5.2, 0, 2.6, 0);
    this._cyl(g, 2.5, 2.5, 0.25, 0, 5.25, 0, this.matPanel);
    this._box(g, 0.12, 5.2, 0.12, 2.45, 2.6, 0, 0, 0, 0, this.matGlow);
    return g;
  };

  Terrain.prototype._makeFlood = function () {
    var g = new THREE.Group();
    this._box(g, 0.28, 9, 0.28, 0, 4.5, 0);
    this._box(g, 1.4, 0.25, 0.7, 0, 9.1, 0.3, -0.35, 0, 0, this.matPanel);
    this._box(g, 1.1, 0.12, 0.2, 0, 9.0, 0.55, -0.35, 0, 0, this.matGlow);
    var light = new THREE.SpotLight(0xffffff, 2.4, 28, 0.55, 0.5, 1.4);
    light.position.set(0, 8.8, 0.4);
    light.target.position.set(0, 0, 6);
    g.add(light);
    g.add(light.target);
    return g;
  };

  Terrain.prototype._makePipe = function () {
    var g = new THREE.Group();
    this._cyl(g, 0.38, 0.38, 14, 0, 1.4, 0);
    g.children[0].rotation.z = Math.PI / 2;
    this._box(g, 0.7, 1.1, 0.7, -6, 0.55, 0);
    this._box(g, 0.7, 1.1, 0.7, 6, 0.55, 0);
    return g;
  };

  Terrain.prototype._factory = function (kind) {
    if (kind === 0) return this._makePylon();
    if (kind === 1) return this._makeHangar();
    if (kind === 2) return this._makePad();
    if (kind === 3) return this._makeHabitat();
    if (kind === 4) return this._makeSolar();
    if (kind === 5) return this._makeDish();
    if (kind === 6) return this._makeTank();
    if (kind === 7) return this._makeFlood();
    return this._makePipe();
  };

  /* Radius + whether the footprint is solid. Pads are drive-on. */
  Terrain.prototype._spec = [
    { r: 2.3, solid: true },
    { r: 10.2, solid: true },
    { r: 0, solid: false },
    { r: 5.4, solid: true },
    { r: 3.2, solid: true },
    { r: 3.0, solid: true },
    { r: 2.6, solid: true },
    { r: 1.2, solid: true },
    { r: 6.5, solid: true }
  ];

  Terrain.prototype._addCollider = function (x, z, r, solid, kind) {
    var rec = { x: x, z: z, r: r, solid: !!solid, kind: kind };
    this.colliders.push(rec);
    return rec;
  };

  Terrain.prototype._spawnOriginBase = function () {
    var pad = this._makePad();
    pad.position.set(0, 0, 0);
    this.scene.add(pad);
    this.structures.push({ mesh: pad, x: 0, z: 0, r: 11, kind: "pad" });

    var hang = this._makeHangar();
    hang.position.set(-36, 0, 6);
    hang.rotation.y = 0.35;
    this.scene.add(hang);
    this.structures.push({ mesh: hang, x: -36, z: 6, r: 10, kind: 1 });
    this._addCollider(-36, 6, 10.2, true, 1);

    var hab = this._makeHabitat();
    hab.position.set(30, 0, -8);
    this.scene.add(hab);
    this.structures.push({ mesh: hab, x: 30, z: -8, r: 5.4, kind: 3 });
    this._addCollider(30, -8, 5.4, true, 3);

    var dish = this._makeDish();
    dish.position.set(18, 0, 28);
    this.scene.add(dish);
    this.structures.push({ mesh: dish, x: 18, z: 28, r: 3, kind: 5 });
    this._addCollider(18, 28, 3, true, 5);

    var tank = this._makeTank();
    tank.position.set(-22, 0, 26);
    this.scene.add(tank);
    this.structures.push({ mesh: tank, x: -22, z: 26, r: 2.6, kind: 6 });
    this._addCollider(-22, 26, 2.6, true, 6);

    var i, a, mesh, x, z;
    for (i = 0; i < 6; i++) {
      a = (i / 6) * Math.PI * 2 + 0.25;
      x = Math.cos(a) * 38;
      z = Math.sin(a) * 38;
      mesh = i % 2 ? this._makePylon() : this._makeFlood();
      mesh.position.set(x, 0, z);
      this.scene.add(mesh);
      this.structures.push({ mesh: mesh, x: x, z: z, r: 2.2, kind: "pylon" });
      this._addCollider(x, z, 2.2, true, "pylon");
    }
    for (i = 0; i < 3; i++) {
      mesh = this._makeSolar();
      x = 12 + i * 9;
      z = 40;
      mesh.position.set(x, 0, z);
      mesh.rotation.y = 0.2;
      this.scene.add(mesh);
      this.structures.push({ mesh: mesh, x: x, z: z, r: 3.2, kind: 4 });
      this._addCollider(x, z, 3.2, true, 4);
    }
  };

  Terrain.prototype.stream = function (px, pz, first) {
    if (first) this._spawnOriginBase();
    var tile = VR.CONFIG.world.tile;
    var rad = VR.CONFIG.world.streamRadius;
    var cx = Math.floor(px / tile);
    var cz = Math.floor(pz / tile);
    var ix, iz, key, keep, i, rec, x, z, kind, yaw, mesh, h, spec, col;

    keep = Object.create(null);
    for (ix = cx - rad; ix <= cx + rad; ix++) {
      for (iz = cz - rad; iz <= cz + rad; iz++) {
        key = ix + ":" + iz;
        keep[key] = true;
        if (this._chunks[key]) continue;
        if (ix === 0 && iz === 0) {
          this._chunks[key] = { meshes: [], cols: [], key: key };
          continue;
        }
        if (M.hash(ix, iz, 11) < 0.46) {
          this._chunks[key] = { meshes: [], cols: [], key: key };
          continue;
        }
        x = (ix + 0.5) * tile + (M.hash(ix, iz, 12) - 0.5) * tile * 0.3;
        z = (iz + 0.5) * tile + (M.hash(ix, iz, 13) - 0.5) * tile * 0.3;
        if (Math.hypot(x, z) < 52) {
          this._chunks[key] = { meshes: [], cols: [], key: key };
          continue;
        }
        kind = (M.hash(ix, iz, 14) * 9) | 0;
        yaw = M.hash(ix, iz, 15) * Math.PI * 2;
        mesh = this._factory(kind);
        h = this.heightAt(x, z);
        mesh.position.set(x, h, z);
        mesh.rotation.y = yaw;
        this.scene.add(mesh);
        spec = this._spec[kind] || { r: 3, solid: true };
        rec = { mesh: mesh, x: x, z: z, r: spec.r, kind: kind, h: h };
        this.structures.push(rec);
        col = [];
        if (spec.solid && spec.r > 0) col.push(this._addCollider(x, z, spec.r, true, kind));
        this._chunks[key] = { meshes: [rec], cols: col, key: key };
      }
    }

    for (key in this._chunks) {
      if (keep[key]) continue;
      rec = this._chunks[key];
      for (i = 0; i < rec.meshes.length; i++) {
        this.scene.remove(rec.meshes[i].mesh);
        this._disposeGroup(rec.meshes[i].mesh);
        this.structures.splice(this.structures.indexOf(rec.meshes[i]), 1);
      }
      for (i = 0; i < rec.cols.length; i++) {
        this.colliders.splice(this.colliders.indexOf(rec.cols[i]), 1);
      }
      delete this._chunks[key];
    }
  };

  Terrain.prototype._disposeGroup = function (root) {
    root.traverse(function (o) {
      if (o.geometry) o.geometry.dispose();
    });
  };

  /**
   * Multi-pass circle vs all solid colliders (structures + rocks).
   * Returns a world-space push so the truck cannot tunnel.
   */
  Terrain.prototype.collideCircle = function (x, z, radius) {
    var pass, i, s, dx, dz, d, pen, min;
    var px = 0;
    var pz = 0;
    var hit = false;
    var lists = [this.colliders, this.rockColliders];
    var li, list;
    for (pass = 0; pass < 3; pass++) {
      for (li = 0; li < 2; li++) {
        list = lists[li];
        for (i = 0; i < list.length; i++) {
          s = list[i];
          if (!s.solid || s.r <= 0) continue;
          dx = x + px - s.x;
          dz = z + pz - s.z;
          min = radius + s.r;
          d = Math.hypot(dx, dz);
          if (d < 0.0001) d = 0.0001;
          if (d < min) {
            pen = min - d;
            px += (dx / d) * pen;
            pz += (dz / d) * pen;
            hit = true;
          }
        }
      }
    }
    return hit ? { x: px, z: pz } : null;
  };

  Terrain.prototype.nearby = function (x, z, range) {
    var out = [];
    var i, s;
    var r2 = range * range;
    for (i = 0; i < this.structures.length; i++) {
      s = this.structures[i];
      if ((s.x - x) * (s.x - x) + (s.z - z) * (s.z - z) < r2) out.push(s);
    }
    return out;
  };

  VR.Terrain = Terrain;
})(typeof window !== "undefined" ? window : globalThis);

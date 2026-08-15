/**
 * VOID RUNNER — Particle pools
 * Copyright (c) 2026 VOID RUNNER contributors
 * SPDX-License-Identifier: MIT
 *
 * Dust, impact sparks, debris and boost streaks. One instanced point
 * pool; a custom shader lets headlights lift lingering lunar motes
 * without a second draw. Kind 0 = dust, 1 = spark, 2 = smoke, 3 = boost.
 */
(function (global) {
  "use strict";

  var VR = (global.VR = global.VR || {});

  var DUST_VERT = [
    "attribute float size;",
    "attribute float life;",
    "attribute float kind;",
    "uniform float uPixelRatio;",
    "varying float vLife;",
    "varying float vKind;",
    "varying vec3 vWorld;",
    "void main(){",
    "  vLife = life;",
    "  vKind = kind;",
    "  vec4 world = modelMatrix * vec4(position, 1.0);",
    "  vWorld = world.xyz;",
    "  vec4 mv = viewMatrix * world;",
    "  float grow = vKind < 0.5 ? (1.0 + (1.0 - vLife) * 1.7) : 1.0;",
    "  gl_PointSize = size * grow * uPixelRatio * (190.0 / max(1.4, -mv.z));",
    "  gl_Position = projectionMatrix * mv;",
    "}"
  ].join("\n");

  var DUST_FRAG = [
    "precision highp float;",
    "varying float vLife;",
    "varying float vKind;",
    "varying vec3 vWorld;",
    "uniform vec3 uHeadPos;",
    "uniform vec3 uHeadDir;",
    "uniform float uHead;",
    "void main(){",
    "  vec2 p = gl_PointCoord * 2.0 - 1.0;",
    "  float r = dot(p, p);",
    "  if(r > 1.0) discard;",
    "  float soft = exp(-r * 2.6);",
    "  float age = 1.0 - clamp(vLife, 0.0, 1.0);",
    "  float fadeIn = smoothstep(0.0, 0.1, age);",
    "  float fadeOut = 1.0 - smoothstep(0.52, 1.0, age);",
    "  float fade = fadeIn * fadeOut;",
    "  vec3 toP = vWorld - uHeadPos;",
    "  float dist = length(toP);",
    "  float cone = 0.0;",
    "  if(dist > 0.05){",
    "    cone = smoothstep(0.42, 0.9, dot(toP / dist, uHeadDir));",
    "    cone *= exp(-dist * 0.032) * uHead;",
    "  }",
    "  float luma = 0.38 + cone * 0.95;",
    "  float alpha = soft * fade * (0.42 + cone * 0.48);",
    "  if(vKind > 0.5 && vKind < 1.5){",
    "    luma = 0.95;",
    "    alpha = soft * fade * 0.92;",
    "  } else if(vKind > 1.5 && vKind < 2.5){",
    "    luma = 0.55 + cone * 0.25;",
    "    alpha = soft * fade * 0.38;",
    "  } else if(vKind > 2.5){",
    "    luma = 0.92;",
    "    alpha = soft * fade * 0.8;",
    "  }",
    "  gl_FragColor = vec4(vec3(luma), alpha);",
    "}"
  ].join("\n");

  function Particles(scene, quality) {
    this.scene = scene;
    this.quality = quality || "high";
    this.cap = quality === "low" ? 220 : quality === "med" ? 400 : 680;
    this.count = this.cap;
    this.pos = new Float32Array(this.count * 3);
    this.vel = new Float32Array(this.count * 3);
    this.life = new Float32Array(this.count);
    this.maxLife = new Float32Array(this.count);
    this.size = new Float32Array(this.count);
    this.kind = new Float32Array(this.count);
    this.lifeN = new Float32Array(this.count);
    this.floor = new Float32Array(this.count);
    this._cursor = 0;

    var i;
    for (i = 0; i < this.count; i++) {
      this.life[i] = -1;
      this.pos[i * 3 + 1] = -999;
    }

    var geo = new THREE.BufferGeometry();
    this._attr = new THREE.BufferAttribute(this.pos, 3);
    this._attr.setUsage(THREE.DynamicDrawUsage);
    this._lifeAttr = new THREE.BufferAttribute(this.lifeN, 1);
    this._lifeAttr.setUsage(THREE.DynamicDrawUsage);
    this._sizeAttr = new THREE.BufferAttribute(this.size, 1);
    this._sizeAttr.setUsage(THREE.DynamicDrawUsage);
    this._kindAttr = new THREE.BufferAttribute(this.kind, 1);
    this._kindAttr.setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute("position", this._attr);
    geo.setAttribute("size", this._sizeAttr);
    geo.setAttribute("life", this._lifeAttr);
    geo.setAttribute("kind", this._kindAttr);

    try {
      this.mat = new THREE.ShaderMaterial({
        uniforms: {
          uPixelRatio: { value: Math.min(window.devicePixelRatio || 1, 2) },
          uHeadPos: { value: new THREE.Vector3(0, 1, 0) },
          uHeadDir: { value: new THREE.Vector3(0, -0.08, -1) },
          uHead: { value: 1 }
        },
        vertexShader: DUST_VERT,
        fragmentShader: DUST_FRAG,
        transparent: true,
        depthWrite: false,
        blending: THREE.NormalBlending
      });
    } catch (e) {
      this.mat = new THREE.PointsMaterial({
        color: 0xffffff,
        size: 0.22,
        transparent: true,
        opacity: 0.7,
        depthWrite: false,
        sizeAttenuation: true
      });
    }

    this.points = new THREE.Points(geo, this.mat);
    this.points.frustumCulled = false;
    scene.add(this.points);

    this._dustG = (VR.CONFIG.dust && VR.CONFIG.dust.gravity) || 1.68;
    this._linger = (VR.CONFIG.dust && VR.CONFIG.dust.linger) || 1.45;
  }

  Particles.prototype.setHeadlights = function (x, y, z, dx, dy, dz, amount) {
    if (!this.mat || !this.mat.uniforms) return;
    this.mat.uniforms.uHeadPos.value.set(x, y, z);
    this.mat.uniforms.uHeadDir.value.set(dx, dy, dz).normalize();
    this.mat.uniforms.uHead.value = amount == null ? 1 : amount;
  };

  Particles.prototype._emit = function (x, y, z, vx, vy, vz, life, sz, kind) {
    var i = this._cursor;
    this._cursor = (this._cursor + 1) % this.count;
    this.pos[i * 3] = x;
    this.pos[i * 3 + 1] = y;
    this.pos[i * 3 + 2] = z;
    this.vel[i * 3] = vx;
    this.vel[i * 3 + 1] = vy;
    this.vel[i * 3 + 2] = vz;
    this.life[i] = life;
    this.maxLife[i] = life;
    this.size[i] = sz || 0.18;
    this.kind[i] = kind == null ? 0 : kind;
    this.floor[i] = y - 2.4;
    this.lifeN[i] = 1;
  };

  Particles.prototype.dust = function (x, y, z, hx, hz, speed) {
    this.wheelDust(x, y, z, hx, hz, hz, -hx, speed, 0, 0, 0.9, 0);
  };

  /**
   * Per-wheel regolith. Volume scales with speed, slip and surface dust.
   * Sideways spray follows the right-vector so a drift throws a sheet.
   */
  Particles.prototype.wheelDust = function (x, y, z, hx, hz, rx, rz, speed, slip, accel, dustAmt, boost) {
    var n = 1;
    var i, a, side, kick, life, sz, up, lat, spray;
    lat = slip;
    slip = Math.abs(slip);
    if (slip > 2.4) n++;
    if (speed > 18) n++;
    if (dustAmt > 1.15) n++;
    if (this.quality === "med") n = Math.min(n, 2);
    if (this.quality === "low") n = 1;
    side = Math.min(8, slip) * 0.42;
    spray = lat === 0 ? 0 : lat > 0 ? -1 : 1;
    kick = Math.max(0, -accel) * 0.012 + Math.max(0, accel) * 0.006;
    for (i = 0; i < n; i++) {
      a = Math.random() * Math.PI * 2;
      up = 0.12 + Math.random() * 0.55 + Math.min(1.2, slip) * 0.18;
      life = (0.55 + Math.random() * 0.7) * this._linger * (0.7 + dustAmt * 0.45);
      sz = 0.26 + Math.random() * 0.22 + dustAmt * 0.1 + (boost > 0.4 ? 0.08 : 0);
      this._emit(
        x + (Math.random() - 0.5) * 0.55,
        y + 0.04,
        z + (Math.random() - 0.5) * 0.55,
        -hx * (speed * 0.1 + kick) + rx * (spray * side * (0.35 + Math.random() * 0.7) + (Math.random() - 0.5) * 0.4) + Math.cos(a) * 0.28,
        up,
        -hz * (speed * 0.1 + kick) + rz * (spray * side * (0.35 + Math.random() * 0.7) + (Math.random() - 0.5) * 0.4) + Math.sin(a) * 0.28,
        life,
        sz,
        0
      );
    }
  };

  Particles.prototype.landDust = function (x, y, z, force, dustAmt) {
    var n = Math.min(28, 8 + (force * 1.6 * ((VR.CONFIG.dust && VR.CONFIG.dust.landMul) || 1)) | 0);
    var i, a, e, p;
    if (this.quality === "low") n = Math.min(n, 12);
    p = 2.2 + force * 0.45;
    for (i = 0; i < n; i++) {
      a = Math.random() * Math.PI * 2;
      e = 0.15 + Math.random() * 0.7;
      this._emit(
        x + Math.cos(a) * 0.8,
        y + 0.08,
        z + Math.sin(a) * 0.8,
        Math.cos(a) * p * (0.6 + e),
        0.4 + Math.random() * 1.6 + force * 0.08,
        Math.sin(a) * p * (0.6 + e),
        (0.7 + Math.random() * 0.9) * this._linger * (0.8 + (dustAmt || 1) * 0.3),
        0.32 + Math.random() * 0.28,
        0
      );
    }
  };

  Particles.prototype.beamMotes = function (x, y, z, hx, hz, amount) {
    var n = amount > 0.7 ? 2 : 1;
    var i, d;
    for (i = 0; i < n; i++) {
      d = 4 + Math.random() * 16;
      this._emit(
        x + hx * d + (Math.random() - 0.5) * 2.4,
        y + 0.3 + Math.random() * 1.1,
        z + hz * d + (Math.random() - 0.5) * 2.4,
        (Math.random() - 0.5) * 0.25,
        0.04 + Math.random() * 0.12,
        (Math.random() - 0.5) * 0.25,
        0.9 + Math.random() * 0.8,
        0.2 + Math.random() * 0.16,
        0
      );
    }
  };

  Particles.prototype.burst = function (x, y, z, power, count) {
    var n = count || 18;
    var i, a, e, p;
    p = power || 8;
    for (i = 0; i < n; i++) {
      a = Math.random() * Math.PI * 2;
      e = Math.random() * Math.PI;
      this._emit(
        x,
        y,
        z,
        Math.cos(a) * Math.sin(e) * p,
        Math.cos(e) * p * 0.7,
        Math.sin(a) * Math.sin(e) * p,
        0.35 + Math.random() * 0.5,
        0.12 + Math.random() * 0.2,
        1
      );
    }
  };

  Particles.prototype.smoke = function (x, y, z) {
    this._emit(
      x + (Math.random() - 0.5) * 0.4,
      y,
      z + (Math.random() - 0.5) * 0.4,
      (Math.random() - 0.5) * 0.4,
      1.4 + Math.random() * 1.2,
      (Math.random() - 0.5) * 0.4,
      0.85 + Math.random() * 0.5,
      0.38,
      2
    );
  };

  Particles.prototype.boost = function (x, y, z, hx, hz) {
    this._emit(
      x - hx * 2.2 + (Math.random() - 0.5) * 0.4,
      y + 0.4,
      z - hz * 2.2 + (Math.random() - 0.5) * 0.4,
      -hx * 7.5,
      0.15 + Math.random() * 0.2,
      -hz * 7.5,
      0.22,
      0.3,
      3
    );
  };

  Particles.prototype.update = function (dt) {
    var i, l, k, kind, grav, drag;
    var dustG = this._dustG;
    for (i = 0; i < this.count; i++) {
      if (this.life[i] < 0) continue;
      this.life[i] -= dt;
      if (this.life[i] <= 0) {
        this.life[i] = -1;
        this.lifeN[i] = 0;
        this.pos[i * 3 + 1] = -999;
        continue;
      }
      k = i * 3;
      kind = this.kind[i];
      if (kind < 0.5) {
        grav = dustG;
        drag = 1.15;
      } else if (kind < 1.5) {
        grav = 14;
        drag = 0.4;
      } else if (kind < 2.5) {
        grav = -0.55;
        drag = 1.6;
      } else {
        grav = 2.2;
        drag = 0.2;
      }
      this.vel[k + 1] -= grav * dt;
      this.vel[k] *= 1 - drag * dt;
      this.vel[k + 2] *= 1 - drag * dt;
      this.pos[k] += this.vel[k] * dt;
      this.pos[k + 1] += this.vel[k + 1] * dt;
      this.pos[k + 2] += this.vel[k + 2] * dt;
      if (this.pos[k + 1] < this.floor[i]) {
        this.pos[k + 1] = this.floor[i];
        this.vel[k + 1] *= -0.12;
        this.vel[k] *= 0.7;
        this.vel[k + 2] *= 0.7;
        if (kind >= 0.5 && kind < 1.5) this.life[i] = Math.min(this.life[i], 0.08);
      }
      l = this.life[i] / this.maxLife[i];
      this.lifeN[i] = l;
    }
    this._attr.needsUpdate = true;
    this._lifeAttr.needsUpdate = true;
    this._sizeAttr.needsUpdate = true;
    this._kindAttr.needsUpdate = true;
  };

  VR.Particles = Particles;
})(typeof window !== "undefined" ? window : globalThis);

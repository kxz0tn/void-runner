/**
 * VOID RUNNER — Void Hauler
 * Copyright (c) 2026 VOID RUNNER contributors
 * SPDX-License-Identifier: MIT
 *
 * Heavy lunar cargo truck. Six driven drums, cab-over hood, energy
 * accents. +steer is right-hand input and produces a RIGHT turn when
 * viewed from the chase camera (yaw is decremented — Three.js Y-up
 * positive rotation is left from behind).
 *
 * Physics is arcade-planted, not a full rigid-body: a bicycle yaw model
 * plus independent wheel springs, a friction-circle-lite slip, and
 * visual weight transfer. Substeps stay in _step; presentation in
 * _present so the body can lean without lifting the drums off the mare.
 */
(function (global) {
  "use strict";

  var VR = (global.VR = global.VR || {});
  var M = VR.math;
  var C = VR.CONFIG.vehicle;

  function Vehicle(scene) {
    this.scene = scene;
    this.root = new THREE.Group();
    scene.add(this.root);

    this.pos = new THREE.Vector3(0, 1.2, 18);
    this.vel = new THREE.Vector3();
    this.yaw = 0;
    this.steer = 0;
    this.pitch = 0;
    this.roll = 0;
    this.speed = 0;
    this.longV = 0;
    this.latV = 0;
    this.slip = 0;
    this.slipAngle = 0;
    this.throttle = 0;
    this.boostT = 0;
    this.boostFuel = 0;
    this.grounded = true;
    this.heading = new THREE.Vector3(0, 0, -1);
    this.right = new THREE.Vector3(1, 0, 0);
    this.damageVisual = 0;
    this.pulseFlash = 0;
    this.alive = true;
    this.handbrake = false;
    this.hullRatio = 1;
    this._wheelSpin = 0;
    this._muzzle = new THREE.Vector3();
    this._smokeAcc = 0;
    this._t = 0;

    this.surfGrip = 1;
    this.surfDust = 0.9;
    this.surfSoft = 1;
    this.surfKind = "mare";
    this.vib = 0;
    this.roughness = 0;
    this.impactImpulse = 0;
    this.landImpulse = 0;
    this.collideImpulse = 0;
    this.engineLoad = 0;
    this.suspTravel = 0;
    this.accelLong = 0;
    this.accelLat = 0;
    this._accelLongS = 0;
    this._accelLatS = 0;
    this._prevLongV = 0;
    this._prevLatV = 0;
    this.wasGrounded = true;
    this.airTime = 0;
    this._squat = 0;
    this.wheelsDown = 6;

    this.wheels = [];
    this._build();
    this.root.position.copy(this.pos);
  }

  Vehicle.prototype._mat = function (hex, metal, rough, basic) {
    if (basic) {
      return new THREE.MeshBasicMaterial({ color: hex, transparent: true, opacity: 1 });
    }
    return new THREE.MeshStandardMaterial({
      color: hex,
      metalness: metal,
      roughness: rough,
      flatShading: true
    });
  };

  Vehicle.prototype._box = function (parent, w, h, d, x, y, z, rx, ry, rz, mat) {
    var m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z);
    if (rx) m.rotation.x = rx;
    if (ry) m.rotation.y = ry;
    if (rz) m.rotation.z = rz;
    m.castShadow = true;
    m.receiveShadow = true;
    parent.add(m);
    return m;
  };

  Vehicle.prototype._build = function () {
    var hull = this._mat(0x1c1c1c, 0.7, 0.42);
    var plate = this._mat(0x2e2e2e, 0.78, 0.3);
    var dark = this._mat(0x0a0a0a, 0.5, 0.55);
    var rubber = this._mat(0x101010, 0.12, 0.88);
    var rim = this._mat(0x7a7a7a, 0.88, 0.24);
    var glow = this._mat(0xffffff, 0, 1, true);

    this.body = new THREE.Group();
    this.body.position.y = 0.08;
    this.root.add(this.body);

    /* Frame rails. */
    this._box(this.body, 1.85, 0.22, 6.4, 0, 0.62, 0.1, 0, 0, 0, dark);

    /* Cab. */
    this._box(this.body, 2.05, 1.55, 2.15, 0, 1.55, -1.85, 0, 0, 0, hull);
    this._box(this.body, 1.85, 0.55, 1.15, 0, 1.05, -3.15, 0.12, 0, 0, plate);
    this._box(this.body, 1.55, 0.07, 0.08, 0, 1.85, -2.9, 0, 0, 0, glow);

    /* Heavy bumper. */
    this._box(this.body, 2.35, 0.45, 0.42, 0, 0.72, -3.75, 0, 0, 0, plate);
    this._box(this.body, 0.55, 0.12, 0.08, -0.7, 0.82, -3.96, 0, 0, 0, glow);
    this._box(this.body, 0.55, 0.12, 0.08, 0.7, 0.82, -3.96, 0, 0, 0, glow);

    /* Cargo box — tall rear wall so the chase cam sees a truck, not a roof. */
    this._box(this.body, 1.85, 1.85, 3.35, 0, 1.62, 1.5, 0, 0, 0, hull);
    this._box(this.body, 1.95, 0.12, 3.4, 0, 2.58, 1.5, 0, 0, 0, plate);
    this._box(this.body, 1.7, 1.55, 0.12, 0, 1.55, 3.2, 0, 0, 0, plate);
    this._box(this.body, 0.08, 1.65, 3.2, -0.96, 1.55, 1.5, 0, 0, 0, dark);
    this._box(this.body, 0.08, 1.65, 3.2, 0.96, 1.55, 1.5, 0, 0, 0, dark);

    /* Exhaust stacks. */
    this._box(this.body, 0.16, 1.15, 0.16, -0.85, 2.55, -1.15, 0, 0, 0, plate);
    this._box(this.body, 0.16, 1.15, 0.16, 0.85, 2.55, -1.15, 0, 0, 0, plate);
    this.exhaust = this._box(this.body, 0.18, 0.08, 0.18, 0, 3.15, -1.15, 0, 0, 0, glow);

    /* Energy spine + underglow. */
    this._box(this.body, 0.07, 0.05, 5.6, 0, 0.95, 0.05, 0, 0, 0, glow);
    this.tail = this._box(this.body, 1.4, 0.1, 0.06, 0, 1.05, 3.28, 0, 0, 0, glow);
    this.under = this._box(this.body, 1.5, 0.04, 5.2, 0, 0.38, 0.1, 0, 0, 0, glow);
    this.under.material.opacity = 0.32;

    /* Damage overlays — hidden until hull drops. */
    this.cracks = new THREE.Group();
    this.body.add(this.cracks);
    this._box(this.cracks, 0.04, 0.55, 0.04, -0.7, 1.7, -1.6, 0.4, 0, 0.3, glow);
    this._box(this.cracks, 0.04, 0.7, 0.04, 0.55, 1.6, 1.2, -0.3, 0, 0.5, glow);
    this._box(this.cracks, 1.1, 0.03, 0.03, 0.1, 2.15, 0.4, 0, 0.2, 0, glow);
    this._box(this.cracks, 0.03, 0.45, 0.8, 1.16, 1.5, 1.8, 0, 0, 0, glow);
    this.cracks.visible = false;
    this.cracks.traverse(function (o) {
      if (o.material) {
        o.material = o.material.clone();
        o.material.transparent = true;
        o.material.opacity = 0;
      }
    });

    /* Six truck drums. Front pair steers. Parent is root (not body) so
       pitch/roll lean the cab while the drums stay planted. */
    var spots = [
      { x: -1.22, z: -2.15, front: true },
      { x: 1.22, z: -2.15, front: true },
      { x: -1.22, z: 0.15, front: false },
      { x: 1.22, z: 0.15, front: false },
      { x: -1.22, z: 2.25, front: false },
      { x: 1.22, z: 2.25, front: false }
    ];
    var i, spec, hub, spin, tire, disc, wr;
    wr = C.wheelRadius;
    for (i = 0; i < spots.length; i++) {
      spec = spots[i];
      hub = new THREE.Group();
      hub.position.set(spec.x, wr, spec.z);
      this.root.add(hub);
      spin = new THREE.Group();
      hub.add(spin);
      tire = new THREE.Mesh(new THREE.CylinderGeometry(wr, wr, 0.42, 12), rubber);
      tire.rotation.z = Math.PI / 2;
      tire.castShadow = true;
      tire.receiveShadow = true;
      spin.add(tire);
      disc = new THREE.Mesh(new THREE.CylinderGeometry(wr * 0.55, wr * 0.55, 0.44, 8), rim);
      disc.rotation.z = Math.PI / 2;
      spin.add(disc);
      this.wheels.push({
        hub: hub,
        spin: spin,
        front: spec.front,
        x: spec.x,
        z: spec.z,
        hy: 0,
        wx: 0,
        wy: wr,
        wz: 0,
        comp: 0,
        grounded: true,
        dust: 0.9,
        _h: null,
        _prevComp: 0
      });
    }

    this.headL = new THREE.SpotLight(0xffffff, 11.5, 88, 0.42, 0.48, 1.0);
    this.headR = new THREE.SpotLight(0xffffff, 11.5, 88, 0.42, 0.48, 1.0);
    this.headL.position.set(-0.7, 0.85, -3.9);
    this.headR.position.set(0.7, 0.85, -3.9);
    this.headL.target.position.set(-0.55, -0.55, -26);
    this.headR.target.position.set(0.55, -0.55, -26);
    this.body.add(this.headL);
    this.body.add(this.headR);
    this.body.add(this.headL.target);
    this.body.add(this.headR.target);

    /* Additive cones so the beams read as volume when dust is in them. */
    var beamMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.028,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      fog: true
    });
    var beamGeo = new THREE.ConeGeometry(5.4, 28, 14, 1, true);
    this.beamL = new THREE.Mesh(beamGeo, beamMat);
    this.beamR = new THREE.Mesh(beamGeo, beamMat.clone());
    this.beamL.rotation.x = -Math.PI / 2;
    this.beamR.rotation.x = -Math.PI / 2;
    this.beamL.position.set(-0.7, 0.55, -17.5);
    this.beamR.position.set(0.7, 0.55, -17.5);
    this.body.add(this.beamL);
    this.body.add(this.beamR);

    this.coreLight = new THREE.PointLight(0xffffff, 0.7, 9, 2);
    this.coreLight.position.set(0, 1.4, 1.6);
    this.body.add(this.coreLight);

    this.underLight = new THREE.PointLight(0xffffff, 0.7, 8, 2);
    this.underLight.position.set(0, 0.15, 0);
    this.body.add(this.underLight);

    this.muzzleNode = new THREE.Object3D();
    this.muzzleNode.position.set(0, 1.05, -4.05);
    this.body.add(this.muzzleNode);
  };

  Vehicle.prototype.reset = function () {
    this.pos.set(0, 1.2, 18);
    this.vel.set(0, 0, 0);
    this.yaw = 0;
    this.steer = 0;
    this.pitch = 0;
    this.roll = 0;
    this.speed = 0;
    this.longV = 0;
    this.latV = 0;
    this.slip = 0;
    this.slipAngle = 0;
    this.boostT = 0;
    this.boostFuel = 0;
    this.damageVisual = 0;
    this.pulseFlash = 0;
    this.alive = true;
    this.handbrake = false;
    this.hullRatio = 1;
    this._wheelSpin = 0;
    this.surfGrip = 1;
    this.surfDust = 0.9;
    this.surfSoft = 1;
    this.surfKind = "pad";
    this.vib = 0;
    this.roughness = 0;
    this.impactImpulse = 0;
    this.landImpulse = 0;
    this.collideImpulse = 0;
    this.engineLoad = 0;
    this.suspTravel = 0;
    this.accelLong = 0;
    this.accelLat = 0;
    this._accelLongS = 0;
    this._accelLatS = 0;
    this._prevLongV = 0;
    this._prevLatV = 0;
    this.wasGrounded = true;
    this.airTime = 0;
    this._squat = 0;
    this.wheelsDown = 6;
    this.root.position.copy(this.pos);
    this.root.rotation.set(0, 0, 0);
    this.body.rotation.set(0, 0, 0);
    this.body.position.set(0, 0.08, 0);
    this.setHullVisual(1);
    var i, w;
    for (i = 0; i < this.wheels.length; i++) {
      w = this.wheels[i];
      w.hub.rotation.y = 0;
      w.spin.rotation.x = 0;
      w.hub.position.y = C.wheelRadius;
      w.hub.scale.y = 1;
      w._h = null;
      w.comp = 0;
      w.grounded = true;
    }
  };

  Vehicle.prototype.giveBoost = function (sec) {
    this.boostFuel = Math.max(this.boostFuel, sec || 3.6);
  };

  Vehicle.prototype.muzzleWorld = function () {
    this.muzzleNode.getWorldPosition(this._muzzle);
    return this._muzzle;
  };

  Vehicle.prototype.setHullVisual = function (ratio) {
    this.hullRatio = M.saturate(ratio);
    var show = this.hullRatio < 0.62;
    this.cracks.visible = show;
    var op = show ? M.saturate((0.62 - this.hullRatio) / 0.62) : 0;
    this.cracks.traverse(function (o) {
      if (o.material && o.material.opacity !== undefined) o.material.opacity = 0.25 + op * 0.75;
    });
  };

  Vehicle.prototype.idleDisplay = function (dt) {
    this.root.rotation.y += dt * 0.28;
    this._wheelSpin += dt * 1.2;
    var i, w;
    for (i = 0; i < this.wheels.length; i++) {
      w = this.wheels[i];
      w.spin.rotation.x = this._wheelSpin;
      w.hub.rotation.y = w.front ? Math.sin(this.root.rotation.y * 0.5) * 0.18 : 0;
    }
  };

  Vehicle.prototype.update = function (dt, input, terrain, boosting) {
    /* Impulses are "this frame" — reset here so game / camera / audio
       can read them after update() returns. */
    this.impactImpulse = 0;
    this.landImpulse = 0;
    this.collideImpulse = 0;

    var steps = C.substeps || 3;
    var sdt = dt / steps;
    var s;
    for (s = 0; s < steps; s++) this._step(sdt, input, terrain, boosting);

    this._present(dt, input);
  };

  Vehicle.prototype._step = function (dt, input, terrain, boosting) {
    var fwd = this.heading;
    var right = this.right;
    var longV, latV, wantSteer, steerLimit, speedN, wantBoost;
    var grip, sa, peak, slide, extraYaw;

    fwd.set(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    right.set(Math.cos(this.yaw), 0, -Math.sin(this.yaw));

    this.throttle = input.throttle;
    this.handbrake = !!input.handbrake;

    wantBoost = boosting && this.boostFuel > 0;
    if (wantBoost) {
      this.boostFuel = Math.max(0, this.boostFuel - dt);
      this.boostT = 1;
    } else {
      this.boostT = M.damp(this.boostT, 0, 5, dt);
    }

    longV = this.vel.dot(fwd);
    latV = this.vel.dot(right);

    if (this.grounded) {
      if (input.throttle > 0.05) {
        longV += C.accel * input.throttle * dt * (wantBoost ? 1.38 : 1);
      } else if (input.throttle < -0.05) {
        if (longV > 1.0) longV -= C.brake * (-input.throttle) * dt;
        else longV += C.reverse * input.throttle * dt;
      }
    }
    if (this.handbrake && longV > 0) longV -= C.brake * 0.62 * dt;
    /* Overdrive shove falls off as speed rises so it stays planted. */
    if (wantBoost && this.grounded) {
      longV += (C.boostAccel || 15.5) * dt * (0.72 + 0.28 * (1 - M.saturate(longV / C.boostSpeed)));
    }

    var maxV = M.lerp(C.maxSpeed, C.boostSpeed, this.boostT);
    longV = M.clamp(longV, -C.reverse * 0.9, maxV);
    longV *= 1 - (C.drag + (this.handbrake ? 1.05 : 0)) * dt;

    this.longV = longV;
    this.speed = Math.abs(longV);
    speedN = M.saturate(this.speed / C.maxSpeed);

    this.accelLong = (longV - this._prevLongV) / Math.max(dt, 0.0008);
    this.accelLat = (latV - this._prevLatV) / Math.max(dt, 0.0008);
    this._prevLongV = longV;
    this._prevLatV = latV;
    this._accelLongS = M.damp(this._accelLongS, this.accelLong, 11, dt);
    this._accelLatS = M.damp(this._accelLatS, this.accelLat, 11, dt);

    steerLimit = C.maxSteer * (1 - 0.62 * speedN * speedN);
    wantSteer = M.clamp(input.steer, -1, 1) * steerLimit;
    this.steer = M.damp(this.steer, wantSteer, 8.2, dt);

    /*
     * Sign convention: +steer = Right/D. Three.js +Y rotation is
     * counterclockwise (left on screen from a rear chase cam), so a
     * right turn MUST decrement yaw.
     */
    if (this.grounded && Math.abs(longV) > 0.3) {
      this.yaw = M.wrapAngle(this.yaw - (longV / C.wheelbase) * Math.tan(this.steer) * dt);
      if (this.handbrake && Math.abs(this.steer) > 0.06 && speedN > 0.22) {
        this.yaw = M.wrapAngle(this.yaw - this.steer * 1.85 * dt * Math.sign(longV));
      }
    }

    /* Slip angle from the current velocity frame, then a cheap
       Pacejka-shaped grip curve: rise to a peak, then a slide plateau.
       Handbrake / boost / surface scale the whole curve. */
    this.slipAngle = Math.atan2(latV, Math.max(2.4, Math.abs(longV)));
    sa = Math.abs(this.slipAngle);
    peak = 0.2;
    slide = sa < peak
      ? (sa / peak) * (2 - sa / peak)
      : Math.exp(-(sa - peak) * 2.2) * 0.82 + 0.18;

    grip = this.handbrake
      ? C.handbrakeGrip
      : M.lerp(C.grip, C.driftGrip, M.saturate(sa / 0.52 * speedN * 1.15));
    grip *= this.surfGrip;
    /* Hold is high at small slip (planted) and falls after the peak. */
    grip *= sa < peak ? 1 - sa * 0.2 : 0.38 + 0.5 * slide;
    if (this.boostT > 0.35) grip *= 0.9;
    if (!this.grounded) grip *= 0.18;

    latV *= Math.pow(M.clamp(grip, 0.08, 0.98), dt * 50);

    /* Residual yaw into a slide so the truck rotates with the drift
       instead of translating sideways like a hovercraft. */
    extraYaw = Math.sign(latV) * Math.min(0.85, sa) * 0.42 * speedN;
    if (this.grounded && Math.abs(latV) > 1.4 && speedN > 0.18) {
      this.yaw = M.wrapAngle(this.yaw - extraYaw * dt);
    }

    this.slip = Math.abs(latV);
    this.latV = latV;

    fwd.set(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    right.set(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
    this.vel.set(fwd.x * longV + right.x * latV, this.vel.y, fwd.z * longV + right.z * latV);

    this.pos.x += this.vel.x * dt;
    this.pos.z += this.vel.z * dt;

    this._collide(terrain, right);
    this._suspend(dt, terrain, input, speedN);

    speedN = M.saturate(this.speed / C.maxSpeed);
    this.engineLoad = M.saturate(
      Math.max(0, this.throttle) * (0.38 + 0.62 * (1 - speedN)) +
        this.boostT * 0.68 +
        (this.grounded ? 0 : 0.12)
    );
  };

  /**
   * Soft circle contact: split normal / tangent so a graze scrapes
   * instead of dumping all speed. Hard hits still report an impulse
   * for camera, dust and audio.
   */
  Vehicle.prototype._collide = function (terrain, right) {
    var hit, len, nx, nz, vn, tx, tz, rest, impact, side;
    hit = terrain.collideCircle(this.pos.x, this.pos.z, C.radius);
    if (!hit) return;

    this.pos.x += hit.x;
    this.pos.z += hit.z;
    len = Math.hypot(hit.x, hit.z) || 1;
    nx = hit.x / len;
    nz = hit.z / len;
    vn = this.vel.x * nx + this.vel.z * nz;
    tx = this.vel.x - vn * nx;
    tz = this.vel.z - vn * nz;
    impact = vn < 0 ? -vn : 0;
    rest = impact > 9 ? (C.rest || 0.16) + 0.08 : (C.rest || 0.16) * 0.45;
    if (vn < 0) {
      this.vel.x = tx * 0.78 - nx * vn * rest;
      this.vel.z = tz * 0.78 - nz * vn * rest;
    } else {
      this.vel.x = tx * 0.88 + nx * vn;
      this.vel.z = tz * 0.88 + nz * vn;
    }
    this.collideImpulse += impact;
    this.impactImpulse += impact;
    side = right.x * nx + right.z * nz;
    this.yaw = M.wrapAngle(this.yaw - side * impact * 0.01);
  };

  /**
   * Independent wheel springs. Body height is the average contact
   * plane; each drum still samples its own cell so ruts and rims
   * read as compression instead of teleporting the whole truck.
   */
  Vehicle.prototype._suspend = function (dt, terrain, input, speedN) {
    var i, w, ox, oz, raw, surf;
    var avg = 0;
    var front = 0;
    var back = 0;
    var left = 0;
    var rght = 0;
    var fn = 0;
    var bn = 0;
    var ln = 0;
    var rn = 0;
    var down = 0;
    var chatter = 0;
    var gSum = 0;
    var dSum = 0;
    var sSum = 0;
    var kind = "mare";
    var kindDust = -1;
    var travel = C.suspTravel || 0.4;
    var wr = C.wheelRadius;
    var ride = C.rideHeight || 0.1;
    var hy, err, k, wantPitch, wantRoll, terrainPitch, terrainRoll;

    for (i = 0; i < this.wheels.length; i++) {
      w = this.wheels[i];
      ox = this.pos.x + this.heading.x * w.z + this.right.x * w.x;
      oz = this.pos.z + this.heading.z * w.z + this.right.z * w.x;
      raw = terrain.heightAt(ox, oz);
      /* Fast temporal filter kills single-sample spikes at speed
         without making the truck float. */
      w._h = w._h == null ? raw : M.damp(w._h, raw, 38, dt);
      surf = terrain.surfaceAt(ox, oz);
      w.hy = w._h;
      w.wx = ox;
      w.wz = oz;
      w.wy = w._h + wr;
      w.dust = surf.dust;
      gSum += surf.grip;
      dSum += surf.dust;
      sSum += surf.soft;
      if (surf.dust > kindDust) {
        kindDust = surf.dust;
        kind = surf.kind;
      }

      w.comp = M.saturate((ride + travel * 0.12 - (this.pos.y - w._h - wr)) / travel);
      if (this.pos.y < w._h + wr + ride + travel * 0.85) {
        w.grounded = true;
        down++;
      } else {
        w.grounded = false;
        w.comp = 0;
      }
      chatter += Math.abs(w.comp - w._prevComp);
      w._prevComp = w.comp;

      avg += w._h;
      if (w.z < -0.4) {
        front += w._h;
        fn++;
      } else if (w.z > 0.4) {
        back += w._h;
        bn++;
      }
      if (w.x < 0) {
        left += w._h;
        ln++;
      } else {
        rght += w._h;
        rn++;
      }
    }

    avg /= this.wheels.length;
    this.surfGrip = gSum / this.wheels.length;
    this.surfDust = dSum / this.wheels.length;
    this.surfSoft = sSum / this.wheels.length;
    this.surfKind = kind;
    this.wheelsDown = down;
    this.roughness = M.damp(this.roughness, chatter * 5.2, 13, dt);

    hy = avg + wr + ride;
    err = hy - this.pos.y;
    k = (C.susp || 20) / Math.max(0.55, this.surfSoft);
    if (this.boostT > 0.4) k *= 1.12;
    if (err > 0.07) k += (err - 0.07) * 48;

    if (down >= 1 && this.pos.y <= hy + 0.48) {
      if (!this.wasGrounded) {
        this.landImpulse = Math.max(0, -this.vel.y);
        this.impactImpulse += this.landImpulse;
        this.vel.y *= 0.28;
        this._squat = Math.min(0.2, this.landImpulse * 0.028);
      }
      this.grounded = true;
      this.airTime = 0;
      this.vel.y += (err * k - this.vel.y * (C.suspDamp || 8.4)) * dt;
      if (this.pos.y < hy - 0.05) {
        this.pos.y = M.lerp(this.pos.y, hy, 1 - Math.exp(-15 * dt));
      }
    } else {
      this.grounded = false;
      this.airTime += dt;
      this.vel.y -= C.gravity * dt;
    }
    this.wasGrounded = this.grounded;
    this.pos.y += this.vel.y * dt;

    this.suspTravel = 0;
    for (i = 0; i < this.wheels.length; i++) this.suspTravel += this.wheels[i].comp;
    this.suspTravel /= this.wheels.length;
    this._squat = M.damp(this._squat, 0, 5.2, dt);

    fn = Math.max(1, fn);
    bn = Math.max(1, bn);
    ln = Math.max(1, ln);
    rn = Math.max(1, rn);
    /* Negative pitch = nose up (forward is -Z). Climbing (front high)
       and acceleration both produce that sign. */
    terrainPitch = M.clamp(((back / bn) - (front / fn)) * (C.terrainFollow || 0.92) * 0.11, -0.22, 0.22);
    terrainRoll = M.clamp(((left / ln) - (rght / rn)) * (C.terrainFollow || 0.92) * 0.11, -0.24, 0.24);
    wantPitch = M.clamp(
      terrainPitch -
        this._accelLongS * (C.squat || 0.0048) -
        input.throttle * 0.026 +
        this.boostT * 0.042 +
        this._squat * 0.55,
      -0.22,
      0.22
    );
    wantRoll = M.clamp(
      terrainRoll -
        this._accelLatS * (C.lean || 0.0036) -
        this.steer * 0.24 * speedN,
      -0.26,
      0.26
    );
    this.pitch = M.damp(this.pitch, wantPitch, 6.1, dt);
    this.roll = M.damp(this.roll, wantRoll, 6.4, dt);
  };

  Vehicle.prototype._present = function (dt, input) {
    var i, w, spin, speedN, localY, travel, wr, dustGlow, vib;
    travel = C.suspTravel || 0.4;
    wr = C.wheelRadius;
    /* Locked drums crawl; a slide adds extra spin so the tires look busy. */
    spin = this.longV * dt / Math.max(0.15, wr);
    if (this.handbrake) spin *= 0.32;
    else spin += this.slip * 0.045 * dt;
    this._wheelSpin += spin;
    for (i = 0; i < this.wheels.length; i++) {
      w = this.wheels[i];
      w.spin.rotation.x = this._wheelSpin;
      w.hub.rotation.y = w.front ? -this.steer : 0;
      localY = w.hy + wr - this.pos.y;
      w.hub.position.y = M.clamp(localY, wr - travel, wr + travel);
      /* Vertical squash sells load without changing the contact point. */
      w.hub.scale.y = 1 - w.comp * 0.12;
    }

    this.root.position.copy(this.pos);
    this.root.rotation.order = "YXZ";
    this.root.rotation.y = this.yaw;
    this.root.rotation.x = 0;
    this.root.rotation.z = 0;

    this.body.rotation.order = "YXZ";
    this.body.rotation.x = this.pitch;
    this.body.rotation.z = this.roll;

    this._t += dt;
    speedN = M.saturate(this.speed / C.maxSpeed);
    vib = (this.engineLoad * 0.01 + this.roughness * 0.065 + this._squat * 0.04) * (C.vibAmp || 1);
    if (this.grounded && this.speed > 3) vib += 0.0032 + speedN * 0.0055;
    this.vib = vib;
    this.body.position.y = 0.08 - this._squat + Math.sin(this._t * 58) * vib * 0.7;
    this.body.position.x = Math.sin(this._t * 41) * vib * 0.24;

    this.damageVisual = M.damp(this.damageVisual, 0, 2.2, dt);
    this.pulseFlash = Math.max(0, this.pulseFlash - dt * 5);
    this.coreLight.intensity = 0.45 + this.boostT * 0.8 + this.pulseFlash + (1 - this.hullRatio) * 0.5;
    this.underLight.intensity = 0.4 + speedN * 0.4 + this.boostT * 0.4;
    this.headL.intensity = 10.2 + this.pulseFlash * 4 + this.boostT * 1.6;
    this.headR.intensity = 10.2 + this.pulseFlash * 4 + this.boostT * 1.6;
    if (this.under.material) this.under.material.opacity = 0.2 + speedN * 0.22 + this.boostT * 0.35;
    if (this.tail.material) this.tail.material.opacity = input.throttle < -0.1 || this.handbrake ? 1 : 0.4;

    dustGlow = M.saturate(speedN * 0.55 + this.surfDust * 0.25 + this.boostT * 0.18);
    if (this.beamL && this.beamL.material) this.beamL.material.opacity = 0.016 + dustGlow * 0.05;
    if (this.beamR && this.beamR.material) this.beamR.material.opacity = 0.016 + dustGlow * 0.05;
  };

  Vehicle.prototype.knock = function (ax, az, force) {
    var len = Math.hypot(ax, az) || 1;
    var inv = 1 / (C.mass || 2);
    this.vel.x += (ax / len) * force * 0.22 * inv;
    this.vel.z += (az / len) * force * 0.22 * inv;
    this.vel.y += force * 0.02 * inv;
    this.damageVisual = 1;
    this.impactImpulse += force * 0.35;
    this._squat = Math.min(0.18, this._squat + force * 0.006);
  };

  VR.Vehicle = Vehicle;
})(typeof window !== "undefined" ? window : globalThis);

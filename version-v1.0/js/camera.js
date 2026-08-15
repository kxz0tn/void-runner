/**
 * VOID RUNNER — Chase camera
 * Copyright (c) 2026 VOID RUNNER contributors
 * SPDX-License-Identifier: MIT
 *
 * Low chase with spring lag, velocity look-ahead and chassis coupling
 * so speed, lean and landings read through the lens. Title orbit is
 * close and low to show wheels.
 */
(function (global) {
  "use strict";

  var VR = (global.VR = global.VR || {});
  var M = VR.math;
  var C = VR.CONFIG.camera;

  function CameraRig(camera, vehicle) {
    this.camera = camera;
    this.vehicle = vehicle;
    this.lookYaw = 0;
    this.lookPitch = 0.04;
    this.shake = 0;
    this._shakeV = new THREE.Vector3();
    this._desired = new THREE.Vector3();
    this._cur = new THREE.Vector3(0, 4, 12);
    this._target = new THREE.Vector3();
    this._titleT = 0;
    this._rumbleT = 0;
    this._bob = 0;
    this._landDip = 0;
    this.mode = "title";
  }

  CameraRig.prototype.setMode = function (mode) {
    this.mode = mode;
    if (mode === "play") {
      this.lookYaw = 0;
      this.lookPitch = 0.04;
      this._landDip = 0;
    }
  };

  CameraRig.prototype.addShake = function (amt) {
    this.shake = Math.min(2.4, this.shake + amt);
  };

  CameraRig.prototype.update = function (dt, input, playing) {
    var v = this.vehicle;
    var speedN, dist, height, lx, lz, fovWant;
    var lookYaw, lookX, lookZ, couple, look, stiffY;
    var rumbleX, rumbleY, bob;
    this._titleT += dt;

    if (!playing || this.mode === "title") {
      var a = this._titleT * 0.32;
      this.camera.position.set(
        v.pos.x + Math.sin(a) * 11.5,
        v.pos.y + 3.6 + Math.sin(this._titleT * 0.45) * 0.35,
        v.pos.z + Math.cos(a) * 11.5
      );
      this._target.set(v.pos.x, v.pos.y + 1.1, v.pos.z);
      this.camera.lookAt(this._target);
      this.camera.fov = M.damp(this.camera.fov, 50, 2, dt);
      this.camera.updateProjectionMatrix();
      return;
    }

    if (this.mode === "over") {
      this.camera.position.x = M.damp(this.camera.position.x, v.pos.x + 6.5, 1.1, dt);
      this.camera.position.y = M.damp(this.camera.position.y, v.pos.y + 3.2, 1.1, dt);
      this.camera.position.z = M.damp(this.camera.position.z, v.pos.z + 6.5, 1.1, dt);
      this.camera.lookAt(v.pos.x, v.pos.y + 0.7, v.pos.z);
      return;
    }

    this.lookYaw = M.clamp(this.lookYaw + (input ? input.lookX : 0) * C.mouseYaw, -1.1, 1.1);
    this.lookPitch = M.clamp(this.lookPitch + (input ? input.lookY : 0) * C.mousePitch, -0.18, 0.45);
    this.lookYaw = M.damp(this.lookYaw, 0, 0.7, dt);
    this.lookPitch = M.damp(this.lookPitch, 0.04, 0.55, dt);

    speedN = M.saturate(v.speed / VR.CONFIG.vehicle.maxSpeed);
    dist = C.chaseDist + speedN * 3.4 - (v.boostT || 0) * 0.4;
    height = C.chaseHeight + speedN * 0.38;
    couple = C.bodyCoupling == null ? 0.36 : C.bodyCoupling;

    /* Chassis coupling: the lens inherits a fraction of body lean so
       weight transfer is felt, not just seen on the truck. */
    height += v.pitch * couple * 2.4;
    this._landDip = Math.max(this._landDip, (v.landImpulse || 0) * 0.055);
    this._landDip = M.damp(this._landDip, 0, 6.2, dt);
    height -= this._landDip;

    this._bob += dt * (5.5 + speedN * 9);
    bob = v.grounded ? Math.sin(this._bob) * speedN * 0.09 : 0;
    height += bob + (v.suspTravel || 0) * 0.18;

    lookYaw = v.yaw + this.lookYaw;
    lx = Math.sin(lookYaw);
    lz = Math.cos(lookYaw);
    this._desired.set(
      v.pos.x + lx * dist + v.right.x * (1.15 + v.roll * couple * 2.2),
      v.pos.y + height + this.lookPitch * 5,
      v.pos.z + lz * dist + v.right.z * (1.15 + v.roll * couple * 2.2)
    );

    stiffY = C.stiffness * ((v.landImpulse || 0) > 2 ? 1.85 : 0.92);
    this._cur.x = M.damp(this._cur.x, this._desired.x, C.stiffness, dt);
    this._cur.y = M.damp(this._cur.y, this._desired.y, stiffY, dt);
    this._cur.z = M.damp(this._cur.z, this._desired.z, C.stiffness, dt);

    if ((v.impactImpulse || 0) > 4) this.addShake(Math.min(0.9, v.impactImpulse * 0.035));

    this.shake = Math.max(0, this.shake - dt * 3.6);
    this._rumbleT += dt * (16 + (v.engineLoad || 0) * 24);
    rumbleX = Math.sin(this._rumbleT * 1.73) * (v.vib || 0) * 0.85 * (C.rumble || 1);
    rumbleY = Math.sin(this._rumbleT * 2.31) * (v.vib || 0) * 0.55 * (C.rumble || 1);
    if (this.shake > 0) {
      this._shakeV.set(
        (Math.random() - 0.5) * this.shake * 0.28 + rumbleX,
        (Math.random() - 0.5) * this.shake * 0.2 + rumbleY,
        (Math.random() - 0.5) * this.shake * 0.28
      );
    } else {
      this._shakeV.set(rumbleX, rumbleY, 0);
    }

    this.camera.position.copy(this._cur).add(this._shakeV);

    look = C.lookAhead * (0.7 + speedN * 0.58);
    lookX = v.heading.x * look + v.vel.x * 0.14;
    lookZ = v.heading.z * look + v.vel.z * 0.14;
    this._target.set(
      v.pos.x + lookX,
      v.pos.y + 1.02 + this.lookPitch * 1.4 + v.pitch * couple * 1.6 - this._landDip * 0.4,
      v.pos.z + lookZ
    );
    this.camera.lookAt(this._target);

    fovWant = M.lerp(C.fov, C.fovBoost, Math.max(speedN * speedN, v.boostT));
    this.camera.fov = M.damp(this.camera.fov, fovWant, 4.4, dt);
    this.camera.updateProjectionMatrix();
  };

  CameraRig.prototype.snapBehind = function () {
    var v = this.vehicle;
    this._cur.set(
      v.pos.x + Math.sin(v.yaw) * C.chaseDist,
      v.pos.y + C.chaseHeight,
      v.pos.z + Math.cos(v.yaw) * C.chaseDist
    );
    this.camera.position.copy(this._cur);
    this._landDip = 0;
  };

  VR.CameraRig = CameraRig;
})(typeof window !== "undefined" ? window : globalThis);

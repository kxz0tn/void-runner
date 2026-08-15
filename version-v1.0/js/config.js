/**
 * VOID RUNNER — Config
 * Copyright (c) 2026 VOID RUNNER contributors
 * SPDX-License-Identifier: MIT
 *
 * v1.0.0 public release tunables. Steering sign: +steer is right-hand
 * input and must produce a right turn on screen.
 */
(function (global) {
  "use strict";

  var VR = (global.VR = global.VR || {});

  VR.VERSION = "1.0.0";
  VR.STORAGE_KEY = "voidrunner.hiscore";

  VR.PALETTE = {
    black: 0x000000,
    void: 0x050505,
    ink: 0x0c0c0c,
    charcoal: 0x161616,
    steel: 0x2a2a2a,
    iron: 0x3c3c3c,
    gray: 0x6e6e6e,
    silver: 0xb4b4b4,
    white: 0xffffff
  };

  VR.CONFIG = {
    renderer: {
      maxPixelRatio: 1.75,
      lowPixelRatio: 1.0,
      shadowMapSizeHigh: 2048,
      shadowMapSizeMed: 1024,
      fogNear: 80,
      fogFar: 340
    },

    camera: {
      fov: 54,
      fovBoost: 68,
      near: 0.15,
      far: 900,
      chaseDist: 13.8,
      chaseHeight: 3.05,
      lookAhead: 12.4,
      stiffness: 5.6,
      mouseYaw: 0.8,
      mousePitch: 0.38,
      /* 0–1: how much chassis pitch/roll the lens inherits. */
      bodyCoupling: 0.36,
      rumble: 1
    },

    vehicle: {
      name: "VOID HAULER",
      accel: 24,
      brake: 46,
      reverse: 11,
      maxSpeed: 34,
      boostSpeed: 50,
      boostAccel: 15.5,
      maxSteer: 0.4,
      wheelbase: 3.55,
      grip: 0.88,
      driftGrip: 0.46,
      handbrakeGrip: 0.24,
      drag: 0.3,
      gravity: 11.6,
      wheelRadius: 0.58,
      susp: 20,
      suspDamp: 8.4,
      suspTravel: 0.4,
      rideHeight: 0.1,
      radius: 2.55,
      mass: 2.55,
      substeps: 3,
      /* Nose rise per unit longitudinal accel (weight transfer). */
      squat: 0.0056,
      /* Body roll per unit lateral accel. */
      lean: 0.0042,
      /* How hard the chassis matches terrain slope (0–1). */
      terrainFollow: 0.92,
      /* Collision normal restitution, 0 = dead, 1 = bounce. */
      rest: 0.16,
      vibAmp: 1
    },

    /*
     * Lunar dust. linger/gravity sell the low-g hang; wheelRate is
     * seconds between per-wheel emits. Designer knobs, not sim constants.
     */
    dust: {
      linger: 1.45,
      gravity: 1.68,
      wheelRate: 0.03,
      landMul: 1,
      headlight: 1
    },

    combat: {
      pulseCooldown: 0.2,
      pulseSpeed: 80,
      pulseLife: 1.2,
      pulseRadius: 0.95,
      pulseDamage: 32,
      iframe: 0.75,
      rapidScale: 0.38
    },

    player: {
      shieldMax: 100,
      hullMax: 100,
      shieldRegen: 4.2,
      shieldRegenDelay: 3.4
    },

    aliens: {
      maxAlive: 20,
      baseSpawn: 2.7,
      minSpawn: 0.7,
      scoutSpeed: 20,
      bruteSpeed: 10.5,
      flyerSpeed: 16,
      packSep: 11,
      flank: 15,
      aggro: 240
    },

    world: {
      tile: 60,
      terrainSize: 780,
      terrainSeg: 136,
      streamRadius: 3,
      craterCell: 62
    },

    score: {
      perMeter: 2.2,
      perSecond: 9,
      perKillScout: 90,
      perKillBrute: 260,
      perKillFlyer: 200,
      perOrb: 80
    }
  };

  VR.detectQuality = function detectQuality() {
    var mobile = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent || "");
    var cores = navigator.hardwareConcurrency || 4;
    var mem = navigator.deviceMemory || 4;
    if (mobile || cores <= 4 || mem <= 4) return "low";
    if (cores <= 8 || mem <= 8) return "med";
    return "high";
  };
})(typeof window !== "undefined" ? window : globalThis);

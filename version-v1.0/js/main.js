/**
 * VOID RUNNER — Bootstrap
 * Copyright (c) 2026 VOID RUNNER contributors
 * SPDX-License-Identifier: MIT
 *
 * Feature-detect WebGL, then hand the canvas to Game. Failures surface
 * as a monochrome diagnostic instead of a blank page.
 */
(function (global) {
  "use strict";

  var VR = (global.VR = global.VR || {});

  function webglOk() {
    try {
      var c = document.createElement("canvas");
      return !!(c.getContext("webgl2") || c.getContext("webgl"));
    } catch (e) {
      return false;
    }
  }

  function fail(msg) {
    var el = document.getElementById("error");
    if (!el) return;
    el.classList.add("show");
    el.textContent = msg;
  }

  function bootLine(text, ok) {
    var log = document.getElementById("boot-log");
    if (!log) return;
    var row = document.createElement("div");
    row.className = ok ? "ok" : "";
    row.textContent = (ok ? "[ OK ]  " : "[ .. ]  ") + text;
    log.appendChild(row);
  }

  function start() {
    var canvas = document.getElementById("gl");
    if (!canvas) {
      fail("VOID RUNNER — canvas node missing.");
      return;
    }
    if (typeof THREE === "undefined") {
      fail("VOID RUNNER — Three.js failed to load. Check the network / CDN.");
      return;
    }
    if (!webglOk()) {
      fail("VOID RUNNER — WebGL is unavailable on this device.");
      return;
    }
    bootLine("WEBGL CONTEXT", true);
    bootLine("PALETTE LOCK  MONOCHROME", true);
    bootLine("VOID HAULER  GEOMETRY", true);
    bootLine("BUILD  " + (VR.VERSION || "1.0.0"), true);
    try {
      VR.instance = new VR.Game(canvas);
      bootLine("SYSTEMS ONLINE", true);
      if (/[?&]autostart=1/.test(location.search || "") || /[?&]drive=1/.test(location.search || "")) {
        VR.instance.startRun();
        if (/[?&]drive=1/.test(location.search || "")) VR.instance._autoDrive = true;
      }
    } catch (err) {
      fail("VOID RUNNER — init fault: " + (err && err.message ? err.message : err));
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }
})(typeof window !== "undefined" ? window : globalThis);

/**
 * VOID RUNNER — Input
 * Copyright (c) 2026 VOID RUNNER contributors
 * SPDX-License-Identifier: MIT
 *
 * Keyboard, pointer-lock mouse look, gamepad, and a two-zone touch
 * fallback. All devices collapse to the same analog frame snapshot.
 */
(function (global) {
  "use strict";

  var VR = (global.VR = global.VR || {});

  function Input(canvas) {
    this.canvas = canvas;
    this.keys = Object.create(null);
    this.mouse = { x: 0, y: 0, dx: 0, dy: 0, down: false, locked: false };
    this.touch = { lx: 0, ly: 0, rx: 0, ry: 0, left: false, right: false, fire: false };
    this._mx = 0;
    this._my = 0;
    this.padConnected = false;

    var self = this;

    window.addEventListener("keydown", function (e) {
      self.keys[e.code] = true;
      if (
        e.code === "Space" ||
        e.code === "ArrowUp" ||
        e.code === "ArrowDown" ||
        e.code === "ArrowLeft" ||
        e.code === "ArrowRight" ||
        e.code === "Tab"
      ) {
        e.preventDefault();
      }
    });
    window.addEventListener("keyup", function (e) {
      self.keys[e.code] = false;
    });

    canvas.addEventListener("mousedown", function (e) {
      self.mouse.down = true;
      if (e.button === 0 && document.pointerLockElement !== canvas) {
        try {
          canvas.requestPointerLock();
        } catch (err) {
          /* pointer lock is optional */
        }
      }
    });
    window.addEventListener("mouseup", function () {
      self.mouse.down = false;
    });
    document.addEventListener("pointerlockchange", function () {
      self.mouse.locked = document.pointerLockElement === canvas;
    });
    document.addEventListener("mousemove", function (e) {
      if (self.mouse.locked) {
        self._mx += e.movementX || 0;
        self._my += e.movementY || 0;
      }
    });

    canvas.addEventListener(
      "touchstart",
      function (e) {
        e.preventDefault();
        self._syncTouches(e.touches, canvas);
        if (e.touches.length >= 2) self.touch.fire = true;
      },
      { passive: false }
    );
    canvas.addEventListener(
      "touchmove",
      function (e) {
        e.preventDefault();
        self._syncTouches(e.touches, canvas);
      },
      { passive: false }
    );
    canvas.addEventListener(
      "touchend",
      function (e) {
        e.preventDefault();
        self._syncTouches(e.touches, canvas);
        if (e.touches.length < 2) self.touch.fire = false;
      },
      { passive: false }
    );

    window.addEventListener("gamepadconnected", function () {
      self.padConnected = true;
    });
    window.addEventListener("gamepaddisconnected", function () {
      self.padConnected = false;
    });

    window.addEventListener("blur", function () {
      self.keys = Object.create(null);
    });
  }

  Input.prototype._syncTouches = function (touches, canvas) {
    var rect = canvas.getBoundingClientRect();
    var i, t, nx, ny, leftOn, rightOn;
    leftOn = false;
    rightOn = false;
    this.touch.lx = 0;
    this.touch.ly = 0;
    this.touch.rx = 0;
    this.touch.ry = 0;
    for (i = 0; i < touches.length; i++) {
      t = touches[i];
      nx = ((t.clientX - rect.left) / rect.width) * 2 - 1;
      ny = ((t.clientY - rect.top) / rect.height) * 2 - 1;
      if (nx < 0) {
        this.touch.lx = VR.math.clamp(nx * 2 + 1, -1, 1);
        this.touch.ly = VR.math.clamp(-ny, -1, 1);
        leftOn = true;
      } else {
        this.touch.rx = VR.math.clamp((nx - 0.5) * 2, -1, 1);
        this.touch.ry = VR.math.clamp(-ny, -1, 1);
        rightOn = true;
      }
    }
    this.touch.left = leftOn;
    this.touch.right = rightOn;
  };

  Input.prototype._gamepad = function () {
    var pads, p, ax, ay, rx, ry;
    if (!navigator.getGamepads) return null;
    pads = navigator.getGamepads();
    if (!pads || !pads[0]) return null;
    p = pads[0];
    ax = Math.abs(p.axes[0]) > 0.18 ? p.axes[0] : 0;
    ay = Math.abs(p.axes[1]) > 0.18 ? p.axes[1] : 0;
    rx = p.axes[2] && Math.abs(p.axes[2]) > 0.12 ? p.axes[2] : 0;
    ry = p.axes[3] && Math.abs(p.axes[3]) > 0.12 ? p.axes[3] : 0;
    return {
      steer: ax,
      throttle: -ay + (p.buttons[7] ? p.buttons[7].value : 0) - (p.buttons[6] ? p.buttons[6].value : 0),
      fire: !!(p.buttons[0] && p.buttons[0].pressed) || !!(p.buttons[2] && p.buttons[2].pressed),
      boost: !!(p.buttons[1] && p.buttons[1].pressed),
      handbrake: !!(p.buttons[5] && p.buttons[5].pressed) || !!(p.buttons[4] && p.buttons[4].pressed),
      pause: !!(p.buttons[9] && p.buttons[9].pressed),
      lookX: rx,
      lookY: ry
    };
  };

  /**
   * Snapshot analog controls for this frame and clear mouse deltas.
   * Positive throttle is forward, positive steer is right.
   */
  Input.prototype.frame = function () {
    var k = this.keys;
    var pad = this._gamepad();
    var throttle = 0;
    var steer = 0;
    var lookX = 0;
    var lookY = 0;

    if (k.KeyW || k.ArrowUp) throttle += 1;
    if (k.KeyS || k.ArrowDown) throttle -= 1;
    if (k.KeyD || k.ArrowRight) steer += 1;
    if (k.KeyA || k.ArrowLeft) steer -= 1;
    if (this.touch.left) {
      throttle = VR.math.clamp(throttle + this.touch.ly, -1, 1);
      steer = VR.math.clamp(steer + this.touch.lx, -1, 1);
    }
    if (this.touch.right) {
      lookX += this.touch.rx;
      lookY += this.touch.ry;
    }

    if (pad) {
      throttle = VR.math.clamp(throttle + pad.throttle, -1, 1);
      steer = VR.math.clamp(steer + pad.steer, -1, 1);
      lookX += pad.lookX;
      lookY += pad.lookY;
    }

    this.mouse.dx = this._mx;
    this.mouse.dy = this._my;
    this._mx = 0;
    this._my = 0;
    lookX += this.mouse.dx * 0.0022;
    lookY += -this.mouse.dy * 0.0022;

    return {
      throttle: VR.math.clamp(throttle, -1, 1),
      steer: VR.math.clamp(steer, -1, 1),
      brake: !!(k.KeyC || k.ControlLeft),
      handbrake: !!(k.KeyC || k.ControlLeft) || !!(pad && pad.handbrake),
      fire: !!(k.Space || k.KeyF) || this.mouse.down || this.touch.fire || !!(pad && pad.fire),
      boost: !!(k.ShiftLeft || k.ShiftRight) || !!(pad && pad.boost),
      pause: !!(k.Escape || k.KeyP) || !!(pad && pad.pause),
      start: !!(k.Enter || k.Space),
      mute: !!k.KeyM,
      lookX: lookX,
      lookY: lookY
    };
  };

  VR.Input = Input;
})(typeof window !== "undefined" ? window : globalThis);

/**
 * VOID RUNNER — Sky + lighting
 * Copyright (c) 2026 VOID RUNNER contributors
 * SPDX-License-Identifier: MIT
 *
 * Black void only. Stars plus a monochrome nebula — no Earth, no planets.
 */
(function (global) {
  "use strict";

  var VR = (global.VR = global.VR || {});

  var NEB_VERT = [
    "varying vec3 vN;",
    "varying vec3 vW;",
    "void main(){",
    "  vN = normalize(normalMatrix * normal);",
    "  vec4 w = modelMatrix * vec4(position,1.0);",
    "  vW = w.xyz;",
    "  gl_Position = projectionMatrix * viewMatrix * w;",
    "}"
  ].join("\n");

  var NEB_FRAG = [
    "precision highp float;",
    "varying vec3 vN;",
    "varying vec3 vW;",
    "uniform float uTime;",
    "float hash(vec3 p){ return fract(sin(dot(p, vec3(127.1,311.7,74.7))) * 43758.5453); }",
    "float nv(vec3 p){",
    "  vec3 i=floor(p); vec3 f=fract(p); f=f*f*(3.0-2.0*f);",
    "  return mix(mix(mix(hash(i),hash(i+vec3(1,0,0)),f.x),",
    "                 mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),",
    "             mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),",
    "                 mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y),f.z);",
    "}",
    "float fbm(vec3 p){ float a=0.5; float s=0.0; for(int i=0;i<5;i++){ s+=a*nv(p); p*=2.11; a*=0.52; } return s; }",
    "void main(){",
    "  vec3 d = normalize(vW);",
    "  float n = fbm(d * 2.4 + vec3(uTime*0.008, 0.2, -uTime*0.006));",
    "  float band = smoothstep(0.46, 0.72, n) * smoothstep(0.2, 0.55, abs(d.y + 0.15));",
    "  float wisps = pow(smoothstep(0.58, 0.86, n), 1.6);",
    "  float luma = band * 0.055 + wisps * 0.09;",
    "  float alpha = band * 0.55 + wisps * 0.28;",
    "  gl_FragColor = vec4(vec3(luma * 4.0), alpha);",
    "}"
  ].join("\n");

  function Sky(scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    scene.add(this.group);

    scene.background = new THREE.Color(0x000000);
    scene.fog = new THREE.Fog(0x000000, VR.CONFIG.renderer.fogNear, VR.CONFIG.renderer.fogFar);

    this._stars();
    this._nebula();
    this._lights();
  }

  Sky.prototype._stars = function () {
    var count = 3400;
    var pos = new Float32Array(count * 3);
    var col = new Float32Array(count * 3);
    var i, r, th, ph, b;
    for (i = 0; i < count; i++) {
      r = 420 + Math.random() * 260;
      th = Math.acos(2 * Math.random() - 1);
      ph = Math.random() * Math.PI * 2;
      pos[i * 3] = r * Math.sin(th) * Math.cos(ph);
      pos[i * 3 + 1] = r * Math.cos(th);
      pos[i * 3 + 2] = r * Math.sin(th) * Math.sin(ph);
      if (pos[i * 3 + 1] < -40) pos[i * 3 + 1] = Math.abs(pos[i * 3 + 1]) * 0.35 + 20;
      b = 0.4 + Math.random() * 0.6;
      if (Math.random() < 0.07) b = 1;
      col[i * 3] = col[i * 3 + 1] = col[i * 3 + 2] = b;
    }
    var g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    g.setAttribute("color", new THREE.BufferAttribute(col, 3));
    this.stars = new THREE.Points(
      g,
      new THREE.PointsMaterial({
        size: 0.95,
        vertexColors: true,
        sizeAttenuation: true,
        depthWrite: false,
        transparent: true,
        opacity: 0.95
      })
    );
    this.group.add(this.stars);
  };

  Sky.prototype._nebula = function () {
    this.nebMat = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 } },
      vertexShader: NEB_VERT,
      fragmentShader: NEB_FRAG,
      transparent: true,
      depthWrite: false,
      side: THREE.BackSide,
      blending: THREE.AdditiveBlending
    });
    this.nebula = new THREE.Mesh(new THREE.SphereGeometry(520, 32, 20), this.nebMat);
    this.group.add(this.nebula);
  };

  Sky.prototype._lights = function () {
    this.ambient = new THREE.AmbientLight(0xffffff, 0.4);
    this.scene.add(this.ambient);

    this.sun = new THREE.DirectionalLight(0xffffff, 1.85);
    this.sun.position.set(70, 95, 36);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    this.sun.shadow.camera.near = 10;
    this.sun.shadow.camera.far = 260;
    this.sun.shadow.camera.left = -70;
    this.sun.shadow.camera.right = 70;
    this.sun.shadow.camera.top = 70;
    this.sun.shadow.camera.bottom = -70;
    this.sun.shadow.bias = -0.00025;
    this.scene.add(this.sun);
    this.scene.add(this.sun.target);

    this.fill = new THREE.DirectionalLight(0xffffff, 0.28);
    this.fill.position.set(-50, 24, -28);
    this.scene.add(this.fill);

    this.hemi = new THREE.HemisphereLight(0xffffff, 0x101010, 0.32);
    this.scene.add(this.hemi);
  };

  Sky.prototype.setQuality = function (q) {
    var size = q === "high" ? 2048 : q === "med" ? 1024 : 512;
    this.sun.castShadow = q !== "low";
    this.sun.shadow.mapSize.set(size, size);
    if (q === "low") {
      this.stars.material.size = 1.25;
      this.nebula.visible = false;
    }
  };

  Sky.prototype.update = function (dt, playerPos) {
    if (this.nebMat) this.nebMat.uniforms.uTime.value += dt;
    this.stars.rotation.y += dt * 0.0012;
    if (this.nebula) this.nebula.rotation.y -= dt * 0.002;
    if (playerPos) {
      this.sun.target.position.copy(playerPos);
      this.sun.position.set(playerPos.x + 70, playerPos.y + 110, playerPos.z + 48);
      this.group.position.set(playerPos.x, 0, playerPos.z);
    }
  };

  VR.Sky = Sky;
})(typeof window !== "undefined" ? window : globalThis);

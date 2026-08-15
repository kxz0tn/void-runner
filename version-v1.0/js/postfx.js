/**
 * VOID RUNNER — Post-processing
 * Copyright (c) 2026 VOID RUNNER contributors
 * SPDX-License-Identifier: MIT
 *
 * Scene → HDR target → cheap dual-blur bloom → composite with grain,
 * chromatic aberration, vignette and scanlines. All monochrome. Falls
 * back to a raw renderer.render if a render target cannot be allocated.
 */
(function (global) {
  "use strict";

  var VR = (global.VR = global.VR || {});

  var QUAD_VERT = [
    "varying vec2 vUv;",
    "void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }"
  ].join("\n");

  var BLUR_FRAG = [
    "precision highp float;",
    "varying vec2 vUv;",
    "uniform sampler2D tDiffuse;",
    "uniform vec2 uDir;",
    "void main(){",
    "  vec4 s = vec4(0.0);",
    "  s += texture2D(tDiffuse, vUv - uDir*3.0) * 0.05;",
    "  s += texture2D(tDiffuse, vUv - uDir*2.0) * 0.09;",
    "  s += texture2D(tDiffuse, vUv - uDir) * 0.12;",
    "  s += texture2D(tDiffuse, vUv) * 0.16;",
    "  s += texture2D(tDiffuse, vUv + uDir) * 0.12;",
    "  s += texture2D(tDiffuse, vUv + uDir*2.0) * 0.09;",
    "  s += texture2D(tDiffuse, vUv + uDir*3.0) * 0.05;",
    "  gl_FragColor = s * 1.35;",
    "}"
  ].join("\n");

  var EXTRACT_FRAG = [
    "precision highp float;",
    "varying vec2 vUv;",
    "uniform sampler2D tDiffuse;",
    "uniform float uThresh;",
    "void main(){",
    "  vec4 c = texture2D(tDiffuse, vUv);",
    "  float l = dot(c.rgb, vec3(0.333));",
    "  float m = smoothstep(uThresh, uThresh + 0.25, l);",
    "  gl_FragColor = vec4(vec3(l * m), 1.0);",
    "}"
  ].join("\n");

  var COMP_FRAG = [
    "precision highp float;",
    "varying vec2 vUv;",
    "uniform sampler2D tDiffuse;",
    "uniform sampler2D tBloom;",
    "uniform float uTime;",
    "uniform float uGrain;",
    "uniform float uCA;",
    "uniform float uGlitch;",
    "uniform float uShake;",
    "float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }",
    "void main(){",
    "  vec2 uv = vUv;",
    "  if(uGlitch > 0.01){",
    "    float g = step(0.92, hash(vec2(floor(uv.y*48.0), floor(uTime*18.0))));",
    "    uv.x += (hash(vec2(uTime, uv.y)) - 0.5) * 0.03 * uGlitch * g;",
    "  }",
    "  float ca = uCA * (0.0018 + uShake * 0.004);",
    "  float r = texture2D(tDiffuse, uv + vec2(ca, 0.0)).r;",
    "  float g = texture2D(tDiffuse, uv).g;",
    "  float b = texture2D(tDiffuse, uv - vec2(ca, 0.0)).b;",
    "  float luma = (r + g + b) / 3.0;",
    "  float bloom = texture2D(tBloom, uv).r;",
    "  luma += bloom * 0.65;",
    "  float scan = 0.88 + 0.12 * sin(uv.y * 980.0 + uTime * 8.0);",
    "  luma *= scan;",
    "  float vig = smoothstep(0.95, 0.35, length(uv - 0.5));",
    "  luma *= vig;",
    "  float grain = (hash(uv * vec2(1920.0, 1080.0) + uTime * 12.0) - 0.5) * uGrain;",
    "  luma += grain;",
    "  luma = clamp(luma, 0.0, 1.0);",
    "  gl_FragColor = vec4(vec3(luma), 1.0);",
    "}"
  ].join("\n");

  function PostFX(renderer, scene, camera, quality) {
    this.renderer = renderer;
    this.scene = scene;
    this.camera = camera;
    this.quality = quality || "high";
    this.enabled = quality !== "low";
    this.glitch = 0;
    this.time = 0;
    this.ok = false;
    this._quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this._quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.MeshBasicMaterial({ color: 0 }));
    this._quadScene = new THREE.Scene();
    this._quadScene.add(this._quad);

    if (!this.enabled) return;

    try {
      var w = renderer.domElement.width || 2;
      var h = renderer.domElement.height || 2;
      var opt = { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, format: THREE.RGBAFormat };
      this.rtScene = new THREE.WebGLRenderTarget(w, h, opt);
      this.rtBright = new THREE.WebGLRenderTarget(w / 2, h / 2, opt);
      this.rtBlurA = new THREE.WebGLRenderTarget(w / 2, h / 2, opt);
      this.rtBlurB = new THREE.WebGLRenderTarget(w / 2, h / 2, opt);

      this.matExtract = new THREE.ShaderMaterial({
        uniforms: { tDiffuse: { value: null }, uThresh: { value: 0.62 } },
        vertexShader: QUAD_VERT,
        fragmentShader: EXTRACT_FRAG,
        depthTest: false,
        depthWrite: false
      });
      this.matBlur = new THREE.ShaderMaterial({
        uniforms: { tDiffuse: { value: null }, uDir: { value: new THREE.Vector2(0.002, 0) } },
        vertexShader: QUAD_VERT,
        fragmentShader: BLUR_FRAG,
        depthTest: false,
        depthWrite: false
      });
      this.matComp = new THREE.ShaderMaterial({
        uniforms: {
          tDiffuse: { value: null },
          tBloom: { value: null },
          uTime: { value: 0 },
          uGrain: { value: 0.06 },
          uCA: { value: 1 },
          uGlitch: { value: 0 },
          uShake: { value: 0 }
        },
        vertexShader: QUAD_VERT,
        fragmentShader: COMP_FRAG,
        depthTest: false,
        depthWrite: false
      });
      this.ok = true;
    } catch (e) {
      this.ok = false;
      this.enabled = false;
    }
  }

  PostFX.prototype.setSize = function (w, h) {
    if (!this.ok) return;
    this.rtScene.setSize(w, h);
    this.rtBright.setSize(w / 2, h / 2);
    this.rtBlurA.setSize(w / 2, h / 2);
    this.rtBlurB.setSize(w / 2, h / 2);
    this.matBlur.uniforms.uDir.value.set(1 / (w / 2), 0);
  };

  PostFX.prototype.addGlitch = function (amt) {
    this.glitch = Math.min(1.5, this.glitch + amt);
  };

  PostFX.prototype.render = function (dt, shake, feel) {
    this.time += dt || 0.016;
    this.glitch = Math.max(0, this.glitch - (dt || 0.016) * 1.8);
    feel = feel || {};

    if (!this.ok || !this.enabled) {
      this.renderer.setRenderTarget(null);
      this.renderer.render(this.scene, this.camera);
      return;
    }

    this.renderer.setRenderTarget(this.rtScene);
    this.renderer.render(this.scene, this.camera);

    this._quad.material = this.matExtract;
    this.matExtract.uniforms.tDiffuse.value = this.rtScene.texture;
    this.renderer.setRenderTarget(this.rtBright);
    this.renderer.render(this._quadScene, this._quadCam);

    this._quad.material = this.matBlur;
    this.matBlur.uniforms.tDiffuse.value = this.rtBright.texture;
    this.matBlur.uniforms.uDir.value.set(0.0035, 0);
    this.renderer.setRenderTarget(this.rtBlurA);
    this.renderer.render(this._quadScene, this._quadCam);

    this.matBlur.uniforms.tDiffuse.value = this.rtBlurA.texture;
    this.matBlur.uniforms.uDir.value.set(0, 0.0035);
    this.renderer.setRenderTarget(this.rtBlurB);
    this.renderer.render(this._quadScene, this._quadCam);

    this._quad.material = this.matComp;
    this.matComp.uniforms.tDiffuse.value = this.rtScene.texture;
    this.matComp.uniforms.tBloom.value = this.rtBlurB.texture;
    this.matComp.uniforms.uTime.value = this.time;
    this.matComp.uniforms.uGlitch.value = this.glitch;
    this.matComp.uniforms.uShake.value = shake || 0;
    this.matComp.uniforms.uGrain.value = 0.055 + (feel.speedN || 0) * 0.028 + (feel.dust || 0) * 0.04;
    this.matComp.uniforms.uCA.value = 1 + (feel.boost || 0) * 0.85 + (feel.hurt || 0) * 0.35;
    this.renderer.setRenderTarget(null);
    this.renderer.render(this._quadScene, this._quadCam);
  };

  VR.PostFX = PostFX;
})(typeof window !== "undefined" ? window : globalThis);

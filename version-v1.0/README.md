# VOID RUNNER

**v1.0.0 — Initial Public Release**

A self-contained 3D monochrome cyberpunk survival driver.

You pilot the **VOID HAULER** — a heavy six-wheel lunar truck — across a generated mare while **Void Stalkers** hunt in packs. Black void sky. Survive.

Strict aesthetic: pure black, pure white, controlled gray. No color. No real-world brands. No external image or audio assets.

## Originality

This project is original work, intended for public release (GitHub, itch.io, and similar).

- All 3D geometry is built from Three.js primitives in code (boxes, cylinders, icosahedra). No imported meshes.
- All audio is synthesized on the Web Audio API. No samples or sound files.
- HUD type uses the host OS monospace stack. No bundled fonts.
- No image, texture, or model files ship with the game.
- Vehicle, hostile, location, and UI names are original (VOID RUNNER, VOID HAULER, Void Stalkers).
- No real-world company, agency, or vehicle product names are used as identities.
- The only third-party code is [Three.js](https://threejs.org/) r160.1 (MIT), vendored at `vendor/three.min.js`. See `vendor/NOTICE.txt`. An optional jsDelivr fallback loads only if that file is missing.

## How to run

Serve the folder over HTTP (browsers can block WebGL / audio from `file://`):

```bash
# Python
python -m http.server 8080

# Node
npx --yes serve -l 8080
```

Then open `http://localhost:8080`.

Opening `index.html` directly works in many desktop browsers if the vendored Three.js loads, but a local server is the supported path.

Requires a current browser with WebGL and the Web Audio API.

## Controls

| Action | Keyboard | Gamepad | Touch |
| --- | --- | --- | --- |
| Drive | WASD / Arrows | Left stick | Left half of screen |
| Look | Mouse (click canvas to lock) | Right stick | Right half of screen |
| Fire | Space / F / click (hold) | A / face button | Two-finger tap |
| Handbrake / drift | C / Ctrl | LB / RB | — |
| Overdrive | Shift (after a boost orb) | B / face | — |
| Pause | Esc / P | Start | — |
| Mute | M | — | — |
| Start / retry | Enter | — | Initiate Run |

## Scoring

`distance × 2.2 + time × 9 + kills + orbs`, all multiplied by the active score multiplier.

High score is stored in `localStorage` under `voidrunner.hiscore`.

## Layout

```
index.html          entry
css/style.css       holographic HUD + CRT overlays
js/                 game systems (see below)
vendor/three.min.js Three.js r160.1 (MIT)
vendor/NOTICE.txt   Three.js attribution
LICENSE             MIT
```

## Systems

| Module | Role |
| --- | --- |
| `js/vehicle.js` | VOID HAULER physics, drums, headlights, damage states |
| `js/terrain.js` | Ridged mare, layered craters, streamed base structures |
| `js/aliens.js` | Robotic scout / brute / hunter pack AI |
| `js/combat.js` | Hold-fire energy bolts |
| `js/orbs.js` | Boost, shield, rapid pickups |
| `js/hazards.js` | Debris + energy storms (later waves) |
| `js/sky.js` | Starfield + monochrome nebula, lighting |
| `js/audio.js` | Entirely synthesized Web Audio (no samples) |
| `js/postfx.js` | Bloom, grain, CA, scanlines, glitch |
| `js/ui.js` | Title / HUD / game over + minimap |
| `js/config.js` | Version (`1.0.0`) and designer tunables |

Geometry, lighting, particles, sky, and audio are generated in code.

## Performance

Target: 60 fps on mid-range desktop.

Quality is auto-selected (`high` / `med` / `low`) from core count, device memory, and mobile UA:

- Instanced rocks, pooled hostiles / orbs / pulses / particles
- Sliding height mesh (no stored heightmap)
- Structure streaming on a hashed grid
- Low tier disables bloom and soft shadows

Known limitations:

- Terrain rebuilds as a single sliding patch; very high speeds can show a one-frame pop when the mesh recenters.
- Hostile bodies are rebuilt from primitives on spawn (fine at the live cap).
- Sky is stars + a faint procedural nebula only.
- Three.js is vendored; the optional CDN fallback is the only network dependency.

## License

MIT — see `LICENSE`. Every first-party source file carries `SPDX-License-Identifier: MIT`.

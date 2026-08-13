# Eaglercraft 1.12 Low-Lag FPS Edition

## What this version genuinely changes

This direct-open client retains the original compiled game payload and native image quality. It changes only the exposed `eaglercraftXOpts` launch block, with **no overlay, observers, menu code, browser FPS loop, resize listener, polling timer, renderer hack, or resolution scaling**.

The key correction is frame pacing: this is a **WASM-GC** client, so the edition enables `enforceVSync: true`. The EaglercraftX WASM documentation says that leaving V-Sync disabled can let the game choke the browser event loop and cause input lag; its documented `enforceVSync` option is WASM-only and re-enables V-Sync at launch. [1]

| Native option | Value | Purpose |
|---|---:|---|
| `enforceVSync` | `true` | Uses the client’s documented WASM frame-pacing safeguard to reduce browser event-loop/input lag. |
| `checkGLErrors`, `checkShaderGLErrors` | `false` | Keeps verbose GL error-checking disabled. |
| `deobfStackTraces` | `false` | Avoids stack-trace deobfuscation work during errors, which the documentation notes can reduce micro-stutters. [1] |
| `allowVoiceClient`, `allowFNAWSkins` | `false` | Disables optional voice support and high-poly FNAW skins. |
| Update checks, signature badge, title extra | `false` | Removes nonessential ancillary startup work; these are not gameplay-renderer optimizers. |

> The client successfully completed its direct-open countdown and reached the standard native runtime sound-enable screen during validation.

## Use this in-game profile

These settings are the real controls for FPS. Start here rather than lowering browser resolution.

| Game setting | Use this value |
|---|---:|
| Render distance | 4 chunks first; try 6 only if stable |
| Graphics | Fast |
| Smooth lighting | Off |
| Clouds | Off |
| Particles | Minimal |
| Entity distance | 50% |
| Mipmap levels | 0 |
| Shaders | Off |
| V-Sync | On; this edition also enforces it at launch |
| Fullscreen | On |

## Identify the kind of lag

| What happens | Most likely cause | What helps |
|---|---|---|
| The picture stutters, controls feel delayed, or FPS drops in busy areas | Client / Chromebook performance | Use the profile above, close other tabs/apps, disconnect extra displays, and let the Chromebook cool down. |
| Players teleport, blocks break late, or chat arrives late while FPS feels smooth | Network / server lag | Use a nearer server region, a stable 5 GHz Wi-Fi connection, and stop downloads/streams; a client file cannot eliminate server tick delay or ping. |
| FPS drops only in one world or near farms | World complexity | Lower render distance to 4, reduce particles, move away from dense mobs/redstone, and avoid heavy shader/resource packs. |

Do not use forced low-resolution scaling: it makes the image pixelated and is not a dependable cure for frame-time spikes. This file provides the strongest safe page-level and documented launch-option changes available for this compiled client; it cannot guarantee a fixed FPS number on every Chromebook.

## Reference

[1]: https://github.com/Eaglercraft-Archive/Eaglercraftx-1.8.8-src/blob/main/README.md "EaglercraftX README: WASM-GC performance and launch options"

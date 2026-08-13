# Lean Native FPS Client

## What changed

This edition is built from the supplied direct-open client with **all previously injected browser code removed**. It has no custom menu, Right Shift listener, injected stylesheet, `MutationObserver`, resize observer, browser FPS widget, `requestAnimationFrame` FPS loop, local-storage preferences, or auxiliary DOM controls.

The compiled game payload is unchanged. That means it keeps the same native visual resolution and does not pretend to modify the game renderer.

## Real normal-quality FPS profile

The game’s own video settings do the meaningful work. Use the following as the first low-lag profile, then raise render distance only if FPS remains stable.

| Setting | Recommended value | Why |
|---|---:|---|
| Render distance | 4–6 chunks | Reduces chunk geometry and CPU/GPU work most directly. |
| Graphics | Fast | Reduces visual detail with far less impact than resolution scaling. |
| Smooth lighting | Off | Removes a costly lighting pass. |
| Clouds | Off | Avoids extra world rendering. |
| Particles | Minimal | Reduces particle draw work while keeping important effects. |
| Entity distance | 50% | Reduces distant entity rendering. |
| Mipmap levels | 0 | Avoids extra texture-memory and filtering work on low-end hardware. |
| V-Sync | Off | Lets the client render freely; use a 60 FPS cap if frame pacing is unstable. |
| Full screen | On | Gives the browser the clearest rendering path and removes UI distractions. |

> Avoid forcing a reduced browser render scale. It makes the image pixelated and does not reliably improve every Chromebook.

## ChromeOS checklist

Close other browser tabs and Android/Linux apps before playing. Use Chrome’s full-screen mode and keep the Chromebook connected to power when possible. If the device is warm, let it cool between long sessions; thermal throttling can sharply lower FPS regardless of client configuration.

## Limits

A page-level HTML wrapper cannot implement real crystal, shield, ping, FOV, particle, rain, or renderer optimizers inside this compiled Eaglercraft client. Those need a supported mod API or the editable source/build project. This lean file removes avoidable page-side overhead but cannot guarantee a fixed FPS target because the Chromebook’s hardware, world/server load, and in-game video settings determine the result.

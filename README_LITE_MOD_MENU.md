# Eagler Lite Mod Menu

## Direct-open client

`Eaglercraft_1.12_LiteModMenu_RightShift.html` is the low-lag direct-open Eagler client with a **Right Shift** browser mod menu. The menu is built only the first time it is opened. It contains no polling timer, animation frame loop, mutation observer, resize observer, game-memory hook, packet manipulation, or network feature.

## Working modules

| Module | Behavior | Performance model |
|---|---|---|
| Custom Crosshair | Displays a compact browser crosshair at the center of the screen | Static DOM element; no loop |
| Keystrokes | Shows W, A, S, D, and Space state | Changes only on keyboard down/up events |
| Fullscreen | Requests normal browser fullscreen | Runs only when clicked |
| Accent / scale / placement | Lets the user set the accent color, menu scale, position, and native resize corner | Updates only on direct user input |
| Copy Settings | Copies the menu configuration for backup or sharing | Runs only when clicked |

The menu remembers its own cosmetic settings locally. Press **Right Shift** again or the close button to hide it.

## Game-data boundary

The menu deliberately does **not** claim to add a working armor durability HUD or total XP amount. The supplied compiled WASM-GC client exposes no supported browser-level player, inventory, armor, durability, or experience API. An outer-page overlay could only show invented values, so no fake armor or XP display is included.

The game’s normal experience bar and level number remain rendered by the native runtime. A real armor/XP HUD would require a moddable client build that exposes live game data.

## Low-lag defaults

The client retains static native boot settings that reduce ancillary runtime work: V-Sync frame pacing is enforced and unused update, skin, voice, signature, and minceraft services are disabled. It does not force low resolution or pixel scaling.

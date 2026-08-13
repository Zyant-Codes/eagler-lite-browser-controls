# Eagler Lite Mod Menu

## Direct-open client

`Eaglercraft_1.12_LiteModMenu_RightShift.html` is the low-lag direct-open Eagler client with a **Right Shift** browser mod menu. The menu is built only the first time it is opened. It contains no polling timer, animation frame loop, mutation observer, resize observer, game-memory hook, packet manipulation, or network feature.

## Working modules

| Module | Behavior | Performance model |
|---|---|---|
| Custom Crosshair | Displays a compact browser crosshair at the center of the screen | Static DOM element; no loop |
| Keystrokes | Shows W, A, S, D, and Space state | Changes only on keyboard down/up events |
| Armor HUD tracker | Shows four compact armor slots on the chosen left or right side, using values entered in the menu | Static DOM element; changes only on direct manual input |
| Fullscreen | Requests normal browser fullscreen | Runs only when clicked |
| Accent / scale / placement | Lets the user set the accent color, menu scale, position, and native resize corner | Updates only on direct user input |
| Copy Settings | Copies the menu configuration for backup or sharing | Runs only when clicked |

The menu remembers its own cosmetic settings locally. Press **Right Shift** again or the close button to hide it.

## Game-data boundary

The menu now includes a configurable **manual armor tracker**. Enable it in the Right Shift menu, choose the left or right side and scale, then enter the values you want it to display for helmet, chestplate, leggings, and boots. It keeps its layout and entries locally.

> The tracker does **not** read equipped gear, armor durability, or total XP automatically. The supplied compiled WASM-GC client exposes no supported browser-level player, inventory, armor, durability, or experience API. The values are manual and clearly labeled as such; no live data is fabricated.

The game’s normal experience bar and level number remain rendered by the native runtime. A real automatic armor/XP HUD would require a moddable client build that exposes live game data.

## Low-lag defaults

The client retains static native boot settings that reduce ancillary runtime work: V-Sync frame pacing is enforced and unused update, skin, voice, signature, and minceraft services are disabled. It does not force low resolution or pixel scaling.

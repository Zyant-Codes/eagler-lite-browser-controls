# Eagler Lite Browser Controls Injection

## What is included

| File | Use |
|---|---|
| `Eaglercraft_1.12_BrowserControls_Injected.html` | A direct-open copy of the supplied client with the injection already embedded. |
| `eagler_lite_browser_injection.js` | The same standalone browser-level injection source. |

Open the patched HTML file directly in ChromeOS. Once the game starts, press **Right Shift** to open **Eagler Lite Controls**.

## Working controls

The injection is deliberately small. It provides a resizable card-style menu, full-screen control, a copy button for normal-quality FPS settings, a compact-menu switch, and an optional browser-frame FPS estimate. The browser FPS sampler is disabled by default; it runs only while its widget is enabled.

The injection stores its own menu preferences in browser local storage. It has no network requests, packet access, game-state reader, click automation, movement automation, or access to the compiled game’s input handling.

## Limits

This is a JavaScript injection into the **outer browser page**, not a ModAPI module inside the compiled Eaglercraft runtime. It cannot truthfully toggle in-game particles, rain, glint, FOV, fullbright, hurt camera, crystal/shield behavior, entity rendering, scoreboard/chat rendering, server ping, or HUD data. Those require a supported client mod API or the matching editable source project.

> The menu is designed to stay low-overhead: one Right Shift listener, a five-second startup reattachment observer, and no persistent animation loop unless the optional FPS widget is turned on.

## If you need real in-game modules

Provide a compatible unminified, unobfuscated, unsigned JavaScript EaglercraftX offline client that supports EaglerForge ModAPI, or provide the editable source/build project for this exact client. Only then can browser/client modules obtain genuine access to in-game systems.

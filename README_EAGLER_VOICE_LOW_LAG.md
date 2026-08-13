# Eagler Voice + Low-Lag Edition

## What is included

This direct-open HTML client enables the client’s built-in **Eaglercraft WebRTC voice** feature using `allowVoiceClient: true`, while retaining the low-lag frame-pacing configuration. It does **not** claim to include the Java **Simple Voice Chat** mod.

## Why Simple Voice Chat cannot be added to this HTML client

Simple Voice Chat requires its Java mod on the player’s client and server. Even when the server runs the Bukkit/Spigot/Paper plugin, the official installation guide still requires each player to run the Fabric, NeoForge, Forge, or Quilt client mod. A compiled browser WASM-GC client cannot load a Forge/Fabric/Quilt JAR or speak the Simple Voice Chat client protocol through an HTML setting. [1]

| Requested feature | Direct-open HTML client status | Requirement |
|---|---|---|
| Simple Voice Chat mod | **Not compatible** | Use a normal Java client with the matching Fabric/Forge/NeoForge/Quilt mod, plus a server with Simple Voice Chat configured. |
| Eaglercraft built-in voice | **Enabled in this file** | Join an Eaglercraft-compatible server whose owner has enabled its matching WebRTC voice service. |
| Voice on a server without any voice service | **Not possible from the client alone** | The server owner must install/configure supported server-side voice functionality. |

> Eaglercraft’s built-in voice service uses WebRTC. The official Eaglercraft documentation warns that WebRTC may expose your IP address when used on a public server. Use voice only on servers you trust. [2]

## What to do next

Open this file directly, allow microphone permission only when the game asks, and join a server that explicitly supports Eaglercraft voice. If the server reports that voice is disabled, that is a server setting: no client-side plugin or menu can turn it on.

Keep the performance profile from the low-lag edition: fullscreen, 4–6 render distance, Fast graphics, smooth lighting off, clouds off, minimal particles, and V-Sync on. Voice activity itself can add some CPU/network load on a low-end Chromebook, so disable voice when you do not need it.

## References

[1]: https://modrepo.de/minecraft/voicechat/wiki/installation "Simple Voice Chat — Installation"
[2]: https://github.com/Eaglercraft-Archive/Eaglercraftx-1.8.8-src/blob/main/README.md "EaglercraftX README — built-in WebRTC voice chat"

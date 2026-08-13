# Eagler Simple VC — Standalone Prototype

## Purpose

**Eagler Simple VC** is a standalone browser/WebRTC voice prototype for the direct-open Eagler client. It is deliberately separate from the Java **Simple Voice Chat** mod. It does not use that mod’s UDP protocol, does not join existing Simple Voice Chat channels, and does not claim interoperability with servers that have only the Java plugin installed.

The system contains two matched parts. The patched Eagler HTML provides an on-demand browser connector, and the Node signaling service creates authenticated named rooms and forwards only WebRTC signaling messages. After signaling, audio is meant to travel peer-to-peer through WebRTC; the signaling service does not receive microphone audio.

| Component | Included behavior | Does not do |
|---|---|---|
| Direct-open Eagler client | Right Shift opens the voice panel; microphone permission is requested only after **Connect & Enable Mic** is clicked | Does not auto-capture audio, identify the in-game player, or alter game networking |
| Signaling service | Authenticates token-bearing WSS sessions, limits room size, isolates rooms, relays SDP/ICE signaling, and passes authenticated ICE configuration | Does not use Simple Voice Chat UDP, persist audio, or provide a public anonymous room service |
| WebRTC media path | Can use configured STUN/TURN services for browser connectivity | Is not guaranteed to establish without a production TURN service in restrictive networks |

## Client use

Open `Eaglercraft_1.12_EaglerSimpleVC_Prototype.html`, then press **Right Shift**. Enter three values supplied by the voice-service operator: the `wss://` server address, a server-issued session token, and the room name. The token is held only in memory and is not written to the browser’s local storage. Clicking **Connect & Enable Mic** is the only code path that calls `getUserMedia()`.

> Browser microphone access requires a secure context and explicit user permission. The client therefore refuses non-`wss://` voice server addresses. [1]

The current room model is manual. People who enter the same room can signal WebRTC audio sessions to one another. It is not proximity voice and is not automatically bound to a Minecraft server, party, or Simple Voice Chat group.

## Server setup

Install dependencies and run the test suite:

```bash
cd eagler-simple-vc-server
pnpm install
pnpm test
```

For production, run the Node service behind an HTTPS reverse proxy that exposes **WSS**. Copy `.env.example`, configure exact allowed origins, issue high-entropy short-lived tokens, and provide STUN/TURN configuration through `EAGLER_SVC_ICE_SERVERS_JSON`. The process should bind to localhost behind the reverse proxy rather than being exposed as an unauthenticated raw HTTP service.

```bash
EAGLER_SVC_TOKENS='issue-per-user-session-token' \
EAGLER_SVC_ALLOWED_ORIGINS='https://play.example.com' \
EAGLER_SVC_ICE_SERVERS_JSON='[{"urls":"stun:stun.example.com:3478"}]' \
HOST=127.0.0.1 PORT=8787 pnpm start
```

A direct `file:///` client has browser Origin `null`. Do not broadly allow `null` on an internet-facing service. If direct-file use is required, protect it with short-lived one-time tokens and a private deployment; a hosted HTTPS client origin is safer.

## Signaling protocol

After opening an authorized socket at `wss://host/?token=TOKEN`, the client sends:

```json
{"type":"join","protocol":"eagler-simple-vc/1","room":"lobby","name":"EaglerPlayer"}
```

The service sends a `welcome` message containing the ephemeral client ID, existing room peers, and any configured ICE servers. It then forwards only `signal` messages between peers in the same room. The supported protocol is intentionally small, bounded to 32 KiB messages, and disallows binary payloads at the signaling layer.

## Security boundaries

A production voice deployment needs a real authentication source tied to your game/server account system, server-issued expiring tokens, WSS/TLS, origin validation, rate limits, moderation policy, and TURN credentials. This prototype demonstrates fixed-token authentication and room isolation only. It is not ready to host public voice rooms without those operational protections.

WebRTC signaling is application-defined: the signaling server relays session descriptions and ICE candidates, while the browser peers establish the media connection. [2]

## References

[1]: https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia "MDN — MediaDevices.getUserMedia()"
[2]: https://developer.mozilla.org/en-US/docs/Web/API/WebRTC_API/Signaling_and_video_calling "MDN — WebRTC signaling"

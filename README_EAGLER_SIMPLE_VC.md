# Eagler Simple VC — WSS Relay Prototype

## Purpose

**Eagler Simple VC** is a standalone browser voice prototype for the direct-open Eagler client. This revision uses a **central WSS audio relay**. It contains no WebRTC, no ICE exchange, no direct browser-to-browser connection, and no Java Simple Voice Chat compatibility layer.

Each player connects only to the configured relay service. The relay forwards bounded PCM audio frames to other authenticated members of the same named room. This avoids exposing direct peer connection information to other players. However, the relay service itself necessarily receives each player’s network connection and handles relayed audio; choose a server operator you trust.

| Component | Included behavior | Deliberately excluded |
|---|---|---|
| Direct-open Eagler client | Right Shift opens a lazy voice panel; microphone permission is requested only after **Connect & Enable Mic** | WebRTC, peer discovery, ICE candidates, direct peer media, automatic microphone capture |
| WSS relay service | Token and Origin checks, manual room isolation, 16-member room ceiling, bounded PCM frames, rate limit, central forwarding | Simple Voice Chat UDP protocol, peer IP exchange, automatic Minecraft account binding, audio storage |
| Browser audio path | Web Audio captures permitted microphone samples and plays relayed samples | End-to-end encryption from the relay operator, proximity routing, Java client-mod interop |

## Privacy boundary

> Players do **not** open direct voice connections to one another in this build. They connect only to the WSS relay server.

This prevents one room member from receiving another member’s direct peer connection information through the client. It does **not** hide a user’s connection from the voice-service operator: just like any game server, the relay server receives the client’s network request and could observe or log connection metadata. Because it relays PCM audio, the operator must also be trusted not to inspect or record relayed content.

## Client use

Open `Eaglercraft_1.12_EaglerSimpleVC_Prototype.html` and press **Right Shift**. Enter the private `wss://` relay address, a server-issued token, a room name, and an optional display name. The token stays in memory only and is not written to local storage. Then click **Connect & Enable Mic**.

The client refuses non-`wss://` relay addresses. It does not construct its panel, request microphone permission, or open a relay connection at page load.

> Browser microphone access requires a secure context and explicit user permission. [1]

## Relay setup

The `eagler-simple-vc-server` directory holds the matching Node service. Install its dependency and run its test suite:

```bash
cd eagler-simple-vc-server
pnpm install
pnpm test
```

Run it behind a reverse proxy that supplies HTTPS/WSS. Bind the Node process to localhost, configure exact Origins, and issue high-entropy short-lived tokens. The relay accepts control messages only after the WSS connection has passed the configured token and Origin checks.

```bash
EAGLER_SVC_TOKENS='issue-per-user-session-token' \
EAGLER_SVC_ALLOWED_ORIGINS='https://play.example.com' \
HOST=127.0.0.1 PORT=8787 pnpm start
```

A direct `file:///` client has Origin `null`. Do not broadly allow `null` on an internet-facing relay. For a public service, serve the client from your own HTTPS domain and list that exact origin. A temporary local-file test needs a private environment and a short-lived token.

## Relay wire behavior

After a successful WSS upgrade, the client sends a JSON join control message:

```json
{"type":"join","protocol":"eagler-simple-vc-wss-relay/1","room":"lobby","name":"EaglerPlayer","sampleRate":48000}
```

The server assigns an opaque numeric relay identifier and accepts bounded binary PCM16 audio frames from that authenticated client. It prefixes each forwarded frame with the sender’s opaque relay ID and sample rate, then sends it only to other members of the same room. It does not forward player IP addresses, SDP offers, ICE candidates, or any peer-connection metadata because none exist in this protocol.

Browser WebSockets can send typed-array binary payloads; the client limits socket backlog to avoid endless buffering. [2] The browser converts the explicitly authorized microphone stream into a Web Audio input node before creating relay frames. [3]

## Limitations

This is a prototype, not a public hosted voice service. It uses manual rooms, does not know Minecraft player positions, and does not connect to Java Simple Voice Chat servers. It also sends uncompressed PCM relay frames, which consume more relay bandwidth than a production Opus pipeline; room size is deliberately capped. The relay needs real authentication, expiry, moderation, abuse monitoring, TLS, operational rate limits, and capacity planning before public deployment.

## References

[1]: https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia "MDN — MediaDevices.getUserMedia()"
[2]: https://developer.mozilla.org/en-US/docs/Web/API/WebSocket/send "MDN — WebSocket.send()"
[3]: https://developer.mozilla.org/en-US/docs/Web/API/AudioContext/createMediaStreamSource "MDN — AudioContext.createMediaStreamSource()"

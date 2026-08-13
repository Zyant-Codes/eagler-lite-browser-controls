# Eagler Simple VC Prototype — Validation Record

## Completed checks

| Check | Result |
|---|---|
| Direct-open HTML client builds from the supplied client payload | Pass |
| Connector script passes JavaScript syntax validation | Pass |
| Client payload validator confirms only title, native options, and explicit connector differ from source | Pass |
| Connector uses no `setInterval`, mutation observer, or resize observer | Pass |
| Microphone capture is only reachable from the explicit Connect button handler | Pass |
| Client requires a `wss://` endpoint and non-empty session token before microphone capture | Pass |
| Session token is not persisted to local storage | Pass |
| Right Shift panel is lazy-created and opens successfully in a browser runtime test | Pass |
| Client launch reaches native Eaglercraft runtime without a microphone request | Pass |
| Signaling server parses successfully | Pass |
| Authenticated join, peer signaling, invalid-token rejection, and invalid-origin rejection tests | 3/3 pass |

## Prototype limitations

The signaling service forwards WebRTC signaling only. It does not receive audio and it does not provide a public production deployment, a TURN service, Minecraft account binding, moderation features, proximity routing, or integration with the Java Simple Voice Chat protocol. The current client uses manual named rooms.

A production deployment must use WSS/TLS, exact allowed origins, short-lived server-issued tokens, and TURN configuration. It should not expose development mode or allow the direct-file `null` origin broadly on the public internet.

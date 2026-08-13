# Eagler Simple VC WSS Relay — Validation Record

## Completed checks

| Check | Result |
|---|---|
| Direct-open HTML client builds from the supplied client payload | Pass |
| WSS relay connector passes JavaScript syntax validation | Pass |
| Client payload validator confirms only title, native options, and explicit connector differ from source | Pass |
| Connector has no `RTCPeerConnection`, ICE, offers, answers, or peer signaling code | Pass |
| Connector has no polling loop, mutation observer, or resize observer | Pass |
| Client requires a `wss://` endpoint and non-empty token before microphone capture | Pass |
| Microphone capture is reachable only from the explicit Connect button handler | Pass |
| Session token is not persisted to local storage | Pass |
| Right Shift panel is lazy-created and opens in a native runtime test | Pass |
| Client launch reaches the native Eaglercraft runtime without microphone access | Pass |
| WSS relay source parses successfully | Pass |
| Authenticated relay, invalid-token rejection, invalid-origin rejection, and pre-join audio rejection tests | 4/4 pass |

## Confirmed privacy behavior

The injected client opens no direct browser-to-browser voice session. Its audio path is browser-to-WSS-relay and relay-to-browser only. It transmits no SDP offer, ICE candidate, or peer address through the Eagler Simple VC protocol.

The central relay still receives the normal network connection from every participant and has access to the audio it relays. It must be operated as a trusted service and protected using WSS/TLS, exact allowed origins, short-lived tokens, and production rate limiting.

## Prototype limitations

The service is not publicly hosted. It uses manual named rooms, uncompressed PCM frames, no in-game player binding, no proximity routing, no moderation controls, no end-to-end encryption from the relay operator, and no Java Simple Voice Chat compatibility.

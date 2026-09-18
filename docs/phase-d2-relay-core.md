# Phase D2 Relay-Core Slice

_Development status on 18 September 2026: the minimal Phase D2 technical gate is locally complete and committed at `91b156a` in game 1.10.12, build `2026-09-18-phase-d2-lockstep-proof`. This is not a release or a production multiplayer service._

## Scope

- Normal `createEngine()` and normal replay loading reject multiple human seats. Only the unwired relay client and official multiplayer replay checker use the private proof factory/capability. The production bundle contract rejects a reachable WebSocket client/relay graph.
- The completed-match proof is intentionally exactly two humans in seats 0 and 1 with no bots. General 2-4-human/bot outcome policy is not implied.
- Risky mode remains unchanged for zero/one explicit human seat. `humanSeats > 1 && risky` is rejected centrally because the multi-seat draft protocol is deferred beyond this slice.
- `game/src/multiplayer/relay/room.mjs` is an in-memory, browser-free, transport-agnostic room. It never runs the engine.
- `statefall-relay/v1` binds one schema-validated canonical room configuration containing protocol, dimensions, bot count, tick duration, difficulty, normalized settings, and seats. Both relay and browser derive the property-order-independent stable SHA-256 fingerprint; no caller digest configures the room.
- A command is accepted only from its connected assigned seat at the current generation and for exactly the delayed target turn. IDs are unique room-wide. Rejected malformed, unauthorized, stale, duplicate/conflicting, late, too-early, out-of-window, cyclic, deep, oversized, and flood inputs do not mutate accepted state.
- Commands are deep-owned on acceptance. At turn sealing they are sorted by seat ID and command ID, assigned a contiguous monotonic server sequence, appended as `sealed` records, and returned in deeply frozen batches. Clients do not apply commands optimistically.

## Outcomes And Lifecycle

- Each client applies every sealed command independently through public `engine.issue()`. Application returns `{advancedTicks,outcomes,status}` and stops safely on deterministic `over` or `paused`. A state-invalid or post-stop command produces only `{seq,id,status:'rejected',code:'STATE_INVALID'}`; no engine exception message or stack crosses the relay boundary.
- Every required seat reports the complete normalized outcome array and its SHA-256 for every batch. The relay compares explicit normalized fields and records consensus without trusting one client. Any mismatch is a terminal `relay.desync`.
- The room will not advance while a required seat is missing/disconnected, while outcome/checkpoint/final evidence is pending, while deterministically paused, or after terminal state. Disconnect does not remove requirements or manufacture consensus. Recovery explicitly states the unresolved outcome/checkpoint/ack work for that seat.
- Capability-gated `surrender` carries the acting seat in the deterministic command log. In the two-seat proof it marks the actor not alive and ends the match; ownership and tile counts remain unchanged and invariant-valid. Standings are derived from canonical player alive/tile state, so either seat can lose.
- Every seat reports exact final tick, canonical digest, legacy hash, RNG draws, applied command count/cursor, normalized standings/winners, and terminal outcome digest. Mismatch is terminal desync. Agreement makes the room immutable and emits `relay.match-completed`.

## Checkpoints And Recovery

- At each 100-tick point, required seat IDs, base sequence, and base batch count are frozen. Reports contain canonical and legacy hashes, RNG draw count, applied engine command count, replay cursor, and SHA-256 of the exact JSON `statefall-engine-checkpoint/v2` bytes.
- Retention accepts only the exact agreed checkpoint byte string. It enforces the retained-byte bound, recomputes SHA-256, safely decodes bounded checkpoint metadata, and verifies tick, RNG draws, and applied command count before atomically replacing the retained recovery point. Wrong-tick, unrelated, malformed, or oversized data cannot replace a valid retained point.
- Recovery carries exact checkpoint bytes and agreed report plus sealed batch suffixes with consensus lifecycle status and actual advanced ticks. It also identifies unresolved evidence. A replacement regenerates checkpoint-v2 bytes/report from its recovered engine before ready/ack when required.
- After restore, catch-up re-verifies exact checkpoint SHA-256 and canonical/RNG/command metadata, applies each batch, and compares reproduced outcomes with consensus. Any failure restores the engine's pre-catch-up checkpoint.

## Bounds

The room has explicit limits for envelope bytes, nesting depth, array length, property count, commands per turn, pending commands, retained command/batch logs, retained checkpoint bytes, events, and checkpoint history. Recursive ownership rejects cycles before descending. The localhost transport additionally enforces exact Origin, loopback binding, HTTP upgrade path, `maxPayload`, JSON-text-only messages, per-message bytes, and per-socket rate limits.

## Evidence

`npm run test:relay` covers two independent no-bot duel engines for 420 ticks, stable fingerprints, ordering, outcome/checkpoint/recovery attacks, unresolved evidence, deterministic pause, both surrender directions, exact stop/no extra batch, seat-derived winners, malicious final mismatch, immutable completion, byte-identical replay bytes, production capability rejection, two fresh imports, and official replaycheck against a temporary exported replay.

`npm run test:relay-browser` covers a real loopback WebSocket and two isolated Chromium contexts. It proves ready gating, ordering, tick-100 agreement, ack stalls, retained and unresolved-checkpoint replacement recovery, fingerprint rejection before seat consumption, terminal completion, byte-identical replay receipt, two browser-side fresh imports, and bounded hostile wire traffic. The browser client is not imported by the legacy game or production entry.

## Post-Proof Product Work

- Production authentication, room secrets/ownership, WordPress tokens, public hosting, persistence/retention, abuse controls, observability, and production network review.
- General 2-4-human plus bots outcome policy, disconnect-to-bot, multi-seat Risky draft, pause voting, spectators, and ranked results.
- Lobby, invites/public rooms, multiplayer UI, Canvas/controller wiring, chat/pings, deployment, and release packaging.
- Phase E may begin after review. No production WebSocket service, release ZIP, deployment, production access, or handoff was created by this proof.

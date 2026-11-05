# Named Seen receipts

Implemented 2026-11-05 in `frontend/` and the NestJS backend.

## Interaction

The sender can right-click a text/media message, hold it on touch devices, or use its actions button. The menu ends with a Seen count and up to four reader avatars. Activating that row opens a compact list of every reader's name, avatar and first-seen date/time. Desktop places the list beside the menu; narrow viewports place it above and constrain its width/scroll area. The delivery ticks on the message also open these details. There are explicit loading, empty, failure and retry states; new socket receipts refresh the list.

This reuses the existing message menu and touch gestures. No reaction, pin or other unrelated screenshot action was added. Details are available on the sender's own ordinary messages, in both groups and direct chats; membership activity notices have no Seen menu.

## Persistence and access control

The existing `MessageReadStatus` model already provides one receipt per `(messageId, userId)` through its unique constraint. No database migration is needed.

- `GET /api/v1/realtime/chats/:id/messages/:messageId/readers` requires JWT, valid positive 32-bit IDs, current chat membership and ownership of the ordinary message. A missing/other-chat/other-sender message returns 404. The route is limited to 60 requests per minute.
- Response data is an array of `{ messageId, userId, readAt, user: { id, email, profile: { firstname, lastname, avatarId } } }`, ordered by first-seen time then user ID. Passwords, addresses and phone numbers are excluded. Receipts from readers who later leave remain part of the message history.
- Read acknowledgements take reader identity from the authenticated socket and time from the server. They accept at most 1000 positive 32-bit message IDs, deduplicate via the database constraint and only apply to ordinary messages in that same chat, excluding the sender's own messages.
- Writing receipts locks the same chat row as membership/removal/deletion, then checks membership again inside the transaction. A stale or removed socket cannot write receipts after departure commits.
- Repeated acknowledgements now preserve `readAt`; previously an upsert rewrote it on subsequent visits. Existing timestamps that were already overwritten cannot be reconstructed and remain the earliest value available to the new behavior.

## Visibility

The frontend uses IntersectionObserver rooted at the message scroller. Only rendered, intersecting incoming ordinary messages are acknowledged while the document is visible. Cache/history downloads and new messages offscreen do not imply Seen. MutationObserver registers newly rendered messages, and returning to the tab checks currently intersecting IDs. Reconnect retries visible messages and duplicate suppression prevents repeated acknowledgements within a connection.

Intersection is an indication that the message was displayed, not proof of human attention. Clients can still acknowledge their own viewing of messages they are authorized to read; the server cannot independently observe the user's screen. Unsupported IntersectionObserver environments do not fabricate read receipts.

Reader queries are scoped to session/chat/message, use AbortSignal, refresh on incoming receipt events and while the details panel is open, and are removed with other chat caches when membership is revoked. Compact ticks do not request details for every message on initial render.

## Validation

- Frontend production build and lint; backend TypeScript check and lint of changed runtime files passed.
- 121 frontend tests and 45 backend unit tests passed.
- Seven real group integration scenarios passed using disposable PostgreSQL data and HTTP/JWT/Socket.IO. The new scenario checks empty/multiple reader lists, identity forgery, cross-chat reads, non-sender/outsider access, immutable first-seen time, safe user fields, removed participants, self/system exclusions, input bounds and receipt cleanup after message deletion.
- Component tests cover the avatar limit, names and exact timestamp attributes, popup opening, live refresh, empty/error retry, lazy loading and hiding details on incoming messages. Visibility tests cover offscreen/hidden messages, returning to the tab, duplicate suppression and batched reads.
- No visual browser/device run was completed in this environment; the attached design was inspected and interaction tests use jsdom.

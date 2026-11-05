# Group chats

Implemented 2026-11-04 in the active React frontend and NestJS backend.

## Product rules

- A group has a required, trimmed name (1–100 characters), one owner, and up to 100 current members. Creation requires the creator plus at least one other person; a group remains a group even after shrinking to one member.
- The creator becomes owner. Only the owner can rename, add/remove other members, or transfer ownership to a current member. Any member can leave.
- When an owner leaves without transferring ownership, the earliest remaining participant becomes owner. The last departure leaves the conversation inaccessible; existing messages/files are retained rather than deleted.
- New or re-added members can see the full existing history. There are no public links, approval requests, separate admin roles in this version. Departures and removals are recorded as group activity.
- Leaving/removal immediately revokes API and attachment access and removes every connected socket of that user from the chat room. Previously downloaded messages/files cannot be revoked.
- Group UI shows sender names and the number of readers for sent messages. Double checks mean at least one other person read the message, not that all members read it.

## Data and concurrency

Migration `20261104100000_group_chats` adds nullable `Chat.name`, `ChatMemberRole` (`OWNER`, `MEMBER`), `ChatParticipant.role`, `joinedAt`, and an index on `chatId`. Existing direct chats retain their IDs and data. Existing groups receive the name `Group` and their earliest participant as owner.

Group mutations lock the `Chat` row inside a database transaction, preserving capacity and ownership under concurrent requests. Message sends lock the same row and recheck membership inside the transaction. Direct-chat creation locks the two users in ID order to prevent duplicate conversations from concurrent application requests.

A membership is unique by `(userId, chatId)`. The backend enforces one owner through serialized mutations; do not change roles directly in the database without preserving that invariant.

## HTTP API

All paths below are under `/api/v1/realtime`, protected by JWT. User identity always comes from the session.

| Method | Path | Payload / behavior |
| --- | --- | --- |
| POST | `/polling/create-chat` | `{ participant: number[], isGroup?: boolean, name?: string, firstMessage?: string }`. Send `isGroup: true` for an explicit group, including a two-person group. More than two unique users defaults to group for compatibility and requires a name. Direct chats reuse an existing conversation. Initial message is optional; the UI creates empty conversations. |
| PATCH | `/groups/:id` | `{ name: string }`, owner only. |
| POST | `/groups/:id/members` | `{ participant: number[] }`, owner only. Duplicate/existing members are ignored; users must exist and total capacity is enforced. |
| DELETE | `/groups/:id/members/:userId` | Owner removes a member, or a member removes themself. |
| POST | `/groups/:id/owner/:userId` | Owner transfers ownership to a current member. |

History retains `chats`, `users` (other members), and `unreadMessages` for compatibility, and adds `chat` with metadata and all current participants/roles. Both inbox transports include `name` and `isGroup`.

GET history and unread endpoints no longer mark messages read. Socket `message:read` writes receipts only for the supplied message IDs belonging to that conversation, excludes the reader’s own messages, and broadcasts those receipts. Unread counts exclude messages sent by the current user and are independent for each member. The frontend requests receipts for loaded messages while the document is visible; this does not establish that every bubble was scrolled into view.

## Socket events

Authenticated connections join a private `user:<id>` room. Creation, rename, membership and ownership changes send `chat:updated { chatId }` to relevant users, including users outside the chat room. `chat:removed { chatId }` tells the departing/removed user to clear cached history and return to the list if that room is open. The server also evicts their sockets from `chat:<id>`.

Ordinary message/read/typing events continue to use existing chat rooms. Inbox polling remains as fallback for ordinary messages outside an open room. On reconnect, the inbox and open history refresh and membership is checked again.

## Setup and verification

From `backend/`:

```bash
npx prisma generate
npx prisma migrate deploy
npm run build
npm test -- --runInBand
npm run test:groups:integration
npm run test:media:integration
```

Apply migrations and regenerate the client before running the updated backend. The additive migration was applied to the configured local `test_realtime` database. Deployment elsewhere still requires these commands and restarting the backend.

The group integration suite uses disposable users/chats, real PostgreSQL, HTTP/JWT and Socket.IO. It covers input validation, direct reuse and two-person groups, multiple recipients, owner-only operations, independent unread/read receipts, history access, invitations, removal, room eviction, ownership transfer, and last-member departure. Test records are removed afterward.

Frontend regression tests cover selection across contact searches, name review, preservation after creation errors, direct chats without synthetic initial messages, confirmation before removal, member permissions/leave, and batched read receipts for history fetched after reconnect. Run `npm test`, `npm run lint`, and `npm run build` from `frontend/`.

Verification: backend/frontend builds, lint for frontend and changed backend runtime files, 41 frontend tests, 14 backend unit tests, three group integration scenarios and the media integration scenario passed. Visual browser/device validation was not completed in this environment because the Chromium download timed out.

## Group photos and member discovery

Click the group name/photo in the conversation header (the subtitle says `Group info`). The owner sees a prominent `Add members` button and group-photo controls. Photo selection shows a local preview and requires `Save photo`; failure keeps the selection for retry. Photos appear in the header, group-info panel and conversation list. Ordinary members can view the photo but cannot edit it.

Migration `20261104110000_group_avatar` adds nullable unique `Chat.avatarId` referencing `UploadFile` through `GroupAvatar`. Apply it with `npx prisma migrate deploy` and regenerate the client before starting the backend. It has been applied to local `test_realtime`.

- `POST /api/v1/files/groups/:chatId/avatar`: multipart `file`, owner only; JPEG/PNG/WebP, maximum 5 MiB, re-encoded with the existing avatar image pipeline. Ownership is checked before processing and again under the group row lock when saving.
- `DELETE /api/v1/files/groups/:chatId/avatar`: owner only; removes the current photo.
- `GET /api/v1/files/:id/content`: group photos require current membership, including for the original uploader. Photos are never public and cannot be claimed as message attachments.
- Replacements/removal clear the previous record and physical file. Active group photos are excluded from draft cleanup. `chat:updated` invalidates member inbox/history metadata on changes.

Verification after this addition: 44 frontend tests, 14 backend unit tests, four real group integration scenarios and the media integration scenario passed. Group-photo integration covers owner/member/outsider permissions, malformed/oversized files, metadata/events, retained active photos, replacement/removal, ownership changes and revoked access after departure.

## Departure activity

Migration `20261104120000_group_activity` adds `Message.kind` (`TEXT`, `MEMBER_LEFT`, `MEMBER_REMOVED`); all existing messages default to `TEXT`. The local database has been migrated.

Leaving/removal and the associated activity message are saved in the same locked transaction. The activity stores a display-name snapshot in `content`: `Name left the group.` or `Owner removed Name from the group.` It remains available in history even after the participant is gone. It is broadcast as `message:new` after the departing user's sockets are evicted, then inbox/group metadata is invalidated for remaining members. No historical departures are reconstructed.

The frontend renders activity as a centered notice with a timestamp and no sender bubble or delivery checks. Inbox previews include the notice; unread counts and read receipts include only `TEXT`. Clients cannot create system kinds through message sending: REST rejects extra fields and socket sends always create `TEXT`.

Verification: 45 frontend tests, 14 backend unit tests, five group integration scenarios and the media integration scenario passed. New checks cover persistent/live departure names, removal vs voluntary leaving, rejected/duplicate departures, event types that cannot be forged by clients, independent unread semantics and activity rendering.

## Member-added activity (2026-11-05)

Migration `20261105100000_member_added_activity` adds `MEMBER_ADDED` to `MessageKind` and has been applied to local `test_realtime`. Adding members to an existing group writes one named activity message per new member in the same membership transaction, then broadcasts it through `message:new`. Each notice reads `Name was added to the group.` using the member's display name at that time. It appears centered with the other membership notices and remains in history for current and newly added members.

Duplicate IDs and people who already belong to the group produce no extra notices. Re-adding someone after departure records a new addition. Failed/unauthorized requests create no activity. Initial group creation does not create individual addition notices. Addition events follow the existing activity rules for unread counts, read receipts, inbox previews and suppressed message push notifications.

Validation: frontend production build, backend TypeScript check, frontend lint, changed backend service lint, 98 frontend tests and six real group integration scenarios passed. The new integration scenario covers live delivery, persisted names, multi-member additions, duplicate suppression, rejected requests, re-addition and unread counts. Backend compilation was checked without emitting into `dist` to avoid interference with the running development watcher.

# Chat and message actions

Implemented in the active React frontend and NestJS backend on 2026-11-05.

## Rules and interface

- Either participant can permanently delete a direct conversation for both people. Only the current owner can delete a group for everyone. A confirmation explains that the operation is irreversible.
- Conversation deletion removes messages, read receipts, memberships, call history, uploaded media records and the physical media files, including group avatars and draft uploads. No deleted-message marker or deletion activity message is created. Active calls are released and connected clients leave the deleted conversation.
- Each participant has their own persistent `muted` setting. Muting suppresses both in-app message cards and FCM pushes; messages and unread counts still arrive. It does not mute incoming calls.
- Reply works with text and media in the same conversation. The bubble shows the original sender and a preview, and clicking it opens the original message. Deleting the original clears the reply relation without retaining a text snapshot or a tombstone.
- Only the sender can edit or delete a message. Editing updates `editedAt`; the bubble displays `edited` beside its time. Media captions can be edited, including cleared; text-only messages cannot be empty. The original unsent draft is restored after saving or cancelling an edit.
- Select supports up to 100 messages. The toolbar provides Forward, Delete and Cancel. Delete is enabled only if every selected message belongs to the user. A mixed-ownership deletion request fails atomically on the server.
- Forwarding accepts text, images, video and voice, in original message order, to any existing conversation/group the user belongs to. Forwarded messages are new messages attributed to the forwarding user and have a Forwarded label. Media files are copied independently; deleting the source does not break the copy.
- Desktop: right-click a conversation for mute/delete, or a message for reply/edit/copy/forward/delete/select. The ellipsis buttons provide a keyboard-accessible alternative.
- Mobile: swipe a conversation left for mute/delete; hold a message for one second for its menu. Scrolling or releasing early cancels the hold.

## API and realtime

All endpoints require JWT authentication and validate conversation membership on the server. Mutations lock chat rows; source and destination locks for forwarding are acquired in ID order.

| Method | Path under `/api/v1` | Body |
| --- | --- | --- |
| DELETE | `realtime/chats/:id` | — |
| PATCH | `realtime/chats/:id/mute` | `{ muted: boolean }` |
| PATCH | `realtime/chats/:id/messages` | `{ messageId, content }` |
| DELETE | `realtime/chats/:id/messages` | `{ messageIds: number[] }` |
| POST | `realtime/chats/:id/forward` | `{ messageIds, targetChatId }` |
| POST | `realtime/chats/:id/messages/sync` | `{ messageIds: number[] }` (up to 1000) |

Both HTTP send and `message:send` accept optional `replyToId`. History and message-window responses include the reply target, `editedAt` and `forwarded`. Inbox responses include the current member's `muted` and `myRole`.

`message:updated` and `message:deleted` go to authenticated user rooms, followed by `chat:updated`. Full deletion uses `chat:removed` for all members. Clients remove deleted history/search/calendar caches and drafts, dismiss in-app notices and stop active call media. History refetch synchronizes loaded IDs to reconcile edits and deletions missed while disconnected, including older loaded pages.

## Migration and verification

Run `npx prisma migrate deploy` and `npx prisma generate` in `backend/` before starting the updated server. Migration `20261105090000_message_actions` adds `ChatParticipant.muted`, `Message.editedAt`, `Message.forwarded` and a nullable indexed self-reference with `ON DELETE SET NULL`. It has been applied to the configured local database.

Commands:

```bash
cd frontend
npm run build
npm run lint
npm test
cd ../backend
npm run build
npm test -- --runInBand
npx jest --config test/jest-message-actions.json --runInBand
```

The integration suite uses real PostgreSQL, authenticated HTTP and Socket.IO with isolated test users and temporary media. It covers membership, owner transfer, both-party deletion, filesystem cleanup, active-call cleanup, notification muting, reply validation, edit authorization, atomic deletion and independent media forwarding. Frontend tests cover right-click, long hold/cancel, swipe, ownership menus, reply/edit/draft restoration, multi-selection and forwarding.

Deletion applies to live application storage. Externally downloaded/forwarded copies, previously delivered OS notifications and independent database/storage backups are outside that operation. If unlinking a physical file temporarily fails after commit, the error is logged and the existing orphan-media sweeper retries cleanup; its DB record and application access are already removed. Real-device gesture testing remains separate from the automated component tests.

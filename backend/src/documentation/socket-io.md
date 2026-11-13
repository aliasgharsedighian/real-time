# Socket.IO event reference

Connect a Socket.IO v4 client to the `/chat` namespace on the backend origin.
The transport path is `/socket.io/`. Pass a signed-in user's access JWT in
`auth.token`. An invalid handshake produces `connect_error` with
`Unauthorized`. When the token expires, the server disconnects the client.
Reconnect using a fresh access token and rejoin the active chat room.

```ts
import { io } from 'socket.io-client';

const socket = io('http://localhost:3333/chat', { auth: { token: accessToken } });

socket.on('error', ({ message }) => console.error(message));
socket.on('message:new', (message) => console.log(message));

socket.on('connect', async () => {
  const result = await socket.timeout(5000).emitWithAck('chat:join', { chatId: 42 });
  if ('message' in result) console.error(result.message);
});
```

## Client → server

Use a callback or `emitWithAck` to read an acknowledgement. Most rejected events
acknowledge with `{ message: string }` and also emit `error`. Rows marked “none”
or “may be skipped” can leave a callback waiting, so set a client-side timeout.
Chat IDs and message IDs are positive integers. Call and attachment IDs are UUIDs.

| Event | Payload | Successful acknowledgement and behavior |
| --- | --- | --- |
| `chat:list` | None | `ChatListEntry[]`. Also emits `chat:list` to the requesting socket. |
| `chat:join` | `{ chatId }` | `{ chatId }`. Requires membership. Emits `chat:joined` and replays active typing entries to the requester. |
| `chat:leave` | `{ chatId }` | `{ ok: true }`. Leaves the socket room and clears that socket's typing state. |
| `chat:presence` | `{ chatId }` | `PresenceSnapshot`. Requires membership. Also emits the snapshot to the requester. |
| `typing:list` | None | `TypingEntry[]` for the user's chats. Also emits `typing:list` to the requester. |
| `typing:start` | `{ chatId }` | `{ ok: true }` when applied. Requires membership and a joined room. Acknowledgement may be skipped if the socket has left or a newer update supersedes it. The server derives the display name. |
| `typing:stop` | `{ chatId }` | Same acknowledgement rules as `typing:start`. |
| `message:send` | `{ chatId, content, attachmentId?, attachmentIds?, replyToId? }` | `Message`. Requires membership. Send text or a draft attachment. `content` is a string of at most 10,000 characters. Use only one attachment field. Multiple attachments must be images, up to 10. |
| `message:read` | `{ chatId, messageIds }` | `Receipt[]`. Requires membership. Up to 1,000 message IDs. |
| `message:read-through` | `{ chatId, throughMessageId }` | `{ unreadCount: number }`. Requires membership. The cursor identifies a message in the chat. |
| `notification:presence` | `{ active: boolean, chatId: number \| null }` | `{ ok: true }`, or `{ ok: false }` on failure. An invalid `active` is ignored without acknowledgement. The web client reports a visible dashboard as active, including an unfocused visible window. A chat counts as open only when the socket has joined its room. |
| `call:list` | None | `Call[]`. Up to 100 records, newest first, for calls in chats the user still belongs to. |
| `call:config` | None | `{ iceServers: [{ urls, username?, credential? }] }`. `urls` is a string or array of strings. TURN credentials, when configured, are short-lived. |
| `call:pending` | None | Incoming ringing `Call` or `null`. |
| `call:start` | `{ chatId, mode: 'audio' \| 'video' }` | `Call`. Direct chats only. |
| `call:accept` | `{ id }` | `Call` in `CONNECTING` state. The receiving device accepts the ringing call. |
| `call:end` | `{ id, failed?: boolean }` | Updated `Call`, or `{ id }` if no live call exists. |
| `call:connected` | `{ id }` | `{ id }`. The call becomes active once both participating devices report connected. |
| `call:signal` | `{ id, signal }` | `{ id }`. Relays signaling to the other device in a connecting or active call. |

`signal` is `{ type: 'offer', sdp: string }` from the caller,
`{ type: 'answer', sdp: string }` from the callee, or
`{ type: 'ice', candidate: object }` from either. The serialized signal is limited
to 65,536 characters.

## Server → client

| Event | Payload | Audience |
| --- | --- | --- |
| `error` | `{ message: string }` | Requesting socket |
| `chat:list` | `ChatListEntry[]` | Requesting socket |
| `chat:joined` | `{ room: 'chat:<id>', chatId }` | Requesting socket |
| `chat:updated` | `{ chatId }` | Affected users' connected devices. Refresh the chat summary. |
| `chat:removed` | `{ chatId }` | Removed users' devices. The server also evicts their sockets from the chat room. |
| `chat:presence` | `PresenceSnapshot` | Requester for a full snapshot, joined chat room for a single-user update |
| `typing:list` | `TypingEntry[]` | Requesting socket |
| `typing:start` | `TypingEntry` | Chat participants and joined sockets, or the joining socket during replay |
| `typing:stop` | `TypingEntry` | Chat participants and joined sockets |
| `message:new` | `Message` | Joined chat room. Group avatar uploads emit `GROUP_PHOTO_CHANGED` with the historical image in `attachments`. Removing a set avatar emits `GROUP_PHOTO_REMOVED` with empty attachments. |
| `message:read` | `Receipt` | Joined chat room, one event per changed receipt |
| `message:pins` | `{ chatId }` | Chat participants' devices. Refresh the pinned messages. |
| `message:reactions` | `ReactionState` | Chat participants' devices after a reaction changes on a regular message or a group photo change. |
| `message:updated` | `Message` | Chat participants' devices |
| `message:deleted` | `{ chatId, messageIds: number[] }` | Chat participants' devices |
| `notification:new` | `ChatNotification` | One socket reporting a visible dashboard for an unmuted recipient, when no active socket for that account has joined and reported the target chat as open. The server rechecks routing before each FCM batch. |
| `call:updated` | `Call` | Caller and callee devices |
| `call:accepted` | `Call` | Caller and accepting callee sockets |
| `call:signal` | `{ id, signal }` | Other participating call socket |

## Payload models

`ChatListEntry`, `Message`, `Receipt` and `ReactionState` are shared with the
HTTP API. See `/v1/documentations/openapi.json` under `components.schemas`.

```ts
type TypingEntry = { chatId: number; userId: number; username: string };
type PresenceSnapshot = {
  chatId: number;
  users: {
    userId: number;
    online: boolean;
    lastSeenAt: string | null;
    lastSeen: 'recently' | 'week' | 'month' | null;
  }[];
};
type Call = {
  id: string;
  chatId: number;
  callerId: number;
  calleeId: number;
  mode: 'audio' | 'video';
  status: 'RINGING' | 'CONNECTING' | 'ACTIVE' | 'MISSED' |
    'CANCELLED' | 'REJECTED' | 'ENDED' | 'FAILED';
  createdAt: string;
  answeredAt: string | null;
  connectedAt: string | null;
  endedAt: string | null;
};
type ChatNotification = {
  type: 'chat.message';
  messageId: string;
  chatId: string;
  recipientId: string;
  senderId: string;
  title: string;
  body: string;
  senderName: string;
  mediaKind: string;
  createdAt: string;
};
```

Dates are serialized as ISO 8601 strings. Presence uses a coarse `lastSeen`
value when the user's exact timestamp is private.

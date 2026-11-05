# Chat presence and typing

The React frontend shows one status line below the conversation title, replacing “Conversation”. Typing takes precedence over online/last seen. Direct chats display only `is typing`; groups display all current names, for example `Alice, Bob, Carol is typing`, and otherwise retain member information.

## Display and privacy

- Online means at least one authenticated `/chat` socket is connected, including background tabs. The final socket disconnect records last seen. Expired sessions disconnect automatically; network loss follows Socket.IO disconnect detection.
- With `Profile.showLastSeen` on (the default), offline status is `last seen recently` below one minute, then whole minutes/hours, `last seen yesterday`, or calendar days ago in the viewer’s timezone. Text updates automatically.
- Profile → **Show my last seen** → **Update** saves the preference. When off, the server projects offline visits into `recently` (less than three days), `week` (three to seven days), or `month` (seven days and older). The final bucket stays `within a month` for older visits, retaining the three requested labels. Unknown private history also uses that final bucket. Online and typing remain visible.
- Private timestamps are never included in presence events or acknowledgements. Existing public user, history, contact and chat-list responses do not select `User.lastSeenAt`. Presence writes preserve the publicly exposed `User.updatedAt` to prevent an indirect timestamp leak. Profile changes immediately publish a new projection to joined members.

## Socket contract

`chat:presence { chatId }` checks the JWT and membership, then returns and emits `{ chatId, users: [{ userId, online, lastSeenAt, lastSeen }] }`. Online/private projections have `lastSeenAt: null`; private offline projections have `lastSeen: "recently" | "week" | "month"`. Changes are broadcast to authorized conversation rooms. Clients refresh after joining/reconnecting and every 30 seconds to advance private buckets; exact relative times tick locally every 15 seconds.

`typing:start`/`typing:stop` require membership and a joined room. Identity/name come from the authenticated account, ignoring supplied identities. Typing means the open conversation has a nonempty text draft, including a restored draft or an emoji. Pausing and blurring the input preserve it; clearing text, sending, leaving, removal or disconnect stop it. There is no idle expiry. State is tracked per socket/conversation and combined across tabs. Joining observers receive current typists, and reconnecting composers republish their draft after joining. Newer typing events supersede older in-flight lookups.

Presence writes are serialized per user across reconnects. Existing notification heartbeats persist activity at most once per 30 seconds, providing a recent fallback after abrupt backend failure. Live presence and typing are held in one backend process, consistent with the existing calls implementation; multiple backend replicas require shared presence/typing state and Socket.IO room delivery.

## Database and verification

Migration `20261105100000_chat_presence` adds nullable `User.lastSeenAt` and default-true `Profile.showLastSeen`. It does not infer past visits from profile edits or messages. Existing accounts acquire a visit on their next socket connection.

```bash
cd backend
npx prisma generate
npx prisma migrate deploy
npm run build
npm test -- --runInBand
npm run test:presence:integration

cd ../frontend
npm run build
npm run lint
npm test
```

Restart the backend after generating Prisma Client. The integration suite uses disposable PostgreSQL accounts and real HTTP/JWT/Socket.IO to verify authorization, typing identity, room exit/disconnect, joining observers, multiple tabs, persisted preferences, private buckets and live privacy updates. Unit/UI tests cover formatting, header precedence, group names, draft persistence through idle/blur, clearing/sending and reconnects. Automated UI tests do not replace visual checks on target devices.

The sidebar replaces each conversation’s message preview with typing text while peers have drafts, including on other pages. Events also target authenticated member user rooms. `typing:list` restores current typists only for the caller’s memberships after reconnects. The last-seen control is presented as a switch, preserving its saved preference. Message times and delivery marks sit inside the bubble at the lower right. The composer places attachments on the left, emoji inside the right of the input, and voice/send on the far right.

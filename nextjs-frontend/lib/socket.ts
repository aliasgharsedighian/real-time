import { io, Socket } from "socket.io-client";

let socket: Socket | null = null;

export function getSocket() {
  if (!socket) {
    socket = io(
      process.env.NEXT_PUBLIC_WS_URL ?? "http://localhost:3333/chat",
      {
        transports: ["websocket"],
      }
    );
  }
  return socket;
}

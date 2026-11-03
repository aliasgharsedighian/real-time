import { io, type Socket } from "socket.io-client";
import { env } from "@/shared/lib/env";
import { useSessionStore } from "@/features/auth/session-store";

let socket: Socket | null = null;

export function getSocket() {
  if (!socket)
    socket = io(env.socketUrl, {
      autoConnect: false,
      auth: (callback) =>
        callback({ token: useSessionStore.getState().tokens?.accessToken }),
    });
  return socket;
}

export function disconnectSocket() {
  socket?.disconnect();
  socket?.removeAllListeners();
  socket = null;
}

import { api } from "@/shared/lib/api";
import { io, type Socket } from "socket.io-client";
import { env } from "@/shared/lib/env";
import { useSessionStore } from "@/features/auth/session-store";

let socket: Socket | null = null;

export function getSocket() {
  if (!socket) {
    socket = io(env.socketUrl, {
      autoConnect: false,
      auth: (callback) =>
        callback({ token: useSessionStore.getState().tokens?.accessToken }),
    });
    const current = socket;
    let recovering = false;
    const recover = async () => {
      if (
        recovering ||
        socket !== current ||
        !useSessionStore.getState().tokens
      )
        return;
      recovering = true;
      try {
        // This authenticated request shares the normal access-token refresh flow.
        await api.get("auth/user-info");
        if (socket === current && useSessionStore.getState().tokens)
          current.connect();
      } catch {
        /* Session validation handles rejected credentials; network recovery can retry. */
      } finally {
        recovering = false;
      }
    };
    current.on("connect_error", (error) => {
      if (error.message === "Unauthorized") void recover();
    });
    current.on("disconnect", (reason) => {
      if (reason === "io server disconnect") void recover();
    });
  }
  return socket;
}

export function disconnectSocket() {
  socket?.disconnect();
  socket?.removeAllListeners();
  socket = null;
}

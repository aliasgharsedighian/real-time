const apiOrigin = (
  import.meta.env.VITE_API_URL || "http://localhost:3333"
).replace(/\/+$/, "");

export const env = {
  apiUrl: apiOrigin.endsWith("/api/v1")
    ? `${apiOrigin}/`
    : `${apiOrigin}/api/v1/`,
  socketUrl:
    import.meta.env.VITE_SOCKET_URL || `${new URL(apiOrigin).origin}/chat`,
};

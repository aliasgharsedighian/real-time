export type Message = {
  id: number | string;
  text: string;
  role: "admin" | "user";
  image?: string;
  timestamp: string;
};

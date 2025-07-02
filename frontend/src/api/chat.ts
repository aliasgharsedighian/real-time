import axios from "axios";
import type { Message } from "../pages/polling/components/chatWidget";

export const fetchMessages = async (): Promise<Message[]> => {
  const response = await axios.get(`${import.meta.env.VITE_API_URL}/posts`);
  console.log(response.data);
  return response.data;
};

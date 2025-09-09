import ChatsContainer from "../components/ChatContent";
import { cookies } from "next/headers";

export default async function PollingChatId({
  params,
}: {
  params: Promise<{ chatId: string }>;
}) {
  const { chatId } = await params;
  const cookieStore = await cookies();
  const token = cookieStore.get("refresh_token")?.value;

  return (
    <div>
      <ChatsContainer chatId={chatId} token={token} />
    </div>
  );
}

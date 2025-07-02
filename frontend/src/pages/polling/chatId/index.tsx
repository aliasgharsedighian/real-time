import { useParams } from "react-router-dom";
import { ChatMessanger } from "../../../components/chatMessanger";

function PollingChatId() {
  const { chatId } = useParams();
  return <div></div>;
}

export default PollingChatId;

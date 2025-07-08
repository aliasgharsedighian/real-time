import React from "react";
import { Button } from "../../../../components/ui/button";
import PulseCircle from "../../../../components/ui/custom/PulseCircle";
import { useGetChatById } from "../../../../hooks/useGetChatById";
import { useChatStore } from "../../../../store/useChatStore";
import { useNavigate } from "react-router-dom";
import { capitalizeFirstLetter } from "../../../../utils/stringUtils";

const ChatHeader = ({ chatId }: { chatId: string | undefined }) => {
  const chatError = useChatStore((state) => state.chatError);
  const navigate = useNavigate();

  const {
    data,
    isLoading,
    isError,
    error: fetchMessagesError,
  } = useGetChatById(chatId);

  const goBack = () => {
    navigate(-1); // This navigates to the previous page in history
  };

  return (
    <div className="bg-[#2b7fff] text-white p-3 flex gap-4 items-center">
      <Button className="!p-1" variant={"ghost"} onClick={goBack}>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={1.5}
          stroke="currentColor"
          className="size-6"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18"
          />
        </svg>
      </Button>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
        }}
      >
        <span>
          {data?.users.map((user: any) => (
            <React.Fragment key={user.id}>
              {capitalizeFirstLetter(user.user.profile.firstname) +
                " " +
                capitalizeFirstLetter(user.user.profile.lastname)}
            </React.Fragment>
          ))}
        </span>
        {chatError ? (
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <PulseCircle size="7px" color="#d32f2f" />
            <span
              style={{ fontSize: 12, color: "#d32f2f", fontWeight: "bold" }}
            >
              Offline!
            </span>
          </div>
        ) : (
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <PulseCircle size="7px" color="white" />
            <span style={{ fontSize: 12 }}>Online!</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default ChatHeader;

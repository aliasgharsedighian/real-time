import React, { useEffect } from "react";
import { Button } from "../../../../components/ui/button";
import PulseCircle from "../../../../components/ui/custom/PulseCircle";
import { useGetChatById } from "../../../../hooks/useGetChatById";
import { useChatStore } from "../../../../store/useChatStore";
import { useNavigate } from "react-router-dom";
import { capitalizeFirstLetter } from "../../../../utils/stringUtils";

const ChatHeader = ({
  chatId,
  setHasMoreMessage,
}: {
  chatId: string | undefined;
  setHasMoreMessage: any;
}) => {
  const chatError = useChatStore((state) => state.chatError);
  const navigate = useNavigate();

  const { data } = useGetChatById(chatId, setHasMoreMessage);

  useEffect(() => {
    console.log();
  });

  const goBack = () => {
    navigate("/polling"); // This navigates to the previous page in history
  };

  return (
    <div className="bg-[#2b7fff] h-[66px] text-white p-3 flex gap-4 items-center sticky top-0 w-full z-10">
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
          {data?.pages[0].users.map((user: any) => (
            <React.Fragment key={user.id}>
              {user.user.profile.firstname
                ? capitalizeFirstLetter(user.user.profile.firstname) +
                  " " +
                  capitalizeFirstLetter(user.user.profile.lastname)
                : user.user.email}
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

"use client";

import { useChatStore } from "@/store/useChatStore";
import React from "react";

function ChatDetailHeader() {
  const openUsers = useChatStore((s) => s.currentOpenUserDetail);
  const typingUsers = useChatStore((s) => s.typingUsers);

  const renderUserName = () => {
    if (openUsers.length > 1) {
      return "Group Chat";
    }
    if (openUsers.length === 1) {
      return openUsers[0].user.profile.firstname
        ? `${openUsers[0].user?.profile.firstname} ${openUsers[0].user?.profile.lastname}`
        : openUsers[0].user.email;
    }
  };

  const renderTyping = () => {
    if (typingUsers.length === 0) {
      return " ";
    }
    if (typingUsers.length === 1) {
      return `${
        typingUsers[0].user.profile.firstname
          ? typingUsers[0].user.profile.firstname
          : typingUsers[0].user.email
      } is typing...`;
    }
    if (typingUsers.length > 1) {
      `${typingUsers.length} people are typing...`;
    }
  };

  return (
    <div className="flex flex-col gap-1">
      <p>{renderUserName()}</p>
      <span className="text-sm text-blue-600 h-6">{renderTyping()}</span>
    </div>
  );
}

export default ChatDetailHeader;

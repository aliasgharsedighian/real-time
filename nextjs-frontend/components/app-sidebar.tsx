"use client";

import * as React from "react";

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { Button } from "./ui/button";
import UserButton from "./UserButton";
import { useAuthStore } from "@/store/useAuthStore";
import { MessageCircle } from "lucide-react";
import { useAllChats } from "@/hooks/useChats";
import Link from "next/link";
import { capitalizeFirstLetter } from "./utils/stringUtils";
import { formatDateBasedOnToday } from "./utils/dateUtils";

// This is sample data.

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const user = useAuthStore((state) => state.user);

  const { data: chats, isLoading } = useAllChats();

  const ChannelsList = chats?.data || [];

  return (
    <Sidebar variant="floating" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <div className="flex items-center justify-between w-full">
                <div className="flex flex-col">
                  <span className="text-xs text-muted-foreground">
                    Welcome back
                  </span>
                  <span className="text-sm font-semibold">
                    {`${user?.profile.firstname} ${user?.profile.lastname}`}
                  </span>
                </div>
                <UserButton />
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarMenu className="gap-2">
            <Button className="w-full" variant="outline">
              Start New Chat
            </Button>
            {/* Channels List */}

            {ChannelsList.length !== 0 ? (
              ChannelsList?.map((chat: any) => (
                <Link key={chat.id} href={`/dashboard/websocket/${chat.id}`}>
                  <div className="border-b py-3 px-2">
                    <div className="w-full flex justify-between">
                      <span className="font-bold">
                        {chat.participants.length === 1 ? (
                          <>
                            {chat.participants[0].user.profile.firstname
                              ? capitalizeFirstLetter(
                                  chat.participants[0].user.profile.firstname
                                ) +
                                " " +
                                capitalizeFirstLetter(
                                  chat.participants[0].user.profile.lastname
                                )
                              : chat.participants[0].user.email}
                          </>
                        ) : (
                          "Group"
                        )}
                      </span>
                      {chat?._count.messages ? (
                        <div className="bg-blue-500 text-white w-5 h-5 flex items-center justify-center rounded-full text-sm">
                          {chat?._count.messages}
                        </div>
                      ) : null}
                    </div>
                    {chat?.messages?.map((message: any) => (
                      <div
                        key={message.id}
                        className="flex justify-between w-full"
                      >
                        <p className="line-clamp-1">{message.content}</p>
                        <span className="text-sm">
                          {formatDateBasedOnToday(message.createdAt)}
                        </span>
                      </div>
                    ))}
                  </div>
                </Link>
              ))
            ) : (
              <div className="flex flex-col items-center justify-center h-full py-12 px-4">
                <div className="text-6xl mb-6 opacity-20">
                  <MessageCircle className="size-16" />
                </div>
                <h2 className="text-xl font-medium text-foreground mb-2">
                  Ready to chat?
                </h2>
                <p className="text-sm text-muted-foreground text-center leading-relaxed max-w-[200px]">
                  Your conversations will appear here once you start chatting
                  with others.
                </p>
              </div>
            )}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}

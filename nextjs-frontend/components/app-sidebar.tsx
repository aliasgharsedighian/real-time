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
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogTitle,
} from "@/components/ui/dialog";
import UserButton from "./UserButton";
import { useAuthStore } from "@/store/useAuthStore";
import { Loader, Loader2, MessageCircle } from "lucide-react";
import { useAllChats } from "@/hooks/useChats";
import Link from "next/link";
import { capitalizeFirstLetter } from "./utils/stringUtils";
import { formatDateBasedOnToday } from "./utils/dateUtils";
import { Label } from "./ui/label";
import { Input } from "./ui/input";
import { Checkbox } from "./ui/checkbox";
import { useSearchContact } from "@/hooks/useSearchContact";
import { useCreateChat } from "@/hooks/useCreateChat";
import { useRouter } from "next/navigation";
import { useDebouncedCallback } from "use-debounce";

// This is sample data.

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const { push } = useRouter();
  const token = useAuthStore((state) => state.token);
  const user = useAuthStore((state) => state.user);

  const { data: chats, isLoading: allChatsLoading } = useAllChats();

  const ChannelsList = chats?.data || [];

  const [searchInput, setSearchInput] = React.useState("");
  const [contactSelect, setContactSelect] = React.useState<number[]>([]);
  const [serachData, setSearchData] = React.useState<any>([]);
  const [openSearchDialog, setOpenSearchDialog] =
    React.useState<boolean>(false);

  const handleSearchInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchInput(e.target.value);
    sendValueToApi(e.target.value);
  };

  const {
    mutate: searchContact,
    error: searchContactError,
    isPending: loadingSearch,
  } = useSearchContact(token);

  const { mutate: createChat, isPending: createChatPending } =
    useCreateChat(token);

  const sendValueToApi = useDebouncedCallback(async (text) => {
    if (text.trim() !== "") {
      searchContact(
        { search: searchInput },
        {
          onSuccess: (response) => {
            const result = response.data;

            if (result.statusCode === 200) {
              if (result.data.length > 0) {
                setSearchData(
                  result.data.map((item: any) => ({
                    id: item.id,
                    email: item.email,
                    name: `${capitalizeFirstLetter(
                      item.profile.firstname
                    )} ${capitalizeFirstLetter(item.profile.lastname)}`,
                    phoneNumber: item.phoneNumber,
                  }))
                );
              }
              if (result.data.length === 0) {
                setSearchData([
                  {
                    id: "",
                    email: "",
                    name: result.message,
                    phoneNumber: "",
                  },
                ]);
              }
            }
          },
          onError: () => {
            setSearchData([]);
          },
        }
      );

      // console.log(result);
    }
    if (text === "") {
      setSearchData([]);
    }
  }, 1000);

  function chooseChatContact(userId: number) {
    if (!contactSelect.includes(userId)) {
      setContactSelect([...contactSelect, userId]);
    } else {
      setContactSelect(contactSelect.filter((item) => item !== userId));
    }
  }

  function handleCreateChatSubmit() {
    if (contactSelect.length !== 0) {
      createChat(
        {
          firstMessage: `${
            user?.profile.firstname ? user.profile.firstname : user?.email
          } create this chat`,
          participant: contactSelect,
        },
        {
          onSuccess: (response) => {
            const result = response.data;
            push(`/dashboard/websocket/${result.data.id}`);
          },
          onError: () => {},
        }
      );
    }
  }

  return (
    <Sidebar variant="floating" {...props}>
      <Dialog open={openSearchDialog} onOpenChange={setOpenSearchDialog}>
        <form className="w-full">
          <DialogContent className="sm:max-w-[425px]">
            <DialogTitle className="hidden">
              Are you absolutely sure?
            </DialogTitle>
            <div className="flex flex-col gap-6 w-full">
              <div className="">
                <h4 className="text-lg font-bold">Add chat</h4>
                <p className="text-sm text-gray-500">
                  {" "}
                  Search other users by email , click on it and press Add chat
                  button
                </p>
              </div>
              <div className="flex flex-col gap-3 w-full">
                <Label htmlFor="username-1">Email</Label>
                <Input
                  id="username-1"
                  name="username"
                  placeholder="search user email ..."
                  value={searchInput}
                  onChange={handleSearchInput}
                />
              </div>
              <div className="flex flex-col">
                {loadingSearch && (
                  <div className="flex gap-2 items-center justify-start h-full py-4 px-4">
                    <p>loading ...</p>
                    <Loader2 className="mr-2 size-5 animate-spin" />
                  </div>
                )}
                {serachData.map((user: any) => {
                  return (
                    <div
                      className="flex items-center gap-2 w-full border-b py-2 hover:bg-gray-100"
                      key={user.id}
                    >
                      <Checkbox
                        className="rounded-full h-6 w-6"
                        checked={contactSelect.includes(user.id)}
                        onCheckedChange={() => chooseChatContact(user.id)}
                      />
                      <div>
                        <Label>{user.name}</Label>
                        <span className="text-sm">{user.email}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            <DialogFooter className="!justify-start items-end">
              <Button
                type="button"
                onClick={handleCreateChatSubmit}
                disabled={createChatPending}
              >
                Add chat
              </Button>
            </DialogFooter>
          </DialogContent>
        </form>
      </Dialog>{" "}
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
            <Button
              onClick={() => setOpenSearchDialog((prev) => !prev)}
              className="w-full"
              variant="outline"
            >
              Start New Chat
            </Button>
            {/* Channels List */}

            {!allChatsLoading ? (
              ChannelsList.length !== 0 ? (
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
                          <span className="text-[12px] whitespace-nowrap">
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
              )
            ) : (
              <div className="flex flex-col gap-2 items-center justify-center h-full py-12 px-4">
                <p>loading ...</p>
                <Loader2 className="mr-2 size-7 animate-spin" />
              </div>
            )}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}

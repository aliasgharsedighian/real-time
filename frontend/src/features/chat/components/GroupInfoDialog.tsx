import { SharedContentSection } from "./SharedContentSection";
import { UserInfoDialog } from "./UserInfoDialog";
import { useChatStatus } from "../hooks/use-chat-status";
import { formatPresence } from "../presence";
import { useChatList } from "../hooks/use-chat-list";
import { muteChat } from "../api";
import { Bell, BellOff } from "lucide-react";
import { useState, type ReactNode } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Users, UserPlus, Crown, LogOut, ArrowLeft } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/shared/ui/dialog";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { IdentityAvatar } from "@/shared/components/IdentityAvatar";
import { displayName, type User } from "@/shared/lib/types";
import { errorMessage } from "@/shared/lib/api";
import { useSession } from "@/features/auth/session-context";
import { useSessionStore } from "@/features/auth/session-store";
import {
  addGroupMembers,
  chatKeys,
  removeGroupMember,
  renameGroup,
  transferGroupOwner,
} from "../api";
import type { ChatDetails } from "../types";
import { GroupPhotoEditor } from "./GroupPhotoEditor";
import { ContactPicker } from "./ContactPicker";

type Confirmation = {
  label: string;
  description: string;
  run: () => Promise<unknown>;
  leave?: boolean;
};

export function GroupInfoDialog({
  chat,
  trigger,
}: {
  chat: ChatDetails;
  trigger?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      {trigger ? (
        <button
          type="button"
          aria-label="Group info"
          onClick={() => setOpen(true)}
          className="flex min-w-0 flex-1 items-center gap-3 rounded-xl py-2 text-left outline-none transition-colors hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring"
        >
          {trigger}
        </button>
      ) : (
        <Button
          variant="ghost"
          size="sm"
          aria-label="Group info"
          onClick={() => setOpen(true)}
        >
          <Users />
          Group info
        </Button>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto rounded-2xl">
          <GroupInfo
            key={`${chat.id}:${open}`}
            chat={chat}
            onClose={() => setOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}

function GroupInfo({
  chat,
  onClose,
}: {
  chat: ChatDetails;
  onClose: () => void;
}) {
  const { user } = useSession();
  const identity = useSessionStore((s) => s.tokens?.refreshToken);
  const chats = useChatList();
  const muted =
    chats.data?.find((value) => value.id === chat.id)?.muted ?? false;
  const status = useChatStatus(chat.id, user?.id);
  const owner = chat.participants.find((p) => p.role === "OWNER");
  const isOwner = owner?.userId === user?.id;
  const [name, setName] = useState(chat.name ?? "");
  const [adding, setAdding] = useState(false);
  const [selected, setSelected] = useState<User[]>([]);
  const [confirmation, setConfirmation] = useState<Confirmation>();
  const cache = useQueryClient();
  const navigate = useNavigate();
  const muteAction = useMutation({
    mutationFn: () => muteChat(chat.id, !muted),
    onSuccess: () => {
      void cache.invalidateQueries({ queryKey: chatKeys.list(identity) });
    },
  });
  const action = useMutation({
    mutationFn: (run: () => Promise<unknown>) => run(),
    onSuccess: () => {
      void cache.invalidateQueries({
        queryKey: chatKeys.history(identity, chat.id),
      });
      void cache.invalidateQueries({ queryKey: chatKeys.list(identity) });
      if (confirmation?.leave) {
        onClose();
        navigate("/dashboard");
      }
      setConfirmation(undefined);
      setAdding(false);
      setSelected([]);
    },
  });
  return (
    <>
      <DialogHeader>
        <DialogTitle>{adding ? "Add members" : "Group info"}</DialogTitle>
        <DialogDescription>
          {adding
            ? "New members can see this group’s message history."
            : `${chat.participants.length} members · Up to 100 people`}
        </DialogDescription>
      </DialogHeader>
      {adding ? (
        <>
          <ContactPicker
            selected={selected}
            onChange={setSelected}
            excluded={chat.participants.map((p) => p.userId)}
            limit={100 - chat.participants.length}
            disabled={action.isPending}
          />
          <div className="flex gap-2">
            <Button
              variant="outline"
              disabled={action.isPending}
              onClick={() => setAdding(false)}
            >
              <ArrowLeft />
              Back
            </Button>
            <Button
              className="flex-1"
              disabled={!selected.length || action.isPending}
              onClick={() =>
                action.mutate(() =>
                  addGroupMembers(
                    chat.id,
                    selected.map((u) => u.id),
                  ),
                )
              }
            >
              {action.isPending
                ? "Adding…"
                : `Add ${selected.length || ""} members`}
            </Button>
          </div>
        </>
      ) : (
        <>
          <GroupPhotoEditor chat={chat} canEdit={isOwner} />
          <div className="space-y-2 text-center">
            <h2 dir="auto" className="break-words text-xl font-semibold">
              {chat.name || "Group"}
            </h2>
            <p className="text-xs text-muted-foreground">
              {chat.participants.length} members
            </p>
            <Button
              variant="secondary"
              disabled={muteAction.isPending || !chats.data}
              onClick={() => muteAction.mutate()}
            >
              {muted ? <Bell /> : <BellOff />}
              {muted ? "Unmute" : "Mute"}
            </Button>
          </div>
          {isOwner ? (
            <form
              className="space-y-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (name.trim() && !action.isPending)
                  action.mutate(() => renameGroup(chat.id, name.trim()));
              }}
            >
              <Label htmlFor="edit-group-name">Group name</Label>
              <div className="flex gap-2">
                <Input
                  id="edit-group-name"
                  maxLength={100}
                  dir="auto"
                  value={name}
                  disabled={action.isPending}
                  onChange={(e) => setName(e.target.value)}
                />
                <Button
                  type="submit"
                  disabled={
                    !name.trim() ||
                    name.trim() === chat.name ||
                    action.isPending
                  }
                >
                  Save
                </Button>
              </div>
            </form>
          ) : null}
          <SharedContentSection chatId={chat.id} />
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">Members</h3>
            {isOwner && (
              <Button
                size="sm"
                disabled={action.isPending || chat.participants.length >= 100}
                onClick={() => {
                  action.reset();
                  setAdding(true);
                }}
              >
                <UserPlus />
                Add members
              </Button>
            )}
          </div>
          <ul className="max-h-72 space-y-1 overflow-y-auto">
            {[...chat.participants]
              .sort(
                (a, b) =>
                  Number(b.role === "OWNER") - Number(a.role === "OWNER") ||
                  a.id - b.id,
              )
              .map((p) => (
                <li
                  key={p.id}
                  className="flex flex-wrap items-center gap-3 rounded-xl border border-border p-3"
                >
                  <UserInfoDialog
                    userId={p.userId}
                    presenceChatId={chat.id}
                    label={`View profile of ${displayName(p.user)}`}
                    className="flex min-w-0 flex-1 items-center gap-3 rounded-lg text-left focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <IdentityAvatar
                      name={displayName(p.user)}
                      avatarId={p.user.profile?.avatarId}
                      className="size-9"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        {displayName(p.user)}
                        {p.userId === user?.id ? " (you)" : ""}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {p.role === "OWNER" ? (
                          <>
                            <Crown className="mr-1 inline size-3 text-brand" />
                            Owner
                          </>
                        ) : (
                          "Member"
                        )}
                      </p>
                      {p.userId !== user?.id && (
                        <p className="text-xs text-muted-foreground">
                          {formatPresence(status.users[p.userId], status.now)}
                        </p>
                      )}
                    </div>
                  </UserInfoDialog>
                  {isOwner && p.userId !== user?.id && (
                    <div className="flex w-full gap-1 pl-12">
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={action.isPending}
                        onClick={() => {
                          action.reset();
                          setConfirmation({
                            label: "Transfer ownership",
                            description: `Make ${displayName(p.user)} the owner? You’ll become a member and they will manage the group.`,
                            run: () => transferGroupOwner(chat.id, p.userId),
                          });
                        }}
                      >
                        Make owner
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive"
                        disabled={action.isPending}
                        onClick={() => {
                          action.reset();
                          setConfirmation({
                            label: "Remove member",
                            description: `Remove ${displayName(p.user)}? They will lose access to this conversation.`,
                            run: () => removeGroupMember(chat.id, p.userId),
                          });
                        }}
                      >
                        Remove
                      </Button>
                    </div>
                  )}
                </li>
              ))}
          </ul>
          <Button
            variant="outline"
            className="text-destructive"
            disabled={action.isPending}
            onClick={() => {
              action.reset();
              setConfirmation({
                label: "Leave group",
                description: `Leave ${chat.name}? You’ll need the owner to add you again.${isOwner ? (chat.participants.length > 1 ? " Ownership will pass to the earliest remaining member." : " You are the last member; this group will no longer be accessible.") : ""}`,
                leave: true,
                run: () => removeGroupMember(chat.id, user!.id),
              });
            }}
          >
            <LogOut />
            Leave group
          </Button>
        </>
      )}
      {confirmation && (
        <div
          className="space-y-3 rounded-xl border border-border bg-muted/60 p-4"
          role="alert"
        >
          <p className="text-sm leading-6">{confirmation.description}</p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              disabled={action.isPending}
              onClick={() => setConfirmation(undefined)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={action.isPending}
              onClick={() => action.mutate(confirmation.run)}
            >
              {action.isPending ? "Updating…" : confirmation.label}
            </Button>
          </div>
        </div>
      )}
      {muteAction.isError && (
        <p role="alert" className="text-sm text-destructive">
          {errorMessage(muteAction.error)}
        </p>
      )}
      {action.isError && (
        <p role="alert" className="text-sm text-destructive">
          {errorMessage(action.error)}
        </p>
      )}
    </>
  );
}

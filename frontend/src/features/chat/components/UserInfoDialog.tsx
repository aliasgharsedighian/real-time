import { useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import {
  Bell,
  BellOff,
  Mail,
  MapPin,
  MessageCircle,
  Phone,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/shared/ui/dialog";
import { Button } from "@/shared/ui/button";
import { IdentityAvatar } from "@/shared/components/IdentityAvatar";
import { displayName } from "@/shared/lib/types";
import { errorMessage } from "@/shared/lib/api";
import { useSessionStore } from "@/features/auth/session-store";
import { useSession } from "@/features/auth/session-context";
import { CallButton } from "@/features/calls/CallButton";
import { chatKeys, createChat, getUserProfile, muteChat } from "../api";
import { useChatList } from "../hooks/use-chat-list";
import { ChatStatus } from "./ChatStatus";
import { SharedContentSection } from "./SharedContentSection";

export function UserInfoDialog({
  userId,
  children,
  className,
  label,
  presenceChatId,
}: {
  userId: number;
  children: ReactNode;
  className?: string;
  label?: string;
  presenceChatId?: number;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        className={
          className ??
          "text-left font-medium text-brand hover:underline focus-visible:ring-2 focus-visible:ring-ring"
        }
        aria-label={label}
        disabled={userId <= 0}
        onClick={() => setOpen(true)}
      >
        {children}
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto rounded-2xl p-0">
          <DialogHeader className="px-6 pt-6">
            <DialogTitle>User info</DialogTitle>
            <DialogDescription>
              Profile and shared conversation
            </DialogDescription>
          </DialogHeader>
          {open && (
            <UserInfo
              userId={userId}
              presenceChatId={presenceChatId}
              onClose={() => setOpen(false)}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
function UserInfo({
  userId,
  presenceChatId,
  onClose,
}: {
  userId: number;
  onClose: () => void;
  presenceChatId?: number;
}) {
  const identity = useSessionStore((s) => s.tokens?.refreshToken);
  const { user: ownUser } = useSession();
  const profile = useQuery({
    queryKey: ["user-profile", identity, userId],
    queryFn: ({ signal }) => getUserProfile(userId, signal),
    retry: false,
  });
  const chats = useChatList();
  const direct = chats.data?.find(
    (chat) =>
      !chat.isGroup && chat.participants.some((p) => p.userId === userId),
  );
  const cache = useQueryClient();
  const navigate = useNavigate();
  const action = useMutation({
    mutationFn: (run: () => Promise<unknown>) => run(),
  });
  if (profile.isPending)
    return (
      <p role="status" className="p-6">
        Loading profile…
      </p>
    );
  if (profile.isError)
    return (
      <div role="alert" className="p-6 text-sm">
        {errorMessage(profile.error)}
        <Button variant="link" onClick={() => void profile.refetch()}>
          Retry profile
        </Button>
      </div>
    );
  const user = profile.data;
  return (
    <div className="space-y-5 pb-6">
      <div className="flex flex-col items-center gap-3 bg-muted/40 px-6 py-5">
        <IdentityAvatar
          avatarId={user.profile?.avatarId}
          name={displayName(user)}
          className="size-24 text-3xl"
        />
        <h2
          dir="auto"
          className="break-words text-center text-xl font-semibold"
        >
          {displayName(user)}
        </h2>
        {(direct || presenceChatId) && (
          <ChatStatus chatId={direct?.id ?? presenceChatId!} peerId={userId} />
        )}
        {ownUser?.id !== userId && (
          <div className="flex items-center justify-center gap-2">
            <Button
              variant="secondary"
              disabled={action.isPending}
              onClick={() =>
                action.mutate(async () => {
                  const chat = direct ?? (await createChat([userId]));
                  await cache.invalidateQueries({
                    queryKey: chatKeys.list(identity),
                  });
                  onClose();
                  navigate(`/dashboard/websocket/${chat.id}`);
                })
              }
            >
              <MessageCircle />
              Message
            </Button>
            {direct && (
              <>
                <Button
                  variant="secondary"
                  disabled={action.isPending}
                  onClick={() =>
                    action.mutate(async () => {
                      await muteChat(direct.id, !direct.muted);
                      await cache.invalidateQueries({
                        queryKey: chatKeys.list(identity),
                      });
                    })
                  }
                >
                  {direct.muted ? <Bell /> : <BellOff />}
                  {direct.muted ? "Unmute" : "Mute"}
                </Button>
                <CallButton chatId={direct.id} />
              </>
            )}
          </div>
        )}
      </div>
      <dl className="space-y-4 px-6 text-sm">
        {user.phoneNumber && (
          <div className="flex items-start gap-3">
            <Phone className="size-4 text-muted-foreground" />
            <div>
              <dd dir="ltr">{user.phoneNumber}</dd>
              <dt className="mt-1 text-xs text-muted-foreground">Mobile</dt>
            </div>
          </div>
        )}
        {user.email && (
          <div className="flex items-start gap-3">
            <Mail className="size-4 text-muted-foreground" />
            <div className="min-w-0">
              <dd className="break-all">{user.email}</dd>
              <dt className="mt-1 text-xs text-muted-foreground">Email</dt>
            </div>
          </div>
        )}
        {user.profile?.address && (
          <div className="flex items-start gap-3">
            <MapPin className="size-4 text-muted-foreground" />
            <div className="min-w-0">
              <dd dir="auto" className="whitespace-pre-wrap break-words">
                {user.profile.address}
              </dd>
              <dt className="mt-1 text-xs text-muted-foreground">Address</dt>
            </div>
          </div>
        )}
      </dl>
      {action.isError && (
        <p role="alert" className="px-6 text-sm text-destructive">
          {errorMessage(action.error)}
        </p>
      )}
      {direct && (
        <div className="px-3">
          <SharedContentSection chatId={direct.id} />
        </div>
      )}
    </div>
  );
}

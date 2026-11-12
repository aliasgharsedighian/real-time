import {
  useEffect,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { Link, useMatch, useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { Phone, PhoneOff, Video } from "lucide-react";
import { toast } from "sonner";
import { useSession } from "@/features/auth/session-context";
import { getSocket } from "@/features/chat/socket";
import { useChatList } from "@/features/chat/hooks/use-chat-list";
import { CallRing } from "./CallRing";
import { displayName } from "@/shared/lib/types";
import { IdentityAvatar } from "@/shared/components/IdentityAvatar";
import { Button } from "@/shared/ui/button";
import { CallController } from "./controller";
import { CallContext } from "./context";

export default function CallProvider({ children }: { children: ReactNode }) {
  const { user } = useSession();
  const userId = user!.id;
  const controller = useMemo(
    () => new CallController(getSocket(), userId),
    [userId],
  );
  const view = useSyncExternalStore(controller.subscribe, controller.snapshot);
  const navigate = useNavigate();
  const onCallPage = useMatch("/dashboard/calls/active");
  const cache = useQueryClient();
  const chats = useChatList();
  const incomingPeer = chats.data
    ?.find((c) => c.id === view.incoming?.chatId)
    ?.participants.find((p) => p.userId !== user?.id)?.user;
  useEffect(() => {
    controller.attach();
    return () => controller.dispose();
  }, [controller]);
  useEffect(() => {
    const socket = getSocket();
    const refresh = () => {
      void cache.invalidateQueries({ queryKey: ["calls"] });
    };
    socket.on("call:updated", refresh);
    return () => {
      socket.off("call:updated", refresh);
    };
  }, [cache]);
  const active = ["preparing", "ringing", "connecting", "active"].includes(
    view.phase,
  );
  return (
    <CallContext value={{ controller, view }}>
      {children}
      {view.incoming && (
        <section
          aria-label="Incoming call"
          role="alert"
          className="brand-panel fixed inset-x-3 top-4 z-50 mx-auto max-w-sm rounded-2xl p-5 shadow-2xl"
        >
          <CallRing sound="incomingCall" />
          <div className="flex items-center gap-3">
            <IdentityAvatar
              avatarId={incomingPeer?.profile?.avatarId}
              name={displayName(incomingPeer)}
              className="size-14"
            />
            <div className="min-w-0">
              <p className="truncate font-semibold">
                {incomingPeer ? displayName(incomingPeer) : "Incoming call"}
              </p>
              <p className="text-sm text-brand">
                Incoming {view.incoming.mode} call
              </p>
            </div>
            {view.incoming.mode === "video" ? (
              <Video className="ml-auto text-brand" />
            ) : (
              <Phone className="ml-auto text-brand" />
            )}
          </div>
          <div className="mt-5 flex gap-3">
            <Button
              variant="destructive"
              className="flex-1"
              onClick={() => {
                void controller
                  .reject()
                  .catch((error: Error) => toast.error(error.message));
              }}
            >
              <PhoneOff />
              Decline
            </Button>
            <Button
              className="brand-cta flex-1"
              onClick={() => {
                navigate("/dashboard/calls/active");
                void controller.accept();
              }}
            >
              <Phone />
              Accept
            </Button>
          </div>
        </section>
      )}
      {active && !onCallPage && (
        <Link
          to="/dashboard/calls/active"
          className="brand-cta fixed bottom-5 left-1/2 z-40 flex -translate-x-1/2 items-center gap-2 rounded-full px-5 py-3 text-sm font-semibold shadow-xl"
        >
          <Phone className="size-4" />
          Return to {view.mode} call
        </Link>
      )}
    </CallContext>
  );
}

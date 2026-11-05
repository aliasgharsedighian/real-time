import { clearNotificationSession } from "@/features/notifications/browser-push";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { IdentityAvatar } from "@/shared/components/IdentityAvatar";
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/ui/popover";
import { Button } from "@/shared/ui/button";
import { api } from "@/shared/lib/api";
import { displayName } from "@/shared/lib/types";
import { disconnectSocket } from "@/features/chat/socket";
import { useSession } from "../session-context";
import { useSessionStore } from "../session-store";

export default function UserButton() {
  const { user } = useSession();
  const cache = useQueryClient();
  const navigate = useNavigate();
  const [pending, setPending] = useState(false);
  const name = displayName(user);
  async function logout() {
    setPending(true);
    try {
      await clearNotificationSession();
      await api.post("auth/logout");
    } catch {
      toast.info("Signed out on this device. The server could not be reached.");
    } finally {
      disconnectSocket();
      await cache.cancelQueries();
      cache.clear();
      useSessionStore.getState().clear();
      navigate("/", { replace: true });
    }
  }
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Account"
          className="rounded-full"
        >
          <IdentityAvatar
            avatarId={user?.profile?.avatarId}
            name={name}
            className="size-9"
          />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-3">
        <Link
          to="/dashboard/profile"
          className="mb-3 flex flex-col border-b pb-3"
        >
          <span className="font-semibold">{name}</span>
          <span className="text-sm text-muted-foreground">{user?.email}</span>
          <span className="mt-2 text-sm text-brand">Edit profile</span>
        </Link>
        <Button
          variant="outline"
          className="w-full"
          disabled={pending}
          onClick={() => void logout()}
        >
          Logout
        </Button>
      </PopoverContent>
    </Popover>
  );
}

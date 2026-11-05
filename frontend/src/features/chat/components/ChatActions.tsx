import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Bell, BellOff, MoreHorizontal, Trash2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog";
import { Button } from "@/shared/ui/button";
import { errorMessage } from "@/shared/lib/api";
import { deleteChat, muteChat } from "../api";
import type { Chat } from "../types";

export function ConfirmDelete({
  open,
  onClose,
  onConfirm,
  description,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  description: string;
}) {
  const [busy, setBusy] = useState(false);
  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (!value && !busy) onClose();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete permanently?</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" disabled={busy} onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await onConfirm();
                onClose();
              } catch (error) {
                toast.error(errorMessage(error));
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy ? "Deleting…" : "Delete"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export interface MenuAction {
  label: string;
  icon: ReactNode;
  run: () => void;
  destructive?: boolean;
}
export function ActionMenu({
  position,
  actions,
  onClose,
}: {
  position: { x: number; y: number };
  actions: MenuAction[];
  onClose: () => void;
}) {
  const menu = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    menu.current?.querySelector("button")?.focus();
    return () => previous?.focus();
  }, []);
  return createPortal(
    <div
      className="fixed inset-0 z-50"
      onPointerDown={onClose}
      onContextMenu={(event) => {
        event.preventDefault();
        onClose();
      }}
    >
      <div
        ref={menu}
        role="menu"
        aria-label="Chat actions"
        style={{
          left: Math.max(8, Math.min(position.x, window.innerWidth - 224)),
          top: Math.max(
            8,
            Math.min(position.y, window.innerHeight - actions.length * 44 - 20),
          ),
        }}
        className="absolute w-52 rounded-xl border border-border bg-popover p-1.5 shadow-xl"
        onPointerDown={(event) => event.stopPropagation()}
        onKeyDown={(event) => {
          if (event.key === "Escape" || event.key === "Tab") {
            onClose();
            return;
          }
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            const items = [...(menu.current?.querySelectorAll("button") ?? [])];
            const i = items.indexOf(
              document.activeElement as HTMLButtonElement,
            );
            items[
              (i + (event.key === "ArrowDown" ? 1 : items.length - 1)) %
                items.length
            ]?.focus();
          }
        }}
      >
        {actions.map((action) => (
          <button
            key={action.label}
            role="menuitem"
            type="button"
            className={`flex min-h-11 w-full items-center gap-3 rounded-lg px-3 text-sm hover:bg-muted focus:bg-muted focus:outline-none ${action.destructive ? "text-destructive" : ""}`}
            onClick={() => {
              onClose();
              action.run();
            }}
          >
            {action.icon}
            {action.label}
          </button>
        ))}
      </div>
    </div>,
    document.body,
  );
}

export function ConversationActions({
  chat,
  children,
}: {
  chat: Chat;
  children: ReactNode;
}) {
  const [position, setPosition] = useState<{ x: number; y: number }>();
  const [swiped, setSwiped] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const start = useRef<{ x: number; y: number } | null>(null);
  const suppressClick = useRef(false);
  const cache = useQueryClient();
  const navigate = useNavigate();
  const canDelete = !chat.isGroup || chat.myRole === "OWNER";
  async function toggleMute() {
    setBusy(true);
    try {
      await muteChat(chat.id, !chat.muted);
      await cache.invalidateQueries({ queryKey: ["chats"] });
      setSwiped(false);
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div
      className="relative overflow-hidden rounded-2xl"
      onContextMenu={(event) => {
        event.preventDefault();
        setPosition({ x: event.clientX, y: event.clientY });
      }}
    >
      <div className="absolute inset-y-0 right-0 flex items-stretch gap-1 p-1">
        <Button
          tabIndex={swiped ? 0 : -1}
          className="h-full w-16 flex-col gap-1 bg-amber-500 text-white hover:bg-amber-600"
          disabled={busy}
          onClick={() => void toggleMute()}
        >
          {chat.muted ? <Bell /> : <BellOff />}
          <span className="text-xs">{chat.muted ? "Unmute" : "Mute"}</span>
        </Button>
        {canDelete && (
          <Button
            tabIndex={swiped ? 0 : -1}
            variant="destructive"
            className="h-full w-16 flex-col gap-1"
            onClick={() => setConfirm(true)}
          >
            <Trash2 />
            <span className="text-xs">Delete</span>
          </Button>
        )}
      </div>
      <div
        className="relative bg-sidebar transition-transform [touch-action:pan-y]"
        style={{
          transform: swiped
            ? `translateX(-${canDelete ? 144 : 76}px)`
            : undefined,
        }}
        onPointerDown={(event) => {
          suppressClick.current = false;
          if (event.pointerType === "touch")
            start.current = { x: event.clientX, y: event.clientY };
        }}
        onPointerUp={(event) => {
          const origin = start.current;
          start.current = null;
          if (
            origin &&
            Math.abs(event.clientX - origin.x) > 45 &&
            Math.abs(event.clientY - origin.y) < 30
          ) {
            suppressClick.current = true;
            setSwiped(event.clientX < origin.x);
          }
        }}
        onPointerCancel={() => {
          start.current = null;
        }}
        onClickCapture={(event) => {
          if (suppressClick.current || swiped) {
            event.preventDefault();
            event.stopPropagation();
            if (!suppressClick.current) setSwiped(false);
          }
        }}
      >
        {children}
        <button
          type="button"
          aria-label="Conversation actions"
          className="absolute right-2 bottom-1 rounded p-1 text-muted-foreground hover:bg-muted"
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            const box = event.currentTarget.getBoundingClientRect();
            setPosition({ x: box.left, y: box.bottom });
          }}
        >
          <MoreHorizontal className="size-4" />
        </button>
      </div>
      {position && (
        <ActionMenu
          position={position}
          onClose={() => setPosition(undefined)}
          actions={[
            {
              label: chat.muted ? "Unmute notifications" : "Mute notifications",
              icon: <BellOff className="size-4" />,
              run: () => void toggleMute(),
            },
            ...(canDelete
              ? [
                  {
                    label: chat.isGroup ? "Delete group" : "Delete chat",
                    icon: <Trash2 className="size-4" />,
                    destructive: true,
                    run: () => setConfirm(true),
                  },
                ]
              : []),
          ]}
        />
      )}
      <ConfirmDelete
        open={confirm}
        onClose={() => setConfirm(false)}
        description={
          chat.isGroup
            ? "This group, all messages and media will be removed for every member. This cannot be undone."
            : "This conversation, all messages and media will be removed for both people. This cannot be undone."
        }
        onConfirm={async () => {
          await deleteChat(chat.id);
          cache.removeQueries({
            queryKey: ["messages"],
            predicate: (query) => query.queryKey[2] === chat.id,
          });
          await cache.invalidateQueries({ queryKey: ["chats"] });
          for (const key of Object.keys(sessionStorage))
            if (key.startsWith("beam-draft:") && key.endsWith(`:${chat.id}`))
              sessionStorage.removeItem(key);
          if (window.location.pathname === `/dashboard/websocket/${chat.id}`)
            navigate("/dashboard", { replace: true });
        }}
      />
    </div>
  );
}

import { ConversationPreview } from "./ConversationPreview";
import { useHorizontalSwipe } from "../hooks/use-horizontal-swipe";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Bell, BellOff, Eye, MoreHorizontal, Trash2 } from "lucide-react";
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
  footer,
  header,
  headerOnly = false,
}: {
  position: { x: number; y: number };
  actions: MenuAction[];
  onClose: () => void;
  footer?: ReactNode;
  header?: ReactNode;
  headerOnly?: boolean;
}) {
  const menu = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const element = menu.current;
    element?.querySelector("button")?.focus({ preventScroll: true });
    return () => {
      // Reply/Edit may already have moved focus to the composer synchronously.
      // Restore the trigger only when dismissal leaves focus in the menu/body.
      const active = document.activeElement;
      if (
        previous?.isConnected &&
        (active === document.body || element?.contains(active))
      )
        previous.focus({ preventScroll: true });
    };
  }, []);
  const width = header ? Math.min(352, window.innerWidth - 16) : 208;
  const height = headerOnly
    ? 288
    : actions.length * 44 + (footer ? 64 : 0) + (header ? 68 : 16);
  return createPortal(
    <div
      data-message-menu
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
          width,
          left: Math.max(
            8,
            Math.min(position.x, window.innerWidth - width - 8),
          ),
          top: Math.max(
            8,
            Math.min(position.y, window.innerHeight - height - 8),
          ),
        }}
        className="absolute flex max-h-[calc(100dvh-16px)] flex-col gap-2"
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
        {header && <div className="shrink-0">{header}</div>}
        {!headerOnly && (
          <div className="w-52 max-w-full overflow-y-auto rounded-xl border border-border bg-popover p-1.5 shadow-xl">
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
            {footer && (
              <div className="mt-1 border-t border-border pt-1">{footer}</div>
            )}
          </div>
        )}
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
  const [preview, setPreview] = useState<"touch" | "menu">();
  const hold = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const start = useRef<{ x: number; y: number } | undefined>(undefined);
  const held = useRef(false);
  function cancelHold() {
    clearTimeout(hold.current);
    start.current = undefined;
  }
  useEffect(() => cancelHold, []);
  const [swiped, setSwiped] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const cache = useQueryClient();
  const navigate = useNavigate();
  const canDelete = !chat.isGroup || chat.myRole === "OWNER";
  const swipe = useHorizontalSwipe({
    restingOffset: swiped ? -(canDelete ? 144 : 76) : 0,
    minOffset: -(canDelete ? 144 : 76),
    maxOffset: 0,
    threshold: 45,
    enabled: !position && !confirm && !preview,
    onCommit: (direction) => setSwiped(direction === "left"),
  });
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
    <>
      <div
        className="relative overflow-hidden rounded-2xl"
        onContextMenu={(event) => {
          event.preventDefault();
          if (
            (event.nativeEvent as PointerEvent).pointerType === "touch" ||
            start.current ||
            held.current
          )
            return;
          setPosition({ x: event.clientX, y: event.clientY });
        }}
      >
        <div
          aria-hidden={!swiped}
          className={`absolute inset-y-0 right-0 flex items-stretch gap-1 p-1 ${swiped ? "" : "pointer-events-none"}`}
        >
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
          className={`relative bg-sidebar [touch-action:pan-y] ${swipe.dragging ? "transition-none" : "transition-transform duration-200 ease-out motion-reduce:transition-none"}`}
          style={{ transform: `translateX(${swipe.offset}px)` }}
          {...swipe.handlers}
          onPointerDown={(event) => {
            swipe.handlers.onPointerDown(event);
            held.current = false;
            cancelHold();
            if (
              event.pointerType !== "touch" ||
              event.isPrimary === false ||
              swiped ||
              position ||
              confirm ||
              preview ||
              (event.target as HTMLElement).closest("button")
            )
              return;
            start.current = { x: event.clientX, y: event.clientY };
            hold.current = setTimeout(() => {
              held.current = true;
              setPreview("touch");
            }, 500);
          }}
          onPointerMove={(event) => {
            swipe.handlers.onPointerMove(event);
            if (
              start.current &&
              Math.hypot(
                event.clientX - start.current.x,
                event.clientY - start.current.y,
              ) > 8
            )
              cancelHold();
          }}
          onPointerUp={(event) => {
            cancelHold();
            swipe.handlers.onPointerUp(event);
          }}
          onPointerCancel={(event) => {
            cancelHold();
            swipe.handlers.onPointerCancel(event);
          }}
          onLostPointerCapture={(event) => {
            cancelHold();
            swipe.handlers.onLostPointerCapture(event);
          }}
          onClickCapture={(event) => {
            if (held.current || swipe.suppressClick.current || swiped) {
              event.preventDefault();
              event.stopPropagation();
              if (!swipe.suppressClick.current) setSwiped(false);
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
                label: "Preview message",
                icon: <Eye className="size-4" />,
                run: () => setPreview("menu"),
              },
              {
                label: chat.muted
                  ? "Unmute notifications"
                  : "Mute notifications",
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
      {preview && (
        <ConversationPreview
          chat={chat}
          onClose={() => setPreview(undefined)}
          actions={
            preview === "touch" ? (
              <>
                <Button
                  variant="ghost"
                  className="w-full justify-start"
                  disabled={busy}
                  onClick={() => void toggleMute()}
                >
                  {chat.muted ? <Bell /> : <BellOff />}
                  {chat.muted ? "Unmute" : "Mute"}
                </Button>
                {canDelete && (
                  <Button
                    variant="ghost"
                    className="w-full justify-start text-destructive"
                    onClick={() => {
                      setPreview(undefined);
                      setConfirm(true);
                    }}
                  >
                    <Trash2 />
                    Delete
                  </Button>
                )}
              </>
            ) : undefined
          }
        />
      )}
    </>
  );
}

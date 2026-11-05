import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  MoreHorizontal,
  Reply,
  Pencil,
  Forward,
  Trash2,
  CheckCircle,
  Copy,
} from "lucide-react";
import { toast } from "sonner";
import { MessageReaders } from "./MessageReaders";
import { ActionMenu } from "./ChatActions";
import { Button } from "@/shared/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog";
import { Input } from "@/shared/ui/input";
import { useChatList } from "../hooks/use-chat-list";
import { displayName } from "@/shared/lib/types";
import { errorMessage } from "@/shared/lib/api";
import type { Message } from "../types";

export function messageSummary(message: Message) {
  return (
    message.content ||
    (message.attachments?.[0]?.kind === "AUDIO"
      ? "Voice message"
      : message.attachments?.[0]?.kind === "VIDEO"
        ? "Video"
        : "Photo")
  );
}
export function MessageInteraction({
  message,
  own,
  canDelete,
  selecting,
  selected,
  onToggle,
  onReply,
  onEdit,
  onDelete,
  onForward,
  children,
}: {
  message: Message;
  own: boolean;
  canDelete: boolean;
  selecting: boolean;
  selected: boolean;
  onToggle: () => void;
  onReply: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onForward: () => void;
  children: ReactNode;
}) {
  const [position, setPosition] = useState<{ x: number; y: number }>();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const origin = useRef<{ x: number; y: number } | null>(null);
  const held = useRef(false);
  function cancel() {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  }
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );
  return (
    <div
      className={`group relative min-w-0 select-none rounded-2xl sm:select-text ${selected ? "ring-2 ring-primary bg-primary/10" : ""}`}
      onContextMenu={(event) => {
        event.preventDefault();
        if (!selecting) setPosition({ x: event.clientX, y: event.clientY });
      }}
      onPointerDown={(event) => {
        held.current = false;
        if (
          event.pointerType !== "touch" ||
          selecting ||
          (event.target as HTMLElement).closest("button,a,video,audio")
        )
          return;
        origin.current = { x: event.clientX, y: event.clientY };
        timer.current = setTimeout(() => {
          held.current = true;
          setPosition({ x: event.clientX, y: event.clientY });
        }, 1000);
      }}
      onPointerMove={(event) => {
        if (
          origin.current &&
          Math.hypot(
            event.clientX - origin.current.x,
            event.clientY - origin.current.y,
          ) > 10
        )
          cancel();
      }}
      onPointerUp={cancel}
      onPointerCancel={cancel}
      onClickCapture={(event) => {
        if ((event.target as HTMLElement).closest("[data-message-menu]"))
          return;
        if (held.current || selecting) {
          event.preventDefault();
          event.stopPropagation();
          if (!held.current) onToggle();
        }
      }}
    >
      {selecting && (
        <button
          type="button"
          aria-label={`Select message ${message.id}`}
          aria-pressed={selected}
          className="absolute -left-8 top-3 grid size-6 place-items-center rounded-full border border-primary bg-card text-brand"
        >
          {selected && <CheckCircle className="size-5" />}
        </button>
      )}
      {children}
      {!selecting && (
        <button
          type="button"
          aria-label={`Message actions ${message.id}`}
          className="absolute -right-1 -top-3 rounded-full border border-border bg-card p-1 text-muted-foreground opacity-0 focus:opacity-100 group-hover:opacity-100 [@media(hover:none)]:opacity-70"
          onClick={(event) => {
            const rect = event.currentTarget.getBoundingClientRect();
            setPosition({ x: rect.left, y: rect.bottom });
          }}
        >
          <MoreHorizontal className="size-4" />
        </button>
      )}
      {position && (
        <ActionMenu
          position={position}
          onClose={() => setPosition(undefined)}
          footer={own ? <MessageReaders message={message} /> : undefined}
          actions={[
            {
              label: "Reply",
              icon: <Reply className="size-4" />,
              run: onReply,
            },
            ...(own
              ? [
                  {
                    label: "Edit",
                    icon: <Pencil className="size-4" />,
                    run: onEdit,
                  },
                ]
              : []),
            ...(message.content
              ? [
                  {
                    label: "Copy text",
                    icon: <Copy className="size-4" />,
                    run: () => {
                      void navigator.clipboard
                        .writeText(message.content)
                        .catch(() => toast.error("Could not copy text."));
                    },
                  },
                ]
              : []),
            {
              label: "Forward",
              icon: <Forward className="size-4" />,
              run: onForward,
            },
            ...(canDelete
              ? [
                  {
                    label: "Delete",
                    icon: <Trash2 className="size-4" />,
                    destructive: true,
                    run: onDelete,
                  },
                ]
              : []),
            {
              label: "Select",
              icon: <CheckCircle className="size-4" />,
              run: onToggle,
            },
          ]}
        />
      )}
    </div>
  );
}

export function ForwardDialog({
  open,
  count,
  onClose,
  onForward,
}: {
  open: boolean;
  count: number;
  onClose: () => void;
  onForward: (id: number) => Promise<void>;
}) {
  const chats = useChatList();
  const [query, setQuery] = useState("");
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
          <DialogTitle>
            Forward {count} message{count === 1 ? "" : "s"}
          </DialogTitle>
          <DialogDescription>Choose a conversation or group.</DialogDescription>
        </DialogHeader>
        <Input
          aria-label="Search forwarding destination"
          placeholder="Search conversations"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <div className="max-h-80 space-y-1 overflow-y-auto">
          {chats.isPending && <p role="status">Loading conversations…</p>}
          {chats.isError && (
            <Button onClick={() => void chats.refetch()}>
              Retry conversations
            </Button>
          )}
          {chats.data
            ?.filter((chat) =>
              (chat.isGroup
                ? chat.name || "Group"
                : displayName(chat.participants[0]?.user)
              )
                .toLocaleLowerCase()
                .includes(query.toLocaleLowerCase()),
            )
            .map((chat) => (
              <Button
                key={chat.id}
                variant="ghost"
                className="w-full justify-start"
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  try {
                    await onForward(chat.id);
                    onClose();
                  } catch (error) {
                    toast.error(errorMessage(error));
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                {chat.isGroup
                  ? chat.name || "Group"
                  : displayName(chat.participants[0]?.user)}
              </Button>
            ))}
          {chats.isSuccess && !chats.data?.length && (
            <p className="text-sm text-muted-foreground">
              Start a conversation to forward messages to it.
            </p>
          )}
        </div>
        {busy && <p role="status">Forwarding…</p>}
      </DialogContent>
    </Dialog>
  );
}

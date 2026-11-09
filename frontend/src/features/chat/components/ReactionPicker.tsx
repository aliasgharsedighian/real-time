import { ChevronDown, ChevronUp } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { IdentityAvatar } from "@/shared/components/IdentityAvatar";
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/ui/popover";
import type { Reaction } from "../types";

const quick = [
  ["👍", "Like"],
  ["❤️", "Heart"],
  ["👎", "Dislike"],
  ["🤣", "Laugh"],
  ["🙏", "Thanks"],
  ["😍", "Heart eyes"],
] as const;

const more = [
  "😂",
  "😁",
  "😊",
  "🥰",
  "😎",
  "😇",
  "😈",
  "😉",
  "🔥",
  "🎉",
  "👏",
  "🙌",
  "🤝",
  "👌",
  "✌️",
  "💯",
  "🤔",
  "🤯",
  "😱",
  "😮",
  "😢",
  "😭",
  "😡",
  "😒",
  "🙄",
  "🤨",
  "😐",
  "😴",
  "🤫",
  "🫡",
  "🤗",
  "🥹",
  "💔",
  "❤️‍🔥",
  "💋",
  "💖",
  "✨",
  "⚡",
  "🏆",
  "🎊",
  "👀",
  "💀",
  "👻",
  "🤡",
  "💩",
  "🐳",
  "🍌",
  "🍾",
  "🤩",
  "🤪",
  "🤓",
  "😅",
  "😬",
  "🤦",
  "🤷",
  "🕊️",
];

export function ReactionPicker({
  selected,
  expanded,
  onExpand,
  onPick,
}: {
  selected?: string;
  expanded: boolean;
  onExpand: () => void;
  onPick: (emoji: string) => void;
}) {
  const emojis: ReadonlyArray<readonly [string, string]> = expanded
    ? [...quick, ...more.map((emoji) => [emoji, emoji] as const)]
    : quick;
  const Chevron = expanded ? ChevronUp : ChevronDown;
  return (
    <div
      className={`rounded-3xl border border-border bg-popover p-1.5 shadow-xl ${expanded ? "" : "flex items-center gap-1"}`}
    >
      <div
        className={
          expanded
            ? "grid max-h-[min(15rem,50dvh)] grid-cols-7 gap-0.5 overflow-y-auto"
            : "grid flex-1 grid-cols-6 gap-0.5"
        }
      >
        {emojis.map(([emoji, label]) => (
          <button
            type="button"
            role="menuitemradio"
            aria-checked={selected === emoji}
            aria-label={label}
            title={label}
            key={emoji}
            className={`grid h-10 min-w-0 place-items-center rounded-xl text-2xl leading-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring ${selected === emoji ? "bg-primary/15" : ""}`}
            onClick={() => onPick(emoji)}
          >
            {emoji}
          </button>
        ))}
      </div>
      <button
        type="button"
        role="menuitem"
        aria-label={expanded ? "Fewer reactions" : "More reactions"}
        aria-expanded={expanded}
        onClick={onExpand}
        className={`grid place-items-center text-muted-foreground hover:text-foreground ${expanded ? "mt-1 h-8 w-full rounded-xl hover:bg-muted" : "h-10 w-[14%] rounded-full bg-muted"}`}
      >
        <Chevron className="size-5" />
      </button>
    </div>
  );
}

export function ReactionChips({
  reactions,
  selected,
  selecting,
  onPick,
}: {
  reactions?: Reaction[];
  selected?: string;
  selecting: boolean;
  onPick: (emoji: string) => void;
}) {
  if (!reactions?.length) return null;
  const groups = new Map<string, Reaction[]>();
  for (const reaction of reactions) {
    const group = groups.get(reaction.emoji);
    if (group) group.push(reaction);
    else groups.set(reaction.emoji, [reaction]);
  }
  return (
    <div
      className="flex min-w-0 flex-wrap gap-1"
      aria-label="Message reactions"
    >
      {[...groups].map(([emoji, reactors]) => (
        <ReactionChip
          key={emoji}
          emoji={emoji}
          reactors={reactors}
          selected={selected === emoji}
          selecting={selecting}
          onPick={onPick}
        />
      ))}
    </div>
  );
}

function ReactionChip({
  emoji,
  reactors,
  selected,
  selecting,
  onPick,
}: {
  emoji: string;
  reactors: Reaction[];
  selected: boolean;
  selecting: boolean;
  onPick: (emoji: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const press = useRef<{
    pointerId: number;
    x: number;
    y: number;
    timer: ReturnType<typeof setTimeout>;
  } | null>(null);
  const suppressClick = useRef(false);
  const count = reactors.length;

  function cancelPress() {
    if (press.current) clearTimeout(press.current.timer);
    press.current = null;
  }
  useEffect(
    () => () => {
      if (press.current) clearTimeout(press.current.timer);
    },
    [],
  );

  return (
    <Popover open={open && !selecting} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`${emoji} ${count} ${count === 1 ? "reaction" : "reactions"}`}
          aria-pressed={selected}
          className={`inline-flex min-h-8 select-none items-center gap-1 rounded-full border px-2 text-xs tabular-nums transition-colors focus-visible:ring-2 focus-visible:ring-ring [-webkit-touch-callout:none] ${selected ? "border-primary/50 bg-primary/20 text-brand" : "border-border bg-background/60 text-muted-foreground hover:bg-muted"}`}
          onContextMenu={(event) => {
            event.preventDefault();
            event.stopPropagation();
            if (selecting) return;
            if (press.current) suppressClick.current = true;
            cancelPress();
            setOpen(true);
          }}
          onPointerDown={(event) => {
            if (event.isPrimary === false) return;
            suppressClick.current = false;
            cancelPress();
            if (selecting || event.pointerType !== "touch") return;
            press.current = {
              pointerId: event.pointerId,
              x: event.clientX,
              y: event.clientY,
              timer: setTimeout(() => {
                suppressClick.current = true;
                setOpen(true);
              }, 500),
            };
          }}
          onPointerMove={(event) => {
            const start = press.current;
            if (
              start?.pointerId === event.pointerId &&
              Math.hypot(event.clientX - start.x, event.clientY - start.y) > 10
            ) {
              suppressClick.current = true;
              cancelPress();
            }
          }}
          onPointerUp={cancelPress}
          onPointerCancel={cancelPress}
          onLostPointerCapture={cancelPress}
          onKeyDown={(event) => {
            suppressClick.current = false;
            if (
              event.key === "ContextMenu" ||
              (event.shiftKey && event.key === "F10")
            ) {
              event.preventDefault();
              if (!selecting) setOpen(true);
            }
          }}
          onClick={(event) => {
            event.preventDefault();
            if (selecting || suppressClick.current) return;
            setOpen(false);
            onPick(emoji);
          }}
        >
          <span className="text-base leading-none">{emoji}</span>
          {count}
        </button>
      </PopoverTrigger>
      <PopoverContent
        aria-label={`Reactions for ${emoji}`}
        sideOffset={6}
        collisionPadding={8}
        data-message-menu
        className="w-56 max-w-[calc(100vw-1rem)] p-1.5"
        onContextMenu={(event) => {
          event.preventDefault();
          event.stopPropagation();
        }}
        onPointerDown={(event) => event.stopPropagation()}
      >
        <ul className="max-h-[min(16rem,50dvh,var(--radix-popover-content-available-height))] overflow-y-auto overscroll-contain">
          {reactors.map(({ userId, user }) => {
            const name =
              [user?.profile?.firstname, user?.profile?.lastname]
                .filter(Boolean)
                .join(" ") || user?.email || `User #${userId}`;
            return (
              <li key={userId} className="flex items-center gap-2.5 px-2 py-1.5">
                <IdentityAvatar
                  name={name}
                  avatarId={user?.profile?.avatarId}
                  className="size-8 shrink-0"
                />
                <span
                  className="min-w-0 flex-1 truncate text-sm"
                  title={name}
                  dir="auto"
                >
                  {name}
                </span>
                <span aria-hidden="true">{emoji}</span>
              </li>
            );
          })}
        </ul>
      </PopoverContent>
    </Popover>
  );
}

import { ChevronDown, ChevronUp } from "lucide-react";

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
  onPick,
}: {
  reactions?: { emoji: string }[];
  selected?: string;
  onPick: (emoji: string) => void;
}) {
  if (!reactions?.length) return null;
  const counts = new Map<string, number>();
  for (const { emoji } of reactions)
    counts.set(emoji, (counts.get(emoji) ?? 0) + 1);
  return (
    <div
      className="flex min-w-0 flex-wrap gap-1"
      aria-label="Message reactions"
    >
      {[...counts].map(([emoji, count]) => (
        <button
          type="button"
          key={emoji}
          aria-label={`${emoji} ${count} ${count === 1 ? "reaction" : "reactions"}`}
          aria-pressed={selected === emoji}
          onClick={() => onPick(emoji)}
          className={`inline-flex min-h-8 items-center gap-1 rounded-full border px-2 text-xs tabular-nums transition-colors focus-visible:ring-2 focus-visible:ring-ring ${selected === emoji ? "border-primary/50 bg-primary/20 text-brand" : "border-border bg-background/60 text-muted-foreground hover:bg-muted"}`}
        >
          <span className="text-base leading-none">{emoji}</span>
          {count}
        </button>
      ))}
    </div>
  );
}

import { useEffect, useRef, useState } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { Search, X, ArrowUpRight } from "lucide-react";
import { useSessionStore } from "@/features/auth/session-store";
import { IdentityAvatar } from "@/shared/components/IdentityAvatar";
import { BrandLoading } from "@/shared/components/BrandLoading";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { displayName } from "@/shared/lib/types";
import { errorMessage } from "@/shared/lib/api";
import { formatDateBasedOnToday } from "@/shared/lib/date";
import { searchMessages } from "../api";
import { useMessageSearch } from "../message-search-context";

function Highlight({ text, term }: { text: string; term: string }) {
  const parts = text.split(
    new RegExp(`(${term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "ig"),
  );
  return (
    <>
      {parts.map((part, index) =>
        index % 2 ? (
          <mark key={index} className="rounded-sm bg-brand/15 text-brand">
            {part}
          </mark>
        ) : (
          part
        ),
      )}
    </>
  );
}

export function MessageSearchPanel({
  chatId,
  title,
  selectedId,
  onSelect,
}: {
  chatId: number;
  title: string;
  selectedId?: number;
  onSelect: (id: number) => Promise<void>;
}) {
  const { setOpen } = useMessageSearch();
  const identity = useSessionStore((s) => s.tokens?.refreshToken);
  const [input, setInput] = useState("");
  const [term, setTerm] = useState("");
  const [selecting, setSelecting] = useState<number>();
  const [selectionError, setSelectionError] = useState("");
  const field = useRef<HTMLInputElement>(null);
  const composing = useRef(false);
  const generation = useRef(0);
  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
    field.current?.focus({ preventScroll: true });
    return () => {
      mounted.current = false;
      document
        .querySelector<HTMLButtonElement>(
          '[aria-controls="message-search-panel"]',
        )
        ?.focus({ preventScroll: true });
    };
  }, []);
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!composing.current) setTerm(input.trim());
    }, 350);
    return () => clearTimeout(timer);
  }, [input]);
  const valid = /[\p{L}\p{N}]{3}/u.test(term) && term.length <= 100;
  const settled = input.trim() === term;
  const results = useInfiniteQuery({
    queryKey: ["message-search", identity, chatId, term],
    queryFn: ({ pageParam, signal }) =>
      searchMessages(chatId, term, pageParam, signal),
    initialPageParam: undefined as number | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    enabled: valid,
    staleTime: 15_000,
    gcTime: 60_000,
    retry: false,
    refetchOnWindowFocus: false,
  });
  const messages = results.data?.pages.flatMap((p) => p.messages) ?? [];
  return (
    <aside
      id="message-search-panel"
      aria-label="Search messages"
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.stopPropagation();
          setOpen(false);
        }
      }}
      className="absolute inset-0 z-20 flex min-h-0 flex-col border-l border-border bg-card lg:static lg:w-80 lg:shrink-0 xl:w-96"
    >
      <div className="shrink-0 space-y-3 border-b border-border p-4">
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-semibold">Search messages</h2>
          <Button
            variant="ghost"
            size="icon"
            className="size-9"
            aria-label="Close message search"
            onClick={() => setOpen(false)}
          >
            <X />
          </Button>
        </div>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-3 size-4 text-muted-foreground" />
          <Input
            ref={field}
            aria-label="Search message text"
            placeholder="Search in this conversation…"
            dir="auto"
            maxLength={100}
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onCompositionStart={() => {
              composing.current = true;
            }}
            onCompositionEnd={(event) => {
              composing.current = false;
              setInput(event.currentTarget.value);
              setTerm(event.currentTarget.value.trim());
            }}
            className="h-10 rounded-xl pl-9 pr-9"
          />
          {input && (
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-0 top-0 size-10"
              aria-label="Clear message search"
              onClick={() => {
                setInput("");
                setTerm("");
                field.current?.focus({ preventScroll: true });
              }}
            >
              <X className="size-4" />
            </Button>
          )}
        </div>
        <p className="truncate text-xs text-muted-foreground">
          Search messages in{" "}
          <span className="font-medium text-foreground">{title}</span>
        </p>
      </div>
      <div
        className="min-h-0 flex-1 overflow-y-auto"
        aria-busy={valid && results.isFetching}
      >
        {!valid ? (
          <div className="grid justify-items-center gap-3 px-6 py-16 text-center text-sm text-muted-foreground">
            <Search className="size-12 text-brand/50" />
            <p>Find a message in this conversation</p>
            <p className="text-xs">
              Enter at least 3 consecutive letters or numbers.
            </p>
          </div>
        ) : !settled || (results.isPending && !results.data) ? (
          <BrandLoading compact message="Searching messages…" />
        ) : results.isError && !results.data ? (
          <div className="space-y-2 p-4 text-center">
            <p role="alert" className="text-sm">
              {errorMessage(results.error)}
            </p>
            <Button variant="ghost" onClick={() => void results.refetch()}>
              Try again
            </Button>
          </div>
        ) : (
          <>
            <p
              role="status"
              className="border-b border-border/60 px-4 py-2 text-xs text-muted-foreground"
            >
              {messages.length
                ? `${messages.length}${results.hasNextPage ? "+" : ""} messages found`
                : "No matching messages"}
            </p>
            {messages.map((message) => (
              <button
                key={message.id}
                type="button"
                disabled={selecting !== undefined}
                aria-current={selectedId === message.id ? "true" : undefined}
                className={`flex w-full gap-3 border-b border-border/40 p-4 text-left transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring disabled:opacity-60 ${selectedId === message.id ? "bg-brand/10" : ""}`}
                onClick={async () => {
                  const attempt = ++generation.current;
                  setSelecting(message.id);
                  setSelectionError("");
                  try {
                    await onSelect(message.id);
                    if (
                      mounted.current &&
                      attempt === generation.current &&
                      window.matchMedia("(max-width: 1023px)").matches
                    )
                      setOpen(false);
                  } catch (error) {
                    if (mounted.current && attempt === generation.current)
                      setSelectionError(errorMessage(error));
                  } finally {
                    if (mounted.current && attempt === generation.current)
                      setSelecting(undefined);
                  }
                }}
              >
                <IdentityAvatar
                  avatarId={message.sender?.profile?.avatarId}
                  name={displayName(message.sender)}
                  className="size-10 shrink-0"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="truncate text-sm font-semibold">
                      {displayName(message.sender)}
                    </span>
                    <time
                      dateTime={message.createdAt}
                      className="shrink-0 text-[10px] text-muted-foreground"
                    >
                      {formatDateBasedOnToday(message.createdAt)}
                    </time>
                  </div>
                  <p
                    dir="auto"
                    className="mt-1 line-clamp-3 break-words text-sm leading-6 text-muted-foreground"
                  >
                    <Highlight text={message.content} term={term} />
                  </p>
                  {selecting === message.id && (
                    <span role="status" className="text-xs text-brand">
                      Opening message…
                    </span>
                  )}
                </div>
                <ArrowUpRight className="mt-1 size-3 shrink-0 text-muted-foreground" />
              </button>
            ))}
            {selectionError && (
              <p role="alert" className="p-4 text-sm text-destructive">
                {selectionError}
              </p>
            )}
            {results.hasNextPage && (
              <div className="p-3 text-center">
                {results.isFetchingNextPage ? (
                  <BrandLoading compact message="Loading more results…" />
                ) : (
                  <Button
                    variant="ghost"
                    onClick={() => void results.fetchNextPage()}
                  >
                    Load more results
                  </Button>
                )}
                {results.isFetchNextPageError && (
                  <p role="alert" className="mt-2 text-xs text-destructive">
                    Could not load more results. Try again.
                  </p>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </aside>
  );
}

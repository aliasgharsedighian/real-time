import { useState } from "react";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  Image,
  Video,
  Mic,
  Link as LinkIcon,
  ChevronRight,
} from "lucide-react";
import { useSessionStore } from "@/features/auth/session-store";
import { Media } from "@/features/uploads/Media";
import { Button } from "@/shared/ui/button";
import { errorMessage } from "@/shared/lib/api";
import { formatMessageTime } from "@/shared/lib/date";
import { getSharedContent, type SharedKind } from "../api";

const categories = [
  { kind: "IMAGE", label: "Photos", icon: Image },
  { kind: "VIDEO", label: "Videos", icon: Video },
  { kind: "LINK", label: "Link messages", icon: LinkIcon },
  { kind: "AUDIO", label: "Voice messages", icon: Mic },
] as const;
export function SharedContentSection({ chatId }: { chatId: number }) {
  const identity = useSessionStore((s) => s.tokens?.refreshToken);
  const [kind, setKind] = useState<SharedKind>();
  const counts = useQuery({
    queryKey: ["shared-content", identity, chatId, "counts"],
    queryFn: ({ signal }) =>
      getSharedContent(chatId, undefined, undefined, signal),
  });
  return (
    <section
      aria-label="Shared content"
      className="border-y border-border py-3"
    >
      {kind ? (
        <>
          <Button variant="ghost" onClick={() => setKind(undefined)}>
            <ArrowLeft />
            Shared content
          </Button>
          <SharedItems key={kind} chatId={chatId} kind={kind} />
        </>
      ) : (
        <>
          {counts.isPending && (
            <p role="status" className="p-3 text-sm text-muted-foreground">
              Loading shared content…
            </p>
          )}
          {counts.isError && (
            <div role="alert" className="p-3 text-sm">
              {errorMessage(counts.error)}
              <Button variant="link" onClick={() => void counts.refetch()}>
                Retry shared content
              </Button>
            </div>
          )}
          {counts.data &&
            categories.map(({ kind, label, icon: Icon }) => (
              <button
                key={kind}
                type="button"
                className="flex min-h-12 w-full items-center gap-4 rounded-xl px-3 text-left text-sm hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
                onClick={() => setKind(kind)}
              >
                <Icon className="size-5 text-muted-foreground" />
                <span className="flex-1">{label}</span>
                <span className="text-muted-foreground">
                  {counts.data.counts[kind]}
                </span>
                <ChevronRight className="size-4 text-muted-foreground" />
              </button>
            ))}
        </>
      )}
    </section>
  );
}
function SharedItems({ chatId, kind }: { chatId: number; kind: SharedKind }) {
  const identity = useSessionStore((s) => s.tokens?.refreshToken);
  const result = useInfiniteQuery({
    queryKey: ["shared-content", identity, chatId, kind],
    initialPageParam: undefined as number | undefined,
    queryFn: ({ pageParam, signal }) =>
      getSharedContent(chatId, kind, pageParam, signal),
    getNextPageParam: (page) => page.nextCursor ?? undefined,
  });
  const messages = result.data?.pages.flatMap((page) => page.messages) ?? [];
  return (
    <div className="space-y-3 pt-3">
      <h3 className="px-3 text-sm font-semibold">
        {categories.find((category) => category.kind === kind)?.label}
      </h3>
      {result.isPending && (
        <p role="status" className="p-3 text-sm">
          Loading…
        </p>
      )}
      {result.isError && (
        <div role="alert" className="text-sm">
          {errorMessage(result.error)}
          <Button variant="link" onClick={() => void result.refetch()}>
            Retry
          </Button>
        </div>
      )}
      {result.isSuccess && !messages.length && (
        <p className="p-3 text-sm text-muted-foreground">
          Nothing shared here yet.
        </p>
      )}
      {messages.map((message) => (
        <article
          key={message.id}
          className="space-y-2 rounded-xl border border-border bg-muted/30 p-3"
        >
          {kind === "LINK"
            ? [
                ...new Set(
                  message.content.match(/https?:\/\/[^\s<>]+/gi) ?? [],
                ),
              ].map((url) => (
                <a
                  key={url}
                  href={url}
                  target="_blank"
                  rel="noreferrer"
                  className="block break-all text-sm text-brand underline"
                >
                  {url}
                </a>
              ))
            : message.attachments
                ?.filter((file) => file.kind === kind)
                .map((file) => <Media key={file.id} file={file} />)}
          {message.content && kind !== "LINK" && (
            <p dir="auto" className="whitespace-pre-wrap break-words text-sm">
              {message.content}
            </p>
          )}
          <time
            dateTime={message.createdAt}
            className="block text-xs text-muted-foreground"
          >
            {new Date(message.createdAt).toLocaleDateString()} ·{" "}
            {formatMessageTime(message.createdAt)}
          </time>
        </article>
      ))}
      {result.hasNextPage && (
        <Button
          variant="outline"
          disabled={result.isFetchingNextPage}
          onClick={() => void result.fetchNextPage()}
        >
          {result.isFetchingNextPage ? "Loading…" : "Load more"}
        </Button>
      )}
    </div>
  );
}

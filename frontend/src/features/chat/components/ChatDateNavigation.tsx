import { useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { useSessionStore } from "@/features/auth/session-store";
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/ui/popover";
import { Button } from "@/shared/ui/button";
import { BrandLoading } from "@/shared/components/BrandLoading";
import { errorMessage } from "@/shared/lib/api";
import {
  formatMessageDay,
  localDateKey,
  localMonthRange,
} from "@/shared/lib/date";
import { getMessageDays } from "../api";

export function DaySeparator({ day }: { day: string }) {
  return (
    <div
      role="separator"
      aria-label={formatMessageDay(day)}
      className="my-5 flex items-center justify-center gap-3 text-xs"
    >
      <span className="h-px max-w-24 flex-1 bg-border/60" />
      <span className="rounded-full border border-border/60 bg-card/90 px-3 py-1.5 font-medium text-muted-foreground">
        <time dateTime={day}>{formatMessageDay(day)}</time>
      </span>
      <span className="h-px max-w-24 flex-1 bg-border/60" />
    </div>
  );
}

export function ChatDateNavigation({
  chatId,
  day,
  onSelect,
  disabled,
  visible = true,
}: {
  chatId: number;
  day: string;
  onSelect: (messageId: number) => Promise<void>;
  disabled?: boolean;
  visible?: boolean;
}) {
  const identity = useSessionStore((s) => s.tokens?.refreshToken);
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState(day.slice(0, 7));
  const [selecting, setSelecting] = useState(false);
  const [error, setError] = useState("");
  const generation = useRef(0);
  const range = useMemo(() => localMonthRange(month), [month]);
  const query = useQuery({
    queryKey: ["message-days", identity, chatId, range],
    queryFn: ({ signal }) => getMessageDays(chatId, range, signal),
    enabled: open,
    staleTime: 0,
    gcTime: 60_000,
    retry: false,
  });
  const available = new Map(
    query.data?.days.map((entry) => [entry.date, entry.messageId]),
  );
  const [year, monthIndex] = month.split("-").map(Number);
  const firstWeekday = new Date(year, monthIndex - 1, 1).getDay();
  const daysInMonth = new Date(year, monthIndex, 0).getDate();
  const cells = Array.from(
    { length: Math.ceil((firstWeekday + daysInMonth) / 7) * 7 },
    (_, index) => index - firstWeekday + 1,
  );
  function moveMonth(offset: number) {
    setMonth(
      localDateKey(new Date(year, monthIndex - 1 + offset, 1)).slice(0, 7),
    );
    setError("");
  }
  const shown = visible || open || selecting;
  return (
    <div
      inert={!shown}
      aria-hidden={!shown}
      className={`pointer-events-none absolute inset-x-0 top-2 z-10 flex justify-center transition-[opacity,transform] duration-300 ease-out motion-reduce:transition-none ${shown ? "translate-y-0 opacity-100" : "-translate-y-2 opacity-0"}`}
    >
      <Popover
        open={open}
        onOpenChange={(value) => {
          generation.current++;
          setSelecting(false);
          setError("");
          if (value) setMonth(day.slice(0, 7));
          setOpen(value);
        }}
      >
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            disabled={disabled}
            aria-label={`Jump to date, ${formatMessageDay(day)}`}
            className={`${shown ? "pointer-events-auto" : "pointer-events-none"} h-8 gap-2 rounded-full border border-border/20 bg-card/45 px-3 text-xs font-medium shadow-sm backdrop-blur-md hover:bg-card/65`}
          >
            <CalendarDays className="size-3.5 text-brand" />
            <time dateTime={day}>{formatMessageDay(day)}</time>
          </Button>
        </PopoverTrigger>
        <PopoverContent
          align="center"
          side="bottom"
          className="w-[min(320px,calc(100vw-24px))] rounded-2xl p-4"
          aria-label="Choose a message date"
        >
          <div className="mb-3 flex items-center justify-between gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="size-9 shrink-0"
              aria-label="Previous month"
              disabled={selecting || (year <= 1900 && monthIndex === 1)}
              onClick={() => moveMonth(-1)}
            >
              <ChevronLeft />
            </Button>
            <input
              type="month"
              aria-label="Calendar month"
              min="1900-01"
              max="9999-12"
              value={month}
              disabled={selecting}
              onChange={(event) => {
                if (
                  /^\d{4}-\d{2}$/.test(event.target.value) &&
                  event.target.validity.valid
                ) {
                  setMonth(event.target.value);
                  setError("");
                }
              }}
              className="min-w-0 flex-1 rounded-lg border border-border bg-background px-2 py-2 text-sm font-semibold"
            />
            <Button
              variant="ghost"
              size="icon"
              className="size-9 shrink-0"
              aria-label="Next month"
              disabled={selecting || (year >= 9999 && monthIndex === 12)}
              onClick={() => moveMonth(1)}
            >
              <ChevronRight />
            </Button>
          </div>
          {query.isPending ? (
            <BrandLoading compact message="Loading message dates…" />
          ) : query.isError && !query.data ? (
            <div className="text-center">
              <p role="alert" className="text-xs text-destructive">
                {errorMessage(query.error)}
              </p>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => void query.refetch()}
              >
                Try again
              </Button>
            </div>
          ) : (
            <>
              <table
                className="w-full table-fixed text-center text-xs"
                aria-label={new Date(
                  year,
                  monthIndex - 1,
                  1,
                ).toLocaleDateString("en-US", {
                  month: "long",
                  year: "numeric",
                })}
              >
                <thead>
                  <tr>
                    {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(
                      (weekday) => (
                        <th
                          key={weekday}
                          scope="col"
                          className="py-2 font-normal text-muted-foreground"
                        >
                          {weekday}
                        </th>
                      ),
                    )}
                  </tr>
                </thead>
                <tbody>
                  {Array.from({ length: cells.length / 7 }, (_, week) => (
                    <tr key={week}>
                      {cells
                        .slice(week * 7, week * 7 + 7)
                        .map((number, index) => {
                          if (number < 1 || number > daysInMonth)
                            return <td key={index} />;
                          const key = `${month}-${String(number).padStart(2, "0")}`;
                          const messageId = available.get(key);
                          return (
                            <td key={index} className="py-0.5">
                              <button
                                type="button"
                                disabled={!messageId || selecting || disabled}
                                aria-label={formatMessageDay(key)}
                                aria-current={key === day ? "date" : undefined}
                                className={`relative mx-auto flex size-9 items-center justify-center rounded-full outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-30 ${key === day ? "bg-brand/15 font-semibold text-brand" : "hover:bg-muted"}`}
                                onClick={async () => {
                                  const attempt = ++generation.current;
                                  setSelecting(true);
                                  setError("");
                                  try {
                                    await onSelect(messageId!);
                                    if (generation.current === attempt)
                                      setOpen(false);
                                  } catch (failure) {
                                    if (generation.current === attempt)
                                      setError(errorMessage(failure));
                                  } finally {
                                    if (generation.current === attempt)
                                      setSelecting(false);
                                  }
                                }}
                              >
                                {number}
                                {messageId && (
                                  <span className="absolute bottom-1 size-1 rounded-full bg-brand" />
                                )}
                              </button>
                            </td>
                          );
                        })}
                    </tr>
                  ))}
                </tbody>
              </table>
              {!query.data?.days.length && (
                <p className="mt-3 text-center text-xs text-muted-foreground">
                  No messages in this month.
                </p>
              )}
              <p className="mt-3 text-center text-xs text-muted-foreground">
                Choose a day with messages
              </p>
            </>
          )}
          {selecting && <BrandLoading compact message="Opening messages…" />}
          {error && (
            <p
              role="alert"
              className="mt-2 text-center text-xs text-destructive"
            >
              {error}
            </p>
          )}
          <div className="mt-3 flex justify-end border-t border-border pt-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                generation.current++;
                setOpen(false);
              }}
            >
              Close
            </Button>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}

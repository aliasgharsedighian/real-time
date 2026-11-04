import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { X, Search } from "lucide-react";
import { useSessionStore } from "@/features/auth/session-store";
import { useSession } from "@/features/auth/session-context";
import { Input } from "@/shared/ui/input";
import { Checkbox } from "@/shared/ui/checkbox";
import { IdentityAvatar } from "@/shared/components/IdentityAvatar";
import { displayName, type User } from "@/shared/lib/types";
import { errorMessage } from "@/shared/lib/api";
import { searchUsers } from "../api";

export function ContactPicker({
  selected,
  onChange,
  excluded = [],
  limit = 99,
  disabled = false,
}: {
  selected: User[];
  onChange: (users: User[]) => void;
  excluded?: number[];
  limit?: number;
  disabled?: boolean;
}) {
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const identity = useSessionStore((s) => s.tokens?.refreshToken);
  const { user } = useSession();
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(search.trim()), 350);
    return () => clearTimeout(timer);
  }, [search]);
  const results = useQuery({
    queryKey: ["contacts", identity, debounced],
    queryFn: ({ signal }) => searchUsers(debounced, signal),
    enabled: !!debounced,
    retry: false,
  });
  const contacts =
    results.data?.filter(
      (contact) => contact.id !== user?.id && !excluded.includes(contact.id),
    ) ?? [];
  return (
    <div className="space-y-3">
      {!!selected.length && (
        <div
          className="flex max-h-28 flex-wrap gap-2 overflow-y-auto"
          aria-label="Selected contacts"
        >
          {selected.map((contact) => (
            <button
              key={contact.id}
              type="button"
              disabled={disabled}
              onClick={() =>
                onChange(selected.filter((c) => c.id !== contact.id))
              }
              aria-label={`Remove ${displayName(contact)} from selection`}
              className="flex min-h-9 max-w-full items-center gap-2 rounded-full bg-primary/10 px-3 text-xs text-brand"
            >
              <span className="truncate">{displayName(contact)}</span>
              <X className="size-3 shrink-0" />
            </button>
          ))}
        </div>
      )}
      <div className="relative">
        <Search className="absolute top-3.5 left-3 size-4 text-muted-foreground" />
        <Input
          autoFocus
          aria-label="Search contacts by email"
          placeholder="Search by email…"
          className="h-11 pl-9"
          value={search}
          disabled={disabled}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>
      <div
        className="max-h-60 min-h-28 overflow-y-auto"
        aria-label="Contact results"
      >
        {!debounced && (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Find people by email to start a conversation.
          </p>
        )}
        {(results.isFetching || search.trim() !== debounced) && (
          <p role="status" className="py-4 text-sm text-muted-foreground">
            Searching…
          </p>
        )}
        {results.isError && (
          <p role="alert" className="py-4 text-sm text-destructive">
            {errorMessage(results.error)}
          </p>
        )}
        {debounced &&
          !results.isFetching &&
          results.isSuccess &&
          contacts.length === 0 && (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No new contacts found. Try another email.
            </p>
          )}
        {search.trim() === debounced &&
          contacts.map((contact) => {
            const checked = selected.some((c) => c.id === contact.id);
            return (
              <label
                key={contact.id}
                className="flex min-h-16 cursor-pointer items-center gap-3 rounded-xl px-2 py-3 hover:bg-muted"
              >
                <Checkbox
                  checked={checked}
                  disabled={disabled || (!checked && selected.length >= limit)}
                  onCheckedChange={() =>
                    onChange(
                      checked
                        ? selected.filter((c) => c.id !== contact.id)
                        : [...selected, contact],
                    )
                  }
                />
                <IdentityAvatar
                  avatarId={contact.profile?.avatarId}
                  name={displayName(contact)}
                  className="size-9"
                />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium">
                    {displayName(contact)}
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {contact.email}
                  </span>
                </span>
              </label>
            );
          })}
      </div>
      {selected.length >= limit && (
        <p role="status" className="text-xs text-muted-foreground">
          {limit === 1
            ? "Remove the selected contact to choose someone else."
            : `You can select up to ${limit} people.`}
        </p>
      )}
    </div>
  );
}

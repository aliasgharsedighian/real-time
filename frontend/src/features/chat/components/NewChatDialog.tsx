import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { Checkbox } from "@/shared/ui/checkbox";
import { Button } from "@/shared/ui/button";
import { displayName } from "@/shared/lib/types";
import { errorMessage } from "@/shared/lib/api";
import { useSession } from "@/features/auth/session-context";
import { useSessionStore } from "@/features/auth/session-store";
import { chatKeys, createChat, searchUsers } from "../api";

export function NewChatDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [selected, setSelected] = useState<number[]>([]);
  const { user } = useSession();
  const identity = useSessionStore((state) => state.tokens?.refreshToken);
  const cache = useQueryClient();
  const navigate = useNavigate();
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(search.trim()), 400);
    return () => clearTimeout(timer);
  }, [search]);
  const results = useQuery({
    queryKey: ["contacts", identity, debounced],
    queryFn: ({ signal }) => searchUsers(debounced, signal),
    enabled: open && !!debounced,
    retry: false,
  });
  const creation = useMutation({
    mutationFn: () =>
      createChat(selected, `${displayName(user)} create this chat`),
  });
  async function submit() {
    try {
      const chat = await creation.mutateAsync();
      void cache.invalidateQueries({ queryKey: chatKeys.list(identity) });
      onOpenChange(false);
      setSearch("");
      setSelected([]);
      navigate(`/dashboard/websocket/${chat.id}`);
    } catch (error) {
      toast.error(errorMessage(error));
    }
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add chat</DialogTitle>
          <DialogDescription>
            Search other users by email, select contacts and press Add chat.
          </DialogDescription>
        </DialogHeader>
        <Label htmlFor="contact-search">Email</Label>
        <Input
          id="contact-search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search user email…"
        />
        <div className="max-h-72 overflow-y-auto">
          {results.isFetching && (
            <p role="status" className="py-4 text-sm">
              Searching…
            </p>
          )}
          {results.isError && (
            <p role="alert" className="py-4 text-sm text-destructive">
              {errorMessage(results.error)}
            </p>
          )}
          {debounced && !results.isFetching && results.data?.length === 0 && (
            <p className="py-4 text-sm text-muted-foreground">
              No users found.
            </p>
          )}
          {search.trim() === debounced &&
            results.data?.map((contact) => (
              <label
                key={contact.id}
                className="flex cursor-pointer items-center gap-3 border-b py-3"
              >
                <Checkbox
                  checked={selected.includes(contact.id)}
                  onCheckedChange={(checked) =>
                    setSelected((old) =>
                      checked
                        ? [...old, contact.id]
                        : old.filter((id) => id !== contact.id),
                    )
                  }
                />
                <span>
                  <span className="block text-sm font-medium">
                    {displayName(contact)}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {contact.email}
                  </span>
                </span>
              </label>
            ))}
        </div>
        <Button
          onClick={() => void submit()}
          disabled={selected.length === 0 || creation.isPending}
        >
          {creation.isPending
            ? "Creating…"
            : `Add chat${selected.length ? ` (${selected.length})` : ""}`}
        </Button>
      </DialogContent>
    </Dialog>
  );
}

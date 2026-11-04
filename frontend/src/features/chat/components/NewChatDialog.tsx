import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { MessageCircle, Users, ArrowLeft } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { Button } from "@/shared/ui/button";
import { displayName, type User } from "@/shared/lib/types";
import { errorMessage } from "@/shared/lib/api";
import { useSessionStore } from "@/features/auth/session-store";
import { chatKeys, createChat } from "../api";
import { ContactPicker } from "./ContactPicker";

export function NewChatDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <NewConversation
          key={String(open)}
          onClose={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
}

function NewConversation({ onClose }: { onClose: () => void }) {
  const [mode, setMode] = useState<"direct" | "group">("direct");
  const [step, setStep] = useState<"people" | "details">("people");
  const [selected, setSelected] = useState<User[]>([]);
  const [name, setName] = useState("");
  const identity = useSessionStore((state) => state.tokens?.refreshToken);
  const cache = useQueryClient();
  const navigate = useNavigate();
  const creation = useMutation({
    mutationFn: () =>
      createChat(
        selected.map((u) => u.id),
        "",
        mode === "group" ? { name: name.trim() } : undefined,
      ),
    onSuccess: (chat) => {
      void cache.invalidateQueries({ queryKey: chatKeys.list(identity) });
      onClose();
      navigate(`/dashboard/websocket/${chat.id}`);
    },
  });
  return (
    <>
      <DialogHeader>
        <DialogTitle>
          {step === "details" ? "Name your group" : "New conversation"}
        </DialogTitle>
        <DialogDescription>
          {step === "details"
            ? "Choose a name everyone will recognize. You can change it later."
            : "Start a private chat or bring your people together in a group."}
        </DialogDescription>
      </DialogHeader>
      {step === "people" ? (
        <>
          <div
            className="grid grid-cols-2 gap-2"
            aria-label="Conversation type"
          >
            {(["direct", "group"] as const).map((value) => (
              <Button
                key={value}
                variant={mode === value ? "default" : "outline"}
                aria-pressed={mode === value}
                onClick={() => {
                  setMode(value);
                  setSelected([]);
                  creation.reset();
                }}
                disabled={creation.isPending}
              >
                {value === "direct" ? <MessageCircle /> : <Users />}
                {value === "direct" ? "Direct message" : "New group"}
              </Button>
            ))}
          </div>
          <ContactPicker
            selected={selected}
            onChange={setSelected}
            limit={mode === "direct" ? 1 : 99}
            disabled={creation.isPending}
          />
          <Button
            disabled={!selected.length || creation.isPending}
            onClick={() =>
              mode === "group" ? setStep("details") : creation.mutate()
            }
          >
            {creation.isPending
              ? "Opening…"
              : mode === "group"
                ? `Next · ${selected.length} selected`
                : "Start conversation"}
          </Button>
        </>
      ) : (
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (name.trim() && !creation.isPending) creation.mutate();
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="group-name">Group name</Label>
            <Input
              id="group-name"
              autoFocus
              maxLength={100}
              dir="auto"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Design team"
              disabled={creation.isPending}
            />
            <p className="text-right text-xs text-muted-foreground">
              {name.length}/100
            </p>
          </div>
          <div className="rounded-xl bg-muted/50 p-3">
            <p className="mb-1 text-sm font-medium">
              {selected.length + 1} members, including you
            </p>
            <p className="break-words text-sm text-muted-foreground">
              {selected.map(displayName).join(", ")}
            </p>
          </div>
          <p className="text-xs leading-5 text-muted-foreground">
            You’ll be the group owner. Members can see the group’s message
            history. You can add or remove people from group info.
          </p>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={creation.isPending}
              onClick={() => setStep("people")}
            >
              <ArrowLeft />
              Back
            </Button>
            <Button
              type="submit"
              className="flex-1"
              disabled={!name.trim() || creation.isPending}
            >
              {creation.isPending ? "Creating group…" : "Create group"}
            </Button>
          </div>
        </form>
      )}
      {creation.isError && (
        <p role="alert" className="text-sm text-destructive">
          {errorMessage(creation.error)}
        </p>
      )}
    </>
  );
}

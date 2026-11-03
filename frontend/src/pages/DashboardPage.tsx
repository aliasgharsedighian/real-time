import { MessageCircle, PanelLeft } from "lucide-react";
import { Brand } from "@/shared/components/Brand";
import { ChatList } from "@/features/chat/components/ChatList";
import { useSidebar } from "@/shared/ui/sidebar";
import { Button } from "@/shared/ui/button";
import { useIsMobile } from "@/shared/hooks/use-mobile";

export default function DashboardPage() {
  const { setOpen } = useSidebar();
  const isMobile = useIsMobile();
  if (isMobile)
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <ChatList />
      </div>
    );
  return (
    <div className="brand-scene flex flex-1 flex-col items-center justify-center gap-6 p-8 text-center">
      <Brand
        variant="vertical"
        className="w-64 shadow-[0_0_70px_var(--brand-halo)]"
      />
      <div className="space-y-3">
        <p className="text-xs font-semibold tracking-[.2em] text-brand">
          WELCOME TO YOUR SPACE
        </p>
        <h1 className="text-3xl font-semibold tracking-tight">
          Send your signal.
        </h1>
        <p className="max-w-sm text-sm leading-6 text-muted-foreground">
          Select a chat from the sidebar or start a new conversation.
        </p>
      </div>
      <Button variant="outline" onClick={() => setOpen(true)}>
        <PanelLeft />
        Explore your chats
      </Button>
      <span className="mt-8 inline-flex items-center gap-2 text-xs text-muted-foreground">
        <MessageCircle className="size-4 text-brand" />
        Real connections. In real time.
      </span>
    </div>
  );
}

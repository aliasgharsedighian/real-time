"use client";

import { useSidebar } from "@/components/ui/sidebar";
import { useAuthStore } from "@/store/useAuthStore";
import { useRouter } from "next/navigation";

function Dashboard() {
  const user = useAuthStore((state) => state.user);
  const router = useRouter();
  const { setOpen } = useSidebar();

  const channel = undefined;

  return (
    <div className="flex flex-col w-full flex-1">
      {channel ? (
        <div>Channel</div>
      ) : (
        <div className="flex flex-col items-center justify-center h-full">
          <h2 className="text-2xl font-semibold text-muted-foreground mb-4">
            No chat selected
          </h2>
          <p className="text-muted-foreground">
            Select a chat from the sidebar or start a new conversation
          </p>
        </div>
      )}
    </div>
  );
}

export default Dashboard;

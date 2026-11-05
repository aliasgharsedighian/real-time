import { Link, useLocation } from "react-router-dom";
import { MessageCircle, Phone, UserRound } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/shared/ui/sidebar";
import { Brand } from "@/shared/components/Brand";
import { displayName } from "@/shared/lib/types";
import { useSession } from "@/features/auth/session-context";
import UserButton from "@/features/auth/components/UserButton";
import { ChatList } from "./ChatList";

export function ChatSidebar() {
  const { user } = useSession();
  const location = useLocation();
  const { setOpenMobile } = useSidebar();
  return (
    <Sidebar
      variant="sidebar"
      collapsible="icon"
      className="border-r border-border"
    >
      <SidebarHeader className="shrink-0 gap-4 border-b border-border px-3 py-5 [@media(max-height:700px)]:gap-2 [@media(max-height:700px)]:py-2">
        <Link
          to="/dashboard"
          aria-label="BatGram chats"
          onClick={() => setOpenMobile(false)}
        >
          <Brand className="w-full max-w-56 [@media(max-height:700px)]:max-h-8 [@media(max-height:700px)]:w-auto group-data-[collapsible=icon]:hidden" />
          <Brand
            variant="icon"
            className="hidden size-10 rounded-xl group-data-[collapsible=icon]:block"
          />
        </Link>
        <SidebarMenu className="[@media(max-height:700px)]:flex-row group-data-[collapsible=icon]:flex-col">
          <SidebarMenuItem className="[@media(max-height:700px)]:flex-1">
            <SidebarMenuButton
              asChild
              isActive={
                location.pathname === "/dashboard" ||
                location.pathname.startsWith("/dashboard/websocket/")
              }
              size="lg"
              tooltip="Chats"
              className="rounded-xl data-[active=true]:text-brand [@media(max-height:700px)]:justify-center"
            >
              <Link to="/dashboard" onClick={() => setOpenMobile(false)}>
                <MessageCircle />
                <span className="group-data-[collapsible=icon]:sr-only [@media(max-height:700px)]:sr-only">
                  Messages
                </span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem className="[@media(max-height:700px)]:flex-1">
            <SidebarMenuButton
              asChild
              isActive={location.pathname.startsWith("/dashboard/calls")}
              size="lg"
              tooltip="Calls"
              className="rounded-xl data-[active=true]:text-brand [@media(max-height:700px)]:justify-center"
            >
              <Link to="/dashboard/calls" onClick={() => setOpenMobile(false)}>
                <Phone />
                <span className="group-data-[collapsible=icon]:sr-only [@media(max-height:700px)]:sr-only">
                  Calls
                </span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem className="[@media(max-height:700px)]:flex-1">
            <SidebarMenuButton
              asChild
              isActive={location.pathname === "/dashboard/profile"}
              size="lg"
              tooltip="Profile"
              className="rounded-xl data-[active=true]:text-brand [@media(max-height:700px)]:justify-center"
            >
              <Link
                to="/dashboard/profile"
                onClick={() => setOpenMobile(false)}
              >
                <UserRound />
                <span className="group-data-[collapsible=icon]:sr-only [@media(max-height:700px)]:sr-only">
                  My profile
                </span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent className="overflow-hidden group-data-[collapsible=icon]:hidden">
        <ChatList onNavigate={() => setOpenMobile(false)} />
      </SidebarContent>
      <SidebarFooter className="mt-auto shrink-0 border-t border-border p-3 [@media(max-height:700px)]:p-2">
        <div className="brand-panel flex min-w-0 items-center gap-3 rounded-2xl p-2 group-data-[collapsible=icon]:border-0 group-data-[collapsible=icon]:bg-transparent group-data-[collapsible=icon]:p-0">
          <UserButton />
          <div className="min-w-0 group-data-[collapsible=icon]:hidden">
            <p className="truncate text-sm font-semibold">
              {displayName(user)}
            </p>
            <Link
              to="/dashboard/profile"
              className="text-xs text-brand"
              onClick={() => setOpenMobile(false)}
            >
              Your BatGram profile
            </Link>
          </div>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}

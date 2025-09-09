"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/store/useAuthStore";
import Link from "next/link";
import { logoutUser } from "@/hooks/useAuth";

export default function UserButton() {
  const token = useAuthStore((state) => state.token);
  const { setToken, setUser } = useAuthStore.getState();
  const user = useAuthStore((state) => state.user);

  const { mutateAsync: logout, isPending: logoutPending } = logoutUser(token);

  const handleLogout = async () => {
    try {
      await logout(undefined, {
        onSuccess: (response) => {
          const res = response.data;
          if (res.statusCode === 200) {
            setToken(null);
            setUser(null);
          }
        },
      });
    } catch (error) {}
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" className="rounded-full p-0 w-10 h-10">
          <Avatar className="w-10 h-10">
            <AvatarImage src="/assets/icons/user-icon.png" alt="User" />
            <AvatarFallback>
              {" "}
              {user?.profile.firstname.charAt(0)}{" "}
              {user?.profile.lastname.charAt(0)}
            </AvatarFallback>
          </Avatar>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-2">
        <div className="flex flex-col">
          <Link
            className="flex items-start gap-3 border-b pb-2"
            href="/profile"
          >
            <Avatar className="w-10 h-10">
              <AvatarImage src="/assets/icons/user-icon.png" alt="User" />
              <AvatarFallback>
                {" "}
                {user?.profile.firstname.charAt(0)}{" "}
                {user?.profile.lastname.charAt(0)}
              </AvatarFallback>
            </Avatar>
            <div className="flex flex-col text-sm">
              <span className="font-bold">{`${user?.profile.firstname} ${user?.profile.lastname}`}</span>
              <span>{user?.email}</span>
            </div>
          </Link>
          <div className="pt-2">
            <Button variant="outline" className="w-full" onClick={handleLogout}>
              Logout
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

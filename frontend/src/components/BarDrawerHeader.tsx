import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "./ui/drawer";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "./ui/accordion";
import { Link } from "react-router-dom";
import { useAuthStore } from "../store/useAuthStore";
import { useState } from "react";
import Button from "./ui/custom/Button";

function BarDrawerHeader() {
  const [drawerOpen, setDrawerOpen] = useState(false);

  const user = useAuthStore((state) => state.user);
  const { setToken, setUser } = useAuthStore.getState();
  const { isLoggedIn } = useAuthStore();
  return (
    <Drawer open={drawerOpen} onOpenChange={setDrawerOpen}>
      <DrawerTrigger>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={1.5}
          stroke="currentColor"
          className="size-7 text-white"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5"
          />
        </svg>
      </DrawerTrigger>
      <DrawerContent className="h-screen">
        <DrawerHeader className="border-b">
          <div className="flex flex-col gap-2 items-start">
            <img
              className="bg-[#efefef] rounded-full w-10 h-10 flex items-center justify-center"
              src="/assets/user-icon.png"
              alt=""
            />
            <DrawerTitle className="flex items-start">{`${user?.profile.firstname} ${user?.profile.lastname}`}</DrawerTitle>
            <p>{user?.email}</p>
          </div>
        </DrawerHeader>
        {/* <Link className="border-b py-3.5 px-4 font-semibold" to="/">
            Home
          </Link> */}
        {isLoggedIn && (
          <Link
            onClick={() => setDrawerOpen(false)}
            className="border-b py-3.5 px-4 font-semibold"
            to="/profile"
          >
            My Profile
          </Link>
        )}
        <Accordion className="border-b px-4" type="single" collapsible>
          <AccordionItem value="item-1">
            <AccordionTrigger>Chats Type</AccordionTrigger>
            <AccordionContent>
              <Link onClick={() => setDrawerOpen(false)} to="/polling">
                Polling
              </Link>
            </AccordionContent>
          </AccordionItem>
        </Accordion>

        <DrawerFooter className="px-0">
          <Button
            onClick={() => {
              setToken(null);
              setUser(null);
            }}
            variant="ghost"
          >
            <p className="px-4 py-1.5 text-red-600">Logout</p>
          </Button>
          <DrawerDescription className="border-t px-4 pt-2">
            This is test Private chat
            <br />
            Enjoy it!
          </DrawerDescription>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}

export default BarDrawerHeader;

import { useNavigate } from "react-router-dom";
import { Button } from "../../../components/ui/button";
import PulseCircle from "../../../components/ui/custom/PulseCircle";
import { useChatStore } from "../../../store/useChatStore";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "../../../components/ui/popover";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogTitle,
  DialogTrigger,
} from "../../../components/ui/dialog";
import { Label } from "../../../components/ui/label";
import { Input } from "../../../components/ui/input";
import { useState } from "react";
import { useDebouncedCallback } from "use-debounce";
import { Checkbox } from "../../../components/ui/checkbox";
import { useSearchContact } from "../../../hooks/useSearchContact";
import { useAuthStore } from "../../../store/useAuthStore";
import { capitalizeFirstLetter } from "../../../utils/stringUtils";
import { useCreateChat } from "../../../hooks/useCreateChat";
import BarDrawerHeader from "../../../components/BarDrawerHeader";

const ChatHeader = () => {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const token = useAuthStore((state) => state.token);
  const chatError = useChatStore((state) => state.chatError);

  const [searchInput, setSearchInput] = useState("");
  const [contactSelect, setContactSelect] = useState<number[]>([]);
  const [serachData, setSearchData] = useState<any>([]);

  const handleSearchInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchInput(e.target.value);
    sendValueToApi(e.target.value);
  };

  const { mutate: searchContact, error: searchContactError } =
    useSearchContact(token);

  const { mutate: createChat, isPending: createChatPending } =
    useCreateChat(token);

  const sendValueToApi = useDebouncedCallback(async (text) => {
    if (text !== "") {
      searchContact(
        { search: searchInput },
        {
          onSuccess: (response) => {
            const result = response.data;

            if (result.statusCode === 200) {
              if (result.data.length > 0) {
                setSearchData(
                  result.data.map((item: any) => ({
                    id: item.id,
                    email: item.email,
                    name: `${capitalizeFirstLetter(
                      item.profile.firstname
                    )} ${capitalizeFirstLetter(item.profile.lastname)}`,
                    phoneNumber: item.phoneNumber,
                  }))
                );
              }
              if (result.data.length === 0) {
                setSearchData([
                  {
                    id: "",
                    email: "",
                    name: result.message,
                    phoneNumber: "",
                  },
                ]);
              }
            }
          },
          onError: () => {
            setSearchData([]);
          },
        }
      );

      // console.log(result);
    }
    if (text === "") {
      setSearchData([]);
    }
  }, 1000);

  function chooseChatContact(userId: number) {
    if (!contactSelect.includes(userId)) {
      setContactSelect([...contactSelect, userId]);
    } else {
      setContactSelect(contactSelect.filter((item) => item !== userId));
    }
  }

  function handleCreateChatSubmit() {
    if (contactSelect.length !== 0) {
      createChat(
        {
          firstMessage: `${
            user?.profile.firstname ? user.profile.firstname : user?.email
          } create this chat`,
          participant: contactSelect,
        },
        {
          onSuccess: (response) => {
            const result = response.data;
            navigate(`/polling/${result.data.id}`);
          },
          onError: () => {},
        }
      );
    }
  }

  return (
    <header className="flex items-center justify-between bg-[#2b7fff] h-[66px] sticky top-0 w-full z-10">
      <div className="text-white p-3 flex gap-4 items-center">
        {/* <Link to="/">
          {" "}
          <Button className="!p-1" variant={"ghost"}>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
              className="size-6"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18"
              />
            </svg>
          </Button>
        </Link> */}
        <BarDrawerHeader />
        <div
          style={{
            display: "flex",
            flexDirection: "column",
          }}
        >
          <span>Chat Messenger</span>
          {chatError || searchContactError ? (
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <PulseCircle size="7px" color="#d32f2f" />
              <span
                style={{ fontSize: 12, color: "#d32f2f", fontWeight: "bold" }}
              >
                Offline!
              </span>
            </div>
          ) : (
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <PulseCircle size="7px" color="white" />
              <span style={{ fontSize: 12 }}>Online!</span>
            </div>
          )}
        </div>
      </div>

      <Popover>
        <PopoverTrigger className="px-3">
          {" "}
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
            className="size-6 text-white"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 6.75a.75.75 0 1 1 0-1.5.75.75 0 0 1 0 1.5ZM12 12.75a.75.75 0 1 1 0-1.5.75.75 0 0 1 0 1.5ZM12 18.75a.75.75 0 1 1 0-1.5.75.75 0 0 1 0 1.5Z"
            />
          </svg>
        </PopoverTrigger>
        <PopoverContent className="p-0">
          <div className="flex flex-col items-start gap-2">
            <Dialog>
              <form className="w-full">
                <DialogTrigger asChild>
                  <div className="flex items-center justify-between gap-2 border-b w-full p-2">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth={1.5}
                      stroke="currentColor"
                      className="size-6"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M18 7.5v3m0 0v3m0-3h3m-3 0h-3m-2.25-4.125a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0ZM3 19.235v-.11a6.375 6.375 0 0 1 12.75 0v.109A12.318 12.318 0 0 1 9.374 21c-2.331 0-4.512-.645-6.374-1.766Z"
                      />
                    </svg>
                    <p>Add chat</p>
                  </div>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[425px]">
                  <DialogTitle className="hidden">
                    Are you absolutely sure?
                  </DialogTitle>
                  <div className="flex flex-col gap-6 w-full">
                    <div className="">
                      <h4 className="text-lg font-bold">Add chat</h4>
                      <p className="text-sm text-gray-500">
                        {" "}
                        Search other users by email , click on it and press Add
                        chat button
                      </p>
                    </div>
                    <div className="flex flex-col gap-3 w-full">
                      <Label htmlFor="username-1">Email</Label>
                      <Input
                        id="username-1"
                        name="username"
                        placeholder="search user email ..."
                        value={searchInput}
                        onChange={handleSearchInput}
                      />
                    </div>
                    <div className="flex flex-col">
                      {serachData.map((user: any) => {
                        return (
                          <div
                            className="flex items-center gap-2 w-full border-b py-2 hover:bg-gray-100"
                            key={user.id}
                          >
                            <Checkbox
                              className="rounded-full h-6 w-6"
                              checked={contactSelect.includes(user.id)}
                              onCheckedChange={() => chooseChatContact(user.id)}
                            />
                            <div>
                              <Label>{user.name}</Label>
                              <span className="text-sm">{user.email}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  <DialogFooter className="!justify-start items-end">
                    <Button
                      type="button"
                      onClick={handleCreateChatSubmit}
                      disabled={createChatPending}
                    >
                      Add chat
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </form>
            </Dialog>
          </div>
        </PopoverContent>
      </Popover>
    </header>
  );
};

export default ChatHeader;

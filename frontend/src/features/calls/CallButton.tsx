import { Phone, Video } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/ui/popover";
import { Button } from "@/shared/ui/button";
import { useState } from "react";
import { useCalls } from "./context";
import type { CallMode } from "./types";
export function CallButton({ chatId }: { chatId: number }) {
  const [open, setOpen] = useState(false);
  const { controller, view } = useCalls();
  const navigate = useNavigate();
  function start(mode: CallMode) {
    setOpen(false);
    if (
      ["preparing", "ringing", "connecting", "active"].includes(view.phase) ||
      view.incoming
    ) {
      toast.error("Finish your current call first.");
      return;
    }
    navigate("/dashboard/calls/active");
    void controller
      .start(chatId, mode)
      .catch((error: Error) => toast.error(error.message));
  }
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="size-11 text-brand"
          aria-label="Start a call"
        >
          <Phone />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-52 rounded-xl p-2">
        <Button
          variant="ghost"
          className="w-full justify-start"
          onClick={() => start("audio")}
        >
          <Phone />
          Voice call
        </Button>
        <Button
          variant="ghost"
          className="w-full justify-start"
          onClick={() => start("video")}
        >
          <Video />
          Video call
        </Button>
      </PopoverContent>
    </Popover>
  );
}

import EmojiPicker, { EmojiStyle, Theme } from "emoji-picker-react";
import { useTheme } from "@/shared/components/ThemeProvider";

export default function ChatEmojiPicker({
  onSelect,
}: {
  onSelect: (emoji: string) => void;
}) {
  const { theme } = useTheme();
  return (
    <EmojiPicker
      onEmojiClick={(data) => onSelect(data.emoji)}
      theme={theme === "dark" ? Theme.DARK : Theme.LIGHT}
      emojiStyle={EmojiStyle.NATIVE}
      width="100%"
      height={350}
      previewConfig={{ showPreview: false }}
    />
  );
}

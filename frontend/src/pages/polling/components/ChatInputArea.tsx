import Button from "../../../components/ui/Button";
import Spinner from "../../../components/ui/Spinner";
import { useChatStore } from "../../../store/useChatStore";

interface Props {
  sendMessage: any;
  isPending: boolean;
}

const ChatInputArea = ({ sendMessage, isPending }: Props) => {
  const input = useChatStore((state) => state.input);
  const setInput = useChatStore((state) => state.setInput);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        borderTop: "1px solid #eee",
      }}
    >
      <textarea
        style={{
          border: "none",
          resize: "none",
          boxShadow: "none",
          padding: "8px",
          outline: "none",
          width: "100%",
          fontFamily: "IRANSans, sans-serif",
        }}
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder="Write your message ..."
      />
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          borderTop: "1px solid #eee",
          padding: "4px 8px",
        }}
      >
        <Button variant="ghost">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
            style={{
              width: "20px",
              height: "20px",
              transform: "rotate(-45deg)",
              color: "#aaa",
            }}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="m18.375 12.739-7.693 7.693a4.5 4.5 0 0 1-6.364-6.364l10.94-10.94A3 3 0 1 1 19.5 7.372L8.552 18.32m.009-.01-.01.01m5.699-9.941-7.81 7.81a1.5 1.5 0 0 0 2.112 2.13"
            />
          </svg>
        </Button>
        <Button
          type="submit"
          variant="primary"
          onClick={sendMessage}
          disabled={!input || isPending}
          style={{
            transform: "rotate(180deg)",
          }}
        >
          {isPending ? (
            <Spinner width={15} height={15} color="white" />
          ) : (
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
              style={{ width: "16px", height: "16px" }}
              className="rotate-180"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M6 12 3.269 3.125A59.769 59.769 0 0 1 21.485 12 59.768 59.768 0 0 1 3.27 20.875L5.999 12Zm0 0h7.5"
              />
            </svg>
          )}
        </Button>
      </div>
    </div>
  );
};

export default ChatInputArea;

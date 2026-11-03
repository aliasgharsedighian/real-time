export default function DashboardPage() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center p-6 text-center">
      <h1 className="mb-4 text-2xl font-semibold text-muted-foreground">
        No chat selected
      </h1>
      <p className="text-muted-foreground">
        Select a chat from the sidebar or start a new conversation
      </p>
    </div>
  );
}

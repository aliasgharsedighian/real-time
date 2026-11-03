import { Link } from "react-router-dom";
import { Button } from "@/shared/ui/button";

export default function NotFoundPage() {
  return (
    <main className="grid min-h-[60dvh] place-items-center p-6 text-center">
      <div className="space-y-4">
        <h1 className="text-3xl font-semibold">Page not found</h1>
        <p className="text-muted-foreground">This page does not exist.</p>
        <Button asChild>
          <Link to="/dashboard">Back to chats</Link>
        </Button>
      </div>
    </main>
  );
}

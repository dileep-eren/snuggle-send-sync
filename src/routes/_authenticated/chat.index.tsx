import { createFileRoute } from "@tanstack/react-router";
import { MessageCircle } from "lucide-react";

export const Route = createFileRoute("/_authenticated/chat/")({
  component: () => (
    <div className="bg-hero flex h-full w-full flex-col items-center justify-center p-8 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-soft">
        <MessageCircle className="h-8 w-8" />
      </div>
      <h2 className="mt-6 text-2xl font-bold">Pick a conversation</h2>
      <p className="mt-2 max-w-sm text-muted-foreground">Choose a chat on the left, or open People to message someone new.</p>
    </div>
  ),
});

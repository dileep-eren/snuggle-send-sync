import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Fragment, useEffect, useRef, useState } from "react";
import { ArrowLeft, Loader2, SendHorizontal, AlertCircle } from "lucide-react";
import {
  fetchConversations, fetchMessages, sendMessage, useAuthUser, formatTime, formatDay, errorMessage, type Message,
} from "@/lib/chat";
import { UserAvatar } from "@/components/UserAvatar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/chat/$conversationId")({
  component: Thread,
});

type Pending = { tempId: string; content: string; failed?: boolean };

function Thread() {
  const { conversationId } = Route.useParams();
  const { user } = useAuthUser();
  const qc = useQueryClient();
  const [text, setText] = useState("");
  const [pending, setPending] = useState<Pending[]>([]);
  const [sendError, setSendError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);

  const convs = useQuery({ queryKey: ["conversations", user?.id], queryFn: () => fetchConversations(user!.id), enabled: !!user });
  const conv = convs.data?.find((c) => c.id === conversationId);
  const msgs = useQuery({ queryKey: ["messages", conversationId], queryFn: () => fetchMessages(conversationId), enabled: !!user });

  useEffect(() => { setPending([]); setSendError(null); setText(""); }, [conversationId]);
  useEffect(() => { bottomRef.current?.scrollIntoView({ block: "end" }); }, [msgs.data?.length, pending.length]);

  async function doSend(content: string, tempId: string) {
    if (!user) return;
    try {
      const m = await sendMessage(conversationId, user.id, content);
      qc.setQueryData<Message[]>(["messages", conversationId], (old) =>
        old ? (old.some((x) => x.id === m.id) ? old : [...old, m]) : [m],
      );
      setPending((p) => p.filter((x) => x.tempId !== tempId));
      qc.invalidateQueries({ queryKey: ["conversations", user.id] });
    } catch (e) {
      setPending((p) => p.map((x) => (x.tempId === tempId ? { ...x, failed: true } : x)));
      setSendError(errorMessage(e));
    }
  }

  function submit(e?: React.FormEvent) {
    e?.preventDefault();
    const content = text.trim();
    if (!content) return;
    if (content.length > 4000) return setSendError("Message is too long (max 4000 characters)");
    setSendError(null);
    const tempId = `t-${Date.now()}-${Math.random()}`;
    setPending((p) => [...p, { tempId, content }]);
    setText("");
    taRef.current?.focus();
    void doSend(content, tempId);
  }

  const notFound = convs.isSuccess && !conv;
  const list = msgs.data ?? [];

  return (
    <div className="flex h-dvh w-full flex-col bg-background">
      <header className="flex items-center gap-3 border-b bg-card/80 px-3 py-3 backdrop-blur md:px-6">
        <Button asChild variant="ghost" size="icon" className="md:hidden" aria-label="Back to chats">
          <Link to="/chat"><ArrowLeft /></Link>
        </Button>
        {conv ? (
          <>
            <UserAvatar id={conv.other?.id} name={conv.other?.display_name} />
            <div className="min-w-0">
              <p className="truncate font-display font-semibold">{conv.other?.display_name}</p>
              <p className="truncate text-xs text-muted-foreground">@{conv.other?.username}</p>
            </div>
          </>
        ) : notFound ? (
          <p className="font-medium">Conversation unavailable</p>
        ) : (
          <Skeleton className="h-10 w-48" />
        )}
      </header>

      <div className="flex-1 overflow-y-auto px-3 py-6 md:px-8">
        {notFound ? (
          <div className="mx-auto max-w-sm py-20 text-center">
            <AlertCircle className="mx-auto h-8 w-8 text-destructive" />
            <p className="mt-3 font-medium">You don't have access to this conversation.</p>
            <Button asChild variant="outline" className="mt-4"><Link to="/chat">Back to chats</Link></Button>
          </div>
        ) : msgs.isLoading ? (
          <div className="space-y-3">
            {[40, 60, 30, 55].map((w, i) => (
              <Skeleton key={i} className={cn("h-10 rounded-2xl", i % 2 ? "ml-auto" : "")} style={{ width: `${w}%` }} />
            ))}
          </div>
        ) : msgs.isError ? (
          <div className="py-20 text-center text-sm">
            <p className="text-destructive">{errorMessage(msgs.error)}</p>
            <Button size="sm" variant="outline" className="mt-3" onClick={() => msgs.refetch()}>Retry</Button>
          </div>
        ) : list.length === 0 && pending.length === 0 ? (
          <div className="py-20 text-center">
            <p className="font-display text-lg font-semibold">No messages yet</p>
            <p className="mt-1 text-sm text-muted-foreground">Send the first message to {conv?.other?.display_name ?? "them"}.</p>
          </div>
        ) : (
          <div className="mx-auto flex max-w-3xl flex-col gap-1">
            {list.map((m, i) => {
              const prev = list[i - 1];
              const mine = m.sender_id === user?.id;
              const newDay = !prev || new Date(prev.created_at).toDateString() !== new Date(m.created_at).toDateString();
              const grouped = !newDay && prev?.sender_id === m.sender_id;
              return (
                <Fragment key={m.id}>
                  {newDay && (
                    <div className="my-4 text-center">
                      <span className="rounded-full bg-muted px-3 py-1 text-[11px] font-medium text-muted-foreground">{formatDay(m.created_at)}</span>
                    </div>
                  )}
                  <Bubble mine={mine} content={m.content} time={formatTime(m.created_at)} grouped={grouped} />
                </Fragment>
              );
            })}
            {pending.map((p) => (
              <div key={p.tempId} className="flex flex-col items-end">
                <Bubble mine content={p.content} time={p.failed ? "Failed" : "Sending…"} dim={!p.failed} grouped />
                {p.failed && (
                  <div className="mt-1 flex gap-2 text-xs">
                    <button className="font-medium text-primary" onClick={() => {
                      setPending((x) => x.map((y) => (y.tempId === p.tempId ? { ...y, failed: false } : y)));
                      void doSend(p.content, p.tempId);
                    }}>Retry</button>
                    <button className="text-muted-foreground" onClick={() => setPending((x) => x.filter((y) => y.tempId !== p.tempId))}>Discard</button>
                  </div>
                )}
              </div>
            ))}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      {!notFound && (
        <form onSubmit={submit} className="border-t bg-card px-3 py-3 md:px-6">
          {sendError && <p role="alert" className="mx-auto mb-2 max-w-3xl text-xs text-destructive">{sendError}</p>}
          <div className="mx-auto flex max-w-3xl items-end gap-2 rounded-2xl border bg-background p-2 focus-within:ring-2 focus-within:ring-ring/40">
            <textarea
              ref={taRef}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); } }}
              rows={1}
              maxLength={4000}
              placeholder="Write a message…"
              aria-label="Message"
              className="max-h-40 min-h-[40px] flex-1 resize-none bg-transparent px-2 py-2 text-[15px] outline-none placeholder:text-muted-foreground"
            />
            <Button type="submit" size="icon" className="h-10 w-10 shrink-0 rounded-xl" disabled={!text.trim()} aria-label="Send">
              {pending.some((p) => !p.failed) ? <Loader2 className="animate-spin" /> : <SendHorizontal />}
            </Button>
          </div>
          <p className="mx-auto mt-1 hidden max-w-3xl text-[11px] text-muted-foreground md:block">Enter to send · Shift+Enter for new line</p>
        </form>
      )}
    </div>
  );
}

function Bubble({ mine, content, time, grouped, dim }: { mine: boolean; content: string; time: string; grouped?: boolean; dim?: boolean }) {
  return (
    <div className={cn("bubble-in-anim flex", mine ? "justify-end" : "justify-start", !grouped && "mt-2")}>
      <div
        className={cn(
          "max-w-[80%] rounded-2xl px-4 py-2 shadow-soft md:max-w-[65%]",
          mine ? "rounded-br-md bg-bubble-out text-bubble-out-foreground" : "rounded-bl-md border bg-bubble-in text-bubble-in-foreground",
          dim && "opacity-70",
        )}
      >
        <p className="whitespace-pre-wrap break-words text-[15px] leading-relaxed">{content}</p>
        <p className={cn("mt-0.5 text-right text-[10px]", mine ? "text-bubble-out-foreground/70" : "text-muted-foreground")}>{time}</p>
      </div>
    </div>
  );
}

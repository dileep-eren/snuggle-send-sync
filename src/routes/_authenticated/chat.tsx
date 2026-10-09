import { createFileRoute, Link, Outlet, useNavigate, useParams } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { LogOut, MessageCircle, Search, Loader2, Users, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  fetchConversations, fetchMyProfile, searchUsers, startConversation, useAuthUser,
  formatRelative, errorMessage, type Message,
} from "@/lib/chat";
import { UserAvatar } from "@/components/UserAvatar";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/chat")({
  head: () => ({
    meta: [
      { title: "Chats — Relay" },
      { name: "description", content: "Your private Relay conversations." },
      { property: "og:title", content: "Chats — Relay" },
      { property: "og:description", content: "Your private Relay conversations." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ChatLayout,
});

function ChatLayout() {
  const { user } = useAuthUser();
  const params = useParams({ strict: false }) as { conversationId?: string };
  const activeId = params.conversationId;
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [term, setTerm] = useState("");
  const [mode, setMode] = useState<"chats" | "people">("chats");
  const [starting, setStarting] = useState<string | null>(null);

  const me = useQuery({ queryKey: ["me", user?.id], queryFn: () => fetchMyProfile(user!.id), enabled: !!user });
  const convs = useQuery({ queryKey: ["conversations", user?.id], queryFn: () => fetchConversations(user!.id), enabled: !!user });
  const people = useQuery({
    queryKey: ["people", user?.id, term],
    queryFn: () => searchUsers(term, user!.id),
    enabled: !!user && mode === "people",
  });

  // Realtime: any new message I can see (RLS-filtered) refreshes sidebar + thread cache
  useEffect(() => {
    if (!user) return;
    const ch = supabase
      .channel(`inbox-${user.id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, (payload) => {
        const m = payload.new as Message;
        qc.setQueryData<Message[]>(["messages", m.conversation_id], (old) =>
          old && !old.some((x) => x.id === m.id) ? [...old, m] : old,
        );
        qc.invalidateQueries({ queryKey: ["conversations", user.id] });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user, qc]);

  async function openWith(otherId: string) {
    setStarting(otherId);
    try {
      const id = await startConversation(otherId);
      await qc.invalidateQueries({ queryKey: ["conversations", user?.id] });
      setMode("chats");
      setTerm("");
      navigate({ to: "/chat/$conversationId", params: { conversationId: id } });
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setStarting(null);
    }
  }

  async function signOut() {
    await supabase.auth.signOut();
    qc.clear();
    navigate({ to: "/auth" });
  }

  const filteredConvs = (convs.data ?? []).filter((c) => {
    if (mode !== "chats" || !term.trim()) return true;
    const t = term.toLowerCase();
    return c.other?.display_name.toLowerCase().includes(t) || c.other?.username.includes(t);
  });

  return (
    <div className="flex h-dvh overflow-hidden">
      <aside
        className={cn(
          "flex w-full flex-col border-r bg-sidebar md:w-[340px] md:shrink-0",
          activeId && "hidden md:flex",
        )}
      >
        <div className="flex items-center justify-between px-4 pt-4">
          <Link to="/chat" className="flex items-center gap-2 font-display text-lg font-bold">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <MessageCircle className="h-4 w-4" />
            </span>
            Relay
          </Link>
          <Button variant="ghost" size="icon" onClick={signOut} aria-label="Sign out" title="Sign out">
            <LogOut />
          </Button>
        </div>

        <div className="flex items-center gap-3 px-4 py-3">
          {me.data ? (
            <>
              <UserAvatar id={me.data.id} name={me.data.display_name} size="sm" />
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{me.data.display_name}</p>
                <p className="truncate text-xs text-muted-foreground">@{me.data.username}</p>
              </div>
            </>
          ) : (
            <Skeleton className="h-8 w-40" />
          )}
        </div>

        <div className="px-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              placeholder={mode === "people" ? "Search people by name or @username" : "Filter chats"}
              className="bg-card pl-9 pr-8"
              aria-label="Search"
              maxLength={50}
            />
            {term && (
              <button onClick={() => setTerm("")} aria-label="Clear search" className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground">
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          <div className="mt-3 grid grid-cols-2 rounded-lg bg-sidebar-accent p-1 text-sm">
            {(["chats", "people"] as const).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={cn("rounded-md py-1.5 font-medium capitalize transition", mode === m ? "bg-card shadow-soft" : "text-muted-foreground")}
              >
                {m}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-3 flex-1 overflow-y-auto px-2 pb-4">
          {mode === "chats" ? (
            convs.isLoading ? (
              <ListSkeleton />
            ) : convs.isError ? (
              <ErrorBox msg={errorMessage(convs.error)} onRetry={() => convs.refetch()} />
            ) : filteredConvs.length === 0 ? (
              <div className="px-6 py-12 text-center">
                <Users className="mx-auto h-8 w-8 text-muted-foreground" />
                <p className="mt-3 text-sm font-medium">{term ? "No matching chats" : "No conversations yet"}</p>
                <p className="mt-1 text-xs text-muted-foreground">Find someone in People to start chatting.</p>
                <Button size="sm" className="mt-4" onClick={() => setMode("people")}>Find people</Button>
              </div>
            ) : (
              filteredConvs.map((c) => (
                <Link
                  key={c.id}
                  to="/chat/$conversationId"
                  params={{ conversationId: c.id }}
                  className={cn(
                    "flex items-center gap-3 rounded-xl px-3 py-2.5 transition hover:bg-sidebar-accent",
                    activeId === c.id && "bg-sidebar-accent",
                  )}
                >
                  <UserAvatar id={c.other?.id} name={c.other?.display_name} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <p className="truncate font-medium">{c.other?.display_name ?? "Unknown user"}</p>
                      {c.last && <span className="shrink-0 text-[11px] text-muted-foreground">{formatRelative(c.last.created_at)}</span>}
                    </div>
                    <p className="truncate text-sm text-muted-foreground">
                      {c.last ? `${c.last.sender_id === user?.id ? "You: " : ""}${c.last.content}` : "Say hello 👋"}
                    </p>
                  </div>
                </Link>
              ))
            )
          ) : people.isLoading ? (
            <ListSkeleton />
          ) : people.isError ? (
            <ErrorBox msg={errorMessage(people.error)} onRetry={() => people.refetch()} />
          ) : (people.data ?? []).length === 0 ? (
            <p className="px-6 py-12 text-center text-sm text-muted-foreground">No people found.</p>
          ) : (
            people.data!.map((p) => (
              <button
                key={p.id}
                onClick={() => openWith(p.id)}
                disabled={!!starting}
                className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition hover:bg-sidebar-accent disabled:opacity-60"
              >
                <UserAvatar id={p.id} name={p.display_name} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{p.display_name}</p>
                  <p className="truncate text-sm text-muted-foreground">@{p.username}</p>
                </div>
                {starting === p.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <span className="text-xs font-medium text-primary">Message</span>}
              </button>
            ))
          )}
        </div>
      </aside>

      <section className={cn("min-w-0 flex-1", !activeId && "hidden md:flex")}>
        <Outlet />
      </section>
    </div>
  );
}

function ListSkeleton() {
  return (
    <div className="space-y-2 px-2">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 py-2">
          <Skeleton className="h-10 w-10 rounded-full" />
          <div className="flex-1 space-y-2"><Skeleton className="h-3 w-1/2" /><Skeleton className="h-3 w-3/4" /></div>
        </div>
      ))}
    </div>
  );
}

function ErrorBox({ msg, onRetry }: { msg: string; onRetry: () => void }) {
  return (
    <div className="m-2 rounded-xl border border-destructive/30 bg-card p-4 text-sm">
      <p className="text-destructive">{msg}</p>
      <Button size="sm" variant="outline" className="mt-2" onClick={onRetry}>Retry</Button>
    </div>
  );
}

import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User } from "@supabase/supabase-js";

export type Profile = { id: string; username: string; display_name: string };
export type Message = {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  created_at: string;
};
export type ConversationSummary = {
  id: string;
  last_message_at: string;
  other: Profile | null;
  last: Message | null;
};

export function useAuthUser() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user);
      setLoading(false);
    });
    const { data } = supabase.auth.onAuthStateChange((_e, session) => setUser(session?.user ?? null));
    return () => data.subscription.unsubscribe();
  }, []);
  return { user, loading };
}

export async function fetchMyProfile(id: string): Promise<Profile | null> {
  const { data, error } = await supabase.from("profiles").select("id, username, display_name").eq("id", id).maybeSingle();
  if (error) throw error;
  return data;
}

export async function searchUsers(term: string, meId: string): Promise<Profile[]> {
  let q = supabase.from("profiles").select("id, username, display_name").neq("id", meId).order("display_name").limit(50);
  const t = term.trim().replace(/[%_,()]/g, "");
  if (t) q = q.or(`username.ilike.%${t}%,display_name.ilike.%${t}%`);
  const { data, error } = await q;
  if (error) throw error;
  return data ?? [];
}

export async function fetchConversations(meId: string): Promise<ConversationSummary[]> {
  const { data: convs, error } = await supabase
    .from("conversations")
    .select("id, last_message_at, conversation_participants(user_id, profiles(id, username, display_name))")
    .order("last_message_at", { ascending: false });
  if (error) throw error;
  const ids = (convs ?? []).map((c) => c.id);
  const lastById = new Map<string, Message>();
  if (ids.length) {
    // Fetch recent messages and pick last per conversation
    const { data: msgs, error: mErr } = await supabase
      .from("messages")
      .select("*")
      .in("conversation_id", ids)
      .order("created_at", { ascending: false })
      .limit(Math.max(200, ids.length * 5));
    if (mErr) throw mErr;
    for (const m of msgs ?? []) if (!lastById.has(m.conversation_id)) lastById.set(m.conversation_id, m);
  }
  return (convs ?? []).map((c) => {
    const parts = (c.conversation_participants ?? []) as { user_id: string; profiles: Profile | null }[];
    const other = parts.find((p) => p.user_id !== meId)?.profiles ?? null;
    return { id: c.id, last_message_at: c.last_message_at, other, last: lastById.get(c.id) ?? null };
  });
}

export async function fetchMessages(conversationId: string): Promise<Message[]> {
  const { data, error } = await supabase
    .from("messages")
    .select("*")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true })
    .limit(500);
  if (error) throw error;
  return data ?? [];
}

export async function startConversation(otherId: string): Promise<string> {
  const { data, error } = await supabase.rpc("get_or_create_dm", { _other: otherId });
  if (error) throw error;
  return data as string;
}

export async function sendMessage(conversationId: string, senderId: string, content: string) {
  const text = content.trim();
  if (!text) throw new Error("Message can't be empty");
  if (text.length > 4000) throw new Error("Message is too long (max 4000 characters)");
  const { data, error } = await supabase
    .from("messages")
    .insert({ conversation_id: conversationId, sender_id: senderId, content: text })
    .select()
    .single();
  if (error) throw error;
  return data as Message;
}

export function initials(name?: string | null) {
  if (!name) return "?";
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]!.toUpperCase()).join("");
}

const avatarTones = ["bg-chart-1", "bg-chart-2", "bg-chart-3", "bg-chart-4", "bg-chart-5"];
export function avatarTone(id?: string) {
  if (!id) return avatarTones[0];
  let h = 0;
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return avatarTones[h % avatarTones.length];
}

export function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}
export function formatRelative(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) return formatTime(iso);
  const diff = (now.getTime() - d.getTime()) / 86400000;
  if (diff < 7) return d.toLocaleDateString([], { weekday: "short" });
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}
export function formatDay(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) return "Today";
  const y = new Date(now); y.setDate(now.getDate() - 1);
  if (d.toDateString() === y.toDateString()) return "Yesterday";
  return d.toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" });
}

export function errorMessage(e: unknown) {
  if (e && typeof e === "object" && "message" in e) return String((e as { message: unknown }).message);
  return "Something went wrong";
}

import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, MessageCircle, MailCheck } from "lucide-react";
import { errorMessage } from "@/lib/chat";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — Relay" },
      { name: "description", content: "Sign in or create your Relay account to start private conversations." },
      { property: "og:title", content: "Sign in — Relay" },
      { property: "og:description", content: "Sign in or create your Relay account." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

const signUpSchema = z.object({
  displayName: z.string().trim().min(1, "Display name is required").max(50),
  username: z.string().trim().toLowerCase().regex(/^[a-z0-9_]{3,24}$/, "Username: 3–24 letters, numbers or _"),
  email: z.string().trim().email("Enter a valid email").max(255),
  password: z.string().min(8, "Password must be at least 8 characters").max(72),
});
const signInSchema = z.object({
  email: z.string().trim().email("Enter a valid email"),
  password: z.string().min(1, "Password is required"),
});

function AuthPage() {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmSent, setConfirmSent] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => { if (data.user) navigate({ to: "/chat" }); });
    const { data } = supabase.auth.onAuthStateChange((e, s) => { if (e === "SIGNED_IN" && s) navigate({ to: "/chat" }); });
    return () => data.subscription.unsubscribe();
  }, [navigate]);

  async function onSignIn(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const f = new FormData(e.currentTarget);
    const parsed = signInSchema.safeParse({ email: f.get("email"), password: f.get("password") });
    if (!parsed.success) return setError(parsed.error.issues[0]!.message);
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword(parsed.data);
    setBusy(false);
    if (error) setError(error.message === "Invalid login credentials" ? "Wrong email or password." : error.message);
  }

  async function onSignUp(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const f = new FormData(e.currentTarget);
    const parsed = signUpSchema.safeParse({
      displayName: f.get("displayName"), username: f.get("username"), email: f.get("email"), password: f.get("password"),
    });
    if (!parsed.success) return setError(parsed.error.issues[0]!.message);
    setBusy(true);
    try {
      const { data: taken } = await supabase.rpc("username_available", { _username: parsed.data.username });
      if (taken === false) throw new Error("That username is already taken");
      const { data, error } = await supabase.auth.signUp({
        email: parsed.data.email,
        password: parsed.data.password,
        options: {
          emailRedirectTo: `${window.location.origin}/chat`,
          data: { username: parsed.data.username, display_name: parsed.data.displayName },
        },
      });
      if (error) throw error;
      if (!data.session) setConfirmSent(parsed.data.email);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function onGoogle() {
    setError(null);
    const r = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin + "/auth" });
    if (r.error) setError(errorMessage(r.error));
  }

  return (
    <main className="bg-hero flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <Link to="/" className="mb-8 flex items-center justify-center gap-2 font-display text-2xl font-bold">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <MessageCircle className="h-5 w-5" />
          </span>
          Relay
        </Link>
        <div className="rounded-3xl border bg-card p-6 shadow-soft sm:p-8">
          {confirmSent ? (
            <div className="py-6 text-center">
              <MailCheck className="mx-auto h-10 w-10 text-primary" />
              <h2 className="mt-4 text-xl font-semibold">Check your inbox</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                We sent a confirmation link to <strong>{confirmSent}</strong>. Click it to activate your account.
              </p>
              <Button variant="outline" className="mt-6" onClick={() => setConfirmSent(null)}>Back to sign in</Button>
            </div>
          ) : (
            <Tabs defaultValue="signin" onValueChange={() => setError(null)}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="signin">Sign in</TabsTrigger>
                <TabsTrigger value="signup">Create account</TabsTrigger>
              </TabsList>
              <TabsContent value="signin">
                <form onSubmit={onSignIn} className="mt-4 space-y-4" noValidate>
                  <Field id="si-email" name="email" label="Email" type="email" autoComplete="email" />
                  <Field id="si-pass" name="password" label="Password" type="password" autoComplete="current-password" />
                  {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
                  <Button className="w-full" disabled={busy}>{busy && <Loader2 className="animate-spin" />}Sign in</Button>
                </form>
              </TabsContent>
              <TabsContent value="signup">
                <form onSubmit={onSignUp} className="mt-4 space-y-4" noValidate>
                  <Field id="su-name" name="displayName" label="Display name" autoComplete="name" />
                  <Field id="su-user" name="username" label="Username" autoComplete="username" placeholder="e.g. priya_k" />
                  <Field id="su-email" name="email" label="Email" type="email" autoComplete="email" />
                  <Field id="su-pass" name="password" label="Password" type="password" autoComplete="new-password" placeholder="At least 8 characters" />
                  {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
                  <Button className="w-full" disabled={busy}>{busy && <Loader2 className="animate-spin" />}Create account</Button>
                </form>
              </TabsContent>
              <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground">
                <div className="h-px flex-1 bg-border" />or<div className="h-px flex-1 bg-border" />
              </div>
              <Button type="button" variant="outline" className="w-full" onClick={onGoogle}>Continue with Google</Button>
            </Tabs>
          )}
        </div>
      </div>
    </main>
  );
}

function Field({ id, label, ...props }: { id: string; label: string } & React.ComponentProps<"input">) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} {...props} />
    </div>
  );
}

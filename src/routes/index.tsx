import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { MessageCircle, Lock, Zap } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Veyro — private, real-time messaging" },
      { name: "description", content: "Veyro is a fast, private one-to-one chat app with instant delivery and persistent history." },
      { property: "og:title", content: "Veyro — private, real-time messaging" },
      { property: "og:description", content: "Instant one-to-one conversations with persistent history." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <main className="bg-hero min-h-screen">
      <div className="mx-auto flex max-w-5xl flex-col px-6 py-8">
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-2 font-display text-xl font-bold">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <MessageCircle className="h-4 w-4" />
            </span>
            Veyro
          </div>
          <Button asChild variant="ghost"><Link to="/auth">Sign in</Link></Button>
        </header>
        <section className="py-24 md:py-32">
          <p className="mb-4 inline-block rounded-full bg-accent px-3 py-1 text-xs font-medium text-accent-foreground">
            Built for FIRST COMMIT · IIT Mandi
          </p>
          <h1 className="max-w-3xl text-5xl font-bold leading-[1.05] md:text-7xl">
            Say it once.<br />It lands <span className="text-signal">instantly.</span>
          </h1>
          <p className="mt-6 max-w-xl text-lg text-muted-foreground">
            Private one-to-one conversations that arrive the moment you hit send — and are still there when you come back.
          </p>
          <div className="mt-10 flex gap-3">
            <Button asChild size="lg"><Link to="/chat">Open Veyro</Link></Button>
            <Button asChild size="lg" variant="outline"><Link to="/auth">Create account</Link></Button>
          </div>
        </section>
        <section className="grid gap-4 pb-16 md:grid-cols-3">
          {[
            { icon: Zap, t: "Real-time", d: "Messages stream over live connections — no refresh." },
            { icon: Lock, t: "Private by design", d: "Only the two people in a conversation can read it." },
            { icon: MessageCircle, t: "Persistent", d: "Your history loads on every device you sign in to." },
          ].map(({ icon: I, t, d }) => (
            <div key={t} className="rounded-2xl border bg-card p-6 shadow-soft">
              <I className="h-5 w-5 text-primary" />
              <h3 className="mt-3 font-semibold">{t}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{d}</p>
            </div>
          ))}
        </section>
      </div>
    </main>
  );
}

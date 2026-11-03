import { Link } from "react-router-dom";
import { ArrowRight, MessageCircle, Moon, Send, Zap } from "lucide-react";
import AuthButton from "@/features/auth/components/AuthButton";
import Header from "@/shared/components/Header";
import { Brand } from "@/shared/components/Brand";
import FeatureCard from "@/shared/components/FeatureCard";

export default function HomePage() {
  return (
    <div className="brand-scene min-h-dvh overflow-hidden">
      <Header />
      <main className="mx-auto max-w-6xl px-5 pb-16 sm:px-8">
        <section className="grid min-h-[75dvh] items-center gap-10 py-12 text-center md:grid-cols-2 md:py-20 md:text-left">
          <div className="relative order-first mx-auto flex w-full max-w-sm items-center justify-center rounded-[2.5rem] border border-border bg-[#050A12] px-6 py-14 shadow-[0_0_80px_var(--brand-halo)] md:order-last md:py-24">
            <div className="pointer-events-none absolute inset-0 rounded-[2.5rem] bg-[url('/brand/gotham-skyline.svg')] bg-cover bg-bottom opacity-60" />
            <Brand variant="vertical" className="relative w-full max-w-72" />
          </div>
          <div className="space-y-6">
            <span className="inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/5 px-3 py-1.5 text-xs font-medium text-brand">
              <span className="size-1.5 rounded-full bg-primary" /> YOUR SIGNAL.
              YOUR PEOPLE.
            </span>
            <h1 className="text-4xl leading-[1.12] font-bold tracking-tight sm:text-6xl">
              Out of the dark.
              <br />
              <span className="text-brand">Into the conversation.</span>
            </h1>
            <p className="mx-auto max-w-md text-base leading-7 text-muted-foreground md:mx-0">
              A little Gotham. A lot of connection. Bring your conversations to
              life with BatGram.
            </p>
            <div className="flex flex-col items-center gap-4 md:items-start">
              <AuthButton type="button" />
              <Link
                to="/login"
                className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-brand"
              >
                Already have an account? Log in{" "}
                <ArrowRight className="size-4" />
              </Link>
            </div>
            <p className="text-xs text-muted-foreground">
              Real-time messaging. Made for your everyday.
            </p>
          </div>
        </section>
        <section className="space-y-8 border-t border-border py-12 text-center">
          <div>
            <p className="mb-3 text-xs font-semibold tracking-[.2em] text-brand">
              STAY IN YOUR ELEMENT
            </p>
            <h2 className="text-3xl font-bold tracking-tight">Chat smarter.</h2>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <FeatureCard
              icon={MessageCircle}
              title="Keep it flowing"
              description="Real-time messages, typing indicators and read receipts keep the conversation moving."
            />
            <FeatureCard
              icon={Moon}
              title="Your kind of night"
              description="An electric dark theme or a fresh light look. Switch whenever you feel like it."
            />
            <FeatureCard
              icon={Zap}
              title="Always within reach"
              description="Install BatGram on your home screen and jump straight back into your chats."
            />
          </div>
        </section>
        <div className="brand-panel flex flex-col items-center justify-between gap-5 rounded-3xl p-6 text-center sm:flex-row sm:text-left">
          <div className="flex items-center gap-4">
            <Send className="size-7 shrink-0 text-brand" />
            <div>
              <h2 className="font-semibold">
                Your next conversation starts here.
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Find your people. Send your signal.
              </p>
            </div>
          </div>
          <Link
            to="/login"
            className="inline-flex items-center gap-2 text-sm font-semibold text-brand"
          >
            Get started <ArrowRight className="size-4" />
          </Link>
        </div>
      </main>
      <footer className="border-t border-border px-5 py-6">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 sm:flex-row">
          <Brand className="w-36" />
          <p className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} BatGram. Stay connected.
          </p>
        </div>
      </footer>
    </div>
  );
}

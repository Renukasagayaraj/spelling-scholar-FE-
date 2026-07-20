import { useState } from "react";
import { Link } from "react-router-dom";
import { Check, Sparkles, ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

const MONTHLY = 9.99;
const ANNUAL_TOTAL = 99; // ~2 months free

export default function Pricing() {
  const [billing, setBilling] = useState<"monthly" | "yearly">("monthly");
  const { toast } = useToast();

  const notifyPlaceholder = (plan: string) =>
    toast({
      title: `${plan} — coming soon`,
      description: "Checkout isn't wired up yet. We'll let you know when it goes live.",
    });

  return (
    <div className="min-h-screen bg-background text-foreground font-body">
      <header className="sticky top-0 z-40 backdrop-blur bg-background/80 border-b border-border">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link to="/landing" className="flex items-center gap-2 font-display font-semibold text-lg">
            <ArrowLeft className="h-4 w-4" />
            AI Spelling Coach
          </Link>
          <nav className="hidden md:flex items-center gap-7 text-base font-medium text-foreground">
            <Link to="/landing" className="hover:text-primary transition">Home</Link>
            <Link to="/pricing" className="text-primary">Pricing</Link>
            <Link to="/" className="hover:text-primary transition">Open app</Link>
          </nav>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-16 sm:py-24">
        <div className="text-center max-w-2xl mx-auto space-y-4">
          <div className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-primary bg-primary/10 rounded-full px-3 py-1">
            <Sparkles className="h-3.5 w-3.5" />
            Pricing
          </div>
          <h1 className="text-4xl sm:text-5xl font-display font-semibold tracking-tight font-serif">
            Simple pricing.<span className="text-primary"> Master every word.</span>
          </h1>
          <p className="text-base sm:text-lg text-muted-foreground">
            Start free with the first 50 standard words. Upgrade any time to unlock every practice mode.
          </p>
        </div>

        {/* Billing toggle */}
        <div className="mt-10 flex justify-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card p-1">
            <button
              type="button"
              onClick={() => setBilling("monthly")}
              className={cn(
                "px-4 py-1.5 rounded-full text-sm font-medium transition",
                billing === "monthly"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              Monthly
            </button>
            <button
              type="button"
              onClick={() => setBilling("yearly")}
              className={cn(
                "px-4 py-1.5 rounded-full text-sm font-medium transition",
                billing === "yearly"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              Yearly
            </button>
          </div>
        </div>

        {/* Plans */}
        <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
          {/* Free */}
          <div className="rounded-2xl border border-border bg-card p-8 flex flex-col">
            <div className="space-y-1">
              <h2 className="text-xl font-display font-semibold">Free</h2>
              <p className="text-sm text-muted-foreground">Try the coach.</p>
            </div>
            <div className="mt-6">
              <span className="text-4xl font-display font-semibold">$0</span>
            </div>
            <ul className="mt-6 space-y-3 text-sm flex-1">
              <Feature>Upto 50 words of StandardPractice</Feature>
              <Feature>AI coaching feedback on every attempt</Feature>
              <Feature>Audio pronunciation & smart hints</Feature>
              <Feature>Session history</Feature>
            </ul>
            <button
              onClick={() => notifyPlaceholder("Free plan")}
              className="mt-8 w-full py-3 rounded-xl border border-border font-medium text-foreground hover:bg-accent transition"
            >
              Get started free
            </button>
          </div>

          {/* Premium */}
          <div className="relative rounded-2xl border-2 border-primary bg-card p-8 flex flex-col shadow-lg">
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground text-[10px] font-semibold uppercase tracking-wider px-3 py-1 rounded-full">
              {billing === "yearly" ? "Save 17%" : "Most popular"}
            </div>
            <div className="space-y-1">
              <h2 className="text-xl font-display font-semibold">Premium</h2>
              <p className="text-sm text-muted-foreground">
                {billing === "yearly"
                  ? "One year, best value. Cancel anytime."
                  : "Pay month to month. Cancel anytime."}
              </p>
            </div>
            <div className="mt-6">
              <span className="text-4xl font-display font-semibold">
                ${billing === "yearly" ? ANNUAL_TOTAL : MONTHLY.toFixed(2)}
              </span>
              <span className="text-muted-foreground ml-1">
                /{billing === "yearly" ? "year" : "month"}
              </span>
              {billing === "yearly" && (
                <p className="text-xs text-muted-foreground mt-1">
                  ${(ANNUAL_TOTAL / 12).toFixed(2)}/mo equivalent — two months free
                </p>
              )}
            </div>
            <ul className="mt-6 space-y-3 text-sm flex-1">
              <Feature>Unlimited Standard Practice — all levels</Feature>
              <Feature highlight>Custom Word Lists — import your own</Feature>
              <Feature highlight>Language Origins — Greek, Latin, French & more</Feature>
              <Feature>Mock Bee competitions</Feature>
              <Feature>Full reports & progress tracking</Feature>
              <Feature>Priority AI coaching</Feature>
            </ul>
            <button
              onClick={() =>
                notifyPlaceholder(billing === "yearly" ? "Premium Yearly" : "Premium Monthly")
              }
              className="mt-8 w-full py-3 rounded-xl bg-primary text-primary-foreground font-semibold hover:opacity-90 transition"
            >
              {billing === "yearly" ? "Upgrade annually" : "Upgrade monthly"}
            </button>
          </div>
        </div>

        {/* FAQ */}
        <div className="mt-20 max-w-3xl mx-auto">
          <h3 className="text-2xl font-display font-semibold text-center mb-8 font-serif">
            Frequently asked
          </h3>
          <div className="space-y-4">
            <Faq q="What's included in the free plan?">
              You get the first 50 words of Standard Practice with full AI coaching, audio, and hints — no credit card needed.
            </Faq>
            <Faq q="What unlocks with Premium?">
              Custom Word Lists (import your own words) and Language Origins (practice by Greek, Latin, French, etc.) are Premium-only. Premium also removes the 50-word cap on Standard Practice.
            </Faq>
            <Faq q="Can I cancel anytime?">
              Yes. Cancel from your account settings and you'll keep Premium access until the end of the billing period.
            </Faq>
            <Faq q="Is there a school or family plan?">
              Not yet — but we're working on it. Reach out if you're interested.
            </Faq>
          </div>
        </div>
      </main>
    </div>
  );
}

function Feature({ children, highlight }: { children: React.ReactNode; highlight?: boolean }) {
  return (
    <li className="flex items-start gap-2.5">
      <Check className={cn("h-4 w-4 mt-0.5 shrink-0", highlight ? "text-primary" : "text-muted-foreground")} />
      <span className={cn(highlight && "font-medium text-foreground")}>{children}</span>
    </li>
  );
}

function Faq({ q, children }: { q: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <p className="font-semibold text-foreground">{q}</p>
      <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">{children}</p>
    </div>
  );
}

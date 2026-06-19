import { useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowRight,
  Sparkles,
  GraduationCap,
  Globe,
  List as ListIcon,
  Mic,
  Trophy,
  BookOpen,
  CheckCircle2,
  Star,
} from "lucide-react";
import { AuthDialog } from "@/components/AuthDialog";
import { useAuth } from "@/hooks/use-auth";
import beePng from "@/assets/bee.png";
import themeSparkle from "@/assets/theme-sparkle.jpg";
import themeBee from "@/assets/theme-bee.jpg";
import themeDino from "@/assets/theme-dino.jpg";
import themeNature from "@/assets/theme-nature.jpg";
import themeSpace from "@/assets/theme-space.jpg";
import themeSunset from "@/assets/theme-sunset-sea.jpg";

const features = [
  {
    icon: GraduationCap,
    title: "Standard Practice",
    desc: "Level-based spelling practice that adapts from beginner to competition level with smart difficulty scaling.",
  },
  {
    icon: ListIcon,
    title: "Custom Word Lists",
    desc: "Parents and teachers can import their own lists — homework, spelling bee prep, vocabulary words.",
  },
  {
    icon: Globe,
    title: "Foreign Origin Drills",
    desc: "Master tricky words rooted in French, Japanese, Latin, Greek, and more — with etymology baked in.",
  },
  {
    icon: Mic,
    title: "Voice-First Practice",
    desc: "Hear pronunciations and respond by voice. Real coaching feedback like a human tutor.",
  },
  {
    icon: BookOpen,
    title: "Deep Coaching Feedback",
    desc: "Beyond right/wrong: error analysis, miss categories, memory tips, and linguistic patterns.",
  },
  {
    icon: Trophy,
    title: "Rewards & Themes",
    desc: "Streaks, level-ups, and a dozen playful themes — dinos, space, sunset sea, sparkle and more.",
  },
];

const themes = [
  { name: "Sparkle", img: themeSparkle },
  { name: "Bee", img: themeBee },
  { name: "Dino", img: themeDino },
  { name: "Nature", img: themeNature },
  { name: "Space", img: themeSpace },
  { name: "Sunset Sea", img: themeSunset },
];

const steps = [
  { n: "01", title: "Pick a channel", desc: "Standard practice, custom lists, or foreign-origin drills." },
  { n: "02", title: "Spell out loud or type", desc: "Audio pronunciations, hints, and on-demand definitions." },
  { n: "03", title: "Get coached", desc: "Per-word miss analysis, memory tips, and a downloadable session report." },
];

export default function Landing() {
  const { user } = useAuth();
  const [authOpen, setAuthOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background text-foreground font-body">
      {/* Nav */}
      <header className="sticky top-0 z-40 backdrop-blur bg-background/80 border-b border-border">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link to="/landing" className="flex items-center gap-2">
            <img src={beePng} alt="AI Spelling Coach mascot" className="w-8 h-8" />
            <span className="font-display font-semibold text-lg">AI Spelling Coach</span>
          </Link>
          <nav className="hidden md:flex items-center gap-7 text-sm text-muted-foreground">
            <a href="#features" className="hover:text-foreground transition">Features</a>
            <a href="#how" className="hover:text-foreground transition">How it works</a>
            <a href="#themes" className="hover:text-foreground transition">Themes</a>
            <a href="#faq" className="hover:text-foreground transition">FAQ</a>
          </nav>
          <div className="flex items-center gap-2">
            {user ? (
              <Link
                to="/"
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition"
              >
                Open app <ArrowRight className="h-4 w-4" />
              </Link>
            ) : (
              <>
                <button
                  onClick={() => setAuthOpen(true)}
                  className="px-3 py-2 text-sm text-muted-foreground hover:text-foreground transition"
                >
                  Sign in
                </button>
                <button
                  onClick={() => setAuthOpen(true)}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition"
                >
                  Get started <ArrowRight className="h-4 w-4" />
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div
          className="absolute inset-0 -z-10 opacity-60"
          style={{
            background:
              "radial-gradient(60% 60% at 20% 10%, hsl(var(--primary) / 0.18), transparent 60%), radial-gradient(50% 50% at 90% 30%, hsl(var(--accent) / 0.18), transparent 60%), radial-gradient(40% 40% at 50% 100%, hsl(var(--secondary) / 0.15), transparent 60%)",
          }}
        />
        <div className="max-w-6xl mx-auto px-6 pt-16 pb-20 md:pt-24 md:pb-28 grid md:grid-cols-2 gap-12 items-center">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-chip text-chip-foreground text-xs font-medium">
              <Sparkles className="h-3.5 w-3.5" /> Built for spelling bee prep
            </span>
            <h1 className="mt-4 font-display text-4xl md:text-6xl font-bold tracking-tight leading-[1.05]">
              Spell smarter. <br />
              <span className="text-primary">Coached by AI.</span>
            </h1>
            <p className="mt-5 text-lg text-muted-foreground max-w-xl">
              A delightful, voice-first spelling tutor for kids — with deep coaching feedback,
              custom word lists, foreign-origin drills, and downloadable session reports parents love.
            </p>
            <div className="mt-7 flex flex-wrap items-center gap-3">
              <button
                onClick={() => (user ? null : setAuthOpen(true))}
                className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-primary text-primary-foreground font-semibold shadow-lg shadow-primary/20 hover:opacity-95 transition"
              >
                {user ? (
                  <Link to="/" className="inline-flex items-center gap-2">
                    Open the app <ArrowRight className="h-4 w-4" />
                  </Link>
                ) : (
                  <>
                    Start practicing free <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </button>
              <Link
                to="/"
                className="inline-flex items-center gap-2 px-5 py-3 rounded-xl border border-border text-foreground hover:bg-muted transition"
              >
                Try the demo
              </Link>
            </div>
            <div className="mt-6 flex items-center gap-4 text-sm text-muted-foreground">
              <div className="flex -space-x-1">
                {[0, 1, 2, 3, 4].map((i) => (
                  <Star key={i} className="h-4 w-4 fill-secondary text-secondary" />
                ))}
              </div>
              Loved by parents prepping their kids for spelling bees.
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="relative"
          >
            <div className="absolute -inset-6 rounded-3xl bg-gradient-to-br from-primary/10 via-accent/10 to-secondary/10 blur-2xl" />
            <div className="relative rounded-2xl border border-border bg-card shadow-2xl shadow-foreground/5 p-6">
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Practice · Level 3
                </span>
                <span className="text-xs px-2 py-1 rounded-md bg-chip-accent text-chip-accent-foreground">
                  Streak · 7
                </span>
              </div>
              <div className="rounded-xl bg-muted/60 p-6">
                <p className="text-sm text-muted-foreground mb-2">Listen and spell</p>
                <div className="flex items-center gap-3">
                  <button className="h-12 w-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-md">
                    <Mic className="h-5 w-5" />
                  </button>
                  <div className="flex-1 h-12 rounded-lg border border-border bg-background flex items-center px-4 text-muted-foreground">
                    Type your answer…
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  {["Definition", "Example", "Origin", "Part of speech"].map((c) => (
                    <span key={c} className="text-xs px-2.5 py-1 rounded-full bg-background border border-border">
                      {c}
                    </span>
                  ))}
                </div>
              </div>
              <div className="mt-4 grid grid-cols-3 gap-3 text-center">
                {[
                  { k: "Correct", v: "12" },
                  { k: "Words", v: "15" },
                  { k: "Accuracy", v: "80%" },
                ].map((s) => (
                  <div key={s.k} className="rounded-lg bg-muted/50 py-3">
                    <div className="font-display font-semibold text-lg">{s.v}</div>
                    <div className="text-xs text-muted-foreground">{s.k}</div>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-20 md:py-28">
        <div className="max-w-6xl mx-auto px-6">
          <div className="max-w-2xl">
            <h2 className="font-display text-3xl md:text-4xl font-bold">
              Everything a young speller needs.
            </h2>
            <p className="mt-3 text-muted-foreground">
              Real coaching, not just a quiz. Built around how kids actually learn — with voice,
              etymology, and feedback that explains the why.
            </p>
          </div>
          <div className="mt-12 grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {features.map((f) => (
              <div
                key={f.title}
                className="group rounded-2xl border border-border bg-card p-6 hover:shadow-xl hover:shadow-foreground/5 transition"
              >
                <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center mb-4">
                  <f.icon className="h-5 w-5" />
                </div>
                <h3 className="font-display font-semibold text-lg">{f.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="py-20 md:py-24 bg-muted/40 border-y border-border">
        <div className="max-w-6xl mx-auto px-6">
          <h2 className="font-display text-3xl md:text-4xl font-bold">How it works</h2>
          <div className="mt-12 grid md:grid-cols-3 gap-6">
            {steps.map((s) => (
              <div key={s.n} className="rounded-2xl bg-background border border-border p-6">
                <div className="font-display text-3xl font-bold text-primary">{s.n}</div>
                <h3 className="mt-3 font-display font-semibold text-lg">{s.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Themes */}
      <section id="themes" className="py-20 md:py-28">
        <div className="max-w-6xl mx-auto px-6">
          <div className="flex items-end justify-between flex-wrap gap-4">
            <div>
              <h2 className="font-display text-3xl md:text-4xl font-bold">Themes kids actually want to use.</h2>
              <p className="mt-3 text-muted-foreground max-w-xl">
                Swap looks any time. From bees and dinos to space and sunset sea.
              </p>
            </div>
          </div>
          <div className="mt-10 grid grid-cols-2 md:grid-cols-3 gap-4">
            {themes.map((t) => (
              <div key={t.name} className="relative rounded-2xl overflow-hidden aspect-[4/3] border border-border group">
                <img
                  src={t.img}
                  alt={`${t.name} theme preview`}
                  className="w-full h-full object-cover group-hover:scale-105 transition duration-500"
                />
                <div className="absolute inset-x-0 bottom-0 p-3 bg-gradient-to-t from-black/60 to-transparent">
                  <span className="text-white font-display font-semibold">{t.name}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Parents section */}
      <section className="py-20 md:py-24 bg-muted/40 border-y border-border">
        <div className="max-w-6xl mx-auto px-6 grid md:grid-cols-2 gap-12 items-center">
          <div>
            <h2 className="font-display text-3xl md:text-4xl font-bold">Built with parents in mind.</h2>
            <p className="mt-3 text-muted-foreground">
              Track each session, see exactly where your child struggled, and download a tidy PDF report
              after every practice — perfect for spelling bee prep notebooks.
            </p>
            <ul className="mt-6 space-y-3 text-sm">
              {[
                "Per-word miss analysis with error types and memory tips",
                "Concept labels (morphology) for every word",
                "One-click downloadable session report (PDF)",
                "Custom list import for homework or weekly word lists",
              ].map((b) => (
                <li key={b} className="flex items-start gap-2.5">
                  <CheckCircle2 className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                  <span>{b}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-2xl border border-border bg-card p-6 shadow-xl shadow-foreground/5">
            <div className="text-xs uppercase tracking-wider text-muted-foreground">Session Report</div>
            <div className="mt-2 font-display font-semibold text-lg">AI Spelling Coach — Session Report</div>
            <div className="mt-4 space-y-3 text-sm">
              {[
                { w: "rhythm", ok: true },
                { w: "conscience", ok: false },
                { w: "silhouette", ok: true },
                { w: "millennium", ok: false },
              ].map((r) => (
                <div key={r.w} className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-2">
                  <span className="font-medium">{r.w}</span>
                  <span
                    className={
                      r.ok
                        ? "text-xs px-2 py-0.5 rounded-md bg-success/15 text-success"
                        : "text-xs px-2 py-0.5 rounded-md bg-destructive/15 text-destructive"
                    }
                  >
                    {r.ok ? "Correct" : "Coached"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="py-20 md:py-24">
        <div className="max-w-3xl mx-auto px-6">
          <h2 className="font-display text-3xl md:text-4xl font-bold">Questions, answered.</h2>
          <div className="mt-10 divide-y divide-border border-y border-border">
            {[
              {
                q: "Is it really free to start?",
                a: "Yes — create an account and start practicing right away. No card required.",
              },
              {
                q: "What ages is it best for?",
                a: "Designed for elementary and middle-school spellers — including kids prepping for competitive spelling bees.",
              },
              {
                q: "Can I upload my own word list?",
                a: "Yes. Parents and teachers can import custom lists for homework, weekly words, or bee prep.",
              },
              {
                q: "Does it work with voice?",
                a: "Absolutely — your child can hear the word pronounced and respond by voice or by typing.",
              },
            ].map((f) => (
              <details key={f.q} className="group py-5">
                <summary className="flex items-center justify-between cursor-pointer list-none">
                  <span className="font-display font-semibold">{f.q}</span>
                  <span className="text-muted-foreground group-open:rotate-45 transition">+</span>
                </summary>
                <p className="mt-3 text-sm text-muted-foreground">{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 md:py-28">
        <div className="max-w-5xl mx-auto px-6">
          <div
            className="relative overflow-hidden rounded-3xl p-10 md:p-16 text-center"
            style={{
              background:
                "linear-gradient(135deg, hsl(var(--primary)) 0%, hsl(var(--accent)) 100%)",
            }}
          >
            <h2 className="font-display text-3xl md:text-5xl font-bold text-primary-foreground">
              Ready to spell smarter?
            </h2>
            <p className="mt-4 text-primary-foreground/85 max-w-xl mx-auto">
              Join families using AI Spelling Coach to make daily practice something kids actually look forward to.
            </p>
            <div className="mt-8 flex items-center justify-center gap-3 flex-wrap">
              {user ? (
                <Link
                  to="/"
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-background text-foreground font-semibold hover:opacity-95 transition"
                >
                  Open the app <ArrowRight className="h-4 w-4" />
                </Link>
              ) : (
                <button
                  onClick={() => setAuthOpen(true)}
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-background text-foreground font-semibold hover:opacity-95 transition"
                >
                  Create your free account <ArrowRight className="h-4 w-4" />
                </button>
              )}
              <Link
                to="/"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl border border-primary-foreground/30 text-primary-foreground hover:bg-primary-foreground/10 transition"
              >
                Try the demo
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-10">
        <div className="max-w-6xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <img src={beePng} alt="" className="w-6 h-6" />
            <span>© {new Date().getFullYear()} AI Spelling Coach</span>
          </div>
          <div className="flex items-center gap-5">
            <a href="#features" className="hover:text-foreground transition">Features</a>
            <a href="#faq" className="hover:text-foreground transition">FAQ</a>
            <Link to="/" className="hover:text-foreground transition">Open app</Link>
          </div>
        </div>
      </footer>

      <AuthDialog open={authOpen} onOpenChange={setAuthOpen} />
    </div>
  );
}

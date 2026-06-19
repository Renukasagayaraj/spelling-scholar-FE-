import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { GraduationCap, BookOpen, Globe, Sparkles, Loader2, Trophy, BarChart3 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
import {
  fetchCustomLists,
  fetchForeignOrigins,
  type CustomListSummary,
  type ForeignOriginSummary,
} from "@/lib/api";

export type ChannelSelection =
  | { kind: "standard" }
  | { kind: "customManage" }
  | { kind: "customList"; list: CustomListSummary }
  | { kind: "foreignManage" }
  | { kind: "foreignOrigin"; origin: ForeignOriginSummary };

interface ChannelsDashboardProps {
  onSelectChannel: (selection: ChannelSelection) => void;
}

interface CardConfig {
  key: string;
  title: string;
  subtitle: string;
  Icon: typeof GraduationCap;
  // Background and icon-color tokens — using semantic chip palette so themes work
  bgClass: string;
  iconColorClass: string;
  onClick: () => void;
}

export function ChannelsDashboard({ onSelectChannel }: ChannelsDashboardProps) {
  const { user } = useAuth();
  const [customLists, setCustomLists] = useState<CustomListSummary[]>([]);
  const [origins, setOrigins] = useState<ForeignOriginSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        // Only fetch custom lists when authenticated to avoid 401 noise.
        const [listsRes, originsRes] = await Promise.allSettled([
          user ? fetchCustomLists() : Promise.resolve({ lists: [] as CustomListSummary[] }),
          fetchForeignOrigins(),
        ]);
        if (cancelled) return;
        if (listsRes.status === "fulfilled") setCustomLists(listsRes.value.lists || []);
        else setCustomLists([]);
        if (originsRes.status === "fulfilled") setOrigins(originsRes.value.origins || []);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [user]);

  const cards: CardConfig[] = [
    {
      key: "standard",
      title: "Standard Practice",
      subtitle: "Curated words organized by level. Pick a level and get started.",
      Icon: GraduationCap,
      bgClass: "bg-[hsl(var(--channel-green))]",
      iconColorClass: "text-primary",
      onClick: () => onSelectChannel({ kind: "standard" }),
    },
    {
      key: "custom-manage",
      title: "My Word Lists",
      subtitle: !user
        ? "Sign in to bring your own word lists from a CSV or text file or type them in the app."
        : customLists.length > 0
          ? `${customLists.length} saved list${customLists.length === 1 ? "" : "s"}. Practice or import more.`
          : "Import a new list from a CSV or text file to practice your own words.",
      Icon: BookOpen,
      bgClass: "bg-[hsl(var(--channel-warm))]",
      iconColorClass: "text-secondary",
      onClick: () => onSelectChannel({ kind: "customManage" }),
    },
    {
      key: "foreign-manage",
      title: "Language Origins",
      subtitle:
        origins.length > 0
          ? `Explore ${origins.length} language${origins.length === 1 ? "" : "s"} of origin and master tricky loanwords.`
          : "Explore words grouped by their language of origin.",
      Icon: Globe,
      bgClass: "bg-[hsl(var(--channel-purple))]",
      iconColorClass: "text-accent",
      onClick: () => onSelectChannel({ kind: "foreignManage" }),
    },
    {
      key: "mock-bee",
      title: "Mock Bee",
      subtitle: "Practice in spelling bee-style with timed words and competition words.",
      Icon: Trophy,
      bgClass: "bg-[hsl(var(--channel-yellow))]",
      iconColorClass: "text-warning",
      onClick: () => {},
    },
    {
      key: "reports",
      title: "Reports",
      subtitle: "Track progress, accuracy trends, and words that need more practice.",
      Icon: BarChart3,
      bgClass: "bg-[hsl(var(--channel-blue))]",
      iconColorClass: "text-info",
      onClick: () => {},
    },
  ];

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* Hero */}
      <div className="text-center max-w-3xl mx-auto pt-0 space-y-3">
        <div className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-primary bg-primary/10 rounded-full px-3 py-1">
          <Sparkles className="h-3.5 w-3.5" />
          AI Spelling Coach
        </div>
        <h1 className="text-4xl sm:text-5xl font-display tracking-tight text-foreground leading-[1.05] lg:text-4xl font-semibold">
          <span className="text-foreground font-serif">Master every word, </span><span className="text-primary font-serif">one at a time.</span>
        </h1>
        <p className="text-base sm:text-lg text-muted-foreground max-w-xl mx-auto leading-relaxed">
          Practice spelling with audio, smart hints, and personalized<br />
          AI-powered coaching. Choose a practice mode below to begin.
        </p>
      </div>

      {/* Channel cards — webapp grid */}
      <div>
        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
            {cards.map((card, idx) => {
              const Icon = card.Icon;
              return (
                <motion.button
                  key={card.key}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(idx * 0.05, 0.4) }}
                  whileHover={{ y: -2 }}
                  onClick={card.onClick}
                  className={cn(
                    "group relative flex flex-col items-start text-left",
                    "rounded-2xl p-6 min-h-[180px] border border-border/40",
                    "transition-all shadow-sm hover:shadow-lg hover:-translate-y-0.5",
                    "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    card.bgClass
                  )}
                >
                  <div
                    className={cn(
                      "rounded-xl bg-background/70 p-2.5 mb-4 transition-transform group-hover:scale-110",
                      card.iconColorClass
                    )}
                  >
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="font-display tracking-tight text-foreground text-lg font-serif font-semibold">
                    {card.title}
                  </h3>
                  <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">
                    {card.subtitle}
                  </p>
                </motion.button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

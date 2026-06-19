import { useState, useRef, useEffect } from "react";
import { Palette } from "lucide-react";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export type ThemeKey = "default" | "dark" | "warm" | "space" | "bee" | "dino" | "sunset-sea" | "pastel-sky" | "rainbow" | "sparkle" | "sparkle2" | "teal-sparkle" | "night-sky" | "gold-sparkle" | "teal-burst";

interface ThemeOption {
  key: ThemeKey;
  label: string;
  emoji: string;
  description: string;
  colors: [string, string, string]; // 3 preview swatches
  levels?: number[]; // if set, theme is only available for these levels
}

const THEMES: ThemeOption[] = [
  {
    key: "default",
    label: "Classic Teal",
    emoji: "🎓",
    description: "Professional & focused",
    colors: ["hsl(168,55%,38%)", "hsl(35,80%,56%)", "hsl(250,45%,58%)"],
  },
  {
    key: "dark",
    label: "Dark Mode",
    emoji: "🌙",
    description: "Easy on the eyes",
    colors: ["hsl(222,24%,9%)", "hsl(168,60%,48%)", "hsl(250,60%,70%)"],
  },
  {
    key: "warm",
    label: "Warm Sunset",
    emoji: "🌅",
    description: "Cozy orange & pink tones · Levels 2 & 3",
    colors: ["hsl(28,85%,56%)", "hsl(340,45%,62%)", "hsl(45,75%,55%)"],
    levels: [2, 3],
  },
  {
    key: "space",
    label: "Cosmic",
    emoji: "🚀",
    description: "Deep purple & neon glow · Level 1 only",
    colors: ["hsl(270,75%,62%)", "hsl(180,100%,50%)", "hsl(320,80%,60%)"],
    levels: [1],
  },
  {
    key: "bee",
    label: "Spelling Bee",
    emoji: "🐝",
    description: "Honeycomb gold & amber",
    colors: ["hsl(40,90%,48%)", "hsl(30,75%,30%)", "hsl(48,95%,55%)"],
  },
  {
    key: "dino",
    label: "Dino World",
    emoji: "🦖",
    description: "Prehistoric jungle · Level 1 only",
    colors: ["hsl(100,55%,38%)", "hsl(35,65%,48%)", "hsl(40,35%,88%)"],
    levels: [1],
  },
  {
    key: "sunset-sea",
    label: "Sunset Sea",
    emoji: "🌊",
    description: "Calm horizon · Level 3 only",
    colors: ["hsl(28,75%,68%)", "hsl(210,40%,72%)", "hsl(210,30%,60%)"],
    levels: [3],
  },
  {
    key: "pastel-sky",
    label: "Pastel Sky",
    emoji: "☁️",
    description: "Dreamy clouds · Level 2 only",
    colors: ["hsl(255,55%,80%)", "hsl(340,70%,82%)", "hsl(220,60%,78%)"],
    levels: [2],
  },
  {
    key: "rainbow",
    label: "Rainbow Sky",
    emoji: "🌈",
    description: "Vibrant rainbow · Level 1 only",
    colors: ["hsl(210,75%,62%)", "hsl(40,90%,60%)", "hsl(320,65%,68%)"],
    levels: [1],
  },
  {
    key: "sparkle",
    label: "Sparkle",
    emoji: "✨",
    description: "Pink bokeh lights · Level 1 only",
    colors: ["hsl(340,55%,82%)", "hsl(30,60%,85%)", "hsl(230,25%,72%)"],
    levels: [1],
  },
  {
    key: "sparkle2",
    label: "Sparkle 2",
    emoji: "💗",
    description: "Soft pink glow · Level 1 only",
    colors: ["hsl(340,45%,85%)", "hsl(20,55%,88%)", "hsl(220,20%,75%)"],
    levels: [1],
  },
  {
    key: "teal-sparkle",
    label: "Teal Sparkle",
    emoji: "💎",
    description: "Aqua glitter · Level 2 only",
    colors: ["hsl(180,55%,70%)", "hsl(190,60%,65%)", "hsl(170,50%,75%)"],
    levels: [2],
  },
  {
    key: "night-sky",
    label: "Night Sky",
    emoji: "🌌",
    description: "Starry galaxy · Level 3 only",
    colors: ["hsl(220,40%,12%)", "hsl(180,30%,25%)", "hsl(210,60%,75%)"],
    levels: [3],
  },
  {
    key: "gold-sparkle",
    label: "Gold Sparkle",
    emoji: "🏆",
    description: "Shimmering gold · Level 1 only",
    colors: ["hsl(42,75%,50%)", "hsl(38,80%,42%)", "hsl(45,90%,65%)"],
    levels: [1],
  },
  {
    key: "teal-burst",
    label: "Teal Burst",
    emoji: "🌠",
    description: "Starburst zoom · Level 3 only",
    colors: ["hsl(185,40%,30%)", "hsl(190,35%,45%)", "hsl(15,40%,55%)"],
    levels: [3],
  },
];

interface ThemePickerProps {
  current: ThemeKey;
  onChange: (theme: ThemeKey) => void;
  level?: number;
}

export function ThemePicker({ current, onChange, level }: ThemePickerProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const visibleThemes = THEMES.filter(
    (t) => !t.levels || (level !== undefined && t.levels.includes(level))
  );

  return (
    <div ref={ref} className="relative">
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={() => setOpen((v) => !v)}
            className="p-2 rounded-lg bg-muted text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
            aria-label="Theme"
          >
            <Palette className="h-4 w-4" />
          </button>
        </TooltipTrigger>
        <TooltipContent>Theme</TooltipContent>
      </Tooltip>

      {open && (
        <div className="absolute right-0 top-full mt-2 z-50 w-64 rounded-xl border border-border bg-popover p-2 shadow-lg animate-pop-in">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-serif font-semibold text-base px-2 py-1">
            Choose a theme
          </p>
          {visibleThemes.map((t) => (
            <button
              key={t.key}
              onClick={() => { onChange(t.key); setOpen(false); }}
              className={cn(
                "w-full flex items-center gap-3 rounded-lg px-2.5 py-2 text-left transition-colors",
                current === t.key
                  ? "bg-primary/10 ring-1 ring-primary/30"
                  : "hover:bg-muted"
              )}
            >
              <span className="text-lg">{t.emoji}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-display tracking-tight text-foreground font-serif font-semibold text-base truncate">{t.label}</p>
                <p className="text-[10px] text-muted-foreground truncate">{t.description}</p>
              </div>
              <div className="flex gap-0.5">
                {t.colors.map((c, i) => (
                  <span
                    key={i}
                    className="h-3 w-3 rounded-full border border-border/40"
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

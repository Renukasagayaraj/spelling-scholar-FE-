import { cn } from "@/lib/utils";
import { Check } from "lucide-react";
import beeImg from "@/assets/cute-bee.png";

const BeeIcon = ({ className }: { className?: string }) => (
  <span
    aria-hidden
    className={cn("inline-block h-6 w-6 shrink-0 bg-current", className)}
    style={{
      WebkitMaskImage: `url(${beeImg})`,
      maskImage: `url(${beeImg})`,
      WebkitMaskRepeat: "no-repeat",
      maskRepeat: "no-repeat",
      WebkitMaskPosition: "center",
      maskPosition: "center",
      WebkitMaskSize: "contain",
      maskSize: "contain",
    }}
  />
);

const Bee2Icon = ({ className }: { className?: string }) => (
  <div className={cn("flex items-center gap-0.5", className)}>
    <BeeIcon className="w-6 h-6 shrink-0" />
    <BeeIcon className="w-6 h-6 shrink-0" />
  </div>
);

const Bee3Icon = ({ className }: { className?: string }) => (
  <div className={cn("flex items-center gap-0.5", className)}>
    <BeeIcon className="w-6 h-6 shrink-0" />
    <BeeIcon className="w-6 h-6 shrink-0" />
    <BeeIcon className="w-6 h-6 shrink-0" />
  </div>
);

const levels = [
  {
    level: 1,
    label: "Grades 1–3",
    tier: "Beginner",
    Icon: BeeIcon,
    tintVar: "--channel-green",
  },
  {
    level: 2,
    label: "Grades 4–6",
    tier: "Intermediate",
    Icon: Bee2Icon,
    tintVar: "--channel-warm",
  },
  {
    level: 3,
    label: "Grades 7–9",
    tier: "Advanced",
    Icon: Bee3Icon,
    tintVar: "--channel-purple",
  },
];

interface LevelSelectorProps {
  selected: number;
  onSelect: (level: number) => void;
}

export function LevelSelector({ selected, onSelect }: LevelSelectorProps) {
  return (
    <div className="flex flex-col sm:flex-row gap-3">
      {levels.map(({ level, label, tier, Icon, tintVar }) => {
        const isSelected = selected === level;
        return (
          <button
            key={level}
            onClick={() => onSelect(level)}
            style={{
              backgroundColor: `hsl(var(${tintVar}))`,
            }}
            className={cn(
              "group relative flex-1 p-5 rounded-xl text-left transition-all duration-300 overflow-hidden",
              "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              "border-2",
              isSelected
                ? "border-primary shadow-xl shadow-primary/30 ring-4 ring-primary/25 -translate-y-0.5"
                : "border-foreground/20 hover:border-foreground/40 hover:-translate-y-0.5 hover:shadow-lg"
            )}
          >
            {isSelected && (
              <div className="absolute top-2 right-2 w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-md">
                <Check className="h-4 w-4" strokeWidth={3} />
              </div>
            )}

            <div className="inline-flex h-11 px-2 min-w-11 rounded-xl items-center justify-center mb-3 transition-transform duration-300 w-fit bg-white/70 group-hover:scale-110 shadow-sm">
              <Icon className="text-black" />
            </div>

            <div className="font-bold text-base text-foreground">{label}</div>
            <div className="text-[10px] mt-1 uppercase tracking-wider font-semibold text-foreground/70">
              {tier}
            </div>
          </button>
        );
      })}
    </div>
  );
}

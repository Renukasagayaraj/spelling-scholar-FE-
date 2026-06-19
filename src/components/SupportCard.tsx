import { motion, AnimatePresence } from "framer-motion";
import { BookOpen, MessageSquareQuote, Globe, Tag } from "lucide-react";
import { cn } from "@/lib/utils";

interface SupportCardProps {
  type: "definition" | "example" | "origin" | "partOfSpeech";
  content: string;
  isOpen: boolean;
  onToggle: () => void;
}

const config = {
  definition: { icon: BookOpen, label: "Definition", color: "bg-chip text-chip-foreground" },
  example: { icon: MessageSquareQuote, label: "Example Sentence", color: "bg-chip-warm text-chip-warm-foreground" },
  origin: { icon: Globe, label: "Origin", color: "bg-chip-accent text-chip-accent-foreground" },
  partOfSpeech: { icon: Tag, label: "Part of Speech", color: "bg-chip text-chip-foreground" },
};

export function SupportCard({ type, content, isOpen, onToggle }: SupportCardProps) {
  const { icon: Icon, label, color } = config[type];

  return (
    <div>
      <button
        onClick={onToggle}
        className={cn(
          "flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-all w-full text-left",
          isOpen ? color : "bg-muted text-muted-foreground hover:bg-muted/80"
        )}
      >
        <Icon className="h-4 w-4 shrink-0" />
        <span>{label}</span>
      </button>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className={cn("rounded-lg px-4 py-3 mt-1.5 text-sm leading-relaxed", color)}>
              {content}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

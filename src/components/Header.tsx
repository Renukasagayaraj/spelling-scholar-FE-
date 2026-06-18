import { useNavigate, useLocation } from "react-router-dom";
import { Volume1, VolumeX } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { AuthMenu } from "./AuthMenu";
import { ThemePicker } from "./ThemePicker";
import { useAuth } from "@/hooks/use-auth";
import beePng from "@/assets/bee.png";

interface HeaderProps {
  onBackToDashboard?: () => void;
}

export function Header({ onBackToDashboard }: HeaderProps) {
  const { theme, setTheme, soundEnabled, toggleSound } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const handleLogoClick = () => {
    if (location.pathname === "/" && onBackToDashboard) {
      onBackToDashboard();
    } else {
      navigate("/");
    }
  };

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border/60 bg-transparent backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-8">
        <button
          onClick={handleLogoClick}
          className="flex items-center gap-2 rounded-lg px-1.5 py-1 -ml-1.5 hover:bg-primary/10 transition-colors text-left"
          title="Home"
        >
          <img src={beePng} alt="Spelling bee mascot" className="h-12 w-auto mt-1" />
          <span className="text-lg font-display tracking-tight text-[#1e3a5f] font-serif font-semibold">
            AI Spelling Coach
          </span>
        </button>

        <div className="flex items-center gap-1.5">
          <AuthMenu />
          
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={toggleSound}
                className="p-2 rounded-lg bg-muted text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                aria-label="Sound"
              >
                {soundEnabled ? <Volume1 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
              </button>
            </TooltipTrigger>
            <TooltipContent>Sound</TooltipContent>
          </Tooltip>

          <ThemePicker current={theme} onChange={setTheme} />
        </div>
      </div>
    </header>
  );
}

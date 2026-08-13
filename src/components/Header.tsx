import { Link } from "react-router-dom";
import { Volume1, VolumeX } from "lucide-react";
import beePng from "@/assets/bee.png";
import { AuthMenu } from "@/components/AuthMenu";
import { ThemePicker, type ThemeKey } from "@/components/ThemePicker";
import { useCheer } from "@/hooks/use-cheer";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface HeaderProps {
    theme: ThemeKey;
    onThemeChange: (theme: ThemeKey) => void;
    level?: number;
    showSound?: boolean;
    onLogoClick?: () => void;
    maxWidthClass?: string; // e.g. "max-w-6xl" or "max-w-4xl"
}

export function Header({
    theme,
    onThemeChange,
    level,
    showSound = false,
    onLogoClick,
    maxWidthClass = "max-w-6xl",
}: HeaderProps) {
    const { soundEnabled, toggleSound } = useCheer();

    const logoContent = (
        <>
            <img src={beePng} alt="Spelling bee mascot" className="h-14 w-auto mt-1" />
            <span className="text-lg font-display font-semibold tracking-tight text-foreground font-serif font-semibold">
                AI Spelling Coach
            </span>
        </>
    );

    return (
        <header className="sticky top-0 z-40 w-full border-b border-border/60 bg-transparent backdrop-blur-md">
            <div className={`mx-auto flex h-16 ${maxWidthClass} items-center justify-between px-4 sm:px-8`}>
                <button
                    type="button"
                    onClick={onLogoClick}
                    title="Home"
                    className="flex items-center gap-2 rounded-lg px-1.5 py-1 -ml-1.5 hover:bg-primary/10 transition-colors"
                >
                    {logoContent}
                </button>

                <div className="flex items-center gap-1">
                     <a
                        href="/pricing"
                        className="hidden sm:inline-flex font-medium px-3 py-1.5 rounded-lg text-foreground hover:text-primary transition-colors text-base"
                        >
                        Pricing
                    </a>
                    <AuthMenu />
                    {showSound && (
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
                    )}
                    <ThemePicker current={theme} onChange={onThemeChange} level={level} />
                </div>
            </div>
        </header>
    );
}

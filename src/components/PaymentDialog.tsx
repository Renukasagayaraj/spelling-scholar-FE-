import { useState } from "react";
import { Check, Sparkles, Loader2, CreditCard, ShieldCheck } from "lucide-react";
import {
    Dialog,
    DialogContent,
} from "@/components/ui/dialog";
import { useAuth } from "@/hooks/use-auth";
import { createStripeCheckoutSession } from "@/lib/api";
import { toast } from "sonner";

interface PaymentDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function PaymentDialog({ open, onOpenChange }: PaymentDialogProps) {
    const { user } = useAuth();
    const [busy, setBusy] = useState(false);

    const handleUpgrade = async () => {
        if (!user) {
            toast.error("Please sign in first to upgrade to Premium.");
            return;
        }

        setBusy(true);
        try {
            const { url } = await createStripeCheckoutSession();
            // Redirect to Stripe Checkout
            window.location.href = url;
        } catch (err) {
            console.error(err);
            toast.error(err instanceof Error ? err.message : "Failed to initiate payment. Please try again.");
            setBusy(false);
        }
    };

    const premiumFeatures = [
        { title: "Everything in Free", desc: "Access standard levels and smart hints" },
        { title: "Custom Word Lists", desc: "Practice any spelling words from CSV or text files" },
        { title: "Language Origins Practice", desc: "Master loanwords from German, French, Latin, and more" },
        { title: "Mock Bee Simulations", desc: "Experience timed spelling bees with competitive words" },
        { title: "Progress & Accuracy Reports", desc: "Pinpoint weak spots and review words that need practice" },
    ];

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[480px] max-h-[90vh] flex flex-col p-0 overflow-hidden border-none rounded-2xl shadow-2xl bg-card [&>button]:text-white/80 [&>button]:hover:text-white">
                {/* Header decoration */}
                <div className="relative bg-gradient-to-br from-[#1e3a5f] to-primary p-6 text-primary-foreground text-center shrink-0">
                    <div className="absolute top-3 right-3 bg-amber-400 text-amber-950 text-[10px] font-bold uppercase px-2 py-0.5 rounded-full flex items-center gap-1 shadow-sm">
                        <Sparkles className="h-3 w-3 fill-current" /> Premium
                    </div>
                    <h2 className="text-2xl font-serif font-bold tracking-tight text-white mb-1">
                        Unlock Premium Access
                    </h2>
                    <p className="text-sm text-primary-foreground/80 max-w-sm mx-auto">
                        Take spelling mastery to the next level with full AI coaching power
                    </p>
                </div>

                <div className="p-6 space-y-6 overflow-y-auto flex-1">
                    {/* Pricing display */}
                    <div className="bg-muted/40 rounded-xl p-4 border border-border/50 text-center">
                        <p className="text-xs text-muted-foreground uppercase font-semibold tracking-wider mb-1">Monthly Plan</p>
                        <div className="flex items-baseline justify-center gap-1">
                            <span className="text-4xl font-extrabold tracking-tight text-[#1e3a5f] font-serif">$5.00</span>
                            <span className="text-muted-foreground text-sm">/ month</span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-2">Cancel anytime. 100% secure Checkout.</p>
                    </div>

                    {/* Features list */}
                    <div className="space-y-3.5">
                        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">What's Included:</h3>
                        <ul className="space-y-3">
                            {premiumFeatures.map((feat, idx) => (
                                <li key={idx} className="flex items-start gap-3">
                                    <div className="rounded-full bg-emerald-500/10 p-0.5 text-emerald-600 dark:text-emerald-400 mt-0.5">
                                        <Check className="h-4 w-4 stroke-[3]" />
                                    </div>
                                    <div>
                                        <h4 className="text-sm font-semibold text-foreground leading-tight">{feat.title}</h4>
                                        <p className="text-xs text-muted-foreground leading-normal mt-0.5">{feat.desc}</p>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    </div>

                    {/* Call to action */}
                    <div className="pt-2 space-y-3">
                        <button
                            onClick={handleUpgrade}
                            disabled={busy}
                            className="w-full flex items-center justify-center gap-2 rounded-xl py-3 px-4 font-semibold text-base bg-amber-400 hover:bg-amber-500 text-amber-950 disabled:opacity-50 transition-all shadow-md hover:shadow-lg active:scale-[0.98]"
                        >
                            {busy ? (
                                <>
                                    <Loader2 className="h-5 w-5 animate-spin" />
                                    Initiating Checkout...
                                </>
                            ) : (
                                <>
                                    <CreditCard className="h-5 w-5" />
                                    Upgrade Now
                                </>
                            )}
                        </button>

                        <div className="flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground">
                            <ShieldCheck className="h-4 w-4 text-muted-foreground/80" />
                            Secured payments by Stripe
                        </div>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
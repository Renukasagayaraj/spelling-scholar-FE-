import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
    User as UserIcon,
    Sparkles,
    Loader2,
    CreditCard,
    Shield,
    ExternalLink,
    ArrowLeft,
    Check,
    ShieldCheck,
    Mail,
    LogOut,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { createStripePortalSession, createStripeCheckoutSession } from "@/lib/api";
import { toast } from "sonner";
import { motion } from "framer-motion";
import beePng from "@/assets/bee.png";
import { AuthMenu } from "@/components/AuthMenu";
import { ThemePicker, type ThemeKey } from "@/components/ThemePicker";

export default function Profile() {
    const {
        user,
        loading,
        subscribed,
        currentPeriodEnd,
        cancelAtPeriodEnd,
        refreshSubscription,
        signOut,
    } = useAuth();
    const [busy, setBusy] = useState(false);
    const [stripeAction, setStripeAction] = useState<"billing" | "checkout" | null>(null);
    const navigate = useNavigate();

    const [theme, setTheme] = useState<ThemeKey>(() => {
        return (localStorage.getItem("spelling-coach-theme") as ThemeKey) || "default";
    });

    useEffect(() => {
        document.documentElement.setAttribute("data-theme", theme === "default" ? "" : theme);
        localStorage.setItem("spelling-coach-theme", theme);
    }, [theme]);

    useEffect(() => {
        if (!loading && !user) {
            // Redirect or show login card, but we let the UI render the login card for better UX
        } else if (user) {
            refreshSubscription().catch(console.error);
        }
    }, [user, loading, refreshSubscription]);

    const handleManageBilling = async () => {
        setBusy(true);
        setStripeAction("billing");
        try {
            const { url } = await createStripePortalSession();
            window.location.href = url;
        } catch (err) {
            console.error(err);
            toast.error("Failed to load Stripe billing portal. Please try again.");
            setBusy(false);
            setStripeAction(null);
        }
    };

    const handleUpgrade = async () => {
        setBusy(true);
        setStripeAction("checkout");
        try {
            const { url } = await createStripeCheckoutSession();
            window.location.href = url;
        } catch (err) {
            console.error(err);
            toast.error("Failed to initiate payment. Please try again.");
            setBusy(false);
            setStripeAction(null);
        }
    };

    const formatPeriodEnd = (timestamp: number) => {
        return new Date(timestamp * 1000).toLocaleDateString("en-US", {
            year: "numeric",
            month: "long",
            day: "numeric",
        });
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-[#fcfbf7] dark:bg-background flex items-center justify-center">
                <div className="text-center space-y-4">
                    <Loader2 className="h-10 w-10 animate-spin text-primary mx-auto" />
                    <p className="text-muted-foreground font-medium">Loading account details...</p>
                </div>
            </div>
        );
    }

    // If not authenticated, prompt to go home to sign in or display a helpful message
    if (!user) {
        return (
            <div className="min-h-screen bg-[#fcfbf7] dark:bg-background flex items-center justify-center p-4">
                <motion.div
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="max-w-md w-full bg-card border border-border/60 rounded-2xl p-8 shadow-xl text-center space-y-6"
                >
                    <div className="w-16 h-16 bg-primary/10 text-primary rounded-full flex items-center justify-center mx-auto">
                        <UserIcon className="h-8 w-8" />
                    </div>
                    <div className="space-y-2">
                        <h2 className="text-2xl font-serif font-bold text-[#1e3a5f]">Access Denied</h2>
                        <p className="text-muted-foreground text-sm">
                            Please sign in to view and manage your account subscription.
                        </p>
                    </div>
                    <button
                        onClick={() => navigate("/")}
                        className="w-full inline-flex items-center justify-center gap-2 rounded-xl py-3 font-semibold text-sm bg-primary text-primary-foreground hover:bg-primary/90 transition-all shadow-md active:scale-[0.98]"
                    >
                        <ArrowLeft className="h-4 w-4" /> Go to Home page to Sign In
                    </button>
                </motion.div>
            </div>
        );
    }


    return (
        <div className="min-h-screen">
            {/* Top Header */}
            <header className="sticky top-0 z-40 w-full border-b border-border/60 bg-transparent backdrop-blur-md">
                <div className="mx-auto flex h-16 max-w-4xl items-center justify-between px-4 sm:px-8">
                    <Link
                        to="/"
                        className="flex items-center gap-2 rounded-lg px-1.5 py-1 -ml-1.5 hover:bg-primary/10 transition-colors"
                    >
                        <img src={beePng} alt="Spelling bee mascot" className="h-12 w-auto mt-1" />
                        <span className="text-lg font-display tracking-tight text-[#1e3a5f] font-serif font-semibold">
                            AI Spelling Coach
                        </span>
                    </Link>
                    <div className="flex items-center gap-2">
                        <AuthMenu />
                        <ThemePicker current={theme} onChange={setTheme} />
                    </div>
                </div>
            </header>

            {/* Main Content Area */}
            <main className="mx-auto max-w-3xl px-4 sm:px-8 py-10 space-y-8">
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3 }}
                    className="space-y-6"
                >
                    {/* Back Navigation Link */}
                    <Link
                        to="/"
                        className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors rounded-lg px-2.5 py-1.5 hover:bg-accent/30"
                    >
                        <ArrowLeft className="h-4 w-4" />
                        Back to Dashboard
                    </Link>

                    <div className="space-y-2">
                        <h1 className="text-3xl font-serif font-bold text-[#1e3a5f] tracking-tight">
                            My Profile
                        </h1>
                        <p className="text-muted-foreground text-sm">
                            Manage your credentials, subscription details, and billing settings.
                        </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {/* Left side: Account Info Summary */}
                        <div className="md:col-span-1 space-y-6">
                            <div className="bg-card border border-border/50 rounded-2xl p-6 shadow-sm flex flex-col items-center text-center space-y-4">
                                <div className="w-20 h-20 bg-primary/10 text-primary border-4 border-primary/20 rounded-full flex items-center justify-center font-bold text-3xl shadow-inner">
                                    {user.email?.charAt(0).toUpperCase() || "S"}
                                </div>
                                <div className="space-y-1 w-full">
                                    <h3 className="font-semibold text-foreground truncate max-w-full" title={user.email}>
                                        {user.email}
                                    </h3>
                                    <div className="flex justify-center">
                                        {subscribed ? (
                                            <span className="inline-flex items-center gap-1 text-[11px] font-bold bg-amber-400 text-amber-950 px-2.5 py-0.5 rounded-full shadow-sm">
                                                <Sparkles className="h-3 w-3 fill-current animate-pulse" />
                                                Premium Tier
                                            </span>
                                        ) : (
                                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold bg-muted text-muted-foreground px-2.5 py-0.5 rounded-full border border-border/40">
                                                <Shield className="h-3 w-3" />
                                                Free Tier
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Security info card */}
                            <div className="bg-card border border-border/40 rounded-2xl p-5 shadow-sm text-xs space-y-3.5 text-muted-foreground">
                                <h4 className="font-bold uppercase tracking-wider text-foreground">Security Info</h4>
                                <div className="flex items-start gap-2.5">
                                    <Mail className="h-4 w-4 text-muted-foreground/75 shrink-0 mt-0.5" />
                                    <div className="space-y-0.5">
                                        <p className="font-semibold text-foreground">Verified Email Address</p>
                                        <p className="truncate max-w-[150px]">{user.email}</p>
                                    </div>
                                </div>
                                <div className="flex items-start gap-2.5">
                                    <ShieldCheck className="h-4 w-4 text-muted-foreground/75 shrink-0 mt-0.5" />
                                    <div className="space-y-0.5">
                                        <p className="font-semibold text-foreground">Authentication Partner</p>
                                        <p>Supabase Auth</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Right side: Subscription Management */}
                        <div className="md:col-span-2 space-y-6">
                            {subscribed ? (
                                /* Subscribed Premium Panel */
                                <div className="bg-card border border-amber-500/20 bg-gradient-to-b from-amber-500/[0.02] to-transparent rounded-2xl p-6 sm:p-8 shadow-sm space-y-6">
                                    <div className="flex items-start justify-between gap-4 border-b border-border/50 pb-5">
                                        <div className="space-y-1.5">
                                            <h2 className="text-xl font-serif font-bold text-amber-950 dark:text-amber-300 flex items-center gap-2">
                                                <Sparkles className="h-5 w-5 fill-current text-amber-500" />
                                                Premium Monthly Subscription
                                            </h2>
                                        </div>
                                    </div>

                                    <div className="space-y-5">
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-1">
                                                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">Plan</span>
                                                <span className="text-sm font-bold text-foreground">
                                                    Premium Monthly
                                                </span>
                                            </div>
                                            <div className="space-y-1">
                                                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">Status</span>
                                                <span className="text-sm font-bold text-amber-800 dark:text-amber-300 bg-amber-500/10 px-2.5 py-0.5 rounded-full inline-block">
                                                    Active
                                                </span>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-1">
                                                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">Price</span>
                                                <span className="text-sm font-bold text-foreground">
                                                    $5.00 / month
                                                </span>
                                            </div>
                                            {currentPeriodEnd && (
                                                <div className="space-y-1">
                                                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">
                                                        {cancelAtPeriodEnd ? "Subscription Expires" : "Next Billing"}
                                                    </span>
                                                    <span className="text-sm font-bold text-[#1e3a5f]">
                                                        {formatPeriodEnd(currentPeriodEnd)}
                                                    </span>
                                                </div>
                                            )}
                                        </div>

                                        <div className="text-xs text-muted-foreground leading-normal border-t border-border/40 pt-4">
                                            You can cancel, update your credit card details, or download past invoices securely inside your Stripe portal.
                                        </div>

                                        <button
                                            onClick={handleManageBilling}
                                            disabled={busy}
                                            className="w-full flex items-center justify-center gap-2 rounded-xl py-3.5 font-bold text-sm bg-amber-400 hover:bg-amber-500 text-amber-950 disabled:opacity-50 transition-all shadow-md active:scale-[0.99]"
                                        >
                                            {busy && stripeAction === "billing" ? (
                                                <>
                                                    <Loader2 className="h-4 w-4 animate-spin" />
                                                    Redirecting to Stripe...
                                                </>
                                            ) : (
                                                <>
                                                    <ExternalLink className="h-4.5 w-4.5" />
                                                    Manage Billing in Stripe
                                                </>
                                            )}
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                /* Free Tier Upgrade Panel */
                                <div className="bg-card border border-border/60 rounded-2xl p-6 sm:p-8 shadow-sm space-y-6">
                                    <div className="flex items-start justify-between gap-4 border-b border-border/50 pb-5">
                                        <div className="space-y-1.5">
                                            <h2 className="text-xl font-serif font-bold text-[#1e3a5f]">
                                                Current Plan
                                            </h2>
                                        </div>
                                    </div>

                                    <div className="space-y-5">
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-1">
                                                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">Plan</span>
                                                <span className="text-sm font-bold text-foreground">
                                                    Free
                                                </span>
                                            </div>
                                            <div className="space-y-1">
                                                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">Subscription</span>
                                                <span className="text-sm font-bold text-muted-foreground">
                                                    No Active Subscription
                                                </span>
                                            </div>
                                        </div>

                                        <p className="text-sm text-muted-foreground leading-normal border-t border-border/40 pt-4">
                                            Upgrade to unlock premium features.
                                        </p>

                                        <button
                                            onClick={handleUpgrade}
                                            disabled={busy}
                                            className="w-full flex items-center justify-center gap-2 rounded-xl py-3.5 font-bold text-sm bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-all shadow-md active:scale-[0.99]"
                                        >
                                            {busy && stripeAction === "checkout" ? (
                                                <>
                                                    <Loader2 className="h-4 w-4 animate-spin" />
                                                    Opening Stripe Checkout...
                                                </>
                                            ) : (
                                                <>
                                                    <CreditCard className="h-4.5 w-4.5" />
                                                    Upgrade to Premium
                                                </>
                                            )}
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </motion.div>
            </main>
        </div>
    );
}
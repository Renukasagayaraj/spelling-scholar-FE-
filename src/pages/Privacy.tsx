import { Link } from "react-router-dom";
import { ArrowLeft, Shield, Mail, CheckCircle } from "lucide-react";
import { motion } from "framer-motion";
import beePng from "@/assets/bee.png";

export default function Privacy() {
  return (
    <div className="min-h-screen bg-[#fcfbf7] dark:bg-background text-foreground font-sans">
      {/* Top Header */}
      <header className="sticky top-0 z-40 w-full border-b border-border/60 bg-[#fcfbf7]/80 dark:bg-background/80 backdrop-blur-md">
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
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-muted/70 px-3 py-1.5 rounded-full border border-border/40 transition-all shadow-sm active:scale-95"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to Home
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto max-w-2xl px-4 sm:px-8 py-12 space-y-8">
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="space-y-6"
        >
          <div className="flex items-center gap-3 text-[#1e3a5f] dark:text-[#a5b4fc]">
            <Shield className="h-8 w-8 text-primary" />
            <h1 className="text-3xl font-display font-bold">Privacy Policy</h1>
          </div>
          <p className="text-muted-foreground text-sm">
            Last Updated: June 2, 2026
          </p>

          <div className="rounded-2xl border border-border/60 bg-card/50 backdrop-blur-sm p-6 sm:p-8 space-y-6 shadow-sm">
            <section className="space-y-3">
              <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-primary" />
                1. Data We Collect
              </h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                When you sign in using Facebook or Google, we collect your email address, name, and profile picture to create your user profile. We also collect your spelling practice history, custom word lists, and progress statistics to personalize spelling recommendations.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-primary" />
                2. How We Use Data
              </h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                We use your information exclusively to:
              </p>
              <ul className="list-disc pl-5 text-sm text-muted-foreground space-y-1">
                <li>Create and secure your user account.</li>
                <li>Save and track your spelling test history.</li>
                <li>Unlock premium coaching features.</li>
                <li>Provide customer support.</li>
              </ul>
            </section>

            <section className="space-y-3">
              <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-primary" />
                3. Data Sharing
              </h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                We do not sell, rent, or trade your personal data. Payments are processed securely via Stripe. We do not store or access your credit card numbers.
              </p>
            </section>

            <section className="space-y-3 border-t border-border/60 pt-6">
              <h2 className="text-lg font-semibold text-[#ef4444] flex items-center gap-2">
                <Mail className="h-5 w-5" />
                4. User Data Deletion Instructions
              </h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                We respect your privacy and give you full control over your data. If you want to delete your account and remove all personal details from our systems, simply send an email request to:
              </p>
              <div className="bg-muted/50 border border-border/40 p-3.5 rounded-xl font-mono text-sm text-center font-semibold text-foreground select-all">
                spellingbee.auth@gmail.com
              </div>
              <p className="text-xs text-muted-foreground text-center">
                Upon request, your user record, login credentials, and progress history will be permanently deleted within 48 hours.
              </p>
            </section>
          </div>
        </motion.div>
      </main>
    </div>
  );
}

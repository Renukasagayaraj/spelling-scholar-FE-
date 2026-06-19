import { Link } from "react-router-dom";
import { ArrowLeft, Shield } from "lucide-react";
import { motion } from "framer-motion";

export default function Privacy() {
  return (
    <div className="flex min-h-screen flex-col bg-muted/30">
      {/* Small Header */}
      <header className="sticky top-0 z-40 w-full border-b border-border/60 bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-4xl items-center px-4 sm:px-8">
          <Link
            to="/"
            className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 hover:bg-accent transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="text-sm font-semibold">Back to Home</span>
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 px-4 py-12">
        <div className="mx-auto max-w-2xl">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-2xl border border-border/60 bg-card p-6 sm:p-10 shadow-sm"
          >
            <div className="flex items-center gap-3 border-b border-border/50 pb-5 mb-6">
              <div className="rounded-lg bg-primary/10 p-2 text-primary">
                <Shield className="h-6 w-6" />
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight">Privacy Policy</h1>
                <p className="text-xs text-muted-foreground">Last updated: June 2026</p>
              </div>
            </div>

            <div className="space-y-6 text-sm text-foreground/80 leading-relaxed">
              <p>
                Welcome to <strong>AI Spelling Coach</strong>. We take your privacy very seriously.
                This Privacy Policy explains what information we collect and how we use it.
              </p>

              <div>
                <h2 className="text-base font-semibold text-foreground mb-2">1. Authentication & Security</h2>
                <p>
                  AI Spelling Coach uses Google and Facebook authentication powered securely by Supabase.
                  We collect only the essential information required for login, session preservation, and user account management.
                </p>
              </div>

              <div>
                <h2 className="text-base font-semibold text-foreground mb-2">2. Data We Collect</h2>
                <ul className="list-disc pl-5 space-y-1.5">
                  <li>Your email address (to identify your account and enable secure logins).</li>
                  <li>Your profile name and avatar URL (obtained during third-party sign-in).</li>
                  <li>Your custom word lists created within the app (stored securely in our database).</li>
                </ul>
              </div>

              <div>
                <h2 className="text-base font-semibold text-foreground mb-2">3. Data Sharing & Third Parties</h2>
                <p>
                  We do not sell, rent, or share user data with third parties under any circumstances.
                  All operations are strictly kept secure.
                </p>
              </div>

              <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 mt-6">
                <h2 className="text-sm font-semibold text-primary mb-1">Support & Contact</h2>
                <p className="text-xs text-muted-foreground">
                  If you have any questions about this policy or account security, feel free to reach out to us at:
                </p>
                <a
                  href="mailto:avidaitutor@gmail.com"
                  className="text-sm font-semibold text-primary hover:underline block mt-1.5"
                >
                  avidaitutor@gmail.com
                </a>
              </div>
            </div>
          </motion.div>
        </div>
      </main>
    </div>
  );
}

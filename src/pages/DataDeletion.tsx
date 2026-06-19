import { Link } from "react-router-dom";
import { ArrowLeft, Trash2 } from "lucide-react";
import { motion } from "framer-motion";

export default function DataDeletion() {
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
              <div className="rounded-lg bg-destructive/10 p-2 text-destructive">
                <Trash2 className="h-6 w-6" />
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight">Data Deletion Instructions</h1>
                <p className="text-xs text-muted-foreground">Manage your personal information</p>
              </div>
            </div>

            <div className="space-y-6 text-sm text-foreground/80 leading-relaxed">
              <p>
                In compliance with general data protection regulations and platform developer policies,
                AI Spelling Coach provides a direct method for users to request the deletion of all associated personal information.
              </p>

              <div>
                <h2 className="text-base font-semibold text-foreground mb-2">How to Request Account & Data Deletion</h2>
                <p className="mb-3">
                  If you wish to delete your account, saved word lists, and all other related data, please send an email request:
                </p>
                <div className="rounded-xl border border-border bg-muted/40 p-4 font-medium text-center">
                  <span className="text-muted-foreground text-xs block mb-1">Send your deletion request email to:</span>
                  <a
                    href="mailto:avidaitutor@gmail.com"
                    className="text-base font-bold text-primary hover:underline"
                  >
                    avidaitutor@gmail.com
                  </a>
                </div>
              </div>

              <div>
                <h2 className="text-base font-semibold text-foreground mb-2">What Happens After Requesting Deletion</h2>
                <ul className="list-disc pl-5 space-y-1.5">
                  <li>Our support team will verify your ownership of the account via email check.</li>
                  <li>Once verified, all your account records, profile information, and custom lists will be permanently removed from our databases.</li>
                  <li>The deletion process will be completed within <strong>30 days</strong> of request verification.</li>
                </ul>
              </div>

              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 mt-6 text-amber-800 text-xs">
                <strong>⚠️ Warning:</strong> Account deletion is permanent and cannot be undone. Once deleted, your custom spelling practice history and lists will be permanently lost.
              </div>
            </div>
          </motion.div>
        </div>
      </main>
    </div>
  );
}

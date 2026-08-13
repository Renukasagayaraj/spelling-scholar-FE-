import { createRoot } from "react-dom/client";
import * as Sentry from "@sentry/react";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/react";
import App from "./App.tsx";
import "./index.css";

Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN,
  release: import.meta.env.VITE_APP_VERSION || "dev",
  sendDefaultPii: true,
  environment: import.meta.env.VITE_APP_ENV || import.meta.env.MODE,
});

// Expose Sentry globally so we can test it from the browser developer console
(window as any).Sentry = Sentry;

// Expose supabase globally for easy console debugging and session checking
import { supabase } from "@/lib/supabase";
(window as any).supabase = supabase;

// Inject Tidio script
(function() {
  const script = document.createElement("script");
  script.src = `//code.tidio.co/${import.meta.env.VITE_TIDIO_TRACK_ID}.js`;
  script.async = true;
  document.body.appendChild(script);
})();

createRoot(document.getElementById("root")!).render(
  <>
    <App />
    <Analytics />
    <SpeedInsights />
  </>
);
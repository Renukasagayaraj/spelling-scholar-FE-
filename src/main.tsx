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
  autoSessionTracking: true
});

// Expose Sentry globally so we can test it from the browser developer console
(window as any).Sentry = Sentry;

// Expose supabase globally for easy console debugging and session checking
import { supabase } from "@/lib/supabase";
(window as any).supabase = supabase;

// Dynamically inject HubSpot tracking script if configured
const hubspotId = import.meta.env.VITE_HUBSPOT_TRACKING_ID;
if (hubspotId) {
  const script = document.createElement("script");
  script.type = "text/javascript";
  script.id = "hs-script-loader";
  script.async = true;
  script.defer = true;
  script.src = `//js.hs-scripts.com/${hubspotId}.js`;
  document.body.appendChild(script);
}

createRoot(document.getElementById("root")!).render(
  <>
    <App />
    <Analytics />
    <SpeedInsights />
  </>
);
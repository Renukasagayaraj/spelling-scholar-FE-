import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/hooks/use-auth", () => ({ AuthProvider: ({ children }: { children: ReactNode }) => children }));
vi.mock("@/components/ui/toaster", () => ({ Toaster: () => null }));
vi.mock("@/components/ui/sonner", () => ({ Toaster: () => null }));
vi.mock("@/components/ui/tooltip", () => ({ TooltipProvider: ({ children }: { children: ReactNode }) => children }));
vi.mock("@/pages/Index", () => ({ default: () => <div>index route</div> }));
vi.mock("@/pages/MockBee", () => ({ default: () => <div>mock bee route</div> }));
vi.mock("@/pages/Landing", () => ({ default: () => <div>landing route</div> }));
vi.mock("@/pages/Privacy", () => ({ default: () => <div>privacy route</div> }));
vi.mock("@/pages/Profile", () => ({ default: () => <div>profile route</div> }));
vi.mock("@/pages/DataDeletion", () => ({ default: () => <div>deletion route</div> }));
vi.mock("@/pages/NotFound", () => ({ default: () => <div>not found route</div> }));

import App from "@/App";

describe("application routing", () => {
  beforeEach(() => window.history.replaceState(null, "", "/"));

  it.each([
    ["/", "index route"], ["/mock-bee", "mock bee route"], ["/landing", "landing route"],
    ["/privacy", "privacy route"], ["/profile", "profile route"], ["/data-deletion", "deletion route"],
    ["/unknown", "not found route"],
  ])("routes %s", (path, expected) => {
    window.history.replaceState(null, "", path);
    render(<App />);
    expect(screen.getByText(expected)).toBeInTheDocument();
  });
});

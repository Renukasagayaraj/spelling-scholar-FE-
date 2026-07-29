import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TooltipProvider } from "@/components/ui/tooltip";

const mocks = vi.hoisted(() => ({
  state: { user: null, loading: false, subscribed: false, currentPeriodEnd: null, cancelAtPeriodEnd: false } as {
    user: null | { id: string; email?: string }; loading: boolean; subscribed: boolean; currentPeriodEnd: number | null; cancelAtPeriodEnd: boolean;
  },
  refreshSubscription: vi.fn(), signOut: vi.fn(), checkout: vi.fn(), portal: vi.fn(), toastError: vi.fn(),
}));
vi.mock("@/hooks/use-auth", () => ({ useAuth: () => ({
  ...mocks.state, refreshSubscription: mocks.refreshSubscription, signOut: mocks.signOut,
}) }));
vi.mock("@/lib/api", () => ({ createStripeCheckoutSession: mocks.checkout, createStripePortalSession: mocks.portal }));
vi.mock("sonner", () => ({ toast: { error: mocks.toastError } }));
vi.mock("@/components/AuthMenu", () => ({ AuthMenu: () => <div>Auth menu</div> }));

import Profile from "@/pages/Profile";

const renderProfile = () => render(<MemoryRouter><TooltipProvider><Profile /></TooltipProvider></MemoryRouter>);

describe("profile page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.state = { user: null, loading: false, subscribed: false, currentPeriodEnd: null, cancelAtPeriodEnd: false };
    mocks.refreshSubscription.mockResolvedValue(undefined);
  });

  it("renders loading and signed-out states", () => {
    mocks.state.loading = true;
    const loading = renderProfile();
    expect(screen.getByText("Loading account details...")).toBeInTheDocument();
    loading.unmount();
    mocks.state.loading = false;
    renderProfile();
    expect(screen.getByRole("heading", { name: "Access Denied" })).toBeInTheDocument();
  });

  it("renders the free plan and reports checkout errors", async () => {
    mocks.state.user = { id: "u1", email: "learner@example.com" };
    mocks.checkout.mockRejectedValue(new Error("offline"));
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    renderProfile();
    expect(screen.getByRole("heading", { name: "My Profile" })).toBeInTheDocument();
    expect(screen.getByText("Free Tier")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Upgrade to Premium" }));
    await waitFor(() => expect(mocks.toastError).toHaveBeenCalledWith("Failed to initiate payment. Please try again."));
    consoleError.mockRestore();
  });

  it("renders subscription dates and reports portal errors", async () => {
    mocks.state = { user: { id: "u2", email: "premium@example.com" }, loading: false, subscribed: true, currentPeriodEnd: 1_800_000_000, cancelAtPeriodEnd: true };
    mocks.portal.mockRejectedValue(new Error("offline"));
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    renderProfile();
    expect(screen.getByText("Premium Tier")).toBeInTheDocument();
    expect(screen.getByText("Subscription Expires")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Manage Billing in Stripe" }));
    await waitFor(() => expect(mocks.toastError).toHaveBeenCalledWith("Failed to load Stripe billing portal. Please try again."));
    consoleError.mockRestore();
  });
});

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  state: { user: null, loading: false, configured: true, subscribed: false } as {
    user: null | { email?: string; user_metadata?: { name?: string } }; loading: boolean; configured: boolean; subscribed: boolean;
  },
  password: vi.fn(), signup: vi.fn(), google: vi.fn(), facebook: vi.fn(), signOut: vi.fn(),
  checkout: vi.fn(), toastError: vi.fn(),
}));
vi.mock("@/hooks/use-auth", () => ({ useAuth: () => ({
  ...mocks.state, signInWithPassword: mocks.password, signUpWithPassword: mocks.signup,
  signInWithGoogle: mocks.google, signInWithFacebook: mocks.facebook, signOut: mocks.signOut,
}) }));
vi.mock("@/lib/api", () => ({ createStripeCheckoutSession: mocks.checkout }));
vi.mock("sonner", () => ({ toast: { error: mocks.toastError } }));

import { AuthDialog } from "@/components/AuthDialog";
import { AuthMenu } from "@/components/AuthMenu";
import { PaymentDialog } from "@/components/PaymentDialog";

describe("authentication and payment components", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.state = { user: null, loading: false, configured: true, subscribed: false };
    mocks.password.mockResolvedValue({ error: null });
    mocks.signup.mockResolvedValue({ error: null });
    mocks.google.mockResolvedValue({ error: null });
    mocks.facebook.mockResolvedValue({ error: null });
  });

  it("renders auth menu loading, signed-out, free, and premium branches", () => {
    mocks.state.loading = true;
    const view = render(<MemoryRouter><AuthMenu /></MemoryRouter>);
    expect(view.container.querySelector(".animate-spin")).toBeInTheDocument();
    view.unmount();

    mocks.state = { user: null, loading: false, configured: true, subscribed: false };
    const signedOut = render(<MemoryRouter><AuthMenu /></MemoryRouter>);
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
    expect(screen.getByRole("heading", { name: "Sign in" })).toBeInTheDocument();
    signedOut.unmount();

    mocks.state = { user: { email: "learner@example.com" }, loading: false, configured: true, subscribed: false };
    const free = render(<MemoryRouter><AuthMenu /></MemoryRouter>);
    expect(screen.getByRole("button", { name: "Upgrade" })).toBeInTheDocument();
    fireEvent.click(screen.getByTitle("Sign out"));
    expect(mocks.signOut).toHaveBeenCalled();
    free.unmount();

    mocks.state.subscribed = true;
    render(<MemoryRouter><AuthMenu /></MemoryRouter>);
    expect(screen.getByRole("button", { name: "Premium" })).toBeInTheDocument();
  });

  it("handles password errors, signup success, and social errors", async () => {
    mocks.password.mockResolvedValueOnce({ error: "bad password" });
    mocks.signup.mockResolvedValueOnce({ error: null });
    mocks.google.mockResolvedValueOnce({ error: "google failed" });
    mocks.facebook.mockResolvedValueOnce({ error: "facebook failed" });
    const onOpenChange = vi.fn();
    render(<AuthDialog open onOpenChange={onOpenChange} />);
    const email = document.querySelector('input[type="email"]')!;
    const password = document.querySelector('input[type="password"]')!;
    fireEvent.change(email, { target: { value: " learner@example.com " } });
    fireEvent.change(password, { target: { value: "secret" } });
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
    expect(await screen.findByText("bad password")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Need an account/ }));
    fireEvent.click(screen.getByRole("button", { name: "Create account" }));
    expect(await screen.findByText(/Check your email/)).toBeInTheDocument();
    expect(mocks.signup).toHaveBeenCalledWith("learner@example.com", "secret");

    fireEvent.click(screen.getByRole("button", { name: /Google/ }));
    expect(await screen.findByText("google failed")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Facebook/ }));
    expect(await screen.findByText("facebook failed")).toBeInTheDocument();
  });

  it("requires sign-in for payment and reports checkout failures", async () => {
    const onOpenChange = vi.fn();
    const { unmount } = render(<PaymentDialog open onOpenChange={onOpenChange} />);
    fireEvent.click(screen.getByRole("button", { name: "Upgrade Now" }));
    expect(mocks.toastError).toHaveBeenCalledWith("Please sign in first to upgrade to Premium.");
    unmount();

    mocks.state.user = { email: "learner@example.com" };
    mocks.checkout.mockRejectedValueOnce(new Error("checkout offline"));
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    render(<PaymentDialog open onOpenChange={onOpenChange} />);
    fireEvent.click(screen.getByRole("button", { name: "Upgrade Now" }));
    await waitFor(() => expect(mocks.toastError).toHaveBeenCalledWith("checkout offline"));
    expect(screen.getByRole("button", { name: "Upgrade Now" })).not.toBeDisabled();
    consoleError.mockRestore();
  });
});

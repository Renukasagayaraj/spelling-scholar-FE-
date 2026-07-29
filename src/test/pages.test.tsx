import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => ({
  user: null as null | { id: string; email?: string },
  signInWithPassword: vi.fn(), signUpWithPassword: vi.fn(), signInWithGoogle: vi.fn(), signInWithFacebook: vi.fn(),
}));
vi.mock("@/hooks/use-auth", () => ({ useAuth: () => ({ ...auth }) }));

import Privacy from "@/pages/Privacy";
import DataDeletion from "@/pages/DataDeletion";
import NotFound from "@/pages/NotFound";
import Landing from "@/pages/Landing";

const router = (node: React.ReactNode, path = "/") => render(<MemoryRouter initialEntries={[path]}>{node}</MemoryRouter>);

describe("standalone pages", () => {
  beforeEach(() => {
    auth.user = null;
    vi.clearAllMocks();
  });

  it("renders privacy and deletion policy details", () => {
    const privacy = router(<Privacy />);
    expect(screen.getByRole("heading", { name: "Privacy Policy" })).toBeInTheDocument();
    expect(screen.getByText("avidaitutor@gmail.com")).toHaveAttribute("href", "mailto:avidaitutor@gmail.com");
    privacy.unmount();
    router(<DataDeletion />);
    expect(screen.getByRole("heading", { name: "Data Deletion Instructions" })).toBeInTheDocument();
    expect(screen.getByText(/Account deletion is permanent/)).toBeInTheDocument();
  });

  it("logs and renders missing routes", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    router(<NotFound />, "/does-not-exist");
    expect(screen.getByText("404")).toBeInTheDocument();
    expect(consoleError).toHaveBeenCalledWith("404 Error: User attempted to access non-existent route:", "/does-not-exist");
    consoleError.mockRestore();
  });

  it("renders landing content and opens authentication for signed-out visitors", () => {
    router(<Landing />, "/landing");
    expect(screen.getByRole("heading", { name: /Spell smarter/ })).toBeInTheDocument();
    expect(screen.getByText("Standard Practice")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Get started" }));
    expect(screen.getByRole("heading", { name: "Sign in" })).toBeInTheDocument();
  });

  it("links signed-in visitors directly to the app", () => {
    auth.user = { id: "user", email: "learner@example.com" };
    router(<Landing />, "/landing");
    expect(screen.getAllByRole("link", { name: /Open app/ })[0]).toHaveAttribute("href", "/");
  });
});

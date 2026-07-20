import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AuthCallback from "@/pages/AuthCallback";

const { exchangeCodeForSession } = vi.hoisted(() => ({
  exchangeCodeForSession: vi.fn(),
}));

vi.mock("@/lib/supabase", () => ({
  supabaseConfigured: true,
  supabase: {
    auth: { exchangeCodeForSession },
  },
}));

function renderCallback() {
  return render(
    <MemoryRouter initialEntries={["/auth/callback"]}>
      <Routes>
        <Route path="/auth/callback" element={<AuthCallback />} />
        <Route path="/" element={<div>Home page</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("AuthCallback", () => {
  beforeEach(() => {
    exchangeCodeForSession.mockReset();
    window.history.replaceState(null, "", "/auth/callback");
  });

  it("exchanges the PKCE code once, cleans the URL, and returns home", async () => {
    window.history.replaceState(null, "", "/auth/callback?code=one-time-code");
    exchangeCodeForSession.mockResolvedValue({ error: null });

    renderCallback();

    await waitFor(() => expect(exchangeCodeForSession).toHaveBeenCalledWith("one-time-code"));
    expect(exchangeCodeForSession).toHaveBeenCalledTimes(1);
    expect(window.location.search).toBe("");
    expect(await screen.findByText("Home page")).toBeInTheDocument();
  });

  it("shows a provider error without attempting a code exchange", async () => {
    window.history.replaceState(
      null,
      "",
      "/auth/callback?error=access_denied&error_description=Sign-in%20was%20cancelled",
    );

    renderCallback();

    expect(await screen.findByRole("alert")).toHaveTextContent("Sign-in was cancelled");
    expect(exchangeCodeForSession).not.toHaveBeenCalled();
    expect(window.location.search).toBe("");
  });
});

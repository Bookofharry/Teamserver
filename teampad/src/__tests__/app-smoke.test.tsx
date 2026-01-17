import { describe, it, expect, vi } from "vitest";
import type { ReactNode } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import Auth from "@/pages/Auth";
import Dashboard from "@/pages/Dashboard";
import Pricing from "@/pages/Pricing";
import { ThemeProvider } from "@/components/theme-provider";
import { AuthStatusProvider } from "@/context/auth-status";

const renderWithProviders = (
  ui: ReactNode,
  { initialEntries }: { initialEntries?: string[] } = {},
) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });

  render(
    <QueryClientProvider client={queryClient}>
      <AuthStatusProvider>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          storageKey="teampad-theme"
          disableTransitionOnChange
        >
          <MemoryRouter
            initialEntries={initialEntries}
            future={{
              v7_startTransition: true,
              v7_relativeSplatPath: true,
            }}
          >
            {ui}
          </MemoryRouter>
        </ThemeProvider>
      </AuthStatusProvider>
    </QueryClientProvider>,
  );
};

describe("TeamPad smoke tests", () => {
  it("routes from auth to dashboard after login", async () => {
    const user = userEvent.setup();

    renderWithProviders(
      <Routes>
        <Route path="/auth" element={<Auth />} />
        <Route path="/app" element={<div data-testid="dashboard" />} />
      </Routes>,
      { initialEntries: ["/auth"] },
    );

    await user.type(screen.getByLabelText(/email/i), "alex@teampad.io");
    await user.type(screen.getByLabelText(/password/i), "password123");
    await user.click(screen.getByRole("button", { name: /sign in/i }));

    expect(await screen.findByTestId("dashboard", {}, { timeout: 3000 })).toBeInTheDocument();
  });

  it("allows switching themes from the user menu", async () => {
    const user = userEvent.setup();
    localStorage.clear();
    localStorage.setItem("teampad-notes-collapsed-state", "false");
    renderWithProviders(<Dashboard />);

    await screen.findByText("Collections");
    await user.click(screen.getByRole("button", { name: /alex/i }));
    await user.click(screen.getByRole("menuitemradio", { name: /dark/i }));

    await waitFor(() => {
      const themeKey = Object.keys(localStorage).find((k) => k.startsWith("teampad-theme:"));
      expect(themeKey).toBeDefined();
      expect(localStorage.getItem(themeKey!)).toBe("dark");
      expect(document.documentElement).toHaveClass("dark");
    });
  });

  it("renders sidebar navigation", async () => {
    localStorage.setItem("teampad-notes-collapsed-state", "false");
    renderWithProviders(<Dashboard />);

    expect(await screen.findByText("Collections")).toBeInTheDocument();
    expect((await screen.findAllByText("Marketing")).length).toBeGreaterThan(0);
    expect(await screen.findByRole("button", { name: /sign out/i })).toBeInTheDocument();
  });

  it("renders the pricing plans", async () => {
    renderWithProviders(
      <Routes>
        <Route path="/pricing" element={<Pricing />} />
      </Routes>,
      { initialEntries: ["/pricing"] },
    );

    expect(await screen.findByText(/plans & billing/i)).toBeInTheDocument();
    expect(screen.getAllByText("Free").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Premium").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Premium+").length).toBeGreaterThan(0);
  });
});

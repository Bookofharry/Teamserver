import { Link } from "react-router-dom";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuthStatus } from "@/context/auth-status";

export default function Terms() {
  const { status } = useAuthStatus();
  const isAuthed = status === "authed";

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-50 border-b border-white/15 bg-primary text-primary-foreground relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute inset-0 bg-gradient-to-br from-primary via-primary to-primary/80" />
          <div className="absolute inset-0 opacity-[0.14]">
            <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
              <defs>
                <pattern id="grid-header-terms" width="10" height="10" patternUnits="userSpaceOnUse">
                  <path d="M 10 0 L 0 0 0 10" fill="none" stroke="white" strokeOpacity="0.5" strokeWidth="0.5" />
                </pattern>
              </defs>
              <rect width="100" height="100" fill="url(#grid-header-terms)" />
            </svg>
          </div>
        </div>
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between relative z-10">
          <Link to="/" className="flex items-center gap-3 relative z-20">
            <img
              src="/teampad-logo.png"
              alt="TeamPad logo"
              className="w-20 h-15 rounded-xl bg-[#111217] p-[5px] object-contain shadow-sm"
            />
            <span className="text-lg font-semibold text-white">TeamPad</span>
          </Link>
          <div className="flex items-center gap-3">
            {!isAuthed && (
              <Button
                className="hidden bg-black text-white hover:bg-black hover:text-white active:scale-100 transition-none sm:inline-flex"
                asChild
              >
                <Link to="/auth">Sign in</Link>
              </Button>
            )}
            <Button size="lg" className="bg-white text-primary hover:bg-white/90" asChild>
              <Link to="/app">
                Open app
                <ArrowRight className="w-4 h-4" />
              </Link>
            </Button>
          </div>
        </div>
      </header>

      <main className="relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute -top-40 right-0 h-72 w-72 rounded-full bg-primary/15 blur-3xl" />
          <div className="absolute bottom-0 left-0 h-72 w-72 rounded-full bg-emerald-200/40 blur-3xl" />
          <div className="absolute inset-0 opacity-[0.15]">
            <svg className="w-full h-full" viewBox="0 0 160 160" preserveAspectRatio="none">
              <defs>
                <pattern id="legal-grid-terms" width="16" height="16" patternUnits="userSpaceOnUse">
                  <path d="M 16 0 L 0 0 0 16" fill="none" stroke="currentColor" strokeOpacity="0.25" strokeWidth="0.5" />
                </pattern>
              </defs>
              <rect width="160" height="160" fill="url(#legal-grid-terms)" />
            </svg>
          </div>
        </div>

        <div className="relative mx-auto w-full max-w-6xl px-6 py-12">
          <section className="grid gap-8 lg:grid-cols-[1.2fr_0.8fr]">
            <div className="space-y-6">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.3em] text-muted-foreground">
                  Legal
                </p>
                <h1 className="mt-2 text-4xl font-black font-display">
                  Terms of Service
                </h1>
                <p className="mt-3 text-sm text-muted-foreground">
                  Last updated Jan 2, 2026
                </p>
              </div>
              <p className="text-base text-muted-foreground">
                These terms describe how TeamPad works, what you can expect from us, and what we expect from you.
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                {[
                  "Keep account details accurate.",
                  "Use TeamPad responsibly.",
                  "Your content stays yours.",
                  "Limits depend on your plan.",
                ].map((item) => (
                  <div key={item} className="flex items-start gap-2 text-sm text-muted-foreground">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 text-primary" />
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-border bg-white/80 p-6 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-muted-foreground">
                At a glance
              </p>
              <div className="mt-4 space-y-4 text-sm text-muted-foreground">
                <div className="rounded-xl border border-border bg-background px-4 py-3">
                  <p className="text-sm font-semibold text-foreground">Accounts</p>
                  <p>Protect access and keep login details current.</p>
                </div>
                <div className="rounded-xl border border-border bg-background px-4 py-3">
                  <p className="text-sm font-semibold text-foreground">Content</p>
                  <p>You own your content. We store it to provide the service.</p>
                </div>
                <div className="rounded-xl border border-border bg-background px-4 py-3">
                  <p className="text-sm font-semibold text-foreground">Plans</p>
                  <p>Free and paid limits may change. Billing terms follow pricing.</p>
                </div>
                <div className="rounded-xl border border-border bg-background px-4 py-3">
                  <p className="text-sm font-semibold text-foreground">Termination</p>
                  <p>Misuse can result in suspension or termination.</p>
                </div>
              </div>
            </div>
          </section>

          <section className="mt-12 grid gap-10 lg:grid-cols-[0.35fr_0.65fr]">
            <aside className="rounded-2xl border border-border bg-secondary/40 p-6">
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-muted-foreground">
                Sections
              </p>
              <ul className="mt-4 space-y-3 text-sm text-muted-foreground">
                <li>1. Agreement</li>
                <li>2. Accounts</li>
                <li>3. Acceptable use</li>
                <li>4. Content</li>
                <li>5. Plans and billing</li>
                <li>6. Termination</li>
                <li>7. Disclaimers</li>
                <li>8. Liability</li>
                <li>9. Changes</li>
                <li>10. Contact</li>
              </ul>
            </aside>

            <div className="space-y-6">
              {[
                {
                  title: "Agreement",
                  body:
                    "By accessing TeamPad, you agree to these terms. If you do not agree, you should not use the service.",
                },
                {
                  title: "Accounts",
                  body:
                    "You are responsible for maintaining accurate information and for all activity that occurs under your account.",
                },
                {
                  title: "Acceptable use",
                  body:
                    "Do not misuse TeamPad, attempt to break security, or disrupt service availability. Follow all applicable laws.",
                },
                {
                  title: "Content",
                  body:
                    "You keep ownership of your content. You grant TeamPad permission to host and process your data to deliver features.",
                },
                {
                  title: "Plans and billing",
                  body:
                    "Paid plans follow the pricing page. Feature limits and pricing may evolve as the product grows.",
                },
                {
                  title: "Termination",
                  body:
                    "We may suspend or terminate access for violations, security risks, or abuse of the service.",
                },
                {
                  title: "Disclaimers",
                  body:
                    "TeamPad is provided as-is without warranties. We do not guarantee uninterrupted or error-free service.",
                },
                {
                  title: "Liability",
                  body:
                    "To the maximum extent allowed by law, TeamPad is not liable for indirect or consequential damages.",
                },
                {
                  title: "Changes",
                  body:
                    "We may update these terms from time to time. Continued use means you accept the latest version.",
                },
                {
                  title: "Contact",
                  body: "Questions? Reach us at support@teampad.io.",
                },
              ].map((item, index) => (
                <div
                  key={item.title}
                  className="rounded-2xl border border-border bg-white/90 p-6 shadow-sm"
                >
                  <div className="flex items-start gap-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full border border-border bg-primary/10 text-sm font-semibold text-primary">
                      {index + 1}
                    </div>
                    <div className="space-y-2">
                      <h2 className="text-lg font-semibold">{item.title}</h2>
                      <p className="text-sm text-muted-foreground">{item.body}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}

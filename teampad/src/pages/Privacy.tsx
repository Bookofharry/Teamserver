import { Link } from "react-router-dom";
import { ArrowRight, Database, ShieldCheck, UserSquare2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuthStatus } from "@/context/auth-status";

export default function Privacy() {
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
                <pattern id="grid-header-privacy" width="10" height="10" patternUnits="userSpaceOnUse">
                  <path d="M 10 0 L 0 0 0 10" fill="none" stroke="white" strokeOpacity="0.5" strokeWidth="0.5" />
                </pattern>
              </defs>
              <rect width="100" height="100" fill="url(#grid-header-privacy)" />
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
                <pattern id="legal-grid-privacy" width="16" height="16" patternUnits="userSpaceOnUse">
                  <path d="M 16 0 L 0 0 0 16" fill="none" stroke="currentColor" strokeOpacity="0.25" strokeWidth="0.5" />
                </pattern>
              </defs>
              <rect width="160" height="160" fill="url(#legal-grid-privacy)" />
            </svg>
          </div>
        </div>

        <div className="relative mx-auto w-full max-w-6xl px-6 py-12">
          <section className="grid gap-10 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="space-y-6">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.3em] text-muted-foreground">
                  Legal
                </p>
                <h1 className="mt-2 text-4xl font-black font-display">Privacy Policy</h1>
                <p className="mt-3 text-sm text-muted-foreground">
                  Last updated Jan 2, 2026
                </p>
              </div>
              <p className="text-base text-muted-foreground">
                TeamPad keeps your notes private by default. This policy explains what we collect, why we collect it,
                and how you stay in control.
              </p>
              <div className="grid gap-4 sm:grid-cols-3">
                {[
                  { title: "Collect", icon: Database },
                  { title: "Protect", icon: ShieldCheck },
                  { title: "Control", icon: UserSquare2 },
                ].map((item) => (
                  <div key={item.title} className="rounded-2xl border border-border bg-white/80 p-4">
                    <item.icon className="h-5 w-5 text-primary" />
                    <p className="mt-3 text-sm font-semibold text-foreground">{item.title}</p>
                    <p className="text-xs text-muted-foreground">
                      Clear, minimal data to run TeamPad.
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-border bg-white/90 p-6 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-muted-foreground">
                Data map
              </p>
              <div className="mt-4 space-y-4 text-sm text-muted-foreground">
                <div className="rounded-xl border border-border bg-background px-4 py-3">
                  <p className="text-sm font-semibold text-foreground">Account</p>
                  <p>Name, email, and authentication details.</p>
                </div>
                <div className="rounded-xl border border-border bg-background px-4 py-3">
                  <p className="text-sm font-semibold text-foreground">Workspace</p>
                  <p>Notes, collections, and collaborators you add.</p>
                </div>
                <div className="rounded-xl border border-border bg-background px-4 py-3">
                  <p className="text-sm font-semibold text-foreground">Usage</p>
                  <p>Basic analytics to keep TeamPad reliable.</p>
                </div>
              </div>
            </div>
          </section>

          <section className="mt-12 grid gap-6 lg:grid-cols-2">
            {[
              {
                title: "Information we collect",
                body:
                  "Account details, workspace content you create, and limited usage data needed to operate TeamPad.",
              },
              {
                title: "How we use data",
                body:
                  "To deliver features, protect accounts, and improve reliability. We do not sell your data.",
              },
              {
                title: "Sharing",
                body:
                  "We share data only with trusted service providers that help run TeamPad.",
              },
              {
                title: "Security",
                body:
                  "We use standard safeguards, access controls, and monitoring to protect your information.",
              },
              {
                title: "Retention",
                body:
                  "We retain data while your account is active or as needed to provide the service.",
              },
              {
                title: "Your choices",
                body:
                  "You can update profile details or request account deletion by contacting support.",
              },
            ].map((item) => (
              <div key={item.title} className="rounded-2xl border border-border bg-white/90 p-6 shadow-sm">
                <h2 className="text-lg font-semibold">{item.title}</h2>
                <p className="mt-2 text-sm text-muted-foreground">{item.body}</p>
              </div>
            ))}
          </section>

          <section className="mt-10 rounded-2xl border border-border bg-secondary/40 p-6 text-sm text-muted-foreground">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-semibold text-foreground">Changes & Contact</p>
                <p>We may update this policy. Reach us at support@teampad.io.</p>
              </div>
              <Button variant="outline" asChild>
                <Link to="/terms">View Terms</Link>
              </Button>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}

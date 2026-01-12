import { Link } from 'react-router-dom';
import { ArrowRight, Check, Lock, Shield, Bot, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuthStatus } from '@/context/auth-status';

const Index = () => {
  const { status } = useAuthStatus();
  const isAuthed = status === "authed";

  return (
    <div className="min-h-screen bg-white text-foreground font-bold home-sans">
      <header className="sticky top-0 z-50 border-b border-white/15 bg-primary text-primary-foreground relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute inset-0 bg-gradient-to-br from-primary via-primary to-primary/80" />
          <div className="absolute inset-0 opacity-[0.14]">
            <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
              <defs>
                <pattern id="grid-header" width="10" height="10" patternUnits="userSpaceOnUse">
                  <path d="M 10 0 L 0 0 0 10" fill="none" stroke="white" strokeOpacity="0.5" strokeWidth="0.5" />
                </pattern>
              </defs>
              <rect width="100" height="100" fill="url(#grid-header)" />
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
            <span className="text-lg font-semibold text-white home-display">TeamPad</span>
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

      <main>
        <section className="relative overflow-hidden">
          <div className="relative max-w-6xl mx-auto px-6 py-16 lg:py-24 grid lg:grid-cols-[1.1fr_0.9fr] gap-12 items-center">
            <div className="space-y-8">
              <div className="inline-flex items-center gap-3 rounded-full border-[3px] border-black bg-white px-4 py-2 text-sm text-slate-900 motion-safe:animate-bounce">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-black text-white">
                  <Lock className="w-4 h-4" />
                </span>
                <span className="flex flex-col leading-tight">
                  <span className="text-[11px] uppercase tracking-[0.4em] text-slate-500 font-semibold">
                    Signal over noise
                  </span>
                  <span className="text-base font-semibold text-slate-900">
                    The calm place for team knowledge
                  </span>
                </span>
              </div>
              <h1 className="text-4xl lg:text-5xl font-bold leading-tight home-display">
                <span className="relative inline-flex items-center rounded-xl border border-black bg-black px-3 py-1 text-white shadow-[0_12px_30px_rgba(0,0,0,0.18)] tracking-wide">
                  TeamPad
                </span>{' '}
                <span className="text-slate-900 dark:text-black">
                  keeps team notes organized, fast, and always in sync.
                </span>
              </h1>
              <p className="text-lg text-muted-foreground">
                Capture meeting notes, brainstorms, and decisions without the bloat.
                TeamPad gives your team a shared home for every note with zero friction.
              </p>
              {!isAuthed && (
                <div className="flex flex-wrap gap-3">
                  <Button size="xl" asChild>
                    <Link to="/auth?view=signup">
                      Start free
                      <ArrowRight className="w-4 h-4" />
                    </Link>
                  </Button>
                  <Button size="xl" variant="outline" asChild>
                    <Link to="/app">View demo workspace</Link>
                  </Button>
                </div>
              )}
              <div className="flex flex-wrap gap-6 text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-primary" />
                  First note in under 60 seconds
                </div>
                <div className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-primary" />
                  Workspace and collection organization
                </div>
                <div className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-primary" />
                  AI summaries and action items
                </div>
              </div>
            </div>

            <div className="bg-card border border-border rounded-2xl shadow-card p-6 space-y-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                    <Bot className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Today in TeamPad</p>
                    <p className="text-lg font-semibold home-display">Marketing Sync</p>
                  </div>
                </div>
                <span className="text-xs text-muted-foreground">Updated 2m ago</span>
              </div>
              <div className="space-y-4 text-sm text-muted-foreground">
                <div className="rounded-xl border border-border bg-white p-4">
                  <p className="font-medium text-foreground dark:text-slate-800">Decisions</p>
                  <ul className="mt-2 space-y-2">
                    <li>Launch new landing page on April 10</li>
                    <li>Finalize partner list by Friday</li>
                  </ul>
                </div>
                <div className="rounded-xl border border-border bg-white p-4">
                  <p className="font-medium text-foreground dark:text-slate-800">Next steps</p>
                  <ul className="mt-2 space-y-2">
                    <li>Revise Q2 messaging doc</li>
                    <li>Share feedback in #brand</li>
                  </ul>
                </div>
              </div>
              <Button variant="secondary" className="w-full" asChild>
                <Link to="/app">Open in TeamPad</Link>
              </Button>
            </div>
          </div>
        </section>

        <section className="max-w-6xl mx-auto px-6 py-16">
          <div className="grid md:grid-cols-3 gap-6">
            <div className="rounded-2xl border border-border bg-card p-6 space-y-3">
              <Users className="w-6 h-6 text-primary" />
              <h3 className="text-lg font-semibold home-display">Built for real teams</h3>
              <p className="text-sm text-muted-foreground">
                Workspaces keep client, project, and internal notes neatly separated.
              </p>
            </div>
            <div className="rounded-2xl border border-border bg-card p-6 space-y-3">
              <Bot className="w-6 h-6 text-primary" />
              <h3 className="text-lg font-semibold home-display">AI that does the busywork</h3>
              <p className="text-sm text-muted-foreground">
                Summaries and action lists appear in seconds, ready for your review.
              </p>
            </div>
            <div className="rounded-2xl border border-border bg-card p-6 space-y-3">
              <Shield className="w-6 h-6 text-primary" />
              <h3 className="text-lg font-semibold home-display">Trustworthy by design</h3>
              <p className="text-sm text-muted-foreground">
                Clear save states, version awareness, and permissions you can rely on.
              </p>
            </div>
          </div>
        </section>

        <section className="bg-white border-t border-border">
          <div className="max-w-6xl mx-auto px-6 py-16 grid lg:grid-cols-[1fr_1fr] gap-10">
            <div className="space-y-4">
              <h2 className="text-2xl font-semibold text-slate-900 dark:text-slate-800 home-display">
                A workflow that stays out of your way
              </h2>
              <p className="text-muted-foreground">
                Create a workspace, organize notes by collection, and capture ideas fast.
                TeamPad keeps every update visible so your team never misses a decision.
              </p>
            </div>
            <div className="grid gap-4">
              {[
                {
                  title: 'Capture',
                  description: 'Start a note instantly, with clear save states and version history.',
                },
                {
                  title: 'Organize',
                  description: 'Collect notes by team or project with simple, predictable navigation.',
                },
                {
                  title: 'Share',
                  description: 'Invite collaborators and keep everyone aligned without noisy workflows.',
                },
              ].map((item) => (
                <div key={item.title} className="rounded-xl border border-border bg-card p-4">
                  <p className="font-medium text-foreground home-display">{item.title}</p>
                  <p className="text-sm text-muted-foreground mt-1">{item.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {!isAuthed && (
          <section className="max-w-6xl mx-auto px-6 py-16">
            <div className="rounded-3xl border border-border bg-white p-10 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
              <div className="space-y-3">
                <h2 className="text-2xl font-semibold text-slate-900 dark:text-slate-800 home-display">
                  Ready to see TeamPad in action?
                </h2>
                <p className="text-muted-foreground">
                  Join the early teams keeping their notes clean, searchable, and shared.
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                <Button size="lg" asChild>
                  <Link to="/auth?view=signup">Create account</Link>
                </Button>
                <Button size="lg" variant="outline" asChild>
                  <Link to="/app">Explore the demo</Link>
                </Button>
              </div>
            </div>
          </section>
        )}
      </main>
    </div>
  );
};

export default Index;

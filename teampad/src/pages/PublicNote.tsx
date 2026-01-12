import { type CSSProperties, type ReactNode, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { Loader2, Lock } from 'lucide-react';
import DOMPurify from 'dompurify';
import { restApi } from '@/api/restApi';
import { Button } from '@/components/ui/button';

export default function PublicNote() {
  const { slug } = useParams();
  const {
    data: note,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ['public-note', slug],
    queryFn: () => restApi.getPublicNote(slug as string),
    enabled: Boolean(slug),
  });

  const pageStyle: CSSProperties = {
    '--pn-accent': '198 85% 45%',
    '--pn-deep': '210 78% 32%',
    fontFamily: "'Space Grotesk', 'Avenir Next', 'Avenir', 'Helvetica Neue', sans-serif",
  };
  const brandStyle: CSSProperties = {
    fontFamily: "'Fraunces', 'Iowan Old Style', 'Palatino', serif",
  };

  const Shell = ({ children }: { children: ReactNode }) => (
    <div className="min-h-screen relative overflow-hidden bg-slate-50 text-slate-900" style={pageStyle}>
      <div className="absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-[radial-gradient(1200px_600px_at_8%_-10%,hsl(var(--pn-accent)/0.18),transparent),radial-gradient(900px_600px_at_90%_10%,hsl(var(--pn-deep)/0.18),transparent)]" />
        <div className="absolute inset-0 opacity-[0.08] bg-[linear-gradient(120deg,rgba(15,23,42,0.5)_1px,transparent_1px)] bg-[length:160px_160px]" />
      </div>

      <header className="sticky top-0 z-10 border-b border-white/60 bg-white/70 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
          <Link to="/" className="flex items-baseline gap-3">
            <span className="text-2xl font-semibold text-slate-900" style={brandStyle}>
              TeamPad
            </span>
            <span className="text-[10px] uppercase tracking-[0.4em] text-slate-500">Shared</span>
          </Link>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" asChild className="border-slate-300/70 bg-white/70">
              <Link to="/">Home</Link>
            </Button>
            <Button
              size="sm"
              asChild
              className="bg-[hsl(var(--pn-deep))] text-white hover:bg-[hsl(var(--pn-accent))]"
            >
              <Link to="/auth?view=signup">Get TeamPad</Link>
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-10">{children}</main>
    </div>
  );

  const normalizedBody = note?.body
    ? note.body.includes('<')
      ? note.body
      : note.body.replace(/\n/g, '<br />')
    : '';
  const safeBody = useMemo(() => DOMPurify.sanitize(normalizedBody || ''), [normalizedBody]);

  if (isLoading) {
    return (
      <Shell>
        <div className="flex min-h-[70vh] items-center justify-center">
          <div className="flex items-center gap-3 rounded-2xl border border-white/70 bg-white/80 px-6 py-4 text-slate-600 shadow-sm">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span className="text-sm font-medium">Loading shared note...</span>
          </div>
        </div>
      </Shell>
    );
  }

  if (isError || !note) {
    const message =
      error instanceof Error ? error.message : 'This link is invalid or has been removed.';
    return (
      <Shell>
        <div className="flex min-h-[70vh] items-center justify-center">
          <div className="max-w-md text-center space-y-4 rounded-3xl border border-white/70 bg-white/85 p-8 shadow-lg">
            <div className="mx-auto w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center">
              <Lock className="w-5 h-5 text-slate-500" />
            </div>
            <h1 className="text-2xl font-semibold text-slate-900">Note unavailable</h1>
            <p className="text-sm text-slate-600">{message}</p>
            <div className="flex flex-wrap justify-center gap-2">
              <Button onClick={() => refetch()}>Try again</Button>
              <Button variant="outline" asChild className="border-slate-300/70 bg-white/70">
                <Link to="/">Back to TeamPad</Link>
              </Button>
            </div>
          </div>
        </div>
      </Shell>
    );
  }

  const authorName = note.updatedBy?.name || 'TeamPad';
  const authorInitial = authorName.trim().charAt(0).toUpperCase();
  const updatedLabel = format(note.updatedAt, 'MMM d, yyyy · h:mm a');
  const expiresLabel = note.publicExpiresAt
    ? format(note.publicExpiresAt, 'MMM d, yyyy · h:mm a')
    : null;

  return (
    <Shell>
      <div className="grid gap-10 lg:grid-cols-[0.9fr_1.4fr] items-start">
        <aside className="space-y-6 animate-slide-up">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/70 bg-white/80 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.35em] text-slate-500">
            Shared note
          </span>
          <h1 className="text-4xl md:text-5xl font-semibold tracking-tight text-slate-900" style={brandStyle}>
            {note.title || 'Untitled'}
          </h1>
          <div className="rounded-2xl border border-white/70 bg-white/85 p-4 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="h-11 w-11 rounded-full bg-slate-900 text-white flex items-center justify-center text-sm font-semibold">
                {authorInitial}
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-900">{authorName}</p>
                <p className="text-xs text-slate-500">Updated {updatedLabel}</p>
              </div>
            </div>
            {expiresLabel ? (
              <div className="mt-4 rounded-xl border border-amber-200/60 bg-amber-50/70 px-3 py-2 text-[11px] uppercase tracking-[0.25em] text-amber-700">
                Link expires {expiresLabel}
              </div>
            ) : null}
          </div>
          <div className="rounded-2xl border border-slate-200/70 bg-white/85 p-5 space-y-3">
            <p className="text-sm font-semibold text-slate-900">Create your own workspace</p>
            <p className="text-xs text-slate-500">
              Capture decisions, share notes, and keep your team aligned in one place.
            </p>
            <Button
              asChild
              className="bg-[hsl(var(--pn-deep))] text-white hover:bg-[hsl(var(--pn-accent))]"
            >
              <Link to="/auth?view=signup">Start free</Link>
            </Button>
          </div>
        </aside>

        <section className="rounded-3xl border border-white/70 bg-white/85 shadow-[0_30px_80px_rgba(15,23,42,0.12)] animate-slide-up">
          <div className="border-b border-slate-200/70 px-8 py-6">
            <div className="flex items-center gap-3 text-[11px] uppercase tracking-[0.35em] text-slate-500">
              <span className="h-2 w-2 rounded-full bg-[hsl(var(--pn-accent))]" />
              Note
            </div>
          </div>
          <div className="px-8 py-8">
            <div
              className="note-content text-base leading-relaxed text-slate-800"
              dangerouslySetInnerHTML={{ __html: safeBody || '<p>No content yet.</p>' }}
            />
          </div>
          <div className="border-t border-slate-200/60 px-8 py-6 text-center text-[10px] uppercase tracking-[0.35em] text-slate-400">
            Shared via TeamPad
          </div>
        </section>
      </div>
    </Shell>
  );
}

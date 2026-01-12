import { ReactNode } from 'react';
import { Link } from 'react-router-dom';

interface AuthLayoutProps {
  children: ReactNode;
  title: string;
  subtitle: string;
}

export function AuthLayout({ children, title, subtitle }: AuthLayoutProps) {
  return (
    <div className="min-h-screen bg-white text-slate-900 flex relative overflow-hidden">
      {/* Mobile Background */}
      <div className="absolute inset-0 lg:hidden bg-primary">
        <div className="absolute inset-0 bg-gradient-to-br from-primary via-primary to-primary/80" />
        <div className="absolute inset-0 opacity-10">
          <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
            <defs>
              <pattern id="grid-mobile" width="10" height="10" patternUnits="userSpaceOnUse">
                <path d="M 10 0 L 0 0 0 10" fill="none" stroke="white" strokeWidth="0.5" />
              </pattern>
            </defs>
            <rect width="100" height="100" fill="url(#grid-mobile)" />
          </svg>
        </div>
      </div>

      {/* Left Panel - Branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-primary relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary via-primary to-primary/80" />
        <div className="absolute inset-0 opacity-10">
          <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
            <defs>
              <pattern id="grid" width="10" height="10" patternUnits="userSpaceOnUse">
                <path d="M 10 0 L 0 0 0 10" fill="none" stroke="white" strokeWidth="0.5" />
              </pattern>
            </defs>
            <rect width="100" height="100" fill="url(#grid)" />
          </svg>
        </div>
        
        <div className="relative z-10 flex flex-col justify-between p-12 text-primary-foreground">
          <Link to="/" className="flex items-center gap-3">
            <img
              src="/teampad-logo.png"
              alt="TeamPad logo"
              className="w-12 h-12 rounded-xl bg-[#111217] p-[5px] object-contain"
            />
            <span className="text-xl font-semibold">TeamPad</span>
          </Link>

          <div className="max-w-md">
            <h2 className="text-4xl font-bold mb-4 leading-tight">
              Your team's notes, organized and accessible.
            </h2>
            <p className="text-primary-foreground/80 text-lg">
              Fast capture, clear organization, and lightweight collaboration for teams that move quickly.
            </p>
          </div>

          <div className="flex items-center gap-4 text-sm text-primary-foreground/60">
            <span>© {new Date().getFullYear()} TeamPad</span>
            <span>·</span>
            <Link to="/privacy" className="hover:text-primary-foreground transition-colors">Privacy</Link>
            <span>·</span>
            <Link to="/terms" className="hover:text-primary-foreground transition-colors">Terms</Link>
          </div>
        </div>
      </div>

      {/* Right Panel - Form */}
      <div className="flex-1 relative z-10 flex items-center justify-center p-8 bg-transparent lg:bg-white">
        <div className="w-full max-w-md">
          {/* Mobile Logo */}
          <Link to="/" className="lg:hidden flex items-center gap-3 mb-8">
            <img
              src="/teampad-logo.png"
              alt="TeamPad logo"
              className="w-12 h-12 rounded-xl bg-[#111217] p-[5px] object-contain"
            />
            <span className="text-xl font-semibold text-white">TeamPad</span>
          </Link>

          <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
            <div className="mb-6">
              <h1 className="text-2xl font-bold text-foreground mb-2">{title}</h1>
              <p className="text-muted-foreground">{subtitle}</p>
            </div>

            {children}
          </div>
        </div>
      </div>
    </div>
  );
}

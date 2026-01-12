import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { sanitizeEmail } from '@/lib/sanitize';

interface LoginFormProps {
  onSubmit: (email: string, password: string) => Promise<void>;
  onForgotPassword: () => void;
  onSignUp: () => void;
  isLoading: boolean;
  errorMessage?: string | null;
}

export function LoginForm({
  onSubmit,
  onForgotPassword,
  onSignUp,
  isLoading,
  errorMessage,
}: LoginFormProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const safeEmail = sanitizeEmail(email);
    await onSubmit(safeEmail, password);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          placeholder="you@company.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoComplete="email"
        />
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="password">Password</Label>
          <button
            type="button"
            onClick={onForgotPassword}
            className="text-sm text-primary hover:text-primary/80 transition-colors"
          >
            Forgot password?
          </button>
        </div>
        <Input
          id="password"
          type="password"
          placeholder="Enter your password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          autoComplete="current-password"
        />
      </div>

      <Button type="submit" className="w-full" size="lg" disabled={isLoading}>
        {isLoading ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            Signing in...
          </>
        ) : (
          'Sign in'
        )}
      </Button>

      {errorMessage ? (
        <p className="text-sm text-destructive text-center" role="alert">
          {errorMessage}
        </p>
      ) : null}

      <div className="text-center">
        <span className="text-muted-foreground">Don't have an account? </span>
        <button
          type="button"
          onClick={onSignUp}
          className="text-primary hover:text-primary/80 font-medium transition-colors"
        >
          Sign up
        </button>
      </div>
    </form>
  );
}

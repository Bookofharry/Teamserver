import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { sanitizeEmail, sanitizeName } from '@/lib/sanitize';

interface SignUpFormProps {
  onSubmit: (name: string, email: string, password: string) => Promise<void>;
  onLogin: () => void;
  isLoading: boolean;
  existingAccount?: boolean;
  onExistingAccountClear?: () => void;
}

export function SignUpForm({
  onSubmit,
  onLogin,
  isLoading,
  existingAccount,
  onExistingAccountClear,
}: SignUpFormProps) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const safeName = sanitizeName(name);
    const safeEmail = sanitizeEmail(email);
    await onSubmit(safeName, safeEmail, password);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="name">Full name</Label>
        <Input
          id="name"
          type="text"
          placeholder="Alex Johnson"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          autoComplete="name"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          placeholder="you@company.com"
          value={email}
          onChange={(e) => {
            if (existingAccount) {
              onExistingAccountClear?.();
            }
            setEmail(e.target.value);
          }}
          required
          autoComplete="email"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          type="password"
          placeholder="Create a password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          autoComplete="new-password"
        />
      </div>

      <Button type="submit" className="w-full" size="lg" disabled={isLoading}>
        {isLoading ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            Sending code...
          </>
        ) : (
          'Send verification code'
        )}
      </Button>

      {existingAccount ? (
        <p className="text-sm text-destructive text-center" role="alert">
          This email already has an account.{' '}
          <button
            type="button"
            onClick={onLogin}
            className="text-primary hover:text-primary/80 font-medium transition-colors"
          >
            Sign in
          </button>
          
        </p>
      ) : null}

      <p className="text-xs text-center text-muted-foreground">
        We’ll email a 6-digit code to confirm your address.
      </p>

      <p className="text-xs text-center text-muted-foreground">
        By signing up, you agree to our{' '}
        <Link to="/terms" className="text-primary hover:underline">Terms of Service</Link>
        {' '}and{' '}
        <Link to="/privacy" className="text-primary hover:underline">Privacy Policy</Link>
      </p>

      <div className="text-center">
        <span className="text-muted-foreground">Already have an account? </span>
        <button
          type="button"
          onClick={onLogin}
          className="text-primary hover:text-primary/80 font-medium transition-colors"
        >
          Sign in
        </button>
      </div>
    </form>
  );
}

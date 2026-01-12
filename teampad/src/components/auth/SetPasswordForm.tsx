import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface SetPasswordFormProps {
  onSubmit: (password: string) => Promise<void>;
  onBack?: () => void;
  isLoading: boolean;
  label?: string;
  submitLabel?: string;
  helperText?: string;
}

export function SetPasswordForm({
  onSubmit,
  onBack,
  isLoading,
  label = 'Create a password',
  submitLabel = 'Continue',
  helperText = 'Use at least 8 characters',
}: SetPasswordFormProps) {
  const [password, setPassword] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSubmit(password);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="new-password">{label}</Label>
        <Input
          id="new-password"
          type="text"
          placeholder="Create a password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={8}
          autoComplete="new-password"
        />
        <p className="text-xs text-muted-foreground">{helperText}</p>
      </div>

      <Button type="submit" className="w-full" size="lg" disabled={isLoading}>
        {isLoading ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            Saving...
          </>
        ) : (
          submitLabel
        )}
      </Button>

      {onBack && (
        <button
          type="button"
          onClick={onBack}
          className="w-full text-center text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          Back to sign in
        </button>
      )}
    </form>
  );
}

import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { AuthLayout } from '@/components/auth/AuthLayout';
import { LoginForm } from '@/components/auth/LoginForm';
import { SignUpForm } from '@/components/auth/SignUpForm';
import { OTPVerification } from '@/components/auth/OTPVerification';
import { SetPasswordForm } from '@/components/auth/SetPasswordForm';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { api } from '@/api';
import { useAuthStatus } from '@/context/auth-status';
import { sanitizeEmail } from '@/lib/sanitize';

type AuthView = 'login' | 'signup' | 'otp' | 'two-factor' | 'forgot-password' | 'reset-password';
const SIDEBAR_COLLAPSED_KEY = 'teampad-sidebar-collapsed';

export default function Auth() {
  const [searchParams] = useSearchParams();
  const lastViewParamRef = useRef<string | null>(null);
  const redirectRef = useRef<string | null>(null);
  const [view, setView] = useState<AuthView>('login');
  const [isLoading, setIsLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [resetEmail, setResetEmail] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [signUpPassword, setSignUpPassword] = useState('');
  const [signUpName, setSignUpName] = useState('');
  const [signUpExistingAccount, setSignUpExistingAccount] = useState(false);
  const [twoFactorToken, setTwoFactorToken] = useState<string | null>(null);
  const navigate = useNavigate();
  const { toast } = useToast();
  const { refresh, markGuest } = useAuthStatus();
  const loginToastTimeout = useRef<number | null>(null);

  const switchView = (nextView: AuthView) => {
    setAuthError(null);
    setSignUpExistingAccount(false);
    setView(nextView);
  };

  useEffect(() => {
    const viewParam = searchParams.get('view');
    if (viewParam !== lastViewParamRef.current) {
      lastViewParamRef.current = viewParam;
      if (viewParam === 'signup' || viewParam === 'login' || viewParam === 'reset-password' || viewParam === 'otp') {
        setView(viewParam);
      }
    }
    const redirectParam = searchParams.get('redirect');
    if (
      redirectParam &&
      redirectParam.startsWith('/') &&
      !redirectParam.startsWith('//')
    ) {
      redirectRef.current = redirectParam;
    }
    const resetTokenParam = searchParams.get('token');
    if (resetTokenParam) {
      setResetToken(resetTokenParam);
    }
  }, [searchParams]);

  useEffect(() => {
    return () => {
      if (loginToastTimeout.current) {
        window.clearTimeout(loginToastTimeout.current);
      }
    };
  }, []);

  const handleLogin = async (email: string, password: string) => {
    setAuthError(null);
    setIsLoading(true);
    setEmail(email);

    let loginResponse;
    try {
      loginResponse = await api.login({ email, password });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Incorrect email or password.';
      setAuthError(message);
      if (loginToastTimeout.current) {
        window.clearTimeout(loginToastTimeout.current);
      }
      const loginToast = toast({
        title: 'Sign in failed',
        description: message,
        variant: 'destructive',
        className: 'toast-shake',
      });
      loginToastTimeout.current = window.setTimeout(() => {
        loginToast.dismiss();
      }, 2400);
      setIsLoading(false);
      return;
    }

    if (loginResponse?.twoFactorRequired && loginResponse.twoFactorToken) {
      setTwoFactorToken(loginResponse.twoFactorToken);
      switchView('two-factor');
      setIsLoading(false);
      return;
    }

    toast({
      title: 'Welcome back!',
      description: "You've successfully signed in.",
    });
    window.localStorage.setItem(SIDEBAR_COLLAPSED_KEY, 'true');
    await refresh();
    navigate(redirectRef.current ?? '/app');
    setIsLoading(false);
  };

  const handleSignUp = async (name: string, email: string, password: string) => {
    setAuthError(null);
    setIsLoading(true);
    const safeEmail = sanitizeEmail(email);
    setEmail(safeEmail);
    setSignUpPassword(password);
    setSignUpName(name);
    setSignUpExistingAccount(false);

    try {
      const exists = await api.checkEmailExists(safeEmail);
      if (exists) {
        setSignUpExistingAccount(true);
        setIsLoading(false);
        return;
      }
    } catch (error) {
      toast({
        title: 'Unable to verify email',
        description: "We couldn't confirm this email right now. Please try again.",
        variant: 'destructive',
      });
      setIsLoading(false);
      return;
    }

    try {
      await api.requestSignupOtp(safeEmail);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Sign up failed. Please try again.';
      toast({ title: 'Sign up failed', description: message });
      setIsLoading(false);
      return;
    }

    toast({
      title: 'Check your email',
      description: 'Enter the 6-digit code we sent to your email.',
    });
    switchView('otp');
    setIsLoading(false);
  };

  const handleOTPVerify = async (code: string) => {
    setAuthError(null);
    setIsLoading(true);

    try {
      await api.verifySignupOtp({
        name: signUpName,
        email,
        password: signUpPassword,
        code,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Verification failed.';
      toast({ title: 'Verification failed', description: message });
      setIsLoading(false);
      return;
    }

    toast({
      title: 'Account created!',
      description: 'Welcome to TeamPad.',
    });
    await refresh();
    navigate(redirectRef.current ?? '/app');
    setIsLoading(false);
  };

  const handleResendOTP = async () => {
    if (!email) return;
    try {
      await api.requestSignupOtp(email);
      toast({
        title: 'Code sent!',
        description: 'A new verification code has been sent to your email.',
      });
    } catch (error) {
      toast({
        title: 'Resend failed',
        description: error instanceof Error ? error.message : 'Please try again.',
      });
    }
  };

  const handleTwoFactorVerify = async (code: string) => {
    if (!twoFactorToken) return;
    setAuthError(null);
    setIsLoading(true);
    try {
      await api.verifyTwoFactorLogin({ token: twoFactorToken, code });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Verification failed.';
      toast({ title: 'Verification failed', description: message });
      setIsLoading(false);
      return;
    }
    toast({
      title: 'Signed in!',
      description: 'Two-factor verification complete.',
    });
    window.localStorage.setItem(SIDEBAR_COLLAPSED_KEY, 'true');
    await refresh();
    navigate(redirectRef.current ?? '/app');
    setIsLoading(false);
  };

  const handleTwoFactorResend = async () => {
    if (!twoFactorToken) return;
    try {
      await api.resendTwoFactorLogin({ token: twoFactorToken });
      toast({
        title: 'Code resent',
        description: 'A new code has been sent to your email.',
      });
    } catch (error) {
      toast({
        title: 'Resend failed',
        description: error instanceof Error ? error.message : 'Please try again.',
      });
    }
  };

  const handleTwoFactorBack = () => {
    setTwoFactorToken(null);
    switchView('login');
  };

  const handleResetPassword = async () => {
    setAuthError(null);
    setIsLoading(true);
    const safeResetEmail = sanitizeEmail(resetEmail);
    try {
      await api.forgotPassword(safeResetEmail);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Reset failed. Try again.';
      toast({ title: 'Reset failed', description: message });
      setIsLoading(false);
      return;
    }

    toast({
      title: 'Reset email sent',
      description: 'Check your inbox to continue.',
    });
    setIsLoading(false);
    switchView('login');
  };

  const handleResetPasswordSubmit = async (password: string) => {
    setAuthError(null);
    setIsLoading(true);
    if (!resetToken) {
      toast({
        title: 'Reset link missing',
        description: 'Request a new password reset link.',
      });
      switchView('forgot-password');
      setIsLoading(false);
      return;
    }
    try {
      await api.resetPassword({ token: resetToken, password });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Password update failed.';
      toast({ title: 'Password update failed', description: message });
      switchView('forgot-password');
      setIsLoading(false);
      return;
    }

    toast({
      title: 'Password updated',
      description: 'Sign in with your new password.',
    });
    markGuest();
    await api.clearSession();
    navigate('/auth?view=login');
    setIsLoading(false);
  };

  const getAuthContent = () => {
    switch (view) {
      case 'login':
        return {
          title: 'Welcome back',
          subtitle: 'Sign in to continue to TeamPad',
          content: (
            <LoginForm
              onSubmit={handleLogin}
              onForgotPassword={() => switchView('forgot-password')}
              onSignUp={() => switchView('signup')}
              isLoading={isLoading}
              errorMessage={authError}
            />
          ),
        };
      case 'signup':
        return {
          title: 'Create an account',
          subtitle: 'Start organizing your team notes',
          content: (
            <SignUpForm
              onSubmit={handleSignUp}
              onLogin={() => switchView('login')}
              isLoading={isLoading}
              existingAccount={signUpExistingAccount}
              onExistingAccountClear={() => setSignUpExistingAccount(false)}
            />
          ),
        };
      case 'otp':
        return {
          title: 'Verify your email',
          subtitle: 'Enter the code we sent you',
          content: (
            <OTPVerification
              email={email}
              onVerify={handleOTPVerify}
              onResend={handleResendOTP}
              onBack={() => switchView('login')}
              isLoading={isLoading}
            />
          ),
        };
      case 'two-factor':
        return {
          title: 'Two-factor verification',
          subtitle: 'Enter the code we sent to your email',
          content: (
            <OTPVerification
              email={email}
              onVerify={handleTwoFactorVerify}
              onResend={handleTwoFactorResend}
              onBack={handleTwoFactorBack}
              isLoading={isLoading}
            />
          ),
        };
      case 'reset-password':
        return {
          title: 'Reset your password',
          subtitle: 'Choose a new password to continue',
          content: (
            <SetPasswordForm
              onSubmit={handleResetPasswordSubmit}
              onBack={() => switchView('login')}
              isLoading={isLoading}
              label="New password"
              submitLabel="Update password"
              helperText="Use at least 8 characters"
            />
          ),
        };
      case 'forgot-password':
        return {
          title: 'Reset password',
          subtitle: "We'll send you a reset link",
          content: (
            <div className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="reset-email">Email</Label>
                <Input
                  id="reset-email"
                  type="email"
                  placeholder="you@company.com"
                  value={resetEmail}
                  onChange={(event) => setResetEmail(event.target.value)}
                />
              </div>
              <Button className="w-full" size="lg" onClick={handleResetPassword} disabled={isLoading}>
                Send reset link
              </Button>
              <button
                onClick={() => switchView('login')}
                className="w-full text-center text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Back to sign in
              </button>
            </div>
          ),
        };
      default:
        return {
          title: 'Welcome back',
          subtitle: 'Sign in to continue to TeamPad',
          content: (
            <LoginForm
              onSubmit={handleLogin}
              onForgotPassword={() => switchView('forgot-password')}
              onSignUp={() => switchView('signup')}
              isLoading={isLoading}
              errorMessage={authError}
            />
          ),
        };
    }
  };

  const { title, subtitle, content } = getAuthContent();

  return (
    <AuthLayout title={title} subtitle={subtitle}>
      {content}
    </AuthLayout>
  );
}

import { useState, useRef, useEffect } from 'react';
import { Loader2, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface OTPVerificationProps {
  email: string;
  onVerify: (code: string) => Promise<void>;
  onResend: () => Promise<void>;
  onBack: () => void;
  isLoading: boolean;
}

export function OTPVerification({ email, onVerify, onResend, onBack, isLoading }: OTPVerificationProps) {
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [resendTimer, setResendTimer] = useState(60);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    inputRefs.current[0]?.focus();
  }, []);

  useEffect(() => {
    if (resendTimer > 0) {
      const timer = setTimeout(() => setResendTimer(resendTimer - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendTimer]);

  const handleChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;

    const newOtp = [...otp];
    newOtp[index] = value.slice(-1);
    setOtp(newOtp);

    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    if (newOtp.every(digit => digit) && newOtp.join('').length === 6) {
      onVerify(newOtp.join(''));
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').slice(0, 6);
    if (!/^\d+$/.test(pastedData)) return;

    const newOtp = [...otp];
    pastedData.split('').forEach((digit, index) => {
      if (index < 6) newOtp[index] = digit;
    });
    setOtp(newOtp);

    if (pastedData.length === 6) {
      onVerify(pastedData);
    }
  };

  const handleResend = async () => {
    await onResend();
    setResendTimer(60);
    setOtp(['', '', '', '', '', '']);
  };

  return (
    <div className="space-y-6">
      <div>
        <Button variant="ghost" size="sm" onClick={onBack} className="px-2">
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>
      </div>

      <div className="text-center space-y-2">
        <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
          <span className="text-2xl">📧</span>
        </div>
        <h2 className="text-xl font-semibold text-foreground">Check your email</h2>
        <p className="text-muted-foreground">
          We sent a 6-digit code to<br />
          <span className="font-medium text-foreground">{email}</span>
        </p>
      </div>

      <div className="flex justify-center gap-2" onPaste={handlePaste}>
        {otp.map((digit, index) => (
          <input
            key={index}
            ref={(el) => (inputRefs.current[index] = el)}
            type="text"
            inputMode="numeric"
            maxLength={1}
            value={digit}
            onChange={(e) => handleChange(index, e.target.value)}
            onKeyDown={(e) => handleKeyDown(index, e)}
            disabled={isLoading}
            className="w-12 h-14 text-center text-xl font-semibold rounded-lg border border-input bg-background text-white caret-white focus:outline-none focus:ring-2 focus:ring-ring transition-all disabled:opacity-50"
          />
        ))}
      </div>

      {isLoading && (
        <div className="flex justify-center">
          <Loader2 className="w-6 h-6 text-primary animate-spin" />
        </div>
      )}

      <div className="text-center">
        <span className="text-muted-foreground">Didn't receive the code? </span>
        {resendTimer > 0 ? (
          <span className="text-muted-foreground">
            Resend in {resendTimer}s
          </span>
        ) : (
          <button
            onClick={handleResend}
            className="text-primary hover:text-primary/80 font-medium transition-colors"
          >
            Resend code
          </button>
        )}
      </div>

      <p className="text-xs text-center text-muted-foreground">
        Code expires in 10 minutes
      </p>
    </div>
  );
}

import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '@/api';
import { Button } from '@/components/ui/button';
import { ColorizedText } from '@/components/ui/colorized-text';
import { useToast } from '@/hooks/use-toast';
import { useAuthStatus } from '@/context/auth-status';
import type { InviteDetails } from '@/types';

type InviteStatus = 'checking' | 'ready' | 'accepting' | 'declining' | 'error';

export default function InviteAccept() {
  const { token } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { status: authStatus } = useAuthStatus();
  const [status, setStatus] = useState<InviteStatus>('checking');
  const [message, setMessage] = useState('Checking invite...');
  const [invite, setInvite] = useState<InviteDetails | null>(null);
  const isAuthed = authStatus === "authed";

  useEffect(() => {
    const loadInvite = async () => {
      if (!token) {
        setStatus('error');
        setMessage('Invite token is missing.');
        return;
      }

      try {
        const details = await api.getInviteDetails(token);
        setInvite(details);
        setStatus('ready');
        setMessage('');
      } catch (error) {
        setStatus('error');
        setMessage(error instanceof Error ? error.message : 'Invite could not be loaded.');
      }
    };

    loadInvite();
  }, [token]);

  const handleAccept = async () => {
    if (!token) return;
    if (!isAuthed) {
      const redirect = encodeURIComponent(`/invite/${token}`);
      navigate(`/auth?view=login&redirect=${redirect}`);
      return;
    }

    setStatus('accepting');
    setMessage('Accepting your invite...');
    try {
      await api.acceptInvite(token);
      await queryClient.invalidateQueries({ queryKey: ['workspaces'] });
      toast({ title: 'Invite accepted', description: 'Welcome to the workspace.' });
      navigate('/app', { replace: true });
    } catch (error) {
      setStatus('error');
      setMessage(error instanceof Error ? error.message : 'Invite could not be accepted.');
    }
  };

  const handleDecline = async () => {
    if (!token) return;
    if (!isAuthed) {
      const redirect = encodeURIComponent(`/invite/${token}`);
      navigate(`/auth?view=login&redirect=${redirect}`);
      return;
    }

    setStatus('declining');
    setMessage('Declining invite...');
    try {
      await api.declineInvite(token);
      toast({ title: 'Invite declined', description: 'You can close this window.' });
      navigate('/app', { replace: true });
    } catch (error) {
      setStatus('error');
      setMessage(error instanceof Error ? error.message : 'Invite could not be declined.');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center max-w-sm space-y-4">
        <h1 className="text-2xl font-semibold text-foreground">Workspace invite</h1>
        {status === 'checking' && (
          <p className="text-sm text-muted-foreground">Checking invite...</p>
        )}
        {status === 'ready' && invite && (
          <div className="space-y-3">
            <div className="rounded-xl border border-border bg-card p-4 text-left">
              <p className="text-sm text-muted-foreground">Workspace</p>
              <p className="text-lg font-semibold text-foreground">{invite.workspaceName}</p>
              <p className="text-sm text-muted-foreground mt-2">
                Invited by{' '}
                <span className="font-medium">
                  <ColorizedText text={invite.inviter?.name || 'TeamPad'} />
                </span>
              </p>
            </div>
            {!isAuthed && (
              <p className="text-xs text-muted-foreground">
                Sign in or create an account with this email to respond.
              </p>
            )}
            <div className="flex flex-col gap-2">
              <Button onClick={handleAccept} disabled={!isAuthed}>
                Accept invite
              </Button>
              <Button variant="outline" onClick={handleDecline} disabled={!isAuthed}>
                Decline
              </Button>
            </div>
          </div>
        )}
        {(status === 'accepting' || status === 'declining') && (
          <p className="text-sm text-muted-foreground">{message}</p>
        )}
        {status === 'error' && (
          <>
            <p className="text-sm text-muted-foreground">{message}</p>
            <div className="flex flex-col gap-2">
              <Button onClick={() => navigate('/auth?view=login')}>Go to sign in</Button>
              <Button variant="outline" onClick={() => navigate('/')}>
                Back to home
              </Button>
            </div>
          </>
        )}
        {status === 'ready' && !isAuthed && (
          <div className="flex flex-col gap-2">
            <Button onClick={() => navigate(`/auth?view=login&redirect=${encodeURIComponent(`/invite/${token}`)}`)}>
              Sign in
            </Button>
            <Button
              variant="outline"
              onClick={() => navigate(`/auth?view=signup&redirect=${encodeURIComponent(`/invite/${token}`)}`)}
            >
              Create account
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

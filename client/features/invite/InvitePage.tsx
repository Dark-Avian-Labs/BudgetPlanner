import { useAuth } from '@clerk/react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router';

import { planPath } from '../../app/paths';
import { RequireAuth } from '../../components/Layout/Layout';
import { Button } from '../../components/ui/Button';
import { apiJson } from '../../utils/api';

interface InvitePreview {
  role: 'editor' | 'viewer';
  planName: string;
  currency: string;
  expiresAt: string;
}

function InviteInner() {
  const { token } = useParams();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { isLoaded, isSignedIn } = useAuth();
  const [preview, setPreview] = useState<InvitePreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [setAsDefault, setSetAsDefault] = useState(true);
  const [accepting, setAccepting] = useState(false);

  useEffect(() => {
    if (!token) return;
    void (async () => {
      try {
        const data = await apiJson<InvitePreview>(`/api/invites/${token}`);
        setPreview(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Invite unavailable');
      }
    })();
  }, [token]);

  async function accept() {
    if (!token) return;
    setAccepting(true);
    setError(null);
    try {
      const result = await apiJson<{ planId: string }>(`/api/invites/${token}/accept`, {
        method: 'POST',
        body: JSON.stringify({ setAsDefault }),
      });
      navigate(planPath(result.planId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Accept failed');
    } finally {
      setAccepting(false);
    }
  }

  if (!preview && !error) {
    return <p className="text-muted py-16 text-center text-sm">{t('app.loading')}</p>;
  }

  if (error && !preview) {
    return <p className="text-danger py-16 text-center text-sm">{error}</p>;
  }

  if (!preview) return null;

  return (
    <div className="glass-surface mx-auto mt-8 flex max-w-md flex-col gap-4 p-6">
      <h1 className="text-xl font-semibold">{t('invite.acceptTitle')}</h1>
      <p className="text-sm">
        {t('invite.acceptHint', {
          role: preview.role === 'editor' ? t('invite.editor') : t('invite.viewer'),
        })}
      </p>
      <div className="text-muted text-sm">
        <div className="text-foreground text-base font-medium">{preview.planName}</div>
        <div>{preview.currency}</div>
      </div>
      {isLoaded && isSignedIn ? (
        <>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={setAsDefault}
              onChange={(e) => setSetAsDefault(e.target.checked)}
            />
            {t('app.setDefault')}
          </label>
          {error ? <p className="text-danger text-sm">{error}</p> : null}
          <Button variant="accent" disabled={accepting} onClick={() => void accept()}>
            {t('invite.accept')}
          </Button>
        </>
      ) : (
        <p className="text-muted text-sm">{t('auth.signInSubtitle')}</p>
      )}
    </div>
  );
}

export function InvitePage() {
  return (
    <RequireAuth>
      <InviteInner />
    </RequireAuth>
  );
}

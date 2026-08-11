import { useAuth } from '@clerk/react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router';

import { CURRENCIES } from '../../app/config';
import { planPath } from '../../app/paths';
import { RequireAuth } from '../../components/Layout/Layout';
import { Button } from '../../components/ui/Button';
import { FormSelect } from '../../components/ui/FormSelect';
import { Input } from '../../components/ui/Input';
import { MaterialSymbol } from '../../components/ui/MaterialSymbol';
import type { Me, PlanSummary } from '../../lib/types';
import { apiJson } from '../../utils/api';

function HomeInner() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { isLoaded, isSignedIn } = useAuth();
  const [plans, setPlans] = useState<PlanSummary[]>([]);
  const [me, setMe] = useState<Me | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState('Household');
  const [currency, setCurrency] = useState('EUR');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    void (async () => {
      try {
        const data = await apiJson<{
          plans: PlanSummary[];
          me: Me;
          defaultPlanId: string | null;
        }>('/api/plans');
        setPlans(data.plans);
        setMe(data.me);
        if (data.defaultPlanId) {
          navigate(planPath(data.defaultPlanId), { replace: true });
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load');
      }
    })();
  }, [isLoaded, isSignedIn, navigate]);

  async function createPlan() {
    setCreating(true);
    setError(null);
    try {
      const result = await apiJson<{ plan: { id: string } }>('/api/plans', {
        method: 'POST',
        body: JSON.stringify({ name, currency }),
      });
      navigate(planPath(result.plan.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Create failed');
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="flex flex-col gap-6 py-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t('app.name')}</h1>
        <p className="text-muted mt-1 text-sm">{t('auth.signInSubtitle')}</p>
      </div>

      {error ? <p className="text-danger text-sm">{error}</p> : null}

      {plans.length > 0 ? (
        <section className="flex flex-col gap-2">
          <h2 className="text-muted text-xs font-semibold tracking-wide uppercase">Plans</h2>
          <ul className="glass-surface divide-glass-divider divide-y overflow-hidden">
            {plans.map((plan) => (
              <li key={plan.id}>
                <Link
                  to={planPath(plan.id)}
                  className="hover:bg-glass-hover flex items-center justify-between gap-3 px-4 py-3"
                >
                  <span className="font-medium">{plan.name}</span>
                  <span className="text-muted flex items-center gap-2 text-xs">
                    {me?.defaultPlanId === plan.id ? (
                      <MaterialSymbol name="star" filled className="text-[1rem]" />
                    ) : null}
                    {plan.currency}
                    <MaterialSymbol name="chevron_right" />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="glass-surface flex flex-col gap-3 p-4">
        <h2 className="font-semibold">{t('plan.createPlan')}</h2>
        <label className="form-group">
          <span>{t('plan.planName')}</span>
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <FormSelect
          label={t('plan.currency')}
          value={currency}
          options={CURRENCIES.map((code) => ({ value: code, label: code }))}
          onChange={setCurrency}
        />
        <Button variant="accent" disabled={creating} onClick={() => void createPlan()}>
          {t('plan.createPlan')}
        </Button>
      </section>
    </div>
  );
}

export function HomePage() {
  return (
    <RequireAuth>
      <HomeInner />
    </RequireAuth>
  );
}

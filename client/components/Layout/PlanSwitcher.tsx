import { useAuth } from '@clerk/react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router';

import { APP_PATHS, planPath } from '../../app/paths';
import type { PlanSummary } from '../../lib/types';
import { apiJson } from '../../utils/api';
import { SelectDropdown } from '../ui/SelectDropdown';

export function PlanSwitcher() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { isLoaded, isSignedIn } = useAuth();
  const [plans, setPlans] = useState<PlanSummary[]>([]);
  const [open, setOpen] = useState(false);

  const currentPlanId = /^\/plan\/([^/]+)/.exec(location.pathname)?.[1] ?? '';

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    void apiJson<{ plans: PlanSummary[] }>('/api/plans')
      .then((data) => setPlans(data.plans))
      .catch(() => {
        setPlans([]);
      });
  }, [isLoaded, isSignedIn, location.pathname]);

  if (!isLoaded || !isSignedIn || plans.length === 0) return null;

  return (
    <SelectDropdown
      value={currentPlanId}
      options={[
        { value: '', label: t('plan.allPlans') },
        ...plans.map((plan) => ({ value: plan.id, label: plan.name })),
      ]}
      onChange={(value) => {
        if (!value) navigate(APP_PATHS.home);
        else navigate(planPath(value));
      }}
      open={open}
      onOpenChange={setOpen}
      buttonAriaLabel={t('plan.switchPlan')}
      className="w-36 sm:w-52"
    />
  );
}

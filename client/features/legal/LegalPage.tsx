import { LEGAL_ENTITY_NAME, LEGAL_PAGE_URL } from '../../app/config';
import { GlassCard } from '../../components/ui/GlassCard';

export function LegalPage() {
  window.location.replace(LEGAL_PAGE_URL);

  return (
    <div className="mx-auto max-w-5xl">
      <GlassCard className="p-8">
        <h1 className="text-foreground text-2xl font-semibold">Legal</h1>
        <p className="text-muted mt-3 text-sm" role="status" aria-live="polite">
          Redirecting to legal information for {LEGAL_ENTITY_NAME}…
        </p>
      </GlassCard>
    </div>
  );
}

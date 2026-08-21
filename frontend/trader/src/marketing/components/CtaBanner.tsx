import Link from 'next/link';

/**
 * Closing conversion band. Sits above the footer on every marketing page
 * so each one ends with the same next step.
 */
export function CtaBanner({
  title, lead, primary, secondary,
}: {
  title: React.ReactNode;
  lead?: React.ReactNode;
  primary: { label: string; href: string };
  secondary?: { label: string; href: string };
}) {
  return (
    <section className="mk-section">
      <div className="mk-container">
        <div
          className="relative overflow-hidden text-center"
          style={{
            background: 'var(--mk-surface)',
            border: '1px solid var(--mk-line)',
            borderRadius: 'var(--mk-radius-lg)',
            padding: 'clamp(2.5rem, 1.5rem + 4vw, 5rem) var(--mk-gutter)',
          }}
        >
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                'radial-gradient(70% 120% at 50% 0%, var(--mk-accent-soft) 0%, transparent 65%)',
            }}
          />
          <div className="relative flex flex-col items-center gap-4 mx-auto max-w-2xl">
            <h2 className="mk-h2">{title}</h2>
            {lead && <p className="mk-lead">{lead}</p>}
            <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
              <Link href={primary.href} className="mk-btn mk-btn--primary">{primary.label}</Link>
              {secondary && (
                <Link href={secondary.href} className="mk-btn mk-btn--ghost">{secondary.label}</Link>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

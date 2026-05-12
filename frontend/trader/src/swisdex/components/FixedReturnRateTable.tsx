'use client';

/**
 * Fixed Return Funds — rate matrix.
 * Columns: deposit tier. Rows: lock-up tenure. Cells: % return for that tenure.
 */
const TIERS = ['$1K', '$10K', '$25K', '$50K', '$100K'] as const;

const ROWS: { tenure: string; values: [string, string, string, string, string] }[] = [
  { tenure: 'Month',     values: ['1%',  '2%',  '2.5%', '3%',   '4%'  ] },
  { tenure: 'Quarter',   values: ['2%',  '3%',  '3%',   '3.5%', '4.5%'] },
  { tenure: 'Half-Year', values: ['3%',  '4%',  '4.5%', '5%',   '5%'  ] },
  { tenure: 'Year',      values: ['4%',  '5%',  '5.5%', '6%',   '5.5%'] },
  { tenure: '2 Year',    values: ['5%',  '6%',  '6.5%', '7%',   '7%'  ] },
];

export function FixedReturnRateTable({ heading = true }: { heading?: boolean }) {
  return (
    <section className="mx-auto max-w-[1200px] px-[var(--gutter)] py-12 sm:py-16">
      {heading && (
        <div className="text-center mb-10">
          <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full liquid-glass text-[11px] uppercase tracking-[0.16em] text-foreground/70">
            <span className="size-1.5 rounded-full bg-primary" /> Fixed Return Funds
          </span>
          <h2 className="mt-5 font-display uppercase text-2xl sm:text-3xl md:text-4xl tracking-tight">
            Return Rates by Tenure &amp; Tier
          </h2>
          <p className="mt-3 text-foreground/65 max-w-xl mx-auto text-sm sm:text-base">
            Lock your principal for a defined tenure and earn a fixed return. Bigger deposits and longer
            lock-ups unlock higher rates.
          </p>
        </div>
      )}

      <div className="overflow-x-auto -mx-[var(--gutter)] px-[var(--gutter)]">
        <div className="min-w-[640px] rounded-2xl overflow-hidden border border-foreground/15">
          <table className="w-full" style={{ borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th
                  scope="col"
                  className="bg-foreground/[0.04] border-r border-foreground/15 px-5 py-4 text-left text-xs uppercase tracking-[0.16em] text-foreground/55"
                >
                  Tenure
                </th>
                {TIERS.map((tier, i) => (
                  <th
                    key={tier}
                    scope="col"
                    className={`px-5 py-4 text-center font-display uppercase tracking-[0.16em] text-sm text-white ${
                      i < TIERS.length - 1 ? 'border-r border-white/10' : ''
                    }`}
                    style={{
                      background:
                        i === 0
                          ? 'linear-gradient(180deg, #1f2937 0%, #0a0a0a 100%)'
                          : i === 1
                          ? 'linear-gradient(180deg, #2c3e50 0%, #0e1418 100%)'
                          : i === 2
                          ? 'linear-gradient(180deg, #55a630 0%, #1a3210 100%)'
                          : i === 3
                          ? 'linear-gradient(180deg, #2f7d18 0%, #0a1f08 100%)'
                          : 'linear-gradient(180deg, #d00000 0%, #3d0000 100%)',
                    }}
                  >
                    {tier}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ROWS.map((row, ri) => (
                <tr key={row.tenure} className="border-t border-foreground/10">
                  <th
                    scope="row"
                    className="px-5 py-4 text-left text-sm font-semibold text-foreground/85 bg-foreground/[0.04] border-r border-foreground/15"
                  >
                    {row.tenure}
                  </th>
                  {row.values.map((v, ci) => {
                    const highlight = ri === ROWS.length - 1 || ci === TIERS.length - 1;
                    return (
                      <td
                        key={ci}
                        className={`px-5 py-4 text-center text-sm tabular-nums ${
                          highlight ? 'text-primary font-semibold bg-primary/[0.08]' : 'text-foreground/90 bg-foreground/[0.02]'
                        } ${ci < TIERS.length - 1 ? 'border-r border-foreground/10' : ''}`}
                      >
                        {v}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <p className="mt-5 text-center text-xs text-foreground/45 max-w-2xl mx-auto leading-relaxed">
        Rates shown are the fixed return paid for the full tenure, not annualised yields.
        Early withdrawal forfeits the return earned to date and may incur a fee.
      </p>
    </section>
  );
}

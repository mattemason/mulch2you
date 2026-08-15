import { getSiteStats } from "@/lib/db/queries";

/**
 * Headline numbers, read live from the database.
 *
 * Currently not rendered — see the homepage. "0 loads delivered" is an honest
 * stat and a terrible advertisement, so the band waits until there's a real
 * story in it. Kept whole and self-contained so switching it back on is one
 * line in page.tsx, with nothing to rewrite.
 *
 * Whatever goes in here stays computed rather than typed in. A marketing page
 * quoting invented totals is a fabricated trust signal, and these cost one
 * cheap query.
 */
export async function StatsBand() {
  const stats = await getSiteStats();

  // Nothing worth showing yet.
  if (stats.loadsDelivered + stats.drivewaysWaiting + stats.treeCrews === 0) return null;

  return (
    <section className="stats">
      <div className="wrap">
        <div className="stats-grid">
          <Stat
            value={stats.mulchRehomedM3 > 0 ? Math.round(stats.mulchRehomedM3).toString() : "—"}
            unit="m³"
            label="Mulch rehomed instead of tipped"
          />
          <Stat value={stats.loadsDelivered.toString()} label="Loads delivered" />
          <Stat value={stats.drivewaysWaiting.toString()} label="Driveways waiting for a load" />
          <Stat value={stats.treeCrews.toString()} label="Tree crews on board" />
        </div>
      </div>
    </section>
  );
}

function Stat({ value, unit, label }: { value: string; unit?: string; label: string }) {
  return (
    <div className="stat">
      <div className="stat-num">
        {value}
        {unit && <span className="green">{unit}</span>}
      </div>
      <div className="stat-label">{label}</div>
    </div>
  );
}

/**
 * Deterministic trend blurb for the homepage stress strip — same discipline as
 * the digest template: rule-chosen sentences, no number that wasn't computed.
 */

export interface StressPoint {
  slug: string; // "2026-08-12" (UTC day)
  score: number;
  band: string;
}

export function stressTrendBlurb(points: StressPoint[], drivers: string[]): string {
  if (points.length === 0) return "";
  if (points.length < 2) {
    return `One daily reading so far — the trend fills in as nightly editions accumulate. Today's read: ${
      drivers.length ? drivers.join("; ") : "no dominant driver"
    }.`;
  }

  const first = points[0];
  const last = points[points.length - 1];
  const spanDays = points.length - 1;
  const delta = last.score - first.score;
  const sameBand = points.every((p) => p.band === last.band);

  let trend: string;
  if (Math.abs(delta) < 3) {
    trend = sameBand
      ? `Curator stress has held ${last.band.toLowerCase()} for ${spanDays + 1} straight days.`
      : `Curator stress has held near ${Math.round(last.score)} over the last ${spanDays} days.`;
  } else {
    const verb = delta > 0 ? "climbed" : "eased";
    const bandNote = sameBand
      ? `, staying ${last.band.toLowerCase()} throughout`
      : `, moving from ${first.band.toLowerCase()} to ${last.band.toLowerCase()}`;
    trend = `Curator stress has ${verb} ${Math.abs(Math.round(delta))} points over the last ${spanDays} days${bandNote}.`;
  }

  const peak = Math.max(...points.map((p) => p.score));
  const peakNote =
    peak > last.score + 5 && peak > first.score + 5
      ? ` A mid-week spike touched ${Math.round(peak)}.`
      : "";

  const driverNote = drivers.length ? ` Today's read: ${drivers.join("; ")}.` : "";
  return `${trend}${peakNote}${driverNote}`;
}

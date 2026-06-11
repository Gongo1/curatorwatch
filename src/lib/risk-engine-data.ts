// Bundled engine ratings (static import so it ships inside the serverless function —
// avoids runtime fs path issues on Vercel). Refreshed by committing a new
// data/risk-engine/ratings.json (re-run the engine, copy the output, deploy).
import ratings from "../../data/risk-engine/ratings.json";

export const ratingsData = ratings as unknown as Parameters<
  typeof import("@/scripts/import-risk-engine-ratings").importRatingsData
>[0];

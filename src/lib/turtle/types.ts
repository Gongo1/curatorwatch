/**
 * Internal, normalized Turtle opportunity shape used throughout the app.
 * Populated by client.ts from the v2 feed (GET https://earn.turtle.xyz/v2/opportunities/),
 * which is normalized back to this shape so downstream consumers are source-agnostic.
 */

export interface TurtleChain {
  slug: string;
  name: string;
  id?: number | string;
  chainId?: string;
}

export interface TurtleToken {
  address: string;
  symbol: string;
  decimals: number;
  chain: TurtleChain;
  price?: number;
}

export interface TurtleIncentive {
  name?: string;
  description?: string;
  rewardType?: string;
  token?: TurtleToken;
  apr: number;
  type?: string;
}

export interface TurtleCurator {
  name: string;
  description?: string;
  landingUrl?: string;
  iconUrl?: string;
}

export interface TurtleOpportunity {
  id: string;
  name: string;
  description: string;
  type: string; // "vault" | "lending" | etc.
  tvl: number;
  estimatedApr: number;
  depositTokens: TurtleToken[];
  rewardTokens: TurtleToken[];
  incentives: TurtleIncentive[];
  curator?: TurtleCurator;
  url?: string;
  protocol?: string;
  chain?: TurtleChain;
}

export interface TurtleApiResponse {
  opportunities: TurtleOpportunity[];
}

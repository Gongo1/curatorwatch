/**
 * TypeScript interfaces for Turtle Club API responses
 * Source: GET https://earn.turtle.xyz/v1/opportunities/
 */

export interface TurtleChain {
  slug: string;
  name: string;
  id: number;
}

export interface TurtleToken {
  address: string;
  symbol: string;
  decimals: number;
  chain: TurtleChain;
  price?: number;
}

export interface TurtleIncentive {
  token: TurtleToken;
  apr: number;
  type: string;
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
  url?: string;
  protocol?: string;
  chain?: TurtleChain;
}

export interface TurtleApiResponse {
  opportunities: TurtleOpportunity[];
}

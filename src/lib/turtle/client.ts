/**
 * Simple fetch client for Turtle Club API
 * Endpoint: https://earn.turtle.xyz/v1/opportunities/
 * No authentication required.
 */

import type { TurtleOpportunity } from "./types";

const TURTLE_API_URL = "https://earn.turtle.xyz/v1/opportunities/";

export async function fetchTurtleOpportunities(): Promise<TurtleOpportunity[]> {
  const response = await fetch(TURTLE_API_URL, {
    headers: { Accept: "application/json" },
  });

  if (!response.ok) {
    throw new Error(
      `Turtle API error: ${response.status} ${response.statusText}`
    );
  }

  const data = await response.json();

  // API may return array directly or wrapped in an object
  if (Array.isArray(data)) {
    return data as TurtleOpportunity[];
  }

  if (data.opportunities && Array.isArray(data.opportunities)) {
    return data.opportunities as TurtleOpportunity[];
  }

  throw new Error("Unexpected Turtle API response format");
}

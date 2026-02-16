import { GraphQLClient } from "graphql-request";

const MORPHO_API_URL =
  process.env.MORPHO_API_URL || "https://api.morpho.org/graphql";

export const morphoClient = new GraphQLClient(MORPHO_API_URL, {
  headers: {
    "Content-Type": "application/json",
  },
});

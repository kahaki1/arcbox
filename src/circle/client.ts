import { initiateDeveloperControlledWalletsClient } from "@circle-fin/developer-controlled-wallets";
import { circleConfigured, config } from "../config.js";

export type CircleClient = ReturnType<typeof initiateDeveloperControlledWalletsClient>;

let client: CircleClient | null = null;

export function getCircleClient(): CircleClient {
  if (!circleConfigured()) {
    throw new Error(
      "Circle credentials are missing. Set CIRCLE_API_KEY and CIRCLE_ENTITY_SECRET in .env (testnet key from https://console.circle.com).",
    );
  }
  if (!client) {
    client = initiateDeveloperControlledWalletsClient({
      apiKey: config.circleApiKey,
      entitySecret: config.circleEntitySecret,
    });
  }
  return client;
}

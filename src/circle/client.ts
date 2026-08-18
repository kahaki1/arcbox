import { circleConfigured, config } from "../config.js";
import { loadCjs } from "./load-cjs.js";

type CircleSdk = typeof import("@circle-fin/developer-controlled-wallets");
export type CircleClient = ReturnType<CircleSdk["initiateDeveloperControlledWalletsClient"]>;

let client: CircleClient | null = null;

export function getCircleClient(): CircleClient {
  if (!circleConfigured()) {
    throw new Error(
      "Circle credentials are missing. Set CIRCLE_API_KEY and CIRCLE_ENTITY_SECRET in .env (testnet key from https://console.circle.com).",
    );
  }
  if (!client) {
    const sdk = loadCjs<CircleSdk>("@circle-fin/developer-controlled-wallets");
    client = sdk.initiateDeveloperControlledWalletsClient({
      apiKey: config.circleApiKey,
      entitySecret: config.circleEntitySecret,
    });
  }
  return client;
}

import type { Express, Request, Response } from "express";
import { config } from "../config.js";
import { ARC_TESTNET_USDC, executeContract } from "../circle/rest.js";
import type { X402Accept } from "./client.js";

function paymentHeader(req: Request): string | null {
  const value = req.header("payment-signature") ?? req.header("x-payment");
  return value && value.length > 0 ? value : null;
}

function demoAccepts(): X402Accept[] {
  const payTo = config.x402PayTo || "0x0000000000000000000000000000000000000001";
  return [
    {
      scheme: "exact",
      network: config.arcNetwork,
      maxAmountRequired: "10000",
      resource: `${config.publicUrl}/x402/ping`,
      description: "Onix x402 demo ping on Arc Testnet",
      mimeType: "application/json",
      payTo,
      maxTimeoutSeconds: 3600,
      asset: ARC_TESTNET_USDC,
      extra: { name: "USDC", version: "2" },
    },
  ];
}

function send402(res: Response): void {
  const required = {
    x402Version: 1,
    accepts: demoAccepts(),
  };
  res
    .status(402)
    .set("PAYMENT-REQUIRED", Buffer.from(JSON.stringify(required)).toString("base64"))
    .json(required);
}

function splitSig(signature: string): { v: number; r: string; s: string } {
  const hex = signature.startsWith("0x") ? signature.slice(2) : signature;
  if (hex.length < 130) {
    throw new Error("Payment signature is too short.");
  }
  return {
    r: `0x${hex.slice(0, 64)}`,
    s: `0x${hex.slice(64, 128)}`,
    v: Number.parseInt(hex.slice(128, 130), 16),
  };
}

export function mountX402(app: Express): void {
  app.get("/x402/ping", async (req, res) => {
    const encoded = paymentHeader(req);
    if (!encoded) {
      send402(res);
      return;
    }

    let decoded: {
      payload?: {
        signature?: string;
        authorization?: {
          from?: string;
          to?: string;
          value?: string;
          validAfter?: string;
          validBefore?: string;
          nonce?: string;
        };
      };
    };
    try {
      decoded = JSON.parse(Buffer.from(encoded, "base64").toString("utf8")) as typeof decoded;
    } catch {
      send402(res);
      return;
    }

    const auth = decoded.payload?.authorization;
    const signature = decoded.payload?.signature;
    const walletId = req.header("x-onix-wallet-id");
    if (auth && signature && walletId && config.x402PayTo) {
      try {
        const { v, r, s } = splitSig(signature);
        const settled = await executeContract({
          walletId,
          contractAddress: ARC_TESTNET_USDC,
          abiFunctionSignature:
            "transferWithAuthorization(address,address,uint256,uint256,uint256,bytes32,uint8,bytes32,bytes32)",
          abiParameters: [
            auth.from ?? "",
            auth.to ?? "",
            auth.value ?? "0",
            auth.validAfter ?? "0",
            auth.validBefore ?? "0",
            auth.nonce ?? "0x00",
            v,
            r,
            s,
          ],
        });
        res.json({
          ok: true,
          demo: true,
          message: "Paid x402 demo on Arc Testnet.",
          settlement: settled,
        });
        return;
      } catch (error) {
        res.status(402).json({
          error: error instanceof Error ? error.message : "x402 settlement failed",
        });
        return;
      }
    }

    res.json({
      ok: true,
      demo: true,
      message: "Received an x402 payment payload. Set X402_PAY_TO to settle this demo on-chain.",
      authorization: auth ?? null,
    });
  });
}

/**
 * create_token.js
 *
 * Creates a Hedera HTS Non-Fungible Unique token (NFT collection).
 * - Uses @hashgraph/sdk
 * - Reads operator ID & key from .env
 * - Saves tokenId to a file (optional)
 *
 * Usage:
 *   node create_token.js
 */

import fs from "fs/promises";
import dotenv from "dotenv";
import {
  Client,
  PrivateKey,
  TokenCreateTransaction,
  TokenType,
  TokenSupplyType,
  Hbar,
  AccountId
} from "@hashgraph/sdk";

dotenv.config();

// Config from environment
const NETWORK = process.env.HEDERA_NETWORK || "testnet"; // "mainnet" or "testnet"
const OPERATOR_ID = process.env.HEDERA_OPERATOR_ID;
const OPERATOR_KEY = process.env.HEDERA_OPERATOR_KEY;
const TOKEN_NAME = process.env.TOKEN_NAME || "Kivon NonFungible Invoice";
const TOKEN_SYMBOL = process.env.TOKEN_SYMBOL || "KVNI";
const MAX_SUPPLY = Number(process.env.MAX_SUPPLY || 10000);
const OUTPUT_FILE = process.env.OUTPUT_FILE || "token-id.txt";

if (!OPERATOR_ID || !OPERATOR_KEY) {
  console.error("ERROR: HEDERA_OPERATOR_ID and HEDERA_OPERATOR_KEY must be set in .env");
  process.exit(1);
}

async function main() {
  // 1) Create client
  const client = NETWORK === "mainnet"
    ? Client.forMainnet()
    : Client.forTestnet();

  client.setOperator(
    AccountId.fromString(OPERATOR_ID), 
    PrivateKey.fromStringECDSA(OPERATOR_KEY)
  );

  // 2) Prepare keys
  // Using operator's key as admin + supply keys for simplicity.
  // For production, consider using separate keys with limited usage.
  const adminKey = PrivateKey.fromStringECDSA(OPERATOR_KEY);
  const supplyKey = PrivateKey.fromStringECDSA(OPERATOR_KEY);

  console.log("Creating token with:");
  console.log(`  name: ${TOKEN_NAME}`);
  console.log(`  symbol: ${TOKEN_SYMBOL}`);
  console.log(`  maxSupply: ${MAX_SUPPLY}`);
  console.log(`  operator/treasury: ${OPERATOR_ID}`);
  console.log(`  network: ${NETWORK}`);

  // 3) Build TokenCreateTransaction
  // NonFungibleUnique = NFT collection (unique serials)
  const tx = new TokenCreateTransaction()
    .setTokenName(TOKEN_NAME)
    .setTokenSymbol(TOKEN_SYMBOL)
    .setTokenType(TokenType.NonFungibleUnique)
    .setTreasuryAccountId(OPERATOR_ID)
    .setAdminKey(adminKey)      // manage token (optional)
    .setSupplyKey(supplyKey)    // required to mint more serials
    // Optionally set other keys: freeze, wipe, KYC, etc.
    .setSupplyType(TokenSupplyType.Finite)
    .setMaxSupply(MAX_SUPPLY)
    // .setTreasuryMemo("My treasury note") // optional
    .setMaxTransactionFee(new Hbar(10)); // increase if needed

  // 4) Sign & submit
  // We must sign with the admin/supply key if the transaction requires it.
  // Since adminKey/supplyKey are same as operator, we can sign with operator key.
  const txResponse = await tx.execute(client);

  // 5) Get receipt to obtain tokenId
  const receipt = await txResponse.getReceipt(client);
  const tokenId = receipt.tokenId;

  if (!tokenId) {
    console.error("Failed to create token, no tokenId in receipt:", receipt);
    process.exit(1);
  }

  console.log("✅ Token created with tokenId:", tokenId.toString());

  // Save tokenId to a file for later use
  await fs.writeFile(OUTPUT_FILE, tokenId.toString(), "utf8");
  console.log(`Saved tokenId to ${OUTPUT_FILE}`);

  console.log("\nImportant next steps:");
  console.log(" - Keep your supply key safe (used to mint new serials).");
  console.log(" - Use TokenMintTransaction with metadata bytes (e.g. 'ipfs://...') to mint.");
  console.log(" - When done minting, you can disable minting by removing the supplyKey or by setting supply type as finite (we did).");

  process.exit(0);
}

main().catch((err) => {
  console.error("create_token.js error:", err);
  process.exit(1);
});

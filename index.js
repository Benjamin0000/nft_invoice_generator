import fs from "fs/promises";
import path from "path";
import sharp from "sharp";
import { NFTStorage, File } from "nft.storage";
import {
  Client,
  PrivateKey,
  TokenCreateTransaction,
  TokenType,
  TokenSupplyType,
  TokenMintTransaction,
  TokenAssociateTransaction,
  TransferTransaction,
  TokenId
} from "@hashgraph/sdk";
import dotenv from "dotenv";
dotenv.config();

const nftClient = new NFTStorage({ token: process.env.NFT_STORAGE_KEY });



/**
 * Compose overlay svg over template into final PNG buffer
 */
export async function composeInvoiceImage({ templatePath, overlaySvg, outputPath = null }) {
  const templateBuffer = await fs.readFile(templatePath);
  const composed = await sharp(templateBuffer)
    .composite([{ input: Buffer.from(overlaySvg), top: 0, left: 0 }])
    .png({ quality: 90 })
    .toBuffer();

  if (outputPath) await fs.writeFile(outputPath, composed);
  return composed;
}

/** ========== 2) IPFS Upload via nft.storage ========== */
export async function uploadImageAndMetadataToIpfs({ imageBuffer, name, description, properties = {} }) {
  // Put image as File and use nftClient.store which stores metadata JSON and image
  const imageFile = new File([imageBuffer], "invoice.png", { type: "image/png" });
  const metadata = await nftClient.store({
    name,
    description,
    image: imageFile,
    properties
  });
  // metadata.ipnft is CID for metadata JSON; image is pinned too.
  const metadataCid = metadata.ipnft;
  const tokenUri = `ipfs://${metadataCid}`;
  return { metadataCid, tokenUri };
}









/** ========== 4) Full flow: generate -> upload -> create/mint -> transfer ========== */
export async function generateUploadMintAndTransfer({
  // Image generation inputs
  templatePath,
  fromTokenLogoDataURI,
  fromNetworkLogoDataURI,
  toTokenLogoDataURI,
  toNetworkLogoDataURI,
  fromAmountText,
  toAmountText,
  timestampLeft,
  timestampRight,
  transactionHash,
  bigAmountText,
  sessionId,

  // NFT metadata
  metadataName,
  metadataDescription,
  metadataProperties = {},

  // Hedera / minting
  createTokenIfNotExist = true, // create a new NFT collection token if true
  existingTokenIdString = null,  // set "0.0.x" if using existing
  recipientAccountId,            // must be Hedera account like "0.0.xxx"
  recipientPrivateKeyForAssociate = null, // optional - required if recipient is not already associated
}) {
  const client = getHederaClient();





  // 3) Upload image + metadata to IPFS
  const { metadataCid, tokenUri } = await uploadImageAndMetadataToIpfs({
    imageBuffer: finalBuffer,
    name: metadataName,
    description: metadataDescription,
    properties: metadataProperties
  });

  // 4) Prepare metadata bytes for Hedera mint (we put the IPFS tokenUri in the metadata bytes)
  // You may embed the full JSON or just the ipfs URI. We'll encode the tokenUri string.
  const metadataBytes = Buffer.from(JSON.stringify({ tokenUri }));

  // 5) Create token if needed
  let tokenId;
  if (existingTokenIdString) {
    tokenId = TokenId.fromString(existingTokenIdString);
  } else if (createTokenIfNotExist) {
    // choose a name/symbol meaningful for your invoices
    tokenId = await createNftToken({ name: metadataName, symbol: (metadataName || "INV").slice(0,8), client });
  } else {
    throw new Error("No tokenId provided and createTokenIfNotExist=false");
  }

  // 6) Mint one serial with metadataBytes
  const mintReceipt = await mintNft({ client, tokenId, metadataBytesArray: [metadataBytes] });
  // minted serials
  const serials = mintReceipt.serials; // array of serial numbers

  // 7) Ensure recipient is associated. If user provided their private key we can associate
  if (recipientPrivateKeyForAssociate) {
    await associateTokenToAccount({
      client,
      accountId: recipientAccountId,
      accountPrivateKey: recipientPrivateKeyForAssociate,
      tokenId
    });
  } else {
    // No auto-associate. If recipient is not associated, transfer will fail. Caller should ensure association.
  }

  // 8) Transfer newest serial to recipient (from treasury = operator)
  const serialToTransfer = serials[serials.length - 1];
  const transferReceipt = await transferNftToRecipient({
    client,
    tokenId,
    serialNumber: serialToTransfer,
    recipientAccountId
  });

  // Return results
  return {
    metadataCid,
    tokenUri,
    hedera: {
      tokenId: tokenId.toString(),
      mintedSerials: serials,
      transferStatus: transferReceipt.status.toString()
    }
  };
}

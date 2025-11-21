import express from "express";
import fs from "fs/promises";
import FS from "fs";
import path from "path";
import sharp from "sharp";
import bodyParser from "body-parser";
import FormData from "form-data";
import axios from "axios";
import dotenv from "dotenv";

import {
  Client,
  TokenMintTransaction,
  TokenId,
  PrivateKey,
  Hbar,
  AccountId, 
  TransferTransaction
} from "@hashgraph/sdk";
dotenv.config('./env'); 

/* ==============================================
   CONFIG
================================================ */
const PINATA_JWT = process.env.PINATA_JWT;
const HEDERA_CLIENT = Client.forMainnet();

HEDERA_CLIENT.setOperator(
  AccountId.fromString(process.env.HEDERA_OPERATOR_ID),
  PrivateKey.fromStringECDSA(process.env.HEDERA_OPERATOR_KEY)
);

// Your NFT token ID and supply key
const NFT_TOKEN_ID = TokenId.fromString('0.0.10119645');
const SUPPLY_KEY = PrivateKey.fromStringECDSA(process.env.HEDERA_OPERATOR_KEY);



const TOKEN_LOGO = {
  ETH: "./assets/eth_logo.png",
  WETH: "./assets/eth_logo.png",
  BNB: "./assets/bnb_logo.png",
  HBAR: "./assets/hbar_logo.png",
  PACK: "./assets/pack_logo.png",
  SAUCE: "./assets/sauce_logo.png",
  USDC: "./assets/usdc_logo.png",
  USDT: "./assets/usdt_logo.png",
  WBTC: "./assets/btc_logo.png",
  BTCB: "./assets/btc_logo.png"
};

const NETWORK_LOGO = {
  hedera: TOKEN_LOGO["HBAR"],
  ethereum: TOKEN_LOGO["ETH"],
  binance: TOKEN_LOGO["BNB"],
  arbitrum: "./assets/arbitrum_logo.png",
  base: "./assets/base_logo.png",
  optimism: "./assets/optimism_logo.png"
};

function toBase64DataURI(filePath) {
  const imageBuffer = FS.readFileSync(filePath);
  return `data:image/png;base64,${imageBuffer.toString("base64")}`;
}

/* ======================================================
   PINATA HELPERS
====================================================== */

/** Upload a file buffer to Pinata */
async function uploadToPinata_File(buffer, fileName) {
  const form = new FormData();
  form.append("file", buffer, fileName);

  const res = await axios.post(
    "https://api.pinata.cloud/pinning/pinFileToIPFS",
    form,
    {
      maxBodyLength: Infinity,
      headers: {
        Authorization: `Bearer ${PINATA_JWT}`,
        ...form.getHeaders()
      }
    }
  );

  return `ipfs://${res.data.IpfsHash}`;
}

/** Upload a JSON object to Pinata */
async function uploadToPinata_JSON(data) {
  const res = await axios.post(
    "https://api.pinata.cloud/pinning/pinJSONToIPFS",
    data,
    {
      headers: {
        Authorization: `Bearer ${PINATA_JWT}`,
        "Content-Type": "application/json"
      }
    }
  );

  return `ipfs://${res.data.IpfsHash}`;
}


/* ======================================================
   GENERATE INVOICE IMAGE
====================================================== */

async function composeInvoiceImage({ templatePath, overlaySvg }) {
  const templateBuffer = await fs.readFile(templatePath);

  return await sharp(templateBuffer)
    .composite([{ input: Buffer.from(overlaySvg), top: 0, left: 0 }])
    .png({ quality: 90 })
    .toBuffer();
}


/* ======================================================
   EXPRESS SETUP
====================================================== */

const app = express();
app.use(bodyParser.json({ limit: "30mb" }));
const PORT = process.env.PORT || 7000;


/* ======================================================
   SVG OVERLAY
====================================================== */

function makeOverlaySVG({
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
  sessionId
}) {
  const esc = (s) =>
    String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;");

  return `
  <svg xmlns="http://www.w3.org/2000/svg" width="1414" height="2000">
    <style>
      .body { font-family: "Inter", sans-serif; font-size: 28px; fill:#111; }
      .mono { font-family: monospace; font-size:22px; fill:#111; }
      .big { font-family: "Inter", sans-serif; font-size:120px; font-weight:700; fill:#111; }
    </style>

    <image href="${fromTokenLogoDataURI}" x="210" y="420" width="100" height="100" />
    <image href="${fromNetworkLogoDataURI}" x="265" y="470" width="50" height="50" />

    <image href="${toTokenLogoDataURI}" x="770" y="430" width="100" height="100" />
    <image href="${toNetworkLogoDataURI}" x="840" y="485" width="50" height="50" />

    <text x="320" y="480" class="body">From 
      <tspan style="font-weight:bold">${esc(fromAmountText)}</tspan>
    </text>

    <text x="880" y="480" class="body">To 
      <tspan style="font-weight:bold">${esc(toAmountText)}</tspan>
    </text>

    <text x="240" y="650" class="body">${esc(timestampLeft)}</text>
    <text x="905" y="650" class="body">${esc(timestampRight)}</text>

    <text x="235" y="760" class="mono" style="font-weight:500">
      ${esc(transactionHash)}
    </text>

    <text x="310" y="1320" class="big">${esc(bigAmountText)}</text>

    <text x="350" y="1400" class="body">Session ID ${esc(sessionId)}</text>
  </svg>`;
}



app.post("/mint", async (req, res) => {
  try {
    const {
      userAccountId,
      fromToken,
      fromNetwork,
      toToken,
      toNetwork,
      fromAmountText,
      toAmountText,
      timestampLeft,
      timestampRight,
      transactionHash,
      bigAmountText,
      sessionId
    } = req.body;

    if (!userAccountId) return res.status(400).json({ error: "userAccountId required" });

    /* -----------------------------
       Validate tokens and networks
    ----------------------------- */
    if (!TOKEN_LOGO[fromToken] || !TOKEN_LOGO[toToken] ||
        !NETWORK_LOGO[fromNetwork] || !NETWORK_LOGO[toNetwork]) {
      return res.status(400).json({ error: "Invalid token or network" });
    }

    /* -----------------------------
       Base64 logos
    ----------------------------- */
    const fromTokenLogoDataURI = toBase64DataURI(TOKEN_LOGO[fromToken]);
    const fromNetworkLogoDataURI = toBase64DataURI(NETWORK_LOGO[fromNetwork]);
    const toTokenLogoDataURI = toBase64DataURI(TOKEN_LOGO[toToken]);
    const toNetworkLogoDataURI = toBase64DataURI(NETWORK_LOGO[toNetwork]);

    /* -----------------------------
       Render PNG
    ----------------------------- */
    const overlaySvg = makeOverlaySVG({
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
      sessionId
    });

    const templatePath = path.join(process.cwd(), "overlay.PNG");
    const finalBuffer = await composeInvoiceImage({ templatePath, overlaySvg });

    /* -----------------------------
       Upload image & metadata to Pinata
    ----------------------------- */
    const imageURI = await uploadToPinata_File(finalBuffer, `invoice-${sessionId}.png`);
    const metadata = {
      name: `Kivon Invoice - ${sessionId}`,
      description: `Bridged ${fromAmountText} to ${toAmountText}`,
      image: imageURI,
      attributes: [
        { trait_type: "From Amount", value: fromAmountText },
        { trait_type: "To Amount", value: toAmountText },
        { trait_type: "From Network", value: fromNetwork },
        { trait_type: "To Network", value: toNetwork },
        { trait_type: "Transaction Hash", value: transactionHash },
        { trait_type: "Session ID", value: sessionId },
        { trait_type: "Timestamp Left", value: timestampLeft },
        { trait_type: "Timestamp Right", value: timestampRight }
      ]
    };
    const metadataURI = await uploadToPinata_JSON(metadata);

    /* -----------------------------
      Mint NFT (goes to treasury)
    ----------------------------- */
    const metadataBuffer = Buffer.from(metadataURI);

    const mintTx = await new TokenMintTransaction()
      .setTokenId(NFT_TOKEN_ID)
      .setMetadata([metadataBuffer])
      .setMaxTransactionFee(new Hbar(2))
      .execute(HEDERA_CLIENT);

    const mintReceipt = await mintTx.getReceipt(HEDERA_CLIENT);
    const serials = mintReceipt.serials;

    if (!serials || serials.length === 0) {
      return res.status(500).json({ error: "Minting failed — no serial returned" });
    }

    const serial = serials[0]; // minted NFT serial

/* -----------------------------
   Transfer NFT to the user
----------------------------- */
    const treasuryId = AccountId.fromString(process.env.HEDERA_OPERATOR_ID);
    const treasuryKey = PrivateKey.fromStringECDSA(process.env.HEDERA_OPERATOR_KEY);
    const userId = AccountId.fromString(userAccountId);

    const transferTx = await new TransferTransaction()
      .addNftTransfer(NFT_TOKEN_ID, serial, treasuryId, userId)
      .freezeWith(HEDERA_CLIENT)
      .sign(treasuryKey);

    const transferSubmit = await transferTx.execute(HEDERA_CLIENT);
    const transferReceipt = await transferSubmit.getReceipt(HEDERA_CLIENT);

    if (transferReceipt.status.toString() !== "SUCCESS") {
      return res.status(500).json({
        error: "NFT minted but transfer failed",
        status: transferReceipt.status.toString()
      });
    }
    /* -----------------------------
      Response
    ----------------------------- */
    return res.json({
      success: true,
      tokenId: NFT_TOKEN_ID.toString(),
      serial,
      metadataURI,
      imageURI, 
      mintedTo: userAccountId,
      transferStatus: transferReceipt.status.toString()
    });

  } catch (err) {
    console.error("Error:", err);
    res.status(500).json({ error: err.message });
  }
});

/* ======================================================
   START SERVER
====================================================== */
app.listen(PORT, () =>
  console.log(`🚀 Server running on port ${PORT}`)
);

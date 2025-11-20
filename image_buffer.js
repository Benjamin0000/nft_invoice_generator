import fs from "fs/promises";
import sharp from "sharp";
import FS from 'fs';
import path from 'path';

/** ========== 1) IMAGE GENERATION ========== */
/**
 * Create the SVG overlay using provided dynamic data.
 * Coordinates are tuned for a 1414x2000 base template (from your sample).
 */
function makeOverlaySVG({
  // logos are embedded as base64 data URIs
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
  const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;");

  // We'll place elements at coordinates extracted earlier.
  return `
  <svg xmlns="http://www.w3.org/2000/svg" width="1414" height="2000">
    <style>
      .title { font-family: "Inter", sans-serif; font-size: 48px; font-weight:700; fill:#000; }
      .body { font-family: "Inter", sans-serif; font-size: 28px; fill:#111; }
      .mono { font-family: "monospace", monospace; font-size:22px; fill:#111; }
      .big { font-family: "Inter", sans-serif; font-size:160px; font-weight:700; fill:#111; text-shadow: 2px 4px 6px rgba(0,0,0,0.25); }
    </style>

    <!-- Token logos -->
    <!-- From token -->
    <image href="${fromTokenLogoDataURI}" x="210" y="420" width="120" height="120" />
    <!-- From network small subscript -->
    <image href="${fromNetworkLogoDataURI}" x="295" y="205" width="40" height="40" />

    <!-- To token -->
    <image href="${toTokenLogoDataURI}" x="915" y="220" width="120" height="120" />
    <!-- To network small subscript -->
    <image href="${toNetworkLogoDataURI}" x="1000" y="805" width="40" height="40" />

    <!-- Amount labels -->
    <text x="380" y="760" class="body">${esc(fromAmountText)}</text>
    <text x="980" y="760" class="body">${esc(toAmountText)}</text>

    <!-- Timestamps -->
    <text x="310" y="920" class="body">${esc(timestampLeft)}</text>
    <text x="915" y="920" class="body">${esc(timestampRight)}</text>

    <!-- Transaction hash (wrap) -->
    <foreignObject x="110" y="280" width="280" height="160">
      <div xmlns="http://www.w3.org/1999/xhtml" style="font-family: Inter, sans-serif; font-size:20px; color:#111; line-height:1.2; word-break:break-all;">
        ${esc(transactionHash)}
      </div>
    </foreignObject>

    <!-- Big amount -->
    <text x="200" y="1320" class="big">${esc(bigAmountText)}</text>

    <!-- Session ID -->
    <text x="530" y="1400" class="body">Session ID ${esc(sessionId)}</text>
  </svg>
  `;
}  


/**
 * Compose overlay svg over template into final PNG buffer
 */
export async function composeInvoiceImage({templatePath, overlaySvg, outputPath = null}) {
  const templateBuffer = await fs.readFile(templatePath);
  const composed = await sharp(templateBuffer)
    .composite([{ input: Buffer.from(overlaySvg), top: 0, left: 0 }])
    .png({ quality: 90 })
    .toBuffer();

  if (outputPath) await fs.writeFile(outputPath, composed);
  return composed;
}
  
  
  
// 1) Build overlay svg
// const overlaySvg = makeOverlaySVG({
//     fromTokenLogoDataURI,
//     fromNetworkLogoDataURI,
//     toTokenLogoDataURI,
//     toNetworkLogoDataURI,
//     fromAmountText,
//     toAmountText,
//     timestampLeft,
//     timestampRight,
//     transactionHash,
//     bigAmountText,
//     sessionId
// });






// Helper function to convert a PNG file to a Base64 data URI
function toBase64DataURI(filePath) {
  const imageBuffer = FS.readFileSync(filePath);
  return `data:image/png;base64,${imageBuffer.toString('base64')}`;
}

// Convert all images to Base64
const fromTokenLogoDataURI = toBase64DataURI('./tether-usdt-logo.png');
const fromNetworkLogoDataURI = toBase64DataURI('./ethereum_logo.png');
const toTokenLogoDataURI = toBase64DataURI('./sauce.png');
const toNetworkLogoDataURI = toBase64DataURI('./hedera.png');

// Generate the SVG overlay with Base64 images
const overlaySvg = makeOverlaySVG({
    fromTokenLogoDataURI,
    fromNetworkLogoDataURI,
    toTokenLogoDataURI,
    toNetworkLogoDataURI,
    fromAmountText: 'From 100 USDT',
    toAmountText: 'To Amount 100 SAUCE',
    timestampLeft: '13 Nov 2025, 12:04',
    timestampRight: '13 Nov 2025, 12:04',
    transactionHash: '3wrcowtpMo7ZqvmLzqxgkBZ2zvpDFZeJn8S9yLHRkao3LsATQgePiPSV6HxPbNi4X8sjyBwtE179xLSqBymThzn',
    bigAmountText: '1,012.01 USDT',
    sessionId: 'HKA00000000000001'
});

// Compose final image
const finalBuffer = await composeInvoiceImage({
    templatePath: './overlay.PNG',
    overlaySvg,
    outputPath: './prod/new_image.png'
});


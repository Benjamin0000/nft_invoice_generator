import {
  Client,
  PrivateKey,
  TokenCreateTransaction,
  TokenType,
  TokenSupplyType,
  TokenMintTransaction 
} from "@hashgraph/sdk";

const client = Client.forTestnet();
client.setOperator(process.env.HEDERA_ACCOUNT_ID, process.env.HEDERA_PRIVATE_KEY);


const supplyKey = PrivateKey.generate();

const tx = await new TokenCreateTransaction()
  .setTokenName("Bridge Invoice NFT")
  .setTokenSymbol("BRIDGE")
  .setTreasuryAccountId(process.env.HEDERA_ACCOUNT_ID)
  .setTokenType(TokenType.NonFungibleUnique)
  .setSupplyType(TokenSupplyType.Finite)
  .setMaxSupply(100000)       // Or whatever
  .setSupplyKey(supplyKey)
  .freezeWith(client)
  .sign(PrivateKey.fromString(process.env.HEDERA_PRIVATE_KEY));

const submitTx = await tx.execute(client);
const receipt = await submitTx.getReceipt(client);
console.log("NFT Token ID:", receipt.tokenId.toString());



const cid = "ipfs://QmABC123..."; // your invoice image metadata link

const mintTx = await new TokenMintTransaction()
  .setTokenId("0.0.xxxxxx")   // token ID from creation
  .setMetadata([Buffer.from(cid)])    // metadata must be a byte[]
  .freezeWith(client)
  .sign(supplyKey);

const mintSubmit = await mintTx.execute(client);
const mintReceipt = await mintSubmit.getReceipt(client);
console.log("Minted NFT serial:", mintReceipt.serials[0].toString());

await new TransferTransaction()
  .addNftTransfer("0.0.xxxxxx", 1, process.env.HEDERA_ACCOUNT_ID, userWallet)
  .execute(client);

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract InvoiceNFT is ERC721, Ownable {
    uint256 public nextTokenId = 1;

    // storage for each NFT URI
    mapping(uint256 => string) private _tokenURIs;

    constructor()
        ERC721("Bridge Invoice NFT", "BRIDGE")
        Ownable(msg.sender)
    {}

    /**
     * @notice Mint an NFT and set metadata URI
     * @param uri The IPFS metadata URL (example: ipfs://Qm123...)
     */
    function mint(string memory uri) external returns (uint256) {
        uint256 tokenId = nextTokenId;
        nextTokenId++;

        _safeMint(msg.sender, tokenId);
        _setTokenURI(tokenId, uri);

        return tokenId;
    }

    function _setTokenURI(uint256 tokenId, string memory _uri) internal {
        require(_ownerOf(tokenId) != address(0), "Nonexistent token");
        _tokenURIs[tokenId] = _uri;
    }

    /**
     * @notice Returns metadata URI
     */
    function tokenURI(uint256 tokenId)
        public
        view
        override
        returns (string memory)
    {
        require(_ownerOf(tokenId) != address(0), "Nonexistent token");
        return _tokenURIs[tokenId];
    }
}

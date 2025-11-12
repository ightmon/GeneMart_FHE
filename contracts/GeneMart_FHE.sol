pragma solidity ^0.8.24;

import { FHE, euint32, externalEuint32 } from "@fhevm/solidity/lib/FHE.sol";
import { ZamaEthereumConfig } from "@fhevm/solidity/config/ZamaConfig.sol";

contract GeneMart_FHE is ZamaEthereumConfig {
    struct GeneticData {
        string dataId;                  
        euint32 encryptedGenes;        
        uint256 price;                 
        uint256 royaltyPercentage;     
        string metadata;               
        address owner;                 
        uint256 timestamp;             
        uint32 decryptedValue;         
        bool isVerified;               
    }

    mapping(string => GeneticData) public geneticData;
    string[] public dataIds;

    event GeneticDataAdded(string indexed dataId, address indexed owner);
    event DataDecrypted(string indexed dataId, uint32 decryptedValue);

    constructor() ZamaEthereumConfig() {
    }

    function addGeneticData(
        string calldata dataId,
        externalEuint32 encryptedGenes,
        bytes calldata inputProof,
        uint256 price,
        uint256 royaltyPercentage,
        string calldata metadata
    ) external {
        require(bytes(geneticData[dataId].dataId).length == 0, "Data ID already exists");
        require(FHE.isInitialized(FHE.fromExternal(encryptedGenes, inputProof)), "Invalid encrypted input");

        geneticData[dataId] = GeneticData({
            dataId: dataId,
            encryptedGenes: FHE.fromExternal(encryptedGenes, inputProof),
            price: price,
            royaltyPercentage: royaltyPercentage,
            metadata: metadata,
            owner: msg.sender,
            timestamp: block.timestamp,
            decryptedValue: 0,
            isVerified: false
        });

        FHE.allowThis(geneticData[dataId].encryptedGenes);
        FHE.makePubliclyDecryptable(geneticData[dataId].encryptedGenes);
        dataIds.push(dataId);

        emit GeneticDataAdded(dataId, msg.sender);
    }

    function verifyDecryption(
        string calldata dataId, 
        bytes memory abiEncodedClearValue,
        bytes memory decryptionProof
    ) external {
        require(bytes(geneticData[dataId].dataId).length > 0, "Data does not exist");
        require(!geneticData[dataId].isVerified, "Data already verified");

        bytes32[] memory cts = new bytes32[](1);
        cts[0] = FHE.toBytes32(geneticData[dataId].encryptedGenes);

        FHE.checkSignatures(cts, abiEncodedClearValue, decryptionProof);
        uint32 decodedValue = abi.decode(abiEncodedClearValue, (uint32));

        geneticData[dataId].decryptedValue = decodedValue;
        geneticData[dataId].isVerified = true;

        emit DataDecrypted(dataId, decodedValue);
    }

    function getEncryptedGenes(string calldata dataId) external view returns (euint32) {
        require(bytes(geneticData[dataId].dataId).length > 0, "Data does not exist");
        return geneticData[dataId].encryptedGenes;
    }

    function getGeneticData(string calldata dataId) external view returns (
        string memory dataIdValue,
        uint256 price,
        uint256 royaltyPercentage,
        string memory metadata,
        address owner,
        uint256 timestamp,
        bool isVerified,
        uint32 decryptedValue
    ) {
        require(bytes(geneticData[dataId].dataId).length > 0, "Data does not exist");
        GeneticData storage data = geneticData[dataId];

        return (
            data.dataId,
            data.price,
            data.royaltyPercentage,
            data.metadata,
            data.owner,
            data.timestamp,
            data.isVerified,
            data.decryptedValue
        );
    }

    function getAllDataIds() external view returns (string[] memory) {
        return dataIds;
    }

    function isAvailable() public pure returns (bool) {
        return true;
    }
}



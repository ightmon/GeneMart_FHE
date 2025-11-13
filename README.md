# GeneMart_FHE

GeneMart_FHE is a groundbreaking private genetic data marketplace that harnesses the power of Zama's Fully Homomorphic Encryption (FHE) technology. This platform allows users to sell encrypted genetic data rights to pharmaceutical companies, enabling secure computations and statistical analysis on sensitive information—all while ensuring user privacy and data protection.

## The Problem

In the ever-evolving field of biotechnology, the demand for genetic data has surged. However, sharing such sensitive information poses significant risks. Traditional data sharing methods expose cleartext data, making it vulnerable to unauthorized access, misuse, and breaches of privacy. The consequences can be severe, leading to ethical concerns and legal ramifications for both individuals and organizations involved. Thus, there is an urgent need for a secure and private solution that allows for the safe exchange of genetic data while preserving confidentiality.

## The Zama FHE Solution

GeneMart_FHE addresses these privacy concerns through the innovative application of Fully Homomorphic Encryption (FHE). By utilizing Zama's advanced FHE libraries, the marketplace enables computations on encrypted data without needing to decrypt it first. This means pharmaceutical companies can perform statistical analyses and derive insights from genetic data without ever exposing the underlying sensitive information. Specifically, using fhevm allows for processing encrypted inputs securely, maintaining strict privacy controls throughout the data transaction process.

## Key Features

- **Privacy-preserving Data Transactions** 🔒: Securely buy and sell genetic data rights without compromising personal information.
- **Encrypted Data Computation** 🛡️: Perform advanced computations and analytics on encrypted genetic data using FHE.
- **User-Friendly Marketplace** 💼: An intuitive interface for users to manage their genetic data and transactions seamlessly.
- **Fair Revenue Distribution** 💰: A transparent system for data licensing ensures that users receive fair compensation for their genetic data.
- **Accelerated Research** ⚗️: Facilitate faster breakthroughs in medical research while safeguarding user privacy.

## Technical Architecture & Stack

GeneMart_FHE is built upon a robust and secure technical architecture that includes:

- **Core Privacy Engine**: Zama’s FHE libraries (fhevm)
- **Frontend**: HTML, CSS, JavaScript (React)
- **Backend**: Node.js
- **Database**: MongoDB

This stack guarantees high performance while prioritizing data security, leveraging the capabilities of Zama’s cutting-edge encryption technology.

## Smart Contract / Core Logic

Here's a simplified example of how GeneMart_FHE processes encrypted data with Zama’s technology. The following pseudocode snippet demonstrates the essential logic for a transaction:

```solidity
// Simple smart contract for GeneMart_FHE
pragma solidity ^0.8.0;

contract GeneMart {
    mapping(address => uint256) public balances;

    function sellData(uint64 dataID, uint256 price) public {
        // Sell encrypted genetic data
        require(balances[msg.sender] >= price, "Insufficient funds");
        
        // Assume encryptData() handles encryption with TFHE
        bytes encryptedData = encryptData(dataID);
        
        // Logic for transferring data rights
        balances[msg.sender] -= price;
        // Transfer encrypted data to buyer...
    }

    function encryptData(uint64 dataID) view public returns (bytes) {
        // Implement FHE encryption here using TFHE libraries
        return TFHE.encrypt(dataID);
    }
}
```

In this example, we leverage encryption to secure the genetic data during transactions, illustrating the seamless integration of Zama's technology into the marketplace functionality.

## Directory Structure

The directory structure for the GeneMart_FHE project is organized for clarity and ease of navigation:

```
GeneMart_FHE/
├── contracts/
│   └── GeneMart.sol
├── src/
│   ├── index.html
│   ├── App.js
│   └── styles.css
├── backend/
│   ├── server.js
│   └── models/
│       └── Data.js
├── database/
│   └── data-schema.js
└── README.md
```

## Installation & Setup

To set up the GeneMart_FHE project, the following prerequisites are necessary:

### Prerequisites

- Node.js
- npm (Node Package Manager)
- MongoDB

### Installation Steps

1. **Install Dependencies**: 
   Navigate to both the frontend and backend directories, and run the following commands:

   ```bash
   npm install
   ```

2. **Install Zama's FHE Library**:
   Use the following command to install the necessary Zama library for FHE:

   ```bash
   npm install fhevm
   ```

3. **Set Up MongoDB**: Ensure that MongoDB is running and accessible.

4. **Build the Project**: In the project root directory, execute:

   ```bash
   npm run build
   ```

## Build & Run

To compile and run the GeneMart_FHE project, follow these commands:

1. **Compile Smart Contracts**: 
   In the `contracts` directory, run:

   ```bash
   npx hardhat compile
   ```

2. **Start the Backend Server**: In the `backend` directory, execute:

   ```bash
   node server.js
   ```

3. **Run the Frontend**: In the `src` directory, launch your preferred frontend server or use:

   ```bash
   npm start
   ```

## Acknowledgements

We would like to extend our gratitude to Zama for providing the open-source FHE primitives that make GeneMart_FHE possible. Their innovative technology safeguards user privacy while enabling meaningful advancements in genetic research. 

Join us in building a secure future where privacy and innovation go hand in hand!



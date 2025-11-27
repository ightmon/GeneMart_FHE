import { ConnectButton } from '@rainbow-me/rainbowkit';
import '@rainbow-me/rainbowkit/styles.css';
import React, { JSX, useEffect, useState } from "react";
import { getContractReadOnly, getContractWithSigner } from "./components/useContract";
import "./App.css";
import { useAccount } from 'wagmi';
import { useFhevm, useEncrypt, useDecrypt } from '../fhevm-sdk/src';
import { ethers } from 'ethers';

interface GeneticData {
  id: string;
  name: string;
  encryptedValue: string;
  publicValue1: number;
  publicValue2: number;
  description: string;
  creator: string;
  timestamp: number;
  isVerified: boolean;
  decryptedValue: number;
}

const App: React.FC = () => {
  const { address, isConnected } = useAccount();
  const [loading, setLoading] = useState(true);
  const [geneticData, setGeneticData] = useState<GeneticData[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creatingData, setCreatingData] = useState(false);
  const [transactionStatus, setTransactionStatus] = useState<{ visible: boolean; status: "pending" | "success" | "error"; message: string; }>({ 
    visible: false, 
    status: "pending", 
    message: "" 
  });
  const [newData, setNewData] = useState({ name: "", value: "", description: "", category: "" });
  const [selectedData, setSelectedData] = useState<GeneticData | null>(null);
  const [isDecrypting, setIsDecrypting] = useState(false);
  const [contractAddress, setContractAddress] = useState("");
  const [fhevmInitializing, setFhevmInitializing] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeFilter, setActiveFilter] = useState("all");

  const { status, initialize, isInitialized } = useFhevm();
  const { encrypt, isEncrypting } = useEncrypt();
  const { verifyDecryption, isDecrypting: fheIsDecrypting } = useDecrypt();

  useEffect(() => {
    const initFhevmAfterConnection = async () => {
      if (!isConnected || isInitialized || fhevmInitializing) return;
      
      try {
        setFhevmInitializing(true);
        await initialize();
      } catch (error) {
        setTransactionStatus({ 
          visible: true, 
          status: "error", 
          message: "FHEVM initialization failed" 
        });
        setTimeout(() => setTransactionStatus({ visible: false, status: "pending", message: "" }), 3000);
      } finally {
        setFhevmInitializing(false);
      }
    };

    initFhevmAfterConnection();
  }, [isConnected, isInitialized, initialize, fhevmInitializing]);

  useEffect(() => {
    const loadDataAndContract = async () => {
      if (!isConnected) {
        setLoading(false);
        return;
      }
      
      try {
        await loadData();
        const contract = await getContractReadOnly();
        if (contract) setContractAddress(await contract.getAddress());
      } catch (error) {
        console.error('Failed to load data:', error);
      } finally {
        setLoading(false);
      }
    };

    loadDataAndContract();
  }, [isConnected]);

  const loadData = async () => {
    if (!isConnected) return;
    
    setIsRefreshing(true);
    try {
      const contract = await getContractReadOnly();
      if (!contract) return;
      
      const businessIds = await contract.getAllBusinessIds();
      const dataList: GeneticData[] = [];
      
      for (const businessId of businessIds) {
        try {
          const businessData = await contract.getBusinessData(businessId);
          dataList.push({
            id: businessId,
            name: businessData.name,
            encryptedValue: businessId,
            publicValue1: Number(businessData.publicValue1) || 0,
            publicValue2: Number(businessData.publicValue2) || 0,
            description: businessData.description,
            timestamp: Number(businessData.timestamp),
            creator: businessData.creator,
            isVerified: businessData.isVerified,
            decryptedValue: Number(businessData.decryptedValue) || 0
          });
        } catch (e) {
          console.error('Error loading business data:', e);
        }
      }
      
      setGeneticData(dataList);
    } catch (e) {
      setTransactionStatus({ visible: true, status: "error", message: "Failed to load data" });
      setTimeout(() => setTransactionStatus({ visible: false, status: "pending", message: "" }), 3000);
    } finally { 
      setIsRefreshing(false); 
    }
  };

  const createData = async () => {
    if (!isConnected || !address) { 
      setTransactionStatus({ visible: true, status: "error", message: "Please connect wallet first" });
      setTimeout(() => setTransactionStatus({ visible: false, status: "pending", message: "" }), 3000);
      return; 
    }
    
    setCreatingData(true);
    setTransactionStatus({ visible: true, status: "pending", message: "Creating genetic data with FHE encryption..." });
    
    try {
      const contract = await getContractWithSigner();
      if (!contract) throw new Error("Failed to get contract with signer");
      
      const dataValue = parseInt(newData.value) || 0;
      const businessId = `gene-${Date.now()}`;
      
      const encryptedResult = await encrypt(contractAddress, address, dataValue);
      
      const tx = await contract.createBusinessData(
        businessId,
        newData.name,
        encryptedResult.encryptedData,
        encryptedResult.proof,
        parseInt(newData.category) || 1,
        0,
        newData.description
      );
      
      setTransactionStatus({ visible: true, status: "pending", message: "Waiting for transaction confirmation..." });
      await tx.wait();
      
      setTransactionStatus({ visible: true, status: "success", message: "Genetic data created successfully!" });
      setTimeout(() => {
        setTransactionStatus({ visible: false, status: "pending", message: "" });
      }, 2000);
      
      await loadData();
      setShowCreateModal(false);
      setNewData({ name: "", value: "", description: "", category: "" });
    } catch (e: any) {
      const errorMessage = e.message?.includes("user rejected transaction") 
        ? "Transaction rejected by user" 
        : "Submission failed: " + (e.message || "Unknown error");
      setTransactionStatus({ visible: true, status: "error", message: errorMessage });
      setTimeout(() => setTransactionStatus({ visible: false, status: "pending", message: "" }), 3000);
    } finally { 
      setCreatingData(false); 
    }
  };

  const decryptData = async (businessId: string): Promise<number | null> => {
    if (!isConnected || !address) { 
      setTransactionStatus({ visible: true, status: "error", message: "Please connect wallet first" });
      setTimeout(() => setTransactionStatus({ visible: false, status: "pending", message: "" }), 3000);
      return null; 
    }
    
    setIsDecrypting(true);
    try {
      const contractRead = await getContractReadOnly();
      if (!contractRead) return null;
      
      const businessData = await contractRead.getBusinessData(businessId);
      if (businessData.isVerified) {
        const storedValue = Number(businessData.decryptedValue) || 0;
        setTransactionStatus({ visible: true, status: "success", message: "Data already verified on-chain" });
        setTimeout(() => setTransactionStatus({ visible: false, status: "pending", message: "" }), 2000);
        return storedValue;
      }
      
      const contractWrite = await getContractWithSigner();
      if (!contractWrite) return null;
      
      const encryptedValueHandle = await contractRead.getEncryptedValue(businessId);
      
      const result = await verifyDecryption(
        [encryptedValueHandle],
        contractAddress,
        (abiEncodedClearValues: string, decryptionProof: string) => 
          contractWrite.verifyDecryption(businessId, abiEncodedClearValues, decryptionProof)
      );
      
      setTransactionStatus({ visible: true, status: "pending", message: "Verifying decryption on-chain..." });
      
      const clearValue = result.decryptionResult.clearValues[encryptedValueHandle];
      
      await loadData();
      
      setTransactionStatus({ visible: true, status: "success", message: "Data decrypted and verified successfully!" });
      setTimeout(() => setTransactionStatus({ visible: false, status: "pending", message: "" }), 2000);
      
      return Number(clearValue);
      
    } catch (e: any) { 
      if (e.message?.includes("Data already verified")) {
        setTransactionStatus({ visible: true, status: "success", message: "Data is already verified on-chain" });
        setTimeout(() => setTransactionStatus({ visible: false, status: "pending", message: "" }), 2000);
        await loadData();
        return null;
      }
      
      setTransactionStatus({ visible: true, status: "error", message: "Decryption failed: " + (e.message || "Unknown error") });
      setTimeout(() => setTransactionStatus({ visible: false, status: "pending", message: "" }), 3000);
      return null; 
    } finally { 
      setIsDecrypting(false); 
    }
  };

  const checkAvailability = async () => {
    try {
      const contract = await getContractReadOnly();
      if (!contract) return;
      
      const isAvailable = await contract.isAvailable();
      setTransactionStatus({ visible: true, status: "success", message: "Contract is available and ready!" });
      setTimeout(() => setTransactionStatus({ visible: false, status: "pending", message: "" }), 2000);
    } catch (e) {
      setTransactionStatus({ visible: true, status: "error", message: "Availability check failed" });
      setTimeout(() => setTransactionStatus({ visible: false, status: "pending", message: "" }), 3000);
    }
  };

  const filteredData = geneticData.filter(item => {
    const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                         item.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFilter = activeFilter === "all" || 
                         (activeFilter === "verified" && item.isVerified) ||
                         (activeFilter === "unverified" && !item.isVerified);
    return matchesSearch && matchesFilter;
  });

  const stats = {
    total: geneticData.length,
    verified: geneticData.filter(item => item.isVerified).length,
    totalValue: geneticData.reduce((sum, item) => sum + (item.isVerified ? item.decryptedValue : 0), 0)
  };

  if (!isConnected) {
    return (
      <div className="app-container">
        <header className="app-header">
          <div className="logo">
            <h1>🧬 GeneMart FHE</h1>
            <span>Private Genetic Data Marketplace</span>
          </div>
          <div className="header-actions">
            <ConnectButton accountStatus="address" chainStatus="icon" showBalance={false}/>
          </div>
        </header>
        
        <div className="connection-prompt">
          <div className="connection-content">
            <div className="dna-animation">🧬</div>
            <h2>Welcome to GeneMart FHE</h2>
            <p>Connect your wallet to access the private genetic data marketplace with fully homomorphic encryption.</p>
            <div className="feature-grid">
              <div className="feature-card">
                <div className="feature-icon">🔐</div>
                <h3>FHE Encryption</h3>
                <p>Genetic data encrypted with Zama FHE technology</p>
              </div>
              <div className="feature-card">
                <div className="feature-icon">💰</div>
                <h3>Data Monetization</h3>
                <p>Sell encrypted genetic data usage rights to pharma companies</p>
              </div>
              <div className="feature-card">
                <div className="feature-icon">⚡</div>
                <h3>Research Acceleration</h3>
                <p>Enable homomorphic computations on encrypted data</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!isInitialized || fhevmInitializing) {
    return (
      <div className="loading-screen">
        <div className="dna-spinner">🧬</div>
        <p>Initializing FHE Encryption System...</p>
      </div>
    );
  }

  if (loading) return (
    <div className="loading-screen">
      <div className="dna-spinner">🧬</div>
      <p>Loading encrypted genetic data...</p>
    </div>
  );

  return (
    <div className="app-container">
      <header className="app-header">
        <div className="logo">
          <h1>🧬 GeneMart FHE</h1>
          <span>基因數據隱私市場</span>
        </div>
        
        <div className="header-actions">
          <button onClick={checkAvailability} className="check-btn">
            Check Availability
          </button>
          <button onClick={() => setShowCreateModal(true)} className="create-btn">
            + Add Genetic Data
          </button>
          <ConnectButton accountStatus="address" chainStatus="icon" showBalance={false}/>
        </div>
      </header>
      
      <div className="main-content">
        <div className="stats-panel">
          <div className="stat-item">
            <div className="stat-value">{stats.total}</div>
            <div className="stat-label">Total Datasets</div>
          </div>
          <div className="stat-item">
            <div className="stat-value">{stats.verified}</div>
            <div className="stat-label">Verified</div>
          </div>
          <div className="stat-item">
            <div className="stat-value">{stats.totalValue}</div>
            <div className="stat-label">Total Value</div>
          </div>
        </div>

        <div className="controls-panel">
          <div className="search-box">
            <input 
              type="text" 
              placeholder="Search genetic data..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="filter-tabs">
            <button 
              className={activeFilter === "all" ? "active" : ""}
              onClick={() => setActiveFilter("all")}
            >
              All Data
            </button>
            <button 
              className={activeFilter === "verified" ? "active" : ""}
              onClick={() => setActiveFilter("verified")}
            >
              Verified
            </button>
            <button 
              className={activeFilter === "unverified" ? "active" : ""}
              onClick={() => setActiveFilter("unverified")}
            >
              Unverified
            </button>
          </div>
          <button onClick={loadData} className="refresh-btn" disabled={isRefreshing}>
            {isRefreshing ? "Refreshing..." : "Refresh"}
          </button>
        </div>

        <div className="data-grid">
          {filteredData.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">🧬</div>
              <p>No genetic data found</p>
              <button onClick={() => setShowCreateModal(true)} className="create-btn">
                Add First Dataset
              </button>
            </div>
          ) : (
            filteredData.map((item, index) => (
              <div 
                className={`data-card ${item.isVerified ? "verified" : ""}`}
                key={index}
                onClick={() => setSelectedData(item)}
              >
                <div className="card-header">
                  <h3>{item.name}</h3>
                  <span className={`status ${item.isVerified ? "verified" : "pending"}`}>
                    {item.isVerified ? "✅ Verified" : "🔓 Pending"}
                  </span>
                </div>
                <p className="description">{item.description}</p>
                <div className="card-meta">
                  <span>Category: {item.publicValue1}</span>
                  <span>Created: {new Date(item.timestamp * 1000).toLocaleDateString()}</span>
                </div>
                {item.isVerified && (
                  <div className="decrypted-value">
                    Value: {item.decryptedValue}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
      
      {showCreateModal && (
        <CreateDataModal 
          onSubmit={createData} 
          onClose={() => setShowCreateModal(false)} 
          creating={creatingData} 
          data={newData} 
          setData={setNewData}
          isEncrypting={isEncrypting}
        />
      )}
      
      {selectedData && (
        <DataDetailModal 
          data={selectedData} 
          onClose={() => setSelectedData(null)} 
          isDecrypting={isDecrypting || fheIsDecrypting} 
          decryptData={() => decryptData(selectedData.id)}
        />
      )}
      
      {transactionStatus.visible && (
        <div className="transaction-toast">
          <div className={`toast-content ${transactionStatus.status}`}>
            <div className="toast-icon">
              {transactionStatus.status === "pending" && <div className="spinner"></div>}
              {transactionStatus.status === "success" && "✓"}
              {transactionStatus.status === "error" && "✗"}
            </div>
            <div className="toast-message">{transactionStatus.message}</div>
          </div>
        </div>
      )}

      <footer className="app-footer">
        <div className="footer-content">
          <p>GeneMart FHE - Secure Genetic Data Marketplace powered by Zama FHE Technology</p>
          <div className="footer-links">
            <span>Data Authorization & Revenue Sharing</span>
            <span>Research Acceleration</span>
            <span>Privacy First</span>
          </div>
        </div>
      </footer>
    </div>
  );
};

const CreateDataModal: React.FC<{
  onSubmit: () => void; 
  onClose: () => void; 
  creating: boolean;
  data: any;
  setData: (data: any) => void;
  isEncrypting: boolean;
}> = ({ onSubmit, onClose, creating, data, setData, isEncrypting }) => {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    if (name === 'value') {
      const intValue = value.replace(/[^\d]/g, '');
      setData({ ...data, [name]: intValue });
    } else {
      setData({ ...data, [name]: value });
    }
  };

  return (
    <div className="modal-overlay">
      <div className="create-modal">
        <div className="modal-header">
          <h2>Add Genetic Data</h2>
          <button onClick={onClose} className="close-btn">&times;</button>
        </div>
        
        <div className="modal-body">
          <div className="fhe-notice">
            <strong>FHE 🔐 Protection</strong>
            <p>Genetic data value will be encrypted with Zama FHE (Integer only)</p>
          </div>
          
          <div className="form-group">
            <label>Data Name *</label>
            <input 
              type="text" 
              name="name" 
              value={data.name} 
              onChange={handleChange} 
              placeholder="Enter data name..." 
            />
          </div>
          
          <div className="form-group">
            <label>Data Value (Integer only) *</label>
            <input 
              type="number" 
              name="value" 
              value={data.value} 
              onChange={handleChange} 
              placeholder="Enter data value..." 
              step="1"
              min="0"
            />
            <div className="input-hint">FHE Encrypted Integer</div>
          </div>
          
          <div className="form-group">
            <label>Category (1-10) *</label>
            <input 
              type="number" 
              min="1" 
              max="10" 
              name="category" 
              value={data.category} 
              onChange={handleChange} 
              placeholder="Enter category..." 
            />
            <div className="input-hint">Public Data</div>
          </div>
          
          <div className="form-group">
            <label>Description</label>
            <textarea 
              name="description" 
              value={data.description} 
              onChange={handleChange} 
              placeholder="Enter data description..." 
              rows={3}
            />
          </div>
        </div>
        
        <div className="modal-footer">
          <button onClick={onClose} className="cancel-btn">Cancel</button>
          <button 
            onClick={onSubmit} 
            disabled={creating || isEncrypting || !data.name || !data.value || !data.category} 
            className="submit-btn"
          >
            {creating || isEncrypting ? "Encrypting..." : "Create Data"}
          </button>
        </div>
      </div>
    </div>
  );
};

const DataDetailModal: React.FC<{
  data: GeneticData;
  onClose: () => void;
  isDecrypting: boolean;
  decryptData: () => Promise<number | null>;
}> = ({ data, onClose, isDecrypting, decryptData }) => {
  const [localDecrypted, setLocalDecrypted] = useState<number | null>(null);

  const handleDecrypt = async () => {
    if (data.isVerified) return;
    
    const decrypted = await decryptData();
    if (decrypted !== null) {
      setLocalDecrypted(decrypted);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="detail-modal">
        <div className="modal-header">
          <h2>Genetic Data Details</h2>
          <button onClick={onClose} className="close-btn">&times;</button>
        </div>
        
        <div className="modal-body">
          <div className="data-info">
            <div className="info-row">
              <span>Data Name:</span>
              <strong>{data.name}</strong>
            </div>
            <div className="info-row">
              <span>Creator:</span>
              <strong>{data.creator.substring(0, 6)}...{data.creator.substring(38)}</strong>
            </div>
            <div className="info-row">
              <span>Created:</span>
              <strong>{new Date(data.timestamp * 1000).toLocaleString()}</strong>
            </div>
            <div className="info-row">
              <span>Category:</span>
              <strong>{data.publicValue1}</strong>
            </div>
            <div className="info-row">
              <span>Description:</span>
              <p>{data.description}</p>
            </div>
          </div>
          
          <div className="encryption-section">
            <h3>FHE Encryption Status</h3>
            <div className="encryption-status">
              <div className={`status-badge ${data.isVerified ? "verified" : "encrypted"}`}>
                {data.isVerified ? "✅ On-chain Verified" : "🔒 FHE Encrypted"}
              </div>
              
              <div className="data-value-display">
                <strong>Data Value:</strong>
                <span className="value">
                  {data.isVerified ? 
                    data.decryptedValue : 
                    localDecrypted !== null ? 
                    localDecrypted : 
                    "🔒 Encrypted"
                  }
                </span>
                {data.isVerified && <span className="badge">On-chain</span>}
                {localDecrypted !== null && !data.isVerified && <span className="badge local">Local</span>}
              </div>
            </div>
            
            {!data.isVerified && (
              <button 
                className={`decrypt-btn ${isDecrypting ? "decrypting" : ""}`}
                onClick={handleDecrypt}
                disabled={isDecrypting}
              >
                {isDecrypting ? "Decrypting..." : "Verify Decryption"}
              </button>
            )}
          </div>
          
          <div className="fhe-explanation">
            <h4>FHE Protection Process</h4>
            <div className="process-steps">
              <div className="step">
                <div className="step-number">1</div>
                <p>Data encrypted client-side with Zama FHE</p>
              </div>
              <div className="step">
                <div className="step-number">2</div>
                <p>Encrypted data stored on blockchain</p>
              </div>
              <div className="step">
                <div className="step-number">3</div>
                <p>Authorized computations performed on encrypted data</p>
              </div>
              <div className="step">
                <div className="step-number">4</div>
                <p>Results verified on-chain with zero-knowledge proofs</p>
              </div>
            </div>
          </div>
        </div>
        
        <div className="modal-footer">
          <button onClick={onClose} className="close-btn">Close</button>
        </div>
      </div>
    </div>
  );
};

export default App;
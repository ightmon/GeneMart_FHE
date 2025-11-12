import { ConnectButton } from '@rainbow-me/rainbowkit';
import '@rainbow-me/rainbowkit/styles.css';
import React, { JSX, useEffect, useState } from "react";
import { getContractReadOnly, getContractWithSigner } from "./components/useContract";
import "./App.css";
import { useAccount } from 'wagmi';
import { useFhevm, useEncrypt, useDecrypt } from '../fhevm-sdk/src';
import { ethers } from 'ethers';

interface GeneData {
  id: string;
  name: string;
  encryptedValue: string;
  age: number;
  qualityScore: number;
  description: string;
  timestamp: number;
  creator: string;
  isVerified?: boolean;
  decryptedValue?: number;
}

interface MarketStats {
  totalData: number;
  verifiedData: number;
  avgQuality: number;
  recentListings: number;
}

const App: React.FC = () => {
  const { address, isConnected } = useAccount();
  const [loading, setLoading] = useState(true);
  const [geneDataList, setGeneDataList] = useState<GeneData[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creatingData, setCreatingData] = useState(false);
  const [transactionStatus, setTransactionStatus] = useState<{ visible: boolean; status: "pending" | "success" | "error"; message: string; }>({ 
    visible: false, 
    status: "pending" as const, 
    message: "" 
  });
  const [newGeneData, setNewGeneData] = useState({ name: "", value: "", age: "", quality: "", description: "" });
  const [selectedData, setSelectedData] = useState<GeneData | null>(null);
  const [marketStats, setMarketStats] = useState<MarketStats>({ totalData: 0, verifiedData: 0, avgQuality: 0, recentListings: 0 });
  const [showFAQ, setShowFAQ] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [contractAddress, setContractAddress] = useState("");
  const [fhevmInitializing, setFhevmInitializing] = useState(false);

  const { status, initialize, isInitialized } = useFhevm();
  const { encrypt, isEncrypting} = useEncrypt();
  const { verifyDecryption, isDecrypting: fheIsDecrypting } = useDecrypt();

  useEffect(() => {
    const initFhevmAfterConnection = async () => {
      if (!isConnected) return;
      if (isInitialized || fhevmInitializing) return;
      
      try {
        setFhevmInitializing(true);
        console.log('Initializing FHEVM for GeneMart...');
        await initialize();
        console.log('FHEVM initialized successfully');
      } catch (error) {
        console.error('Failed to initialize FHEVM:', error);
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
      const dataList: GeneData[] = [];
      
      for (const businessId of businessIds) {
        try {
          const businessData = await contract.getBusinessData(businessId);
          dataList.push({
            id: businessId,
            name: businessData.name,
            encryptedValue: businessId,
            age: Number(businessData.publicValue1) || 0,
            qualityScore: Number(businessData.publicValue2) || 0,
            description: businessData.description,
            timestamp: Number(businessData.timestamp),
            creator: businessData.creator,
            isVerified: businessData.isVerified,
            decryptedValue: Number(businessData.decryptedValue) || 0
          });
        } catch (e) {
          console.error('Error loading gene data:', e);
        }
      }
      
      setGeneDataList(dataList);
      updateMarketStats(dataList);
    } catch (e) {
      setTransactionStatus({ visible: true, status: "error", message: "Failed to load data" });
      setTimeout(() => setTransactionStatus({ visible: false, status: "pending", message: "" }), 3000);
    } finally { 
      setIsRefreshing(false); 
    }
  };

  const updateMarketStats = (data: GeneData[]) => {
    const totalData = data.length;
    const verifiedData = data.filter(d => d.isVerified).length;
    const avgQuality = data.length > 0 ? data.reduce((sum, d) => sum + d.qualityScore, 0) / data.length : 0;
    const recentListings = data.filter(d => Date.now()/1000 - d.timestamp < 60 * 60 * 24 * 7).length;
    
    setMarketStats({ totalData, verifiedData, avgQuality, recentListings });
  };

  const createGeneData = async () => {
    if (!isConnected || !address) { 
      setTransactionStatus({ visible: true, status: "error", message: "Please connect wallet first" });
      setTimeout(() => setTransactionStatus({ visible: false, status: "pending", message: "" }), 3000);
      return; 
    }
    
    setCreatingData(true);
    setTransactionStatus({ visible: true, status: "pending", message: "Encrypting gene data with FHE..." });
    
    try {
      const contract = await getContractWithSigner();
      if (!contract) throw new Error("Failed to get contract with signer");
      
      const geneValue = parseInt(newGeneData.value) || 0;
      const businessId = `gene-${Date.now()}`;
      
      const encryptedResult = await encrypt(contractAddress, address, geneValue);
      
      const tx = await contract.createBusinessData(
        businessId,
        newGeneData.name,
        encryptedResult.encryptedData,
        encryptedResult.proof,
        parseInt(newGeneData.age) || 0,
        parseInt(newGeneData.quality) || 0,
        newGeneData.description
      );
      
      setTransactionStatus({ visible: true, status: "pending", message: "Storing encrypted data..." });
      await tx.wait();
      
      setTransactionStatus({ visible: true, status: "success", message: "Gene data encrypted and stored!" });
      setTimeout(() => {
        setTransactionStatus({ visible: false, status: "pending", message: "" });
      }, 2000);
      
      await loadData();
      setShowCreateModal(false);
      setNewGeneData({ name: "", value: "", age: "", quality: "", description: "" });
    } catch (e: any) {
      const errorMessage = e.message?.includes("user rejected transaction") 
        ? "Transaction rejected" 
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
    
    try {
      const contractRead = await getContractReadOnly();
      if (!contractRead) return null;
      
      const businessData = await contractRead.getBusinessData(businessId);
      if (businessData.isVerified) {
        const storedValue = Number(businessData.decryptedValue) || 0;
        
        setTransactionStatus({ 
          visible: true, 
          status: "success", 
          message: "Data already verified" 
        });
        setTimeout(() => {
          setTransactionStatus({ visible: false, status: "pending", message: "" });
        }, 2000);
        
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
      
      setTransactionStatus({ visible: true, status: "pending", message: "Verifying decryption..." });
      
      const clearValue = result.decryptionResult.clearValues[encryptedValueHandle];
      
      await loadData();
      
      setTransactionStatus({ visible: true, status: "success", message: "Data decrypted successfully!" });
      setTimeout(() => {
        setTransactionStatus({ visible: false, status: "pending", message: "" });
      }, 2000);
      
      return Number(clearValue);
      
    } catch (e: any) { 
      if (e.message?.includes("Data already verified")) {
        setTransactionStatus({ 
          visible: true, 
          status: "success", 
          message: "Data is already verified" 
        });
        setTimeout(() => {
          setTransactionStatus({ visible: false, status: "pending", message: "" });
        }, 2000);
        
        await loadData();
        return null;
      }
      
      setTransactionStatus({ 
        visible: true, 
        status: "error", 
        message: "Decryption failed: " + (e.message || "Unknown error") 
      });
      setTimeout(() => setTransactionStatus({ visible: false, status: "pending", message: "" }), 3000);
      return null; 
    }
  };

  const testAvailability = async () => {
    try {
      const contract = await getContractReadOnly();
      if (!contract) return;
      
      const isAvailable = await contract.isAvailable();
      setTransactionStatus({ 
        visible: true, 
        status: "success", 
        message: "Contract is available and responding" 
      });
      setTimeout(() => setTransactionStatus({ visible: false, status: "pending", message: "" }), 2000);
    } catch (e) {
      setTransactionStatus({ visible: true, status: "error", message: "Availability check failed" });
      setTimeout(() => setTransactionStatus({ visible: false, status: "pending", message: "" }), 3000);
    }
  };

  const filteredData = geneDataList.filter(data =>
    data.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    data.description.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const renderStatsPanel = () => {
    return (
      <div className="stats-panels">
        <div className="stat-panel gold-panel">
          <div className="stat-icon">🧬</div>
          <div className="stat-content">
            <h3>Total Data Sets</h3>
            <div className="stat-value">{marketStats.totalData}</div>
            <div className="stat-trend">+{marketStats.recentListings} this week</div>
          </div>
        </div>
        
        <div className="stat-panel silver-panel">
          <div className="stat-icon">🔐</div>
          <div className="stat-content">
            <h3>Verified Data</h3>
            <div className="stat-value">{marketStats.verifiedData}/{marketStats.totalData}</div>
            <div className="stat-trend">FHE Protected</div>
          </div>
        </div>
        
        <div className="stat-panel bronze-panel">
          <div className="stat-icon">⭐</div>
          <div className="stat-content">
            <h3>Avg Quality Score</h3>
            <div className="stat-value">{marketStats.avgQuality.toFixed(1)}/10</div>
            <div className="stat-trend">Research Grade</div>
          </div>
        </div>
      </div>
    );
  };

  const renderFAQSection = () => {
    const faqs = [
      {
        question: "How is my genetic data protected?",
        answer: "Your data is encrypted using Fully Homomorphic Encryption (FHE), allowing pharmaceutical companies to perform computations without ever seeing the raw data."
      },
      {
        question: "What can researchers do with my encrypted data?",
        answer: "Researchers can run statistical analysis and machine learning models on your encrypted data, receiving only aggregated results while your individual data remains private."
      },
      {
        question: "How do I earn from my genetic data?",
        answer: "You receive royalties every time your encrypted data is used in research. The FHE system ensures usage is tracked transparently while maintaining privacy."
      },
      {
        question: "Is my identity protected?",
        answer: "Yes, all personal identifiers are removed before encryption. Researchers only work with anonymized, encrypted genetic markers."
      }
    ];

    return (
      <div className="faq-section">
        <h3>Frequently Asked Questions</h3>
        <div className="faq-list">
          {faqs.map((faq, index) => (
            <div key={index} className="faq-item">
              <div className="faq-question">{faq.question}</div>
              <div className="faq-answer">{faq.answer}</div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderFHEProcess = () => {
    return (
      <div className="fhe-process">
        <div className="process-step">
          <div className="step-icon">1</div>
          <div className="step-content">
            <h4>Data Encryption</h4>
            <p>Genetic data encrypted with Zama FHE 🔐</p>
          </div>
        </div>
        <div className="process-arrow">→</div>
        <div className="process-step">
          <div className="step-icon">2</div>
          <div className="step-content">
            <h4>Secure Storage</h4>
            <p>Encrypted data stored on blockchain</p>
          </div>
        </div>
        <div className="process-arrow">→</div>
        <div className="process-step">
          <div className="step-icon">3</div>
          <div className="step-content">
            <h4>Homomorphic Computation</h4>
            <p>Researchers compute on encrypted data</p>
          </div>
        </div>
        <div className="process-arrow">→</div>
        <div className="process-step">
          <div className="step-icon">4</div>
          <div className="step-content">
            <h4>Profit Sharing</h4>
            <p>Earn royalties from research usage</p>
          </div>
        </div>
      </div>
    );
  };

  if (!isConnected) {
    return (
      <div className="app-container">
        <header className="app-header">
          <div className="logo">
            <h1>GeneMart FHE 🧬</h1>
            <p>Private Genetic Data Marketplace</p>
          </div>
          <div className="header-actions">
            <div className="wallet-connect-wrapper">
              <ConnectButton accountStatus="address" chainStatus="icon" showBalance={false}/>
            </div>
          </div>
        </header>
        
        <div className="connection-prompt">
          <div className="connection-content">
            <div className="connection-icon">🧬</div>
            <h2>Connect Your Wallet to Access GeneMart</h2>
            <p>Securely monetize your genetic data while maintaining complete privacy through FHE encryption.</p>
            <div className="connection-steps">
              <div className="step">
                <span>1</span>
                <p>Connect your wallet to initialize FHE system</p>
              </div>
              <div className="step">
                <span>2</span>
                <p>Upload and encrypt your genetic data</p>
              </div>
              <div className="step">
                <span>3</span>
                <p>Earn from pharmaceutical research</p>
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
        <div className="fhe-spinner"></div>
        <p>Initializing FHE Encryption System...</p>
        <p>Status: {fhevmInitializing ? "Initializing FHEVM" : status}</p>
        <p className="loading-note">Securing your genetic data</p>
      </div>
    );
  }

  if (loading) return (
    <div className="loading-screen">
      <div className="fhe-spinner"></div>
      <p>Loading encrypted genetic marketplace...</p>
    </div>
  );

  return (
    <div className="app-container">
      <header className="app-header">
        <div className="logo">
          <h1>GeneMart FHE 🧬</h1>
          <p>Private Genetic Data Marketplace</p>
        </div>
        
        <div className="header-actions">
          <button onClick={testAvailability} className="test-btn">
            Test Contract
          </button>
          <button 
            onClick={() => setShowCreateModal(true)} 
            className="create-btn"
          >
            + List Genetic Data
          </button>
          <div className="wallet-connect-wrapper">
            <ConnectButton accountStatus="address" chainStatus="icon" showBalance={false}/>
          </div>
        </div>
      </header>
      
      <div className="main-content">
        <div className="marketplace-section">
          <div className="section-header">
            <h2>Encrypted Genetic Data Marketplace</h2>
            <div className="header-controls">
              <div className="search-box">
                <input 
                  type="text" 
                  placeholder="Search genetic data..." 
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <button 
                onClick={loadData} 
                className="refresh-btn" 
                disabled={isRefreshing}
              >
                {isRefreshing ? "Refreshing..." : "Refresh"}
              </button>
            </div>
          </div>
          
          {renderStatsPanel()}
          
          <div className="fhe-info-panel">
            <h3>FHE 🔐 Privacy-Preserving Computation</h3>
            {renderFHEProcess()}
          </div>
        </div>
        
        <div className="data-section">
          <div className="section-tabs">
            <button className="tab-active">All Data</button>
            <button onClick={() => setShowFAQ(true)}>FAQ</button>
          </div>
          
          {showFAQ ? (
            renderFAQSection()
          ) : (
            <div className="data-list">
              {filteredData.length === 0 ? (
                <div className="no-data">
                  <p>No genetic data listings found</p>
                  <button 
                    className="create-btn" 
                    onClick={() => setShowCreateModal(true)}
                  >
                    List First Dataset
                  </button>
                </div>
              ) : filteredData.map((data, index) => (
                <div 
                  className={`data-item ${selectedData?.id === data.id ? "selected" : ""} ${data.isVerified ? "verified" : ""}`} 
                  key={index}
                  onClick={() => setSelectedData(data)}
                >
                  <div className="data-header">
                    <div className="data-title">{data.name}</div>
                    <div className="data-badge">{data.isVerified ? "✅ Verified" : "🔓 Ready"}</div>
                  </div>
                  <div className="data-meta">
                    <span>Age: {data.age}</span>
                    <span>Quality: {data.qualityScore}/10</span>
                    <span>{new Date(data.timestamp * 1000).toLocaleDateString()}</span>
                  </div>
                  <div className="data-description">{data.description}</div>
                  <div className="data-creator">Owner: {data.creator.substring(0, 6)}...{data.creator.substring(38)}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      
      {showCreateModal && (
        <ModalCreateData 
          onSubmit={createGeneData} 
          onClose={() => setShowCreateModal(false)} 
          creating={creatingData} 
          geneData={newGeneData} 
          setGeneData={setNewGeneData}
          isEncrypting={isEncrypting}
        />
      )}
      
      {selectedData && (
        <DataDetailModal 
          data={selectedData} 
          onClose={() => setSelectedData(null)} 
          isDecrypting={fheIsDecrypting} 
          decryptData={() => decryptData(selectedData.id)}
        />
      )}
      
      {transactionStatus.visible && (
        <div className="transaction-modal">
          <div className="transaction-content">
            <div className={`transaction-icon ${transactionStatus.status}`}>
              {transactionStatus.status === "pending" && <div className="fhe-spinner"></div>}
              {transactionStatus.status === "success" && <div className="success-icon">✓</div>}
              {transactionStatus.status === "error" && <div className="error-icon">✗</div>}
            </div>
            <div className="transaction-message">{transactionStatus.message}</div>
          </div>
        </div>
      )}
    </div>
  );
};

const ModalCreateData: React.FC<{
  onSubmit: () => void; 
  onClose: () => void; 
  creating: boolean;
  geneData: any;
  setGeneData: (data: any) => void;
  isEncrypting: boolean;
}> = ({ onSubmit, onClose, creating, geneData, setGeneData, isEncrypting }) => {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    if (name === 'value') {
      const intValue = value.replace(/[^\d]/g, '');
      setGeneData({ ...geneData, [name]: intValue });
    } else {
      setGeneData({ ...geneData, [name]: value });
    }
  };

  return (
    <div className="modal-overlay">
      <div className="create-data-modal">
        <div className="modal-header">
          <h2>List Genetic Data</h2>
          <button onClick={onClose} className="close-modal">&times;</button>
        </div>
        
        <div className="modal-body">
          <div className="fhe-notice">
            <strong>FHE 🔐 Encryption</strong>
            <p>Genetic value will be encrypted with Zama FHE (Integer only)</p>
          </div>
          
          <div className="form-group">
            <label>Data Set Name *</label>
            <input 
              type="text" 
              name="name" 
              value={geneData.name} 
              onChange={handleChange} 
              placeholder="Enter data set name..." 
            />
          </div>
          
          <div className="form-group">
            <label>Genetic Value (Integer only) *</label>
            <input 
              type="number" 
              name="value" 
              value={geneData.value} 
              onChange={handleChange} 
              placeholder="Enter genetic value..." 
              step="1"
              min="0"
            />
            <div className="data-type-label">FHE Encrypted Integer</div>
          </div>
          
          <div className="form-row">
            <div className="form-group">
              <label>Donor Age *</label>
              <input 
                type="number" 
                name="age" 
                value={geneData.age} 
                onChange={handleChange} 
                placeholder="Age" 
                min="0"
                max="120"
              />
              <div className="data-type-label">Public Data</div>
            </div>
            
            <div className="form-group">
              <label>Quality Score (1-10) *</label>
              <input 
                type="number" 
                min="1" 
                max="10" 
                name="quality" 
                value={geneData.quality} 
                onChange={handleChange} 
                placeholder="1-10" 
              />
              <div className="data-type-label">Public Data</div>
            </div>
          </div>
          
          <div className="form-group">
            <label>Description</label>
            <textarea 
              name="description" 
              value={geneData.description} 
              onChange={handleChange} 
              placeholder="Describe your genetic data..." 
              rows={3}
            />
          </div>
        </div>
        
        <div className="modal-footer">
          <button onClick={onClose} className="cancel-btn">Cancel</button>
          <button 
            onClick={onSubmit} 
            disabled={creating || isEncrypting || !geneData.name || !geneData.value || !geneData.age || !geneData.quality} 
            className="submit-btn"
          >
            {creating || isEncrypting ? "Encrypting and Listing..." : "List Data Set"}
          </button>
        </div>
      </div>
    </div>
  );
};

const DataDetailModal: React.FC<{
  data: GeneData;
  onClose: () => void;
  isDecrypting: boolean;
  decryptData: () => Promise<number | null>;
}> = ({ data, onClose, isDecrypting, decryptData }) => {
  const [localDecrypted, setLocalDecrypted] = useState<number | null>(null);

  const handleDecrypt = async () => {
    if (localDecrypted !== null) { 
      setLocalDecrypted(null); 
      return; 
    }
    
    const decrypted = await decryptData();
    if (decrypted !== null) {
      setLocalDecrypted(decrypted);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="data-detail-modal">
        <div className="modal-header">
          <h2>Genetic Data Details</h2>
          <button onClick={onClose} className="close-modal">&times;</button>
        </div>
        
        <div className="modal-body">
          <div className="data-info">
            <div className="info-item">
              <span>Data Set:</span>
              <strong>{data.name}</strong>
            </div>
            <div className="info-item">
              <span>Owner:</span>
              <strong>{data.creator.substring(0, 6)}...{data.creator.substring(38)}</strong>
            </div>
            <div className="info-item">
              <span>Listed:</span>
              <strong>{new Date(data.timestamp * 1000).toLocaleDateString()}</strong>
            </div>
            <div className="info-item">
              <span>Donor Age:</span>
              <strong>{data.age}</strong>
            </div>
            <div className="info-item">
              <span>Quality Score:</span>
              <strong>{data.qualityScore}/10</strong>
            </div>
          </div>
          
          <div className="data-description-full">
            <h3>Description</h3>
            <p>{data.description}</p>
          </div>
          
          <div className="encryption-section">
            <h3>FHE Encrypted Genetic Value</h3>
            
            <div className="encryption-status">
              <div className="status-item">
                <span>Encryption Status:</span>
                <strong>{data.isVerified ? "✅ On-chain Verified" : "🔒 Encrypted"}</strong>
              </div>
              
              <div className="status-item">
                <span>Genetic Value:</span>
                <strong>
                  {data.isVerified && data.decryptedValue ? 
                    `${data.decryptedValue} (Verified)` : 
                    localDecrypted !== null ? 
                    `${localDecrypted} (Decrypted)` : 
                    "🔒 FHE Encrypted"
                  }
                </strong>
              </div>
            </div>
            
            <button 
              className={`decrypt-btn ${(data.isVerified || localDecrypted !== null) ? 'decrypted' : ''}`}
              onClick={handleDecrypt} 
              disabled={isDecrypting}
            >
              {isDecrypting ? (
                "🔓 Decrypting..."
              ) : data.isVerified ? (
                "✅ Verified"
              ) : localDecrypted !== null ? (
                "🔄 Re-verify"
              ) : (
                "🔓 Decrypt Value"
              )}
            </button>
            
            <div className="fhe-explanation">
              <div className="fhe-icon">🔐</div>
              <div>
                <strong>FHE Protection</strong>
                <p>Your genetic value is encrypted on-chain. Decryption happens locally and is verified on-chain without exposing the raw data.</p>
              </div>
            </div>
          </div>
        </div>
        
        <div className="modal-footer">
          <button onClick={onClose} className="close-btn">Close</button>
          {!data.isVerified && (
            <button 
              onClick={handleDecrypt} 
              disabled={isDecrypting}
              className="verify-btn"
            >
              {isDecrypting ? "Verifying..." : "Verify on-chain"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default App;



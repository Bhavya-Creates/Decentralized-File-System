import "./App.css";
import axios from "axios";
import { useEffect, useState } from "react";
import { createPublicClient, createWalletClient, custom, http } from "viem";
import { hardhat } from "viem/chains";
import { uploadAbi } from "./abi";

const CONTRACT_ADDRESS = "0x5FbDB2315678afecb367f032d93F642f64180aa3";

const publicClient = createPublicClient({
  chain: hardhat,
  transport: http("http://127.0.0.1:8545"),
});

export default function App() {
  const [account, setAccount] = useState("");

  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);

  const [url, setUrl] = useState("");

  const [files, setFiles] = useState([]);
  const [shareTo, setShareTo] = useState("");
  const [accessList, setAccessList] = useState([]);

  const [viewAddress, setViewAddress] = useState("");
  const [otherFiles, setOtherFiles] = useState([]);

  const walletClient = () =>
    createWalletClient({ chain: hardhat, transport: custom(window.ethereum) });

  const short = (addr) =>
    addr ? `${addr.slice(0, 6)}...${addr.slice(-4)}` : "";

  const connectWallet = async () => {
    if (!window.ethereum) return alert("Install MetaMask");
    const [addr] = await walletClient().requestAddresses();
    setAccount(addr);
  };

  const loadMyFiles = async () => {
    if (!account) return;

    const data = await publicClient.readContract({
      address: CONTRACT_ADDRESS,
      abi: uploadAbi,
      functionName: "display",
      args: [account],
      account,
    });

    setFiles(data);
  };

  const loadAccessList = async () => {
    if (!account) return;

    const data = await publicClient.readContract({
      address: CONTRACT_ADDRESS,
      abi: uploadAbi,
      functionName: "shareAccess",
      args: [],
      account,
    });

    setAccessList(data);
  };

  const uploadToPinata = async () => {
    if (!file) return alert("Select a file first");

    const jwt = import.meta.env.VITE_PINATA_JWT;
    if (!jwt) return alert("Missing VITE_PINATA_JWT in frontend/.env");

    try {
      setUploading(true);

      const formData = new FormData();
      formData.append("file", file);

      const res = await axios.post(
        "https://api.pinata.cloud/pinning/pinFileToIPFS",
        formData,
        {
          headers: {
            Authorization: `Bearer ${jwt}`,
            "Content-Type": "multipart/form-data",
          },
        }
      );

      const cid = res.data.IpfsHash;
      const fileUrl = `https://gateway.pinata.cloud/ipfs/${cid}`;

      setUrl(fileUrl);
      alert("✅ Uploaded to IPFS. Now click Add.");
    } catch (e) {
      console.log(e);
      alert("❌ Pinata upload failed");
    } finally {
      setUploading(false);
    }
  };

  const addFile = async () => {
    if (!account) return alert("Connect wallet first");
    if (!url) return alert("Upload file or paste URL first");

    await walletClient().writeContract({
      address: CONTRACT_ADDRESS,
      abi: uploadAbi,
      functionName: "add",
      args: [account, url],
      account,
    });

    alert("✅ Saved to blockchain");
    setUrl("");
    setFile(null);
    loadMyFiles();
  };

  const setAccess = async (mode) => {
    if (!account) return alert("Connect wallet first");
    if (!shareTo) return alert("Enter user address");

    await walletClient().writeContract({
      address: CONTRACT_ADDRESS,
      abi: uploadAbi,
      functionName: mode,
      args: [shareTo],
      account,
    });

    alert(mode === "allow" ? "✅ Access allowed" : "✅ Access removed");
    setShareTo("");
    loadAccessList();
  };

  const viewOtherUserFiles = async () => {
    if (!account) return alert("Connect wallet first");
    if (!viewAddress) return alert("Enter user address");

    try {
      const data = await publicClient.readContract({
        address: CONTRACT_ADDRESS,
        abi: uploadAbi,
        functionName: "display",
        args: [viewAddress],
        account,
      });

      setOtherFiles(data);
    } catch (e) {
      console.log(e);
      alert("❌ No access / No files");
    }
  };

  useEffect(() => {
    if (!window.ethereum) return;

    const onAccountsChanged = (accs) => setAccount(accs?.[0] || "");
    window.ethereum.on("accountsChanged", onAccountsChanged);

    return () =>
      window.ethereum.removeListener("accountsChanged", onAccountsChanged);
  }, []);

  useEffect(() => {
    if (!account) return;
    loadMyFiles();
    loadAccessList();
    // eslint-disable-next-line
  }, [account]);

  return (
    <div className="container">
      <div className="card">
        <div className="topbar">
          <h2 className="title">Decentralized File System</h2>

          <button className="connectBtn" onClick={connectWallet}>
            {account ? `Connected: ${short(account)}` : "Connect MetaMask"}
          </button>
        </div>

        <div className="section">
          <h3>Upload to IPFS (Pinata)</h3>
          <div className="row">
            <input type="file" onChange={(e) => setFile(e.target.files?.[0])} />
            <button onClick={uploadToPinata} disabled={uploading}>
              {uploading ? "Uploading..." : "Upload"}
            </button>
          </div>
          {file && (
            <p style={{ marginTop: 10, fontWeight: 700 }}>
              Selected: {file.name}
            </p>
          )}
        </div>

        <div className="section">
          <h3>Add File URL / Hash</h3>
          <div className="row">
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="Paste URL or upload file above..."
            />
            <button onClick={addFile}>Add</button>
          </div>
        </div>

        <div className="section">
          <h3>My Files</h3>
          <div className="row">
            <button onClick={loadMyFiles}>Refresh</button>
          </div>

          <ul className="list">
            {files.map((f, i) => (
              <li key={i}>
                <a href={f} target="_blank" rel="noreferrer">
                  {f}
                </a>
              </li>
            ))}
          </ul>
        </div>

        <div className="section">
          <h3>Share Access</h3>
          <div className="row">
            <input
              value={shareTo}
              onChange={(e) => setShareTo(e.target.value)}
              placeholder="Enter address to allow/disallow"
            />
            <button onClick={() => setAccess("allow")}>Allow</button>
            <button className="secondaryBtn" onClick={() => setAccess("disallow")}>
              Disallow
            </button>
          </div>

          <div className="row" style={{ marginTop: 10 }}>
            <button onClick={loadAccessList}>Refresh Access List</button>
          </div>

          <ul className="list">
            {accessList.map((a, i) => (
              <li key={i}>
                {short(a.user)} — {a.access ? "✅ Allowed" : "❌ Revoked"}
              </li>
            ))}
          </ul>
        </div>

        <div className="section">
          <h3>View Other User Files</h3>
          <div className="row">
            <input
              value={viewAddress}
              onChange={(e) => setViewAddress(e.target.value)}
              placeholder="Enter user address to view"
            />
            <button onClick={viewOtherUserFiles}>View</button>
          </div>

          <ul className="list">
            {otherFiles.map((f, i) => (
              <li key={i}>
                <a href={f} target="_blank" rel="noreferrer">
                  {f}
                </a>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

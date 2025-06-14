"use client";

import { useEffect, useState } from "react";
import Web3 from "web3";
import styled, { keyframes } from "styled-components";
import NoteForm from "./components/NoteForm";
import NoteList from "./components/NoteList";
import { sha256 } from "js-sha256";

const fadeIn = keyframes`
  from { opacity: 0; transform: translateY(-10px); }
  to { opacity: 1; transform: translateY(0); }
`;

const Container = styled.div`
  min-height: 100vh;
  background: linear-gradient(135deg, #fdfbfb 0%, #ebedee 100%);
  padding: 2rem 1rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  animation: ${fadeIn} 0.6s ease-out;
`;

const Title = styled.h1`
  font-size: 2.5rem;
  margin-bottom: 1.5rem;
  color: #333;
  text-align: center;
  font-family: "Marker Felt", "Comic Sans MS", cursive;
  text-shadow: 1px 1px 3px rgba(0, 0, 0, 0.1);
`;

const WalletInfo = styled.div`
  margin-bottom: 1.5rem;
  font-size: 1.1rem;
  color: #444;
  background: #e0f7fa;

  border-radius: 10px;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.08);
`;

const ConnectButton = styled.button`
  padding: 0.8rem 1.6rem;
  background-color: #0070f3;
  color: white;
  border: none;
  border-radius: 10px;
  font-size: 1.1rem;
  font-weight: bold;
  cursor: pointer;
  margin-top: 2rem;
  transition: all 0.3s ease;
  box-shadow: 0 4px 10px rgba(0, 0, 0, 0.1);

  &:hover {
    background-color: #0056c1;
    transform: translateY(-2px);
  }
`;

const Notice = styled.p`
  font-size: 1rem;
  color: #888;
  margin-top: 1rem;
`;

export default function Home() {
  const [account, setAccount] = useState(null);
  const [encryptionKey, setEncryptionKey] = useState(null);
  const [notes, setNotes] = useState(() => {
    if (typeof window !== "undefined") {
      return JSON.parse(localStorage.getItem("notes") || "[]");
    }
    return [];
  });

  useEffect(() => {
    if (typeof window.ethereum !== "undefined") {
      const web3 = new Web3(window.ethereum);
      window.ethereum
        .request({ method: "eth_accounts" })
        .then(async (accounts) => {
          if (accounts.length) {
            setAccount(accounts[0]);
            await generateEncryptionKey(accounts[0], web3);
          }
        });
    }
  }, []);

  const connectWallet = async () => {
    if (typeof window.ethereum !== "undefined") {
      try {
        const web3 = new Web3(window.ethereum);
        const accounts = await window.ethereum.request({
          method: "eth_requestAccounts",
        });
        setAccount(accounts[0]);
        await generateEncryptionKey(accounts[0], web3);
      } catch (err) {
        console.error("User denied wallet connection");
      }
    } else {
      alert("Please install MetaMask to continue.");
    }
  };

  const generateEncryptionKey = async (walletAddress, web3) => {
    const message = `Unlock notes for ${walletAddress}`;
    try {
      const signature = await web3.eth.personal.sign(
        message,
        walletAddress,
        ""
      );
      const key = sha256(signature);
      setEncryptionKey(key);
    } catch (err) {
      console.error("Failed to sign message for encryption key:", err);
      setEncryptionKey(null);
    }
  };

  const handleNoteCreated = (cid) => {
    const newNotes = [...notes, { cid }];
    setNotes(newNotes);
    localStorage.setItem("notes", JSON.stringify(newNotes));
  };

  return (
    <Container>
      <Title>📝 Encrypted Sticky Notes on IPFS</Title>
      {account ? (
        <>
          <WalletInfo>🔐 Connected as: {account}</WalletInfo>
          <NoteForm
            onNoteCreated={handleNoteCreated}
            encryptionKey={encryptionKey}
          />
          {encryptionKey ? (
            <NoteList
              notes={notes}
              setNotes={setNotes}
              encryptionKey={encryptionKey}
            />
          ) : (
            <Notice>Sign the message to unlock your notes ✍️</Notice>
          )}
        </>
      ) : (
        <>
          <ConnectButton onClick={connectWallet}>
            🔗 Connect MetaMask Wallet
          </ConnectButton>
          <Notice>Secure your notes with your Ethereum wallet</Notice>
        </>
      )}
    </Container>
  );
}

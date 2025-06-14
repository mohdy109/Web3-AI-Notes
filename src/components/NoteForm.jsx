import { useState } from "react";
import { encryptNote } from "../lib/crypto";
import { uploadToIPFS } from "../lib/ipfs";
import styled from "styled-components";
import { useRef, useEffect } from "react";

const FormContainer = styled.div`
  margin: 2rem 0;
  width: 100%;
  max-width: 600px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
`;

const TextArea = styled.textarea`
  width: 100%;
  min-height: 150px;
  border: none;
  padding: 1rem;
  border-radius: 12px;
  font-size: 1rem;
  background: #fffbe6;
  box-shadow: inset 0 0 8px rgba(0, 0, 0, 0.1);
  resize: vertical;
  outline: none;
`;

const SaveButton = styled.button`
  margin-top: 1rem;
  background: ${({ disabled }) => (disabled ? "#ccc" : "#00b894")};
  color: white;
  border: none;
  padding: 0.75rem 1.5rem;
  border-radius: 8px;
  font-weight: bold;
  cursor: ${({ disabled }) => (disabled ? "not-allowed" : "pointer")};
  transition: background 0.3s;

  &:hover {
    background: ${({ disabled }) => (disabled ? "#ccc" : "#019174")};
  }
`;

const Loader = styled.div`
  border: 4px solid #f3f3f3;
  border-top: 4px solid #00b894;
  border-radius: 50%;
  width: 24px;
  height: 24px;
  animation: spin 1s linear infinite;
  margin: 0 auto;

  @keyframes spin {
    0% {
      transform: rotate(0deg);
    }
    100% {
      transform: rotate(360deg);
    }
  }
`;

export default function NoteForm({ onNoteCreated, encryptionKey }) {
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState("");
  const [tone, setTone] = useState("");
  const [modelsInitialized, setModelsInitialized] = useState(false);
  const [initError, setInitError] = useState(null);
  const [modelLoadingProgress, setModelLoadingProgress] = useState({
    sentiment: 0,
    summary: 0,
  });

  const summarizerRef = useRef(null);
  const sentimentRef = useRef(null);

  async function initModels() {
    if (typeof window === "undefined" || modelsInitialized) return;

    try {
      const { pipeline, env } = await import("@xenova/transformers");

      env.allowLocalModels = false;

      if (
        env.backends?.onnx?.wasm &&
        typeof env.backends.onnx.wasm.numThreads !== "undefined"
      ) {
        env.backends.onnx.wasm.numThreads = 1;
      }

      const safeProgress = (label) => (p) => {
        if (!isNaN(p)) {
          setModelLoadingProgress((prev) => ({
            ...prev,
            [label.toLowerCase()]: Math.round(p * 100),
          }));
        } else {
          console.warn(`${label} progress callback returned NaN`);
        }
      };

      sentimentRef.current = await pipeline(
        "sentiment-analysis",
        "Xenova/distilbert-base-uncased-finetuned-sst-2-english",
        {
          progress_callback: safeProgress("sentiment"),
        }
      );

      summarizerRef.current = await pipeline(
        "summarization",
        "Xenova/distilbart-cnn-12-6",
        {
          progress_callback: safeProgress("summary"),
        }
      );

      setModelsInitialized(true);
      setInitError(null);
      console.log("✅ Models initialized successfully");
    } catch (err) {
      console.error("❌ Model initialization error:", err);
      setInitError("Failed to load AI models. Please refresh the page.");
    }
  }

  useEffect(() => {
    initModels();
    return () => {
      summarizerRef.current = null;
      sentimentRef.current = null;
    };
  }, []);

  const handleEnhance = async () => {
    if (!text.trim()) {
      alert("Please enter some text first");
      return;
    }

    if (initError) {
      alert(initError);
      return;
    }

    setLoading(true);
    try {
      if (!modelsInitialized) {
        await initModels();
        if (!modelsInitialized) throw new Error("Models failed to initialize");
      }

      const [toneResult, summaryResult] = await Promise.all([
        sentimentRef.current(text),
        summarizerRef.current(text, {
          max_length: 80,
          min_length: 30,
          do_sample: false,
        }),
      ]);

      const extractedTone = toneResult[0]?.label || "neutral";
      const extractedSummary =
        summaryResult[0]?.summary_text || "No summary available.";

      setTone(extractedTone);
      setSummary(`${extractedSummary} (Tone: ${extractedTone})`);
    } catch (err) {
      console.error("Enhance error", err);
      alert("Enhancement failed. Please try again later.");
    } finally {
      setLoading(false);
    }
  };
  const handleSave = async () => {
    if (!encryptionKey) {
      alert("Please unlock your notes by signing the message first.");
      return;
    }
    try {
      setLoading(true);
      const timestamp = new Date().toISOString(); 
      const { encrypted, iv } = await encryptNote(text, encryptionKey);
      const cid = await uploadToIPFS(
        JSON.stringify({ encrypted, iv, summary, tone, timestamp })
      );
      onNoteCreated(cid);
      setText("");
      setSummary("");
      setTone("");
    } catch (err) {
      console.error("Error saving note:", err);
      alert("Failed to save note. See console for details.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <FormContainer>
      {!modelsInitialized && (
        <div
          style={{ marginBottom: "1rem", color: "#555", textAlign: "center" }}
        >
          <p>🧠 Preparing AI magic...</p>
          <p>Sentiment Model: {modelLoadingProgress.sentiment}%</p>
          <p>Summary Model: {modelLoadingProgress.summary}%</p>
          <Loader></Loader>
        </div>
      )}
      <TextArea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Write your note..."
        disabled={loading}
      />
      <div style={{ display: "flex", gap: "1rem" }}>
        <SaveButton onClick={handleSave} disabled={loading || !text.trim()}>
          {loading ? "Saving..." : "➕ Save Note"}
        </SaveButton>
        <SaveButton
          onClick={handleEnhance}
          disabled={
            loading || !text.trim() || !modelsInitialized || !!initError
          }
        >
          {!modelsInitialized
            ? `⏳ Loading (${modelLoadingProgress.sentiment}% / ${modelLoadingProgress.summary}%)`
            : initError
            ? "⚠️ Models Error"
            : "✨ Enhance"}
        </SaveButton>
      </div>
      {summary && (
        <div style={{ marginTop: "1rem", color: "#555" }}>
          <strong>Summary:</strong> {summary}
          <br />
          <strong>Tone:</strong> {tone}
        </div>
      )}
      {initError && (
        <div style={{ color: "red", marginTop: "1rem" }}>{initError}</div>
      )}
    </FormContainer>
  );
}

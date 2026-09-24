"use client";

import { useEffect, useRef, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Mic, MicOff } from "lucide-react";
import { StatusChip } from "@/components/StatusChip";
import { ToastStack } from "@/components/Toast";
import { useToasts } from "@/lib/useToasts";

function encodePcmToWav(chunks: Float32Array[], sampleRate: number): Blob {
  const sampleCount = chunks.reduce((total, chunk) => total + chunk.length, 0);
  const wavBuffer = new ArrayBuffer(44 + sampleCount * 2);
  const view = new DataView(wavBuffer);

  function writeText(offset: number, value: string) {
    for (let index = 0; index < value.length; index += 1) {
      view.setUint8(offset + index, value.charCodeAt(index));
    }
  }

  writeText(0, "RIFF");
  view.setUint32(4, 36 + sampleCount * 2, true);
  writeText(8, "WAVE");
  writeText(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeText(36, "data");
  view.setUint32(40, sampleCount * 2, true);

  let offset = 44;
  for (const chunk of chunks) {
    for (const value of chunk) {
      const sample = Math.max(-1, Math.min(1, value));
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
      offset += 2;
    }
  }

  return new Blob([wavBuffer], { type: "audio/wav" });
}

function VoiceUpdateInner() {
  const search = useSearchParams();
  const router = useRouter();
  const supervisorId = search.get("supervisorId") || "";
  const projectId = search.get("projectId") || "";
  const { toasts, push, dismiss } = useToasts();
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const levelFrameRef = useRef<number | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const pcmChunksRef = useRef<Float32Array[]>([]);
  const liveRecognitionRef = useRef<any>(null);

  const [updateDate, setUpdateDate] = useState(new Date().toISOString().slice(0, 10));
  const [discipline, setDiscipline] = useState("");
  const [areaUnit, setAreaUnit] = useState("");
  const [transcript, setTranscript] = useState("");
  const [delayReason, setDelayReason] = useState("");
  const [remarks, setRemarks] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [isListening, setIsListening] = useState(false);
  const [micSupported, setMicSupported] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [livePreviewSupported, setLivePreviewSupported] = useState(false);

  useEffect(() => {
    setMicSupported(typeof navigator.mediaDevices?.getUserMedia === "function" && typeof window.AudioContext !== "undefined");
    setLivePreviewSupported(Boolean((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition));

    return () => {
      liveRecognitionRef.current?.stop();
      if (levelFrameRef.current) cancelAnimationFrame(levelFrameRef.current);
      processorRef.current?.disconnect();
      analyserRef.current?.disconnect();
      audioContextRef.current?.close();
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, [push]);

  useEffect(() => {
    if (!isListening) return;
    const timer = window.setInterval(() => setRecordingSeconds((seconds) => seconds + 1), 1000);
    return () => window.clearInterval(timer);
  }, [isListening]);

  if (!supervisorId || !projectId) {
    return (
      <div className="mx-auto max-w-2xl p-8 text-center text-sm text-slate-500">
        Missing Supervisor_ID or Project.{" "}
        <Link href="/supervisor" className="text-navy-700 underline">
          Go back
        </Link>
      </div>
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!transcript.trim()) {
      push("error", "Please record or type a progress update before submitting.");
      return;
    }

    setSubmitting(true);
    setResult(null);

    try {
      const res = await fetch("/api/supervisor/voice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          project_id: projectId,
          supervisor_id: supervisorId,
          update_date: updateDate,
          discipline: discipline || null,
          area_unit: areaUnit || null,
          activity_update_text: transcript,
          delay_reason: delayReason || null,
          remarks: remarks || null
        })
      });

      const data = await res.json();
      if (!res.ok) {
        push("error", data.error || "Failed to process voice update.");
        return;
      }

      setResult(data);
      push("success", "Voice update processed.");
    } catch {
      push("error", "Something went wrong while processing the voice update.");
    } finally {
      setSubmitting(false);
    }
  }

  async function toggleListening() {
    if (!micSupported) {
      push("error", "This browser does not support microphone recording. Please type the transcript manually.");
      return;
    }

    if (isListening) {
      const audioContext = audioContextRef.current;
      const processor = processorRef.current;
      const stream = streamRef.current;
      const analyser = analyserRef.current;
      const liveRecognition = liveRecognitionRef.current;
      liveRecognition?.stop();
      liveRecognitionRef.current = null;
      if (levelFrameRef.current) cancelAnimationFrame(levelFrameRef.current);
      processor?.disconnect();
      analyser?.disconnect();
      audioContext?.close();
      stream?.getTracks().forEach((track) => track.stop());
      audioContextRef.current = null;
      processorRef.current = null;
      streamRef.current = null;
      setIsListening(false);
      setAudioLevel(0);
      setRecordingSeconds(0);

      const audioBlob = encodePcmToWav(pcmChunksRef.current, audioContext?.sampleRate || 44100);
      if (!audioBlob.size) {
        push("error", "No audio was captured. Please try again.");
        return;
      }

      const formData = new FormData();
      formData.append("project_id", projectId);
      formData.append("supervisor_id", supervisorId);
      formData.append("update_date", updateDate);
      formData.append("discipline", discipline);
      formData.append("area_unit", areaUnit);
      formData.append("delay_reason", delayReason);
      formData.append("remarks", remarks);
      formData.append("transcribe_only", "true");
      formData.append("audio", audioBlob, "supervisor-update.wav");

      setTranscribing(true);
      try {
        const response = await fetch("/api/supervisor/voice", { method: "POST", body: formData });
        const data = await response.json();
        if (!response.ok) {
          push("error", data.error || "Audio transcription failed. You can type the transcript manually.");
          return;
        }
        setTranscript(data.transcript || "");
        push("success", "Transcript ready. Review it and submit it as an update.");
      } catch {
        push("error", "Audio transcription failed. You can type the transcript manually.");
      } finally {
        setTranscribing(false);
      }
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const audioContext = new AudioContext();
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      const processor = audioContext.createScriptProcessor(4096, 1, 1);
      analyser.fftSize = 256;
      pcmChunksRef.current = [];
      streamRef.current = stream;
      audioContextRef.current = audioContext;
      analyserRef.current = analyser;
      processorRef.current = processor;
      processor.onaudioprocess = (event) => {
        pcmChunksRef.current.push(new Float32Array(event.inputBuffer.getChannelData(0)));
        event.outputBuffer.getChannelData(0).fill(0);
      };
      source.connect(analyser);
      analyser.connect(processor);
      processor.connect(audioContext.destination);

      const levelData = new Uint8Array(analyser.fftSize);
      const updateLevel = () => {
        analyser.getByteTimeDomainData(levelData);
        let sum = 0;
        for (const value of levelData) {
          const normalized = (value - 128) / 128;
          sum += normalized * normalized;
        }
        setAudioLevel(Math.min(1, Math.sqrt(sum / levelData.length) * 4));
        levelFrameRef.current = requestAnimationFrame(updateLevel);
      };
      updateLevel();

      const SpeechRecognitionApi = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognitionApi) {
        const recognition = new SpeechRecognitionApi();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = "en-US";
        recognition.onresult = (event: any) => {
          const liveText = Array.from(event.results)
            .map((item: any) => item[0]?.transcript || "")
            .join(" ")
            .trim();
          if (liveText) setTranscript(liveText);
        };
        recognition.onerror = () => undefined;
        recognition.onend = () => {
          if (liveRecognitionRef.current === recognition && streamRef.current) {
            try { recognition.start(); } catch { /* browser may already be stopping */ }
          }
        };
        liveRecognitionRef.current = recognition;
        try { recognition.start(); } catch { /* final WAV transcription remains available */ }
      }

      setTranscript("");
      setResult(null);
      setRecordingSeconds(0);
      setIsListening(true);
    } catch {
      push("error", "Microphone permission was blocked. Please allow access in the browser and try again.");
      setIsListening(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <ToastStack toasts={toasts} onDismiss={dismiss} />
      <header className="border-b border-slate-100 bg-white px-6 py-4">
        <div className="mx-auto flex max-w-2xl items-center justify-between">
          <button onClick={() => router.push("/supervisor")} className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-navy-700">
            <ArrowLeft size={16} />
            Back
          </button>
          <span className="text-sm font-semibold text-navy-900">Voice Update</span>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-6 py-8">
        {result?.demoMode && <span className="chip chip-amber mb-4">Demo AI Mode</span>}

        {!result && (
          <form onSubmit={handleSubmit} className="card space-y-4 p-6">
            <div className="grid grid-cols-2 gap-3 text-xs text-slate-500">
              <div>
                Supervisor: <span className="font-medium text-navy-900">{supervisorId}</span>
              </div>
              <div>
                Project: <span className="font-medium text-navy-900">{projectId}</span>
              </div>
            </div>

            <div>
              <label className="label-field">Update_Date</label>
              <input type="date" className="input-field" value={updateDate} onChange={(e) => setUpdateDate(e.target.value)} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label-field">Discipline</label>
                <select className="input-field" value={discipline} onChange={(e) => setDiscipline(e.target.value)}>
                  <option value="">Select…</option>
                  <option value="CIVIL">Civil</option>
                  <option value="PIPING">Piping</option>
                  <option value="ELECTRICAL">Electrical</option>
                  <option value="INSTRUMENTATION">Instrumentation</option>
                  <option value="MECHANICAL">Mechanical</option>
                  <option value="HSE">HSE</option>
                </select>
              </div>
              <div>
                <label className="label-field">Area / Unit</label>
                <input className="input-field" value={areaUnit} onChange={(e) => setAreaUnit(e.target.value)} placeholder="Rack 3" />
              </div>
            </div>

            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-xs font-medium text-slate-600">
                  <Mic size={16} className={isListening ? "text-red-500" : "text-slate-500"} />
                  {isListening ? `Recording live • ${recordingSeconds}s` : "Voice transcript"}
                </div>
                <button
                  type="button"
                  className={`btn-secondary text-xs ${isListening ? "border-red-200 text-red-600" : ""}`}
                  onClick={toggleListening}
                  disabled={!micSupported || submitting}
                >
                  {isListening ? <><MicOff size={14} /> Stop</> : <><Mic size={14} /> Start</>}
                </button>
              </div>
              {isListening && (
                <div className="mt-3" aria-label="Microphone recording level">
                  <div className="flex h-6 items-end gap-1" aria-hidden="true">
                    {Array.from({ length: 18 }, (_, index) => (
                      <span
                        key={index}
                        className={`flex-1 rounded-sm transition-all ${index / 18 < audioLevel ? "bg-red-500" : "bg-slate-200"}`}
                        style={{ height: `${8 + ((index * 7) % 15)}px` }}
                      />
                    ))}
                  </div>
                  <p className="mt-1 text-[11px] text-slate-500">
                    {audioLevel > 0.04 ? "Audio detected" : "Speak now… waiting for audio"}
                    {livePreviewSupported ? " • Live words are shown below" : " • Final text appears after Stop"}
                  </p>
                </div>
              )}
              {!micSupported && (
                <p className="mt-2 text-[11px] text-amber-600">Microphone recording is unavailable in this browser. Type your transcript below.</p>
              )}
            </div>

            <div>
              <label className="label-field">Transcript / Activity Update</label>
              <textarea
                className="input-field"
                rows={5}
                value={transcript}
                onChange={(e) => setTranscript(e.target.value)}
                placeholder={isListening ? "Your live words will appear here…" : "Example: Piping crew started erection of Line 24-A spool at Rack 3 today at 9 AM. Six workers deployed."}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label-field">Delay Reason (optional)</label>
                <input className="input-field" value={delayReason} onChange={(e) => setDelayReason(e.target.value)} />
              </div>
              <div>
                <label className="label-field">Remarks (optional)</label>
                <input className="input-field" value={remarks} onChange={(e) => setRemarks(e.target.value)} />
              </div>
            </div>

            <button type="submit" disabled={submitting || transcribing || isListening} className="btn-primary w-full">
              {transcribing ? "Converting voice to text…" : submitting ? "Processing with AI…" : "Process Transcript with AI"}
            </button>
          </form>
        )}

        {result && (
          <div className="card space-y-5 p-6">
            <div className="flex flex-wrap items-center gap-2">
              <StatusChip value={result.matchStatus} />
              <StatusChip value={result.decision} />
            </div>

            <DetailRow label="Update ID" value={result.updateId} mono />
            <DetailRow label="Original Input" value={transcript} block />

            {result.llmExtraction && (
              <div>
                <p className="mb-2 text-xs font-medium text-slate-500">Extracted Information</p>
                <div className="grid grid-cols-2 gap-2">
                  {Object.entries(result.llmExtraction)
                    .filter(([k]) => !["missing_fields", "ambiguous_fields"].includes(k))
                    .map(([k, v]: [string, any]) => (
                      <div key={k} className="rounded-lg bg-slate-50 p-2 text-xs">
                        <p className="text-slate-400">{k.replace(/_/g, " ")}</p>
                        <p className="font-medium text-navy-900">{v?.value ?? "—"}</p>
                      </div>
                    ))}
                </div>
              </div>
            )}

            {result.candidates?.length > 0 && (
              <div>
                <p className="mb-2 text-xs font-medium text-slate-500">Candidate Matches</p>
                <div className="space-y-1.5">
                  {result.candidates.map((c: any) => (
                    <div key={c.activity_id} className="flex justify-between rounded-lg bg-slate-50 p-2.5 text-xs">
                      <span className="text-navy-900">
                        {c.activity_name} <span className="font-mono text-slate-400">({c.activity_id})</span>
                      </span>
                      <span className="font-medium text-slate-500">{c.similarity}%</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <DetailRow label="Confidence Score" value={`${result.confidence.overall_score}%`} />
            <DetailRow label="Audit Reason" value={result.reason} block />
            <DetailRow
              label="Outcome"
              value={
                result.decision === "AUTO_ACCEPT" || result.decision === "ACCEPT_MONITOR"
                  ? "Schedule actuals were applied automatically."
                  : "Sent to Program Manager review queue. Schedule actuals were not changed."
              }
              block
            />

            <button
              className="btn-secondary w-full"
              onClick={() => {
                setResult(null);
                setTranscript("");
              }}
            >
              Submit Another Voice Update
            </button>
          </div>
        )}
      </main>
    </div>
  );
}

function DetailRow({ label, value, mono, block }: { label: string; value: string; mono?: boolean; block?: boolean }) {
  return (
    <div className={block ? "" : "flex justify-between text-sm"}>
      <span className="text-xs text-slate-400">{label}</span>
      <span className={`${block ? "mt-1 block rounded-lg bg-slate-50 p-3" : ""} ${mono ? "font-mono text-xs" : "text-sm"} text-navy-900`}>
        {value}
      </span>
    </div>
  );
}

export default function VoiceUpdatePage() {
  return (
    <Suspense fallback={null}>
      <VoiceUpdateInner />
    </Suspense>
  );
}

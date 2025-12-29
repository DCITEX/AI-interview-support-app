
import React, { useState, useRef, useEffect } from 'react';
import { GoogleGenAI, Modality, Type, GenerateContentResponse } from '@google/genai';
import { TranscriptItem, RagDocument, AppStatus, SpeakerRole } from './types';
import { TEMPLATES, MODEL_NAMES } from './constants';
import { createPcmBlob, arrayBufferToBase64 } from './services/audioUtils';
import TranscriptView from './components/TranscriptView';
import SummaryPanel from './components/SummaryPanel';
import { Mic, AlertCircle, PlayCircle, StopCircle, RotateCcw, Loader2, LayoutDashboard } from 'lucide-react';

const App: React.FC = () => {
  const [status, setStatus] = useState<AppStatus>(AppStatus.IDLE);
  const [transcripts, setTranscripts] = useState<TranscriptItem[]>([]);
  const [summary, setSummary] = useState<string>('');
  const [documents, setDocuments] = useState<RagDocument[]>([]);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [hasPostProcessed, setHasPostProcessed] = useState(false);

  const sessionPromiseRef = useRef<Promise<any> | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const currentTranscriptionRef = useRef<string>('');
  const currentTranscriptionIdRef = useRef<string>(Math.random().toString(36).substring(7));

  const updateLiveTranscript = (text: string, isFinal: boolean) => {
    setTranscripts((prev: TranscriptItem[]) => {
      const id = currentTranscriptionIdRef.current;
      const existingIndex = prev.findIndex((item: TranscriptItem) => item.id === id);
      const newItem: TranscriptItem = {
        id,
        speaker: '記録中...' as SpeakerRole,
        text: text,
        timestamp: new Date(),
        isFinal
      };

      if (existingIndex >= 0) {
        const newTranscripts = [...prev];
        newTranscripts[existingIndex] = newItem;
        return newTranscripts;
      } else {
        return [...prev, newItem];
      }
    });

    if (isFinal) {
      currentTranscriptionRef.current = '';
      currentTranscriptionIdRef.current = Math.random().toString(36).substring(7);
    }
  };

  const startRecording = async () => {
    const apiKey = process.env.API_KEY;
    if (!apiKey) {
      setErrorMsg("APIキーが構成されていません。");
      return;
    }

    try {
      setStatus(AppStatus.CONNECTING);
      setErrorMsg(null);
      setTranscripts([]);
      setSummary('');
      setHasPostProcessed(false);
      audioChunksRef.current = [];

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { sampleRate: 16000, channelCount: 1, echoCancellation: true, noiseSuppression: true }
      });
      streamRef.current = stream;

      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
      mediaRecorder.start(1000);
      mediaRecorderRef.current = mediaRecorder;

      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      await audioContext.resume();
      audioContextRef.current = audioContext;

      const ai = new GoogleGenAI({ apiKey });
      const sessionPromise = ai.live.connect({
        model: MODEL_NAMES.LIVE,
        config: {
          responseModalities: [Modality.AUDIO],
          inputAudioTranscription: {},
          systemInstruction: 'あなたは面談の書記です。日本語の会話を正確に書き起こしてください。',
        },
        callbacks: {
          onopen: () => {
            setStatus(AppStatus.RECORDING);
            if (audioContextRef.current && streamRef.current) {
              const source = audioContextRef.current.createMediaStreamSource(streamRef.current);
              const processor = audioContextRef.current.createScriptProcessor(4096, 1, 1);
              processor.onaudioprocess = (ev) => {
                const inputData = ev.inputBuffer.getChannelData(0);
                const pcmBlob = createPcmBlob(inputData);
                sessionPromise.then(s => s.sendRealtimeInput({ media: pcmBlob }));
              };
              source.connect(processor);
              processor.connect(audioContextRef.current.destination);
              scriptProcessorRef.current = processor;
            }
          },
          onmessage: async (msg) => {
            if (msg.serverContent?.inputTranscription) {
              currentTranscriptionRef.current += msg.serverContent.inputTranscription.text;
              updateLiveTranscript(currentTranscriptionRef.current, false);
            }
            if (msg.serverContent?.turnComplete) {
              updateLiveTranscript(currentTranscriptionRef.current, true);
            }
          },
          onerror: () => {
            setErrorMsg("接続エラーが発生しました。");
            stopRecording();
          }
        }
      });
      sessionPromiseRef.current = sessionPromise;

    } catch (e) {
      setErrorMsg("マイクの起動に失敗しました。");
      setStatus(AppStatus.IDLE);
    }
  };

  const stopRecording = async () => {
    if (status !== AppStatus.RECORDING && status !== AppStatus.CONNECTING) return;

    if (sessionPromiseRef.current) {
      sessionPromiseRef.current.then(s => { try { s.close(); } catch (e) { } });
      sessionPromiseRef.current = null;
    }

    if (scriptProcessorRef.current) scriptProcessorRef.current.disconnect();
    if (audioContextRef.current) audioContextRef.current.close();
    if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      const blobPromise = new Promise<Blob>((resolve) => {
        if (!mediaRecorderRef.current) return resolve(new Blob());
        mediaRecorderRef.current.onstop = () => resolve(new Blob(audioChunksRef.current, { type: 'audio/webm' }));
        mediaRecorderRef.current.stop();
      });
      const finalAudio = await blobPromise;
      if (finalAudio.size > 0) analyzeAudio(finalAudio);
    } else {
      setStatus(AppStatus.IDLE);
    }
  };

  const analyzeAudio = async (blob: Blob) => {
    const apiKey = process.env.API_KEY;
    if (!apiKey) return;
    setStatus(AppStatus.PROCESSING);
    try {
      const ai = new GoogleGenAI({ apiKey });
      const buffer = await blob.arrayBuffer();
      const base64Audio = arrayBufferToBase64(buffer);

      const response = await ai.models.generateContent({
        model: MODEL_NAMES.SUMMARY,
        contents: {
          parts: [
            { inlineData: { mimeType: "audio/webm", data: base64Audio } },
            { text: `録音内容を解析し、「Staff」と「Client」に分離して正確に書き起こしてください。JSON形式の配列で返してください。` }
          ]
        },
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                speaker: { type: Type.STRING },
                text: { type: Type.STRING }
              },
              required: ["speaker", "text"]
            }
          }
        }
      });

      const result = JSON.parse(response.text ?? '[]');
      setTranscripts(result.map((r: { speaker: string, text: string }, i: number) => ({
        id: `post-${i}`,
        speaker: r.speaker as SpeakerRole,
        text: r.text,
        timestamp: new Date(),
        isFinal: true
      })));
      setHasPostProcessed(true);
      setStatus(AppStatus.IDLE);
    } catch (e) {
      setErrorMsg("解析に失敗しました。");
      setStatus(AppStatus.IDLE);
    }
  };

  const handleGenerateSummary = async (templateId: string, customInstruction: string) => {
    const apiKey = process.env.API_KEY;
    if (!apiKey) return;
    setStatus(AppStatus.PROCESSING);
    try {
      const template = TEMPLATES.find((item: any) => item.id === templateId);
      const conversationLog = transcripts.map((item: TranscriptItem) => `[${item.speaker}]: ${item.text}`).join('\n');
      const ai = new GoogleGenAI({ apiKey });
      const parts: any[] = [];

      let promptText = `指示: ${template?.prompt}\nカスタム指示: ${customInstruction}\nログ:\n${conversationLog}`;

      documents.forEach((doc: RagDocument) => {
        if (doc.type === 'text/plain') promptText += `\n参照資料(${doc.name}): ${doc.content}`;
        else parts.push({ inlineData: { mimeType: doc.type, data: doc.content } });
      });

      parts.push({ text: promptText });

      const response: GenerateContentResponse = await ai.models.generateContent({
        model: MODEL_NAMES.SUMMARY,
        contents: { parts }
      });

      setSummary(response.text ?? '');
    } catch (e) {
      setErrorMsg("要約生成エラー");
    } finally {
      setStatus(AppStatus.IDLE);
    }
  };

  const handleFileUpload = async (files: FileList) => {
    const newDocs: RagDocument[] = [];
    for (const file of Array.from(files)) {
      try {
        if (file.type.startsWith('text/')) {
          const content = await file.text();
          newDocs.push({ id: Math.random().toString(36), name: file.name, content, type: 'text/plain' as any });
        } else {
          const base64 = arrayBufferToBase64(await file.arrayBuffer());
          newDocs.push({ id: Math.random().toString(36), name: file.name, content: base64, type: file.type as any });
        }
      } catch (e) { console.error(e); }
    }
    setDocuments((prev: RagDocument[]) => [...prev, ...newDocs]);
  };

  return (
    <div className="flex h-screen bg-slate-50 text-slate-900 overflow-hidden font-sans">
      <div className="flex-1 flex flex-col min-w-0 relative">
        <header className="h-16 flex-shrink-0 glass-card border-b border-slate-200 px-6 flex items-center justify-between z-40">
          <div className="flex items-center gap-3">
            <div className="bg-indigo-600 text-white p-2.5 rounded-2xl shadow-xl shadow-indigo-100">
              <Mic size={20} />
            </div>
            <div>
              <h1 className="text-lg font-black text-slate-800 leading-none">面談AI要約</h1>
              <p className="text-[10px] text-slate-400 font-bold tracking-[0.2em] uppercase mt-1">Intelligent Recording</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => { if (confirm("消去しますか？")) location.reload(); }}
              className="p-2.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
            >
              <RotateCcw size={20} />
            </button>
            <button
              className="md:hidden p-2.5 text-slate-600 bg-slate-100 rounded-xl"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            >
              <LayoutDashboard size={20} />
            </button>
          </div>
        </header>

        {errorMsg && (
          <div className="bg-red-500 text-white px-6 py-2.5 flex items-center justify-between z-50">
            <div className="flex items-center gap-3 text-sm font-bold">
              <AlertCircle size={18} />
              <span>{errorMsg}</span>
            </div>
            <button onClick={() => setErrorMsg(null)}><RotateCcw size={16} /></button>
          </div>
        )}

        <main className="flex-1 relative overflow-hidden flex flex-col">
          <TranscriptView
            transcripts={transcripts}
            onEdit={(id: string, text: string) => setTranscripts((prev: TranscriptItem[]) => prev.map((t: TranscriptItem) => t.id === id ? { ...t, text } : t))}
            isRecording={status === AppStatus.RECORDING}
          />

          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-30 flex flex-col items-center gap-4 w-full px-6">
            {status === AppStatus.IDLE && !hasPostProcessed && (
              <button
                onClick={startRecording}
                className="bg-indigo-600 hover:bg-indigo-700 text-white px-10 py-5 rounded-[2rem] shadow-2xl shadow-indigo-200 font-black text-xl flex items-center gap-4 transition-all hover:scale-105 active:scale-95 group"
              >
                <div className="bg-white/20 p-2 rounded-full">
                  <PlayCircle size={28} />
                </div>
                面談を開始
              </button>
            )}
            {status === AppStatus.RECORDING && (
              <button
                onClick={stopRecording}
                className="bg-red-500 hover:bg-red-600 text-white px-10 py-5 rounded-[2rem] shadow-2xl shadow-red-200 font-black text-xl flex items-center gap-4 animate-in zoom-in duration-300"
              >
                <div className="bg-white/20 p-2 rounded-full">
                  <StopCircle size={28} />
                </div>
                記録を終了
              </button>
            )}
            {status === AppStatus.IDLE && transcripts.length > 0 && !hasPostProcessed && (
              <div className="bg-white/90 backdrop-blur-md border border-indigo-100 px-6 py-3 rounded-full shadow-xl flex items-center gap-3 text-xs font-black text-indigo-600">
                <div className="w-2 h-2 bg-indigo-600 rounded-full animate-ping"></div>
                記録完了。解析中...
              </div>
            )}
          </div>

          {status === AppStatus.PROCESSING && (
            <div className="absolute inset-0 bg-white/90 backdrop-blur-xl z-50 flex flex-col items-center justify-center">
              <Loader2 size={64} className="text-indigo-600 animate-spin" />
              <h3 className="text-2xl font-black text-slate-800 mt-8 mb-2">AIが解析中</h3>
            </div>
          )}
        </main>
      </div>

      <aside className={`fixed md:relative inset-y-0 right-0 w-full md:w-[450px] bg-white z-[60] border-l border-slate-200 transition-all duration-500 shadow-2xl md:shadow-none flex flex-col ${isMobileMenuOpen ? 'translate-x-0' : 'translate-x-full md:translate-x-0'}`}>
        <SummaryPanel
          status={status}
          summary={summary}
          onGenerate={handleGenerateSummary}
          onFileUpload={handleFileUpload}
          documents={documents}
          onRemoveDocument={(id: string) => setDocuments((d: RagDocument[]) => d.filter((item: RagDocument) => item.id !== id))}
          onClose={() => setIsMobileMenuOpen(false)}
        />
      </aside>
    </div>
  );
};

export default App;

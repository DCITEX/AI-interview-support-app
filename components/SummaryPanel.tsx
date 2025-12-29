import React, { useState } from 'react';
import { TEMPLATES } from '../constants';
import { RagDocument, AppStatus } from '../types';
import { FileText, Sparkles, Download, Copy, Trash2, Loader2, UploadCloud, ChevronLeft, X, FileSearch, Video, Image as ImageIcon, CheckCircle2 } from 'lucide-react';

interface SummaryPanelProps {
  status: AppStatus;
  summary: string;
  onGenerate: (templateId: string, customInstruction: string) => void;
  onFileUpload: (files: FileList) => void;
  documents: RagDocument[];
  onRemoveDocument: (id: string) => void;
  onClose?: () => void;
}

const SummaryPanel: React.FC<SummaryPanelProps> = ({
  status,
  summary,
  onGenerate,
  onFileUpload,
  documents,
  onRemoveDocument,
  onClose
}) => {
  const [selectedTemplate, setSelectedTemplate] = useState(TEMPLATES[0].id);
  const [customInstruction, setCustomInstruction] = useState('');

  const isGenerating = status === AppStatus.PROCESSING;
  const hasSummary = summary.length > 0;

  const handleCopy = () => {
    navigator.clipboard.writeText(summary);
    alert('コピーしました');
  };

  const getDocIcon = (mime: string) => {
    if (mime === 'application/pdf') return <FileSearch size={16} className="text-red-500" />;
    if (mime.startsWith('video/')) return <Video size={16} className="text-purple-500" />;
    if (mime.startsWith('image/')) return <ImageIcon size={16} className="text-blue-500" />;
    return <FileText size={16} className="text-indigo-500" />;
  };

  return (
    <div className="h-full flex flex-col bg-white overflow-hidden">
      {/* Panel Header */}
      <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/30">
        <div>
          <h2 className="text-xl font-black text-slate-800 tracking-tight flex items-center gap-2">
            <Sparkles size={24} className="text-indigo-600" /> AI ANALYSIS
          </h2>
          <p className="text-[10px] font-bold text-slate-400 tracking-widest uppercase mt-1">Report Generation</p>
        </div>
        {onClose && (
          <button onClick={onClose} className="md:hidden p-2 text-slate-400 hover:bg-slate-100 rounded-full transition-colors">
            <X size={24} />
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-8 scroll-smooth">
        {/* RAG Documents Card */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-black text-slate-700 tracking-tight uppercase">分析参照資料</h3>
            <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">RAG ACTIVE</span>
          </div>
          
          <div className="grid grid-cols-1 gap-2">
            {documents.map(doc => (
              <div key={doc.id} className="flex items-center justify-between p-3 rounded-xl border border-slate-100 bg-slate-50 transition-all hover:border-indigo-200 group">
                <div className="flex items-center gap-3 overflow-hidden">
                  <div className="p-2 bg-white rounded-lg shadow-sm">{getDocIcon(doc.type)}</div>
                  <span className="text-xs font-bold text-slate-600 truncate">{doc.name}</span>
                </div>
                <button onClick={() => onRemoveDocument(doc.id)} className="p-2 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
            
            <label className="relative flex flex-col items-center justify-center p-6 border-2 border-dashed border-slate-200 rounded-2xl hover:bg-slate-50 hover:border-indigo-300 transition-all cursor-pointer">
              <input type="file" multiple accept=".txt,.md,.pdf,.mp4,.mov,.jpg,.png,.webp" onChange={(e) => e.target.files && onFileUpload(e.target.files)} className="hidden" />
              <UploadCloud size={32} className="text-slate-300 mb-2" />
              <span className="text-[11px] font-bold text-slate-400">PDF・動画・テキストを追加</span>
            </label>
          </div>
        </section>

        {/* Templates Selection */}
        <section className="space-y-4">
          <h3 className="text-sm font-black text-slate-700 tracking-tight uppercase">要約テンプレート</h3>
          <div className="grid grid-cols-1 gap-3">
            {TEMPLATES.map((t) => (
              <button
                key={t.id}
                onClick={() => setSelectedTemplate(t.id)}
                className={`relative p-4 rounded-2xl border text-left transition-all ${
                  selectedTemplate === t.id 
                    ? 'bg-indigo-600 border-indigo-600 text-white shadow-xl shadow-indigo-100' 
                    : 'bg-white border-slate-100 text-slate-600 hover:border-indigo-200'
                }`}
              >
                <div className="flex justify-between items-start">
                  <span className="text-sm font-black">{t.name}</span>
                  {selectedTemplate === t.id && <CheckCircle2 size={16} className="text-indigo-200" />}
                </div>
                <p className={`text-[10px] mt-2 font-medium leading-relaxed ${selectedTemplate === t.id ? 'text-indigo-100' : 'text-slate-400'}`}>
                  {t.description}
                </p>
              </button>
            ))}
          </div>
        </section>

        {/* Custom Instructions */}
        <section className="space-y-4">
          <h3 className="text-sm font-black text-slate-700 tracking-tight uppercase">分析フォーカス</h3>
          <textarea
            value={customInstruction}
            onChange={(e) => setCustomInstruction(e.target.value)}
            className="w-full text-sm border-slate-200 rounded-2xl p-4 focus:ring-4 focus:ring-indigo-50 transition-all min-h-[120px] bg-slate-50/50 !text-slate-900 placeholder-slate-300"
            placeholder="例: 「強み」の項目を重点的に分析し、具体的な就労先を提案して"
          />
        </section>

        {/* Action Button */}
        <div className="sticky bottom-0 pt-4 bg-gradient-to-t from-white via-white to-transparent">
          <button
            onClick={() => onGenerate(selectedTemplate, customInstruction)}
            disabled={isGenerating || status === AppStatus.RECORDING}
            className={`w-full py-5 rounded-2xl font-black text-sm tracking-widest uppercase flex items-center justify-center gap-3 transition-all shadow-xl ${
              isGenerating || status === AppStatus.RECORDING
                ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-200'
            }`}
          >
            {isGenerating ? <><Loader2 className="animate-spin" size={20} /> ANALYZING...</> : <><Sparkles size={20} /> 報告書を生成する</>}
          </button>
        </div>

        {/* Result Preview */}
        {hasSummary && (
          <section className="mt-10 space-y-4 animate-in fade-in slide-in-from-bottom-6 duration-700 pb-20">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-black text-slate-700 tracking-tight uppercase">生成された報告書</h3>
              <button onClick={handleCopy} className="text-indigo-600 hover:text-indigo-800 flex items-center gap-1 text-[11px] font-bold">
                <Copy size={14} /> CLIPBOARD
              </button>
            </div>
            <div className="p-6 bg-slate-900 text-slate-100 rounded-3xl text-sm leading-relaxed whitespace-pre-wrap font-mono shadow-inner min-h-[400px]">
              {summary}
            </div>
          </section>
        )}
      </div>
    </div>
  );
};

export default SummaryPanel;
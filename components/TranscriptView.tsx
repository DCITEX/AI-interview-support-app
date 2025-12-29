
import React, { useRef, useEffect } from 'react';
import { TranscriptItem } from '../types';
import { User, ShieldCheck, Sparkles, MessageSquare, Clock } from 'lucide-react';

interface TranscriptViewProps {
  transcripts: TranscriptItem[];
  onEdit: (id: string, newText: string) => void;
  isRecording: boolean;
}

const TranscriptView: React.FC<TranscriptViewProps> = ({ 
  transcripts, 
  onEdit, 
  isRecording,
}) => {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [transcripts]);

  const getSpeakerStyle = (speaker: string) => {
    if (speaker === 'Staff' || speaker.includes('支援員')) {
      return {
        bg: 'bg-indigo-600',
        border: 'border-indigo-100',
        light: 'bg-indigo-50',
        icon: <ShieldCheck size={18} />,
        label: '支援員 / Staff'
      };
    }
    if (speaker === 'Client' || speaker.includes('利用者')) {
      return {
        bg: 'bg-emerald-600',
        border: 'border-emerald-100',
        light: 'bg-emerald-50',
        icon: <User size={18} />,
        label: '利用者 / Client'
      };
    }
    return {
      bg: 'bg-slate-500',
      border: 'border-slate-100',
      light: 'bg-slate-50',
      icon: <MessageSquare size={18} />,
      label: speaker
    };
  };

  if (transcripts.length === 0 && !isRecording) {
    return (
      <div className="absolute inset-0 flex items-center justify-center p-8 z-10">
        <div className="max-w-md w-full text-center animate-in fade-in zoom-in duration-700">
          <div className="relative inline-block mb-8">
            <div className="absolute inset-0 bg-indigo-200 blur-3xl opacity-30 animate-pulse"></div>
            <div className="relative w-28 h-28 bg-white rounded-[2.5rem] flex items-center justify-center shadow-2xl shadow-indigo-100 border border-slate-50 animate-float">
              <MessageSquare size={48} className="text-indigo-500" />
            </div>
            <div className="absolute -bottom-2 -right-2 w-10 h-10 bg-indigo-600 rounded-full flex items-center justify-center text-white shadow-lg">
              <Sparkles size={18} />
            </div>
          </div>
          <h3 className="text-2xl font-black text-slate-800 mb-3 tracking-tight">面談を開始してください</h3>
          <p className="text-slate-500 text-sm leading-relaxed font-medium">
            「面談を開始」ボタンを押すと、AIがリアルタイムで音声を書き起こし、終了後に自動で話者分離を行います。
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto custom-scrollbar p-6 md:p-12 space-y-8 h-full">
      <div className="max-w-3xl mx-auto space-y-8 pb-32">
        {transcripts.map((item) => {
          const style = getSpeakerStyle(item.speaker);
          
          return (
            <div key={item.id} className="flex gap-5 animate-in fade-in slide-in-from-bottom-6 duration-500 group">
              <div className={`flex-shrink-0 w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg ${style.bg} text-white transition-all group-hover:scale-110 group-hover:rotate-3`}>
                {style.icon}
              </div>
              <div className="flex flex-col flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-2 px-1">
                  <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest">
                    {style.label}
                  </span>
                  <div className="h-px w-4 bg-slate-200"></div>
                  <div className="flex items-center gap-1 text-[10px] text-slate-300 font-bold uppercase tracking-tighter">
                    <Clock size={10} />
                    {item.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
                <div className={`relative p-5 rounded-[1.5rem] border bg-white shadow-sm transition-all group-hover:shadow-md ${style.border}`}>
                  <textarea
                    value={item.text}
                    onChange={(e) => onEdit(item.id, e.target.value)}
                    className="w-full bg-transparent border-none resize-none focus:ring-0 p-0 text-[16px] leading-relaxed text-slate-800 font-medium placeholder-slate-300"
                    rows={Math.max(1, Math.ceil(item.text.length / 40))}
                  />
                  {!item.isFinal && (
                    <div className="absolute -bottom-6 left-2 flex items-center gap-2 text-[10px] text-indigo-500 font-black italic animate-pulse">
                      <div className="flex gap-1">
                        <span className="w-1 h-1 bg-indigo-500 rounded-full"></span>
                        <span className="w-1 h-1 bg-indigo-500 rounded-full delay-75"></span>
                        <span className="w-1 h-1 bg-indigo-500 rounded-full delay-150"></span>
                      </div>
                      AI LISTENING...
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
        
        {isRecording && (
          <div className="flex flex-col items-center justify-center py-16 gap-6">
            <div className="flex gap-2 items-end h-12">
              {[...Array(15)].map((_, i) => (
                <div 
                  key={i} 
                  className="w-2 bg-indigo-500 rounded-full animate-bounce" 
                  style={{ 
                    height: `${30 + Math.random() * 70}%`,
                    animationDelay: `${i * 0.05}s`,
                    animationDuration: '0.8s'
                  }} 
                />
              ))}
            </div>
            <div className="bg-indigo-50 text-indigo-600 px-4 py-1 rounded-full text-[10px] font-black tracking-[0.3em] uppercase animate-pulse">
              Active Audio Stream
            </div>
          </div>
        )}
        
        <div ref={bottomRef} className="h-4" />
      </div>
    </div>
  );
};

export default TranscriptView;

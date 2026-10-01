import React, { useState } from 'react';
import type { ChatMessage as ChatMessageType } from '../../types';
import { EvidencePanel } from '../common/EvidencePanel';
import { QueryRoutingBreakdown } from './QueryRoutingBreakdown';
import { WhyThisAnswerDrawer } from './WhyThisAnswerDrawer';
import { voiceService } from '../../services/voiceService';
import { 
  Volume2, 
  Copy, 
  Share2, 
  Check, 
  AlertTriangle,
  User,
  Sparkles,
  ShieldCheck
} from 'lucide-react';

interface ChatMessageProps {
  message: ChatMessageType;
}

export const ChatMessage: React.FC<ChatMessageProps> = ({ message }) => {
  const [copied, setCopied] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [showWhyDrawer, setShowWhyDrawer] = useState(false);

  const isUser = message.sender === 'user';

  const handleCopy = () => {
    navigator.clipboard.writeText(message.text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleListen = () => {
    if (isSpeaking) {
      voiceService.stopSpeaking();
      setIsSpeaking(false);
    } else {
      setIsSpeaking(true);
      const lang = message.language === 'Hinglish' || message.language === 'Hindi' ? 'hi-IN' : 'en-IN';
      voiceService.speak(message.text, lang, () => setIsSpeaking(false));
    }
  };

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({
        title: 'MeteoFusion Intelligence',
        text: message.text,
      }).catch(() => {});
    } else {
      handleCopy();
    }
  };

  if (isUser) {
    return (
      <div className="flex justify-end my-3">
        <div className="flex items-start gap-2.5 max-w-xl">
          <div className="bg-[#1557B0] text-white p-4 rounded-2xl rounded-tr-xs shadow-xs text-sm">
            <p className="leading-relaxed">{message.text}</p>
            <span className="text-[10px] text-blue-200 mt-1 block text-right font-mono-stat">{message.timestamp}</span>
          </div>
          <div className="w-8 h-8 rounded-full bg-[#DCEEFF] border border-[#BFDBFE] flex items-center justify-center text-[#1557B0] shrink-0">
            <User className="w-4 h-4" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex justify-start my-4">
      <div className="flex items-start gap-3 max-w-2xl w-full">
        <div className="w-9 h-9 rounded-2xl bg-gradient-to-br from-[#1557B0] to-[#3B82F6] flex items-center justify-center text-white shrink-0 shadow-xs mt-0.5">
          <Sparkles className="w-4 h-4" />
        </div>

        <div className="space-y-3 flex-1 min-w-0">
          {/* Main Answer Bubble */}
          <div
            className={`p-5 rounded-3xl rounded-tl-xs shadow-xs text-sm space-y-3.5 border ${
              message.status === 'abstain' || message.status === 'clarify'
                ? 'bg-amber-50/60 border-amber-200 text-[#0F2742]'
                : 'bg-white border-[#D7E7F5] text-[#0F2742]'
            }`}
          >
            {message.isSample && (
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-[11px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                <AlertTriangle className="w-3.5 h-3.5" /> SAMPLE DEMO DATA — not a live source
              </div>
            )}

            {/* Official alerts take precedence and are surfaced first. */}
            {(() => {
              const alertList =
                message.alerts && message.alerts.length > 0
                  ? message.alerts
                  : message.activeAlert
                  ? [message.activeAlert]
                  : [];
              if (!alertList.length) return null;
              const isSample = alertList.every((a) => a?.isSample);
              return (
                <div className="space-y-2">
                  <div
                    className={`${
                      isSample
                        ? 'bg-amber-50 border-amber-300 text-amber-900'
                        : 'bg-rose-50 border-rose-300 text-rose-900'
                    } border p-3.5 rounded-2xl flex items-start gap-2.5 text-xs font-medium`}
                  >
                    <AlertTriangle
                      className={`w-4 h-4 ${isSample ? 'text-amber-600' : 'text-rose-600'} shrink-0 mt-0.5`}
                    />
                    <div>
                      <strong className={`block font-bold ${isSample ? 'text-amber-700' : 'text-rose-700'}`}>
                        {isSample
                          ? 'SAMPLE / FIXTURE ALERT — recorded demo data, NOT a live official alert'
                          : 'OFFICIAL NDMA / SACHET ALERT ACTIVE — outranks model weather'}
                      </strong>
                      {alertList
                        .filter(Boolean)
                        .map((alert, i) => (
                          <span key={i} className="block mt-1">
                            <strong>{alert!.title}</strong> — {alert!.officialMessage}
                            {alert!.instruction && (
                              <span className="block mt-1 italic">
                                Official instruction: “{alert!.instruction}”
                              </span>
                            )}
                          </span>
                        ))}
                    </div>
                  </div>
                </div>
              );
            })()}

            {(message.status === 'abstain' || message.status === 'clarify') && (
              <div className="flex items-center gap-2 text-amber-800 text-xs font-bold">
                <AlertTriangle className="w-4 h-4" />
                {message.status === 'abstain'
                  ? 'MeteoFusion abstained rather than guess:'
                  : 'Clarification needed:'}
              </div>
            )}

            <p className="leading-relaxed font-normal text-sm text-[#0F2742]">{message.text}</p>

            {/* Action Bar (Listen, Copy, Share, Why this answer?) */}
            <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-[#D7E7F5] text-xs">
              <button
                onClick={handleListen}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl transition-colors font-medium ${
                  isSpeaking ? 'bg-[#1557B0] text-white' : 'bg-[#F5FAFF] text-[#0F2742] hover:bg-[#DCEEFF]'
                }`}
              >
                <Volume2 className="w-3.5 h-3.5 text-[#3B82F6]" />
                <span>{isSpeaking ? 'Stop' : 'Listen'}</span>
              </button>

              <button
                onClick={handleCopy}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#F5FAFF] text-[#0F2742] hover:bg-[#DCEEFF] transition-colors font-medium"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-[#5D7188]" />}
                <span>{copied ? 'Copied' : 'Copy'}</span>
              </button>

              <button
                onClick={handleShare}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#F5FAFF] text-[#0F2742] hover:bg-[#DCEEFF] transition-colors font-medium"
              >
                <Share2 className="w-3.5 h-3.5 text-[#5D7188]" />
                <span>Share</span>
              </button>

              {message.evidence && (
                <button
                  onClick={() => setShowWhyDrawer(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#DCEEFF] text-[#1557B0] font-bold hover:bg-[#BFDBFE] transition-colors ml-auto shadow-2xs"
                >
                  <ShieldCheck className="w-3.5 h-3.5 text-[#3B82F6]" />
                  <span>Why this answer?</span>
                </button>
              )}
            </div>
          </div>

          {/* Structured Weather Evidence beneath answer */}
          {message.evidence && message.evidence.temperature != null && (
            <EvidencePanel evidence={message.evidence} compact />
          )}

          {/* Technical routing / grounding breakdown */}
          {message.queryAnalysis && <QueryRoutingBreakdown analysis={message.queryAnalysis} />}
        </div>
      </div>

      {/* Why This Answer Evidence Drawer Modal */}
      {showWhyDrawer && message.evidence && (
        <WhyThisAnswerDrawer evidence={message.evidence} onClose={() => setShowWhyDrawer(false)} />
      )}
    </div>
  );
};

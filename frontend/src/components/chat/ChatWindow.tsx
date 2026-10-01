import React, { useRef, useEffect } from 'react';
import { useWeatherStore } from '../../store/useWeatherStore';
import { ChatMessage } from './ChatMessage';
import { ChatInput } from './ChatInput';
import { askWeatherGPT } from '../../services/chatService';
import { Sparkles, Trash2, Bot } from 'lucide-react';

export const ChatWindow: React.FC = () => {
  const { messages, addMessage, clearChat, currentLocation, preferences, sessionId } =
    useWeatherStore();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [isLoading, setIsLoading] = React.useState(false);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  const handleSend = async (userQuery: string) => {
    addMessage({
      sender: 'user',
      text: userQuery,
    });

    setIsLoading(true);

    try {
      const res = await askWeatherGPT(
        userQuery,
        `${currentLocation.name}, ${currentLocation.state}`,
        preferences.language,
        preferences.demoMode,
        undefined,
        sessionId,
      );

      addMessage({
        sender: 'assistant',
        text: res.message,
        queryAnalysis: res.queryAnalysis,
        evidence: res.evidence,
        activeAlert: res.activeAlert,
        alerts: res.alerts,
        advisory: res.view?.advisory,
        status: res.view?.status,
        abstainReason: res.view?.abstainReason,
        clarification: res.view?.clarification,
        isSample: res.isSample,
      });
    } catch {
      addMessage({
        sender: 'assistant',
        text: 'Sorry — the MeteoFusion backend could not be reached and no cached answer is available. Please check your connection and try again.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100dvh-13.5rem)] sm:h-[calc(100vh-10rem)] min-h-[440px] bg-white/90 backdrop-blur-md border border-[#D7E7F5] rounded-2xl shadow-xs overflow-hidden">
      {/* Chat Header */}
      <div className="px-3.5 sm:px-5 py-3 sm:py-3.5 border-b border-[#D7E7F5] bg-[#F5FAFF]/80 flex items-center justify-between">
        <div className="flex items-center gap-2.5 sm:gap-3">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-[#1557B0] to-[#3B82F6] text-white flex items-center justify-center shadow-xs shrink-0">
            <Bot className="w-4 h-4" />
          </div>
          <div>
            <h2 className="font-bold text-xs sm:text-sm text-[#0F2742]">MeteoFusion Intelligence</h2>
            <p className="text-[10px] sm:text-[11px] text-[#5D7188]">Grounded Multi-Model Atmospheric Reasoning</p>
          </div>
        </div>

        <button
          onClick={clearChat}
          className="p-2 rounded-xl text-[#5D7188] hover:bg-[#DCEEFF]/50 hover:text-red-600 transition-colors touch-manipulation"
          title="Clear Chat History"
          aria-label="Clear Chat History"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto p-3 sm:p-4 lg:p-6 space-y-3 sm:space-y-4">
        {messages.map((msg) => (
          <ChatMessage key={msg.id} message={msg} />
        ))}

        {isLoading && (
          <div className="flex justify-start my-3">
            <div className="bg-[#DCEEFF]/40 border border-[#3B82F6]/30 p-3 sm:p-3.5 rounded-2xl rounded-tl-xs text-xs text-[#1557B0] flex items-center gap-2">
              <Sparkles className="w-4 h-4 animate-spin text-[#06B6D4] shrink-0" />
              <span className="font-medium">Synthesizing meteorological evidence, verifying alert registries…</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-3 sm:p-4 border-t border-[#D7E7F5] bg-white">
        <ChatInput onSend={handleSend} isLoading={isLoading} />
      </div>
    </div>
  );
};

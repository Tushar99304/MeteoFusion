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
        text: 'Sorry — the WeatherGPT backend could not be reached and no cached answer is available. Please check your connection and try again.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-8.5rem)] bg-white border border-[#DCEAE2] rounded-2xl shadow-xs overflow-hidden">
      {/* Chat Header */}
      <div className="px-5 py-3.5 border-b border-[#DCEAE2] bg-[#F7FBF8] flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-[#2E7D5B] text-white flex items-center justify-center">
            <Bot className="w-4 h-4" />
          </div>
          <div>
            <h2 className="font-bold text-sm text-[#17352A]">WeatherGPT Intelligence</h2>
            <p className="text-[11px] text-[#6B7D74]">Grounded Conversational Weather Support</p>
          </div>
        </div>

        <button
          onClick={clearChat}
          className="p-1.5 rounded-lg text-[#6B7D74] hover:bg-[#E8F5EE] hover:text-red-600 transition-colors"
          title="Clear Chat History"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto p-4 lg:p-6 space-y-4">
        {messages.map((msg) => (
          <ChatMessage key={msg.id} message={msg} />
        ))}

        {isLoading && (
          <div className="flex justify-start my-3">
            <div className="bg-[#E8F5EE] border border-[#6BAF92]/30 p-3.5 rounded-2xl rounded-tl-xs text-xs text-[#2E7D5B] flex items-center gap-2">
              <Sparkles className="w-4 h-4 animate-spin" />
              <span>Retrieving weather evidence, checking official alerts & validating…</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-4 border-t border-[#DCEAE2] bg-white">
        <ChatInput onSend={handleSend} isLoading={isLoading} />
      </div>
    </div>
  );
};

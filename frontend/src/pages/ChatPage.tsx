import React, { useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ChatWindow } from '../components/chat/ChatWindow';
import { useWeatherStore } from '../store/useWeatherStore';
import { askWeatherGPT } from '../services/chatService';

export const ChatPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const query = searchParams.get('q');
  const { addMessage, currentLocation, preferences, sessionId } = useWeatherStore();
  const handledRef = useRef<string | null>(null);

  useEffect(() => {
    if (!query || handledRef.current === query) return;
    handledRef.current = query;

    addMessage({ sender: 'user', text: query });

    void askWeatherGPT(
      query,
      `${currentLocation.name}, ${currentLocation.state}`,
      preferences.language,
      preferences.demoMode,
      undefined,
      sessionId,
    )
      .then((res) => {
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
      })
      .catch(() => {
        addMessage({
          sender: 'assistant',
          text: 'Sorry — the WeatherGPT backend could not be reached. Please try again when connectivity is restored; I will not invent weather data.',
        });
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-[#17352A]">WeatherGPT Conversational Assistant</h1>
        <p className="text-xs text-[#6B7D74]">
          Answers are grounded in retrieved evidence (Open-Meteo model data + official NDMA/SACHET
          alerts). If evidence is insufficient the assistant abstains or asks for clarification — it
          never guesses.
        </p>
      </div>

      <ChatWindow />
    </div>
  );
};

import React, { useState } from 'react';
import type { QueryAnalysis } from '../../types';
import { ChevronDown, ChevronUp, Cpu, MapPin, Calendar, Languages } from 'lucide-react';

interface QueryRoutingBreakdownProps {
  analysis: QueryAnalysis;
}

export const QueryRoutingBreakdown: React.FC<QueryRoutingBreakdownProps> = ({ analysis }) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="border border-[#DCEAE2] rounded-xl overflow-hidden bg-[#F7FBF8] text-xs">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-3 py-2 flex items-center justify-between text-[#6B7D74] hover:bg-[#E8F5EE] transition-colors"
      >
        <span className="flex items-center gap-1.5 font-medium text-[#17352A]">
          <Cpu className="w-3.5 h-3.5 text-[#2E7D5B]" />
          How WeatherGPT understood your question
        </span>
        {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
      </button>

      {isOpen && (
        <div className="p-3 border-t border-[#DCEAE2] bg-white space-y-2 text-[#17352A] animate-in fade-in duration-150">
          <div className="grid grid-cols-2 gap-2 text-[11px]">
            <div className="flex items-center gap-1.5 bg-[#F7FBF8] p-2 rounded-lg border border-[#DCEAE2]">
              <Cpu className="w-3.5 h-3.5 text-[#2E7D5B]" />
              <span>Intent: <strong>{analysis.intent}</strong></span>
            </div>

            <div className="flex items-center gap-1.5 bg-[#F7FBF8] p-2 rounded-lg border border-[#DCEAE2]">
              <MapPin className="w-3.5 h-3.5 text-[#2E7D5B]" />
              <span>Location: <strong>{analysis.location}</strong></span>
            </div>

            <div className="flex items-center gap-1.5 bg-[#F7FBF8] p-2 rounded-lg border border-[#DCEAE2]">
              <Calendar className="w-3.5 h-3.5 text-[#2E7D5B]" />
              <span>Timeframe: <strong>{analysis.timeframe}</strong></span>
            </div>

            <div className="flex items-center gap-1.5 bg-[#F7FBF8] p-2 rounded-lg border border-[#DCEAE2]">
              <Languages className="w-3.5 h-3.5 text-[#2E7D5B]" />
              <span>Language: <strong>{analysis.language}</strong></span>
            </div>
          </div>

          {analysis.topicLabel && (
            <div className="flex items-center gap-1.5 bg-[#F7FBF8] p-2 rounded-lg border border-[#DCEAE2]">
              <Cpu className="w-3.5 h-3.5 text-[#2E7D5B]" />
              <span>Topic: <strong>{analysis.topicLabel}</strong></span>
            </div>
          )}

          <div className="flex items-center justify-between text-[11px] text-[#6B7D74] pt-1 flex-wrap gap-1">
            <span>Sources: <strong>{analysis.dataSourcesUsed.join(' + ')}</strong></span>
            <span
              className={`font-semibold ${
                analysis.validationStatus === 'ABSTAINED' || analysis.validationStatus === 'CLARIFICATION_NEEDED'
                  ? 'text-amber-700'
                  : analysis.validationStatus === 'SAMPLE_DATA'
                  ? 'text-amber-600'
                  : 'text-[#2E7D5B]'
              }`}
            >
              Status: {analysis.validationStatus.replace(/_/g, ' ')}
            </span>
          </div>

          {analysis.contextUsed && analysis.contextUsed.length > 0 && (
            <div className="text-[10px] text-[#2E7D5B] bg-[#E8F5EE] border border-[#BFE3D2] rounded-lg px-2 py-1">
              Conversation context reused: <strong>{analysis.contextUsed.join(', ')}</strong> from your
              previous message — you don’t need to repeat the city or day.
            </div>
          )}

          <div className="text-[10px] text-[#6B7D74] pt-1 border-t border-[#DCEAE2] mt-1">
            Answer origin: <strong>{analysis.answerOrigin === 'groq_llm' ? 'LLM (grounded & verified)' : analysis.answerOrigin === 'deterministic_fallback' ? 'Deterministic evidence-based fallback' : '—'}</strong>
            {analysis.groundingVerified != null && (
              <> · grounding <strong>{analysis.groundingVerified ? 'verified' : 'not verified'}</strong></>
            )}
            {analysis.groundingNote ? ` · ${analysis.groundingNote}` : ''}
          </div>
        </div>
      )}
    </div>
  );
};

import React, { useState } from 'react';
import type { QueryAnalysis } from '../../types';
import { ChevronDown, ChevronUp, Cpu, MapPin, Calendar, Languages } from 'lucide-react';

interface QueryRoutingBreakdownProps {
  analysis: QueryAnalysis;
}

export const QueryRoutingBreakdown: React.FC<QueryRoutingBreakdownProps> = ({ analysis }) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="border border-[#D7E7F5] rounded-xl overflow-hidden bg-[#F5FAFF] text-xs">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-3.5 py-2 flex items-center justify-between text-[#5D7188] hover:bg-[#DCEEFF]/30 transition-colors"
      >
        <span className="flex items-center gap-1.5 font-medium text-[#0F2742]">
          <Cpu className="w-3.5 h-3.5 text-[#3B82F6]" />
          How MeteoFusion parsed & routed your query
        </span>
        {isOpen ? <ChevronUp className="w-4 h-4 text-[#5D7188]" /> : <ChevronDown className="w-4 h-4 text-[#5D7188]" />}
      </button>

      {isOpen && (
        <div className="p-3.5 border-t border-[#D7E7F5] bg-white space-y-2.5 text-[#0F2742] animate-in fade-in duration-150">
          <div className="grid grid-cols-2 gap-2 text-[11px]">
            <div className="flex items-center gap-1.5 bg-[#F5FAFF] p-2 rounded-lg border border-[#D7E7F5]">
              <Cpu className="w-3.5 h-3.5 text-[#3B82F6]" />
              <span>Intent: <strong>{analysis.intent}</strong></span>
            </div>

            <div className="flex items-center gap-1.5 bg-[#F5FAFF] p-2 rounded-lg border border-[#D7E7F5]">
              <MapPin className="w-3.5 h-3.5 text-[#3B82F6]" />
              <span>Location: <strong>{analysis.location}</strong></span>
            </div>

            <div className="flex items-center gap-1.5 bg-[#F5FAFF] p-2 rounded-lg border border-[#D7E7F5]">
              <Calendar className="w-3.5 h-3.5 text-[#3B82F6]" />
              <span>Timeframe: <strong>{analysis.timeframe}</strong></span>
            </div>

            <div className="flex items-center gap-1.5 bg-[#F5FAFF] p-2 rounded-lg border border-[#D7E7F5]">
              <Languages className="w-3.5 h-3.5 text-[#3B82F6]" />
              <span>Language: <strong>{analysis.language}</strong></span>
            </div>
          </div>

          {analysis.topicLabel && (
            <div className="flex items-center gap-1.5 bg-[#F5FAFF] p-2 rounded-lg border border-[#D7E7F5]">
              <Cpu className="w-3.5 h-3.5 text-[#3B82F6]" />
              <span>Topic: <strong>{analysis.topicLabel}</strong></span>
            </div>
          )}

          <div className="flex items-center justify-between text-[11px] text-[#5D7188] pt-1 flex-wrap gap-1">
            <span>Sources: <strong>{analysis.dataSourcesUsed.join(' + ')}</strong></span>
            <span
              className={`font-semibold ${
                analysis.validationStatus === 'ABSTAINED' || analysis.validationStatus === 'CLARIFICATION_NEEDED'
                  ? 'text-amber-700'
                  : analysis.validationStatus === 'SAMPLE_DATA'
                  ? 'text-amber-600'
                  : 'text-[#1557B0]'
              }`}
            >
              Status: {analysis.validationStatus.replace(/_/g, ' ')}
            </span>
          </div>

          {analysis.contextUsed && analysis.contextUsed.length > 0 && (
            <div className="text-[10px] text-[#1557B0] bg-[#DCEEFF]/40 border border-[#3B82F6]/30 rounded-lg px-2.5 py-1.5">
              Conversation context reused: <strong>{analysis.contextUsed.join(', ')}</strong> from your
              previous query — consistent coordinate grounding preserved.
            </div>
          )}

          <div className="text-[10px] text-[#5D7188] pt-1.5 border-t border-[#D7E7F5] mt-1 font-mono">
            Origin: <strong>{analysis.answerOrigin === 'groq_llm' ? 'LLM (grounded & verified)' : analysis.answerOrigin === 'deterministic_fallback' ? 'Deterministic evidence-based fallback' : '—'}</strong>
            {analysis.groundingVerified != null && (
              <> · Grounding <strong>{analysis.groundingVerified ? 'verified' : 'not verified'}</strong></>
            )}
            {analysis.groundingNote ? ` · ${analysis.groundingNote}` : ''}
          </div>
        </div>
      )}
    </div>
  );
};

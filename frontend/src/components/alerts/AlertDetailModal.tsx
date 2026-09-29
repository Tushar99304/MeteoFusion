import React from 'react';
import type { WeatherAlert } from '../../types';
import { SourceBadge } from '../common/SourceBadge';
import { X, ShieldAlert, CheckCircle2, MapPin, Clock, Quote, ExternalLink } from 'lucide-react';

interface AlertDetailModalProps {
  alert: WeatherAlert;
  onClose: () => void;
}

export const AlertDetailModal: React.FC<AlertDetailModalProps> = ({ alert, onClose }) => {
  const expired = alert.validity === 'expired';
  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl border border-[#DCEAE2] space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-[#DCEAE2] pb-3">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-6 h-6 text-red-600" />
            <div>
              <span className="text-[10px] font-bold text-red-600 tracking-wider uppercase block">
                {expired ? 'Expired alert record' : 'Official NDMA / SACHET alert'}
              </span>
              <h3 className="font-bold text-base text-[#17352A]">{alert.title}</h3>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-[#6B7D74] hover:bg-[#E8F5EE] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {expired && (
          <div className="bg-gray-100 text-gray-700 border border-gray-300 rounded-xl p-3 text-xs font-semibold">
            This alert is EXPIRED. It is shown for transparency only and is not current guidance.
          </div>
        )}

        <div className="flex items-center justify-between bg-[#F7FBF8] p-3 rounded-xl border border-[#DCEAE2] text-xs">
          <div className="flex items-center gap-2">
            <MapPin className="w-4 h-4 text-[#2E7D5B]" />
            <span>
              Affected: <strong>{alert.affectedArea}</strong>
            </span>
          </div>
          <SourceBadge source={alert.source} size="sm" />
        </div>

        {(alert.event || alert.category) && (
          <div className="text-xs text-[#6B7D74] flex flex-wrap gap-3">
            {alert.event && (
              <span>
                Event: <strong className="text-[#17352A]">{alert.event}</strong>
              </span>
            )}
            {alert.category && (
              <span>
                Category: <strong className="text-[#17352A]">{alert.category}</strong>
              </span>
            )}
            {alert.severity && (
              <span>
                Severity: <strong className="text-[#17352A]">{alert.severity}</strong>
              </span>
            )}
          </div>
        )}

        {alert.officialMessage && (
          <div className="space-y-2">
            <h4 className="text-xs font-bold text-[#17352A] uppercase tracking-wider">
              Official bulletin (from the CAP record)
            </h4>
            <div className="bg-red-50/70 border border-red-200 text-red-950 p-4 rounded-xl text-xs leading-relaxed font-medium">
              {alert.officialMessage}
            </div>
          </div>
        )}

        {/* The authority's instruction is quoted VERBATIM, never rephrased by WeatherGPT. */}
        {alert.instruction && (
          <div className="space-y-2">
            <h4 className="text-xs font-bold text-[#17352A] uppercase tracking-wider flex items-center gap-1.5">
              <Quote className="w-3.5 h-3.5 text-red-600" /> Official instruction (quoted verbatim)
            </h4>
            <div className="bg-red-50/70 border border-red-200 text-red-950 p-4 rounded-xl text-xs leading-relaxed font-medium">
              “{alert.instruction}”
            </div>
            <p className="text-[10px] text-[#6B7D74]">
              This is the issuing authority's published instruction. WeatherGPT does not replace or
              override it; an official alert always outranks model-weather interpretation.
            </p>
          </div>
        )}

        {alert.relevanceReason && (
          <div className="bg-[#E8F5EE] border border-[#6BAF92]/40 p-3 rounded-xl text-xs text-[#17352A]">
            Why this alert is shown: {alert.relevanceReason}
            {alert.relevanceLevel ? ` (relevance: ${alert.relevanceLevel})` : ''}
          </div>
        )}

        {alert.recommendedActions && alert.recommendedActions.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-xs font-bold text-[#17352A] uppercase tracking-wider">
              Recommended actions (from the alert record)
            </h4>
            <div className="space-y-2">
              {alert.recommendedActions.map((action, idx) => (
                <div
                  key={idx}
                  className="flex items-start gap-2 text-xs text-[#17352A] bg-[#F7FBF8] p-2.5 rounded-lg border border-[#DCEAE2]"
                >
                  <CheckCircle2 className="w-4 h-4 text-[#2E7D5B] shrink-0 mt-0.5" />
                  <span>{action}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="bg-[#F7FBF8] p-3 rounded-xl border border-[#DCEAE2] text-xs text-[#6B7D74] flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Clock className="w-4 h-4 text-[#2E7D5B]" />
            <span>
              Issued: {alert.issueTime || '—'} | Expires: {alert.expiryTime || '—'}
            </span>
          </div>
          {alert.sourceUrl && (
            <a
              href={alert.sourceUrl}
              target="_blank"
              rel="noreferrer"
              className="text-[#2E7D5B] font-bold hover:underline inline-flex items-center gap-1"
            >
              Source record <ExternalLink className="w-3.5 h-3.5" />
            </a>
          )}
        </div>

        <div className="text-[11px] text-[#6B7D74] text-center pt-2">
          Source: NDMA SACHET / issuing authority. Always follow the latest official guidance from
          state and national disaster management authorities.
        </div>
      </div>
    </div>
  );
};

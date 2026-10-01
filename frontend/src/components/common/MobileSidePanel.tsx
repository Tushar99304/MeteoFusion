import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { 
  X, 
  MessageSquareText, 
  History, 
  Grid, 
  Sparkles, 
  Plus, 
  Trash2, 
  LayoutDashboard, 
  CalendarDays, 
  Map, 
  AlertTriangle, 
  Compass, 
  LineChart, 
  Mic, 
  Database, 
  Settings, 
  Cpu, 
  Layers, 
  Wifi, 
  WifiOff, 
  Languages, 
  ArrowRight,
  ShieldCheck,
  CloudSun
} from 'lucide-react';
import { useWeatherStore } from '../../store/useWeatherStore';

export const MobileSidePanel: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { 
    isMobileSidePanelOpen, 
    setMobileSidePanelOpen,
    messages,
    clearChat,
    currentLocation,
    preferences,
    setLanguage,
    toggleDemoMode,
    connection,
    sessionId
  } = useWeatherStore();

  const [activeTab, setActiveTab] = useState<'history' | 'features'>('history');

  // Close side panel on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isMobileSidePanelOpen) {
        setMobileSidePanelOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isMobileSidePanelOpen, setMobileSidePanelOpen]);

  // Prevent background scroll when side panel is open
  useEffect(() => {
    if (isMobileSidePanelOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isMobileSidePanelOpen]);

  if (!isMobileSidePanelOpen) return null;

  const userMessages = messages.filter((m) => m.sender === 'user');

  const handleNavigate = (path: string, hash?: string) => {
    setMobileSidePanelOpen(false);
    if (hash) {
      if (location.pathname !== '/') {
        navigate(`/${hash}`);
      } else {
        const elem = document.querySelector(hash);
        elem?.scrollIntoView({ behavior: 'smooth' });
      }
    } else {
      navigate(path);
    }
  };

  const handleSelectQuery = (queryText: string) => {
    setMobileSidePanelOpen(false);
    navigate(`/chat?q=${encodeURIComponent(queryText)}`);
  };

  const handleNewChat = () => {
    clearChat();
    setMobileSidePanelOpen(false);
    navigate('/chat');
  };

  const nextLanguage = () => {
    if (preferences.language === 'en') setLanguage('hi');
    else if (preferences.language === 'hi') setLanguage('mr');
    else setLanguage('en');
  };

  const langLabel = {
    en: 'EN',
    hi: 'हिन्दी',
    mr: 'मराठी',
  }[preferences.language] || 'EN';

  const quickPrompts = [
    `What is the weather in ${currentLocation.name} right now?`,
    `Will it rain in ${currentLocation.name} today?`,
    `Are there any active NDMA SACHET alerts?`,
    `Is it safe for highway driving today?`,
    `Show 7-day temperature & rain trends`,
  ];

  const featuresList = [
    {
      group: 'Meteorological Operations',
      items: [
        { label: 'Overview & Telemetry', path: '/', icon: LayoutDashboard },
        { label: '7-Day Forecast', path: '/forecast', icon: CalendarDays },
        { label: 'Weather Map & Pinpoint', path: '/map', icon: Map },
        { label: 'Model Intelligence', path: '/', hash: '#models', icon: Cpu },
        { label: 'Blending Engine Weights', path: '/', hash: '#engine', icon: Layers },
        { label: 'Risk & Official Alerts', path: '/alerts', icon: AlertTriangle, badge: 'SACHET' },
        { label: 'Sector Advisory', path: '/advisory', icon: Compass },
        { label: 'Climate Trends', path: '/climate', icon: LineChart },
      ],
    },
    {
      group: 'AI & Hands-Free Tools',
      items: [
        { label: 'AI Weather Assistant', path: '/chat', icon: MessageSquareText },
        { label: 'Voice Assistant', path: '/voice', icon: Mic },
      ],
    },
    {
      group: 'System & Verification',
      items: [
        { label: 'Sources & Evidence', path: '/sources', icon: Database },
        { label: 'Offline Center', path: '/offline', icon: WifiOff },
        { label: 'Settings & Preferences', path: '/settings', icon: Settings },
      ],
    },
  ];

  return (
    <div className="fixed inset-0 z-50 lg:hidden flex">
      {/* Dimmed Backdrop */}
      <div 
        className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity duration-300 animate-in fade-in"
        onClick={() => setMobileSidePanelOpen(false)}
        aria-hidden="true"
      />

      {/* Drawer Panel Container */}
      <div className="relative w-full max-w-[85vw] xs:max-w-[340px] sm:max-w-sm bg-white h-full shadow-2xl flex flex-col z-10 animate-in slide-in-from-left duration-300 border-r border-[#D7E7F5]">
        
        {/* Top Header */}
        <div className="p-4 border-b border-[#D7E7F5] bg-[#F5FAFF] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#1557B0] to-[#3B82F6] flex items-center justify-center text-white shadow-xs">
              <CloudSun className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-black text-sm text-[#0F2742] tracking-tight">MeteoFusion</span>
                <span className="text-[9px] font-bold px-1.5 py-0.2 rounded-full bg-[#1557B0] text-white">AI</span>
              </div>
              <p className="text-[10px] text-[#5D7188] font-medium">Mobile Intelligence Panel</p>
            </div>
          </div>

          <button
            onClick={() => setMobileSidePanelOpen(false)}
            className="p-2 rounded-xl text-[#5D7188] hover:text-[#0F2742] hover:bg-[#DCEEFF] transition-colors touch-manipulation min-h-[38px] min-w-[38px] flex items-center justify-center"
            aria-label="Close menu"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="px-3 pt-3 pb-2 bg-white border-b border-[#D7E7F5] flex items-center gap-2">
          <button
            onClick={() => setActiveTab('history')}
            className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'history'
                ? 'bg-[#1557B0] text-white shadow-xs'
                : 'bg-[#F5FAFF] text-[#5D7188] hover:text-[#0F2742] border border-[#D7E7F5]'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            <span>Chat History</span>
            {userMessages.length > 0 && (
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono-stat ${
                activeTab === 'history' ? 'bg-white/25 text-white' : 'bg-[#DCEEFF] text-[#1557B0]'
              }`}>
                {userMessages.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('features')}
            className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'features'
                ? 'bg-[#1557B0] text-white shadow-xs'
                : 'bg-[#F5FAFF] text-[#5D7188] hover:text-[#0F2742] border border-[#D7E7F5]'
            }`}
          >
            <Grid className="w-3.5 h-3.5" />
            <span>All Features</span>
          </button>
        </div>

        {/* Scrollable Content Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          
          {/* ---------------- TAB 1: CHAT HISTORY ---------------- */}
          {activeTab === 'history' && (
            <div className="space-y-4">
              {/* New Chat & Reset Bar */}
              <div className="flex items-center justify-between gap-2">
                <button
                  onClick={handleNewChat}
                  className="flex-1 py-2 px-3 rounded-xl bg-[#EBF5FF] hover:bg-[#DCEEFF] text-[#1557B0] border border-[#BFDBFE] text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow-2xs active:scale-[0.98]"
                >
                  <Plus className="w-4 h-4" />
                  <span>Start New Chat</span>
                </button>

                {userMessages.length > 0 && (
                  <button
                    onClick={clearChat}
                    title="Clear current session history"
                    className="p-2 rounded-xl text-rose-600 hover:bg-rose-50 border border-rose-200 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* Session ID Pill */}
              <div className="px-2.5 py-1.5 rounded-xl bg-[#F5FAFF] border border-[#D7E7F5] flex items-center justify-between text-[10px] text-[#5D7188] font-mono-stat">
                <span className="truncate">Session: {sessionId.slice(0, 16)}…</span>
                <span className="text-emerald-700 font-bold flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3 text-emerald-600" /> Grounded
                </span>
              </div>

              {/* History Query List */}
              {userMessages.length > 0 ? (
                <div className="space-y-2">
                  <div className="text-[10px] font-bold text-[#5D7188] uppercase tracking-wider px-1">
                    Previous Queries in This Session
                  </div>
                  {userMessages.map((msg, idx) => (
                    <button
                      key={msg.id || idx}
                      onClick={() => handleSelectQuery(msg.text)}
                      className="w-full text-left p-3 rounded-2xl bg-white hover:bg-[#F5FAFF] border border-[#D7E7F5] transition-all shadow-2xs group flex items-start justify-between gap-2"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-bold text-[#0F2742] truncate group-hover:text-[#1557B0]">
                          {msg.text}
                        </p>
                        <div className="flex items-center gap-2 mt-1 text-[10px] text-[#5D7188]">
                          <span>{msg.timestamp || 'Recent'}</span>
                          <span>•</span>
                          <span className="text-[#1557B0] font-semibold">Ask again</span>
                        </div>
                      </div>
                      <ArrowRight className="w-3.5 h-3.5 text-[#5D7188] group-hover:text-[#1557B0] group-hover:translate-x-0.5 transition-transform mt-0.5 shrink-0" />
                    </button>
                  ))}
                </div>
              ) : (
                /* Empty state when no chat messages */
                <div className="text-center py-4 px-2 space-y-2 bg-[#F5FAFF] rounded-2xl border border-[#D7E7F5]/70">
                  <Sparkles className="w-8 h-8 text-[#3B82F6] mx-auto opacity-80" />
                  <p className="text-xs font-bold text-[#0F2742]">No queries in this session yet</p>
                  <p className="text-[11px] text-[#5D7188]">
                    Ask about local weather, rainfall outlook, travel risk, or official disaster warnings.
                  </p>
                </div>
              )}

              {/* Suggested Quick Prompts */}
              <div className="space-y-2 pt-2">
                <div className="text-[10px] font-bold text-[#5D7188] uppercase tracking-wider px-1 flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-amber-500" />
                  <span>Quick Weather Questions</span>
                </div>
                <div className="space-y-1.5">
                  {quickPrompts.map((prompt, i) => (
                    <button
                      key={i}
                      onClick={() => handleSelectQuery(prompt)}
                      className="w-full text-left px-3 py-2 rounded-xl bg-white hover:bg-[#DCEEFF]/40 border border-[#D7E7F5] text-xs font-medium text-[#0F2742] transition-colors flex items-center justify-between gap-2 shadow-2xs"
                    >
                      <span className="truncate">{prompt}</span>
                      <ArrowRight className="w-3 h-3 text-[#1557B0] shrink-0" />
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ---------------- TAB 2: ALL FEATURES ---------------- */}
          {activeTab === 'features' && (
            <div className="space-y-5">
              {featuresList.map((group, gIdx) => (
                <div key={gIdx} className="space-y-1.5">
                  <div className="text-[10px] font-bold text-[#5D7188] uppercase tracking-wider px-2">
                    {group.group}
                  </div>
                  <div className="space-y-1">
                    {group.items.map((item, idx) => {
                      const Icon = item.icon;
                      const isActive = item.path === location.pathname && !item.hash;
                      return (
                        <button
                          key={idx}
                          onClick={() => handleNavigate(item.path, item.hash)}
                          className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                            isActive
                              ? 'bg-[#DCEEFF] text-[#1557B0] font-bold shadow-2xs'
                              : 'text-[#0F2742] hover:bg-[#F5FAFF]'
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-[#1557B0]' : 'text-[#3B82F6]'}`} />
                            <span className="truncate">{item.label}</span>
                          </div>
                          {item.badge && (
                            <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded-full bg-rose-100 text-rose-700">
                              {item.badge}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Bottom Status & Controls Footer */}
        <div className="p-3.5 border-t border-[#D7E7F5] bg-[#F5FAFF] space-y-2.5">
          {/* Active Location Info */}
          <div className="flex items-center justify-between px-2.5 py-1.5 rounded-xl bg-white border border-[#D7E7F5] text-xs">
            <div className="min-w-0">
              <span className="text-[9px] font-bold text-[#5D7188] uppercase tracking-wider block">Active City</span>
              <span className="font-extrabold text-[#0F2742] truncate block">{currentLocation.name}, {currentLocation.state}</span>
            </div>
            <button
              onClick={() => {
                setMobileSidePanelOpen(false);
                navigate('/map');
              }}
              className="text-[11px] font-bold text-[#1557B0] hover:underline shrink-0"
            >
              Pinpoint on Map
            </button>
          </div>

          {/* Quick Utility Toggles */}
          <div className="flex items-center justify-between gap-2">
            {/* Language button */}
            <button
              onClick={nextLanguage}
              className="flex-1 py-1.5 px-2 rounded-xl bg-white border border-[#D7E7F5] text-[11px] font-bold text-[#0F2742] flex items-center justify-center gap-1 shadow-2xs"
            >
              <Languages className="w-3.5 h-3.5 text-[#3B82F6]" />
              <span>{langLabel}</span>
            </button>

            {/* Demo mode toggle */}
            <button
              onClick={toggleDemoMode}
              className={`flex-1 py-1.5 px-2 rounded-xl border text-[11px] font-bold flex items-center justify-center gap-1 shadow-2xs ${
                preferences.demoMode
                  ? 'bg-amber-100 text-amber-900 border-amber-300'
                  : 'bg-white text-[#5D7188] border-[#D7E7F5]'
              }`}
            >
              <span>{preferences.demoMode ? 'Sample' : 'Live Data'}</span>
            </button>

            {/* Connection status */}
            <div className="px-2 py-1.5 rounded-xl bg-white border border-[#D7E7F5] text-[11px] font-bold text-emerald-700 flex items-center gap-1">
              {connection.isOnline ? (
                <>
                  <Wifi className="w-3 h-3 text-emerald-600" />
                  <span>Online</span>
                </>
              ) : (
                <>
                  <WifiOff className="w-3 h-3 text-rose-600" />
                  <span className="text-rose-700">Offline</span>
                </>
              )}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};

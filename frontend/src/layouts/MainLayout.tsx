import React from 'react';
import { Outlet } from 'react-router-dom';
import { Header } from '../components/common/Header';
import { Sidebar } from '../components/common/Sidebar';
import { MobileNav } from '../components/common/MobileNav';
import { MobileSidePanel } from '../components/common/MobileSidePanel';
import { OfflineBanner } from '../components/offline/OfflineBanner';
import { AlertDetailModal } from '../components/alerts/AlertDetailModal';
import { AtmosphericBackdrop } from '../components/weather/AtmosphericBackdrop';
import { useWeatherStore } from '../store/useWeatherStore';
import { useNetworkStatus } from '../hooks/useNetworkStatus';
import { CheckCircle } from 'lucide-react';

export const MainLayout: React.FC = () => {
  const { activeAlertModal, setActiveAlertModal, syncData, checkHealth, currentWeather } = useWeatherStore();
  const { justRestored } = useNetworkStatus();

  React.useEffect(() => {
    void checkHealth();
    void syncData();
    // Bootstrapped once on mount; subsequent refreshes come from location changes/health polls.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const regime = currentWeather?.blendingMetadata?.weatherRegime || 'Normal';
  const condition = currentWeather?.conditionText || '';

  return (
    <div className="min-h-screen bg-[#F5FAFF] text-[#0F2742] flex flex-col antialiased selection:bg-[#DCEEFF] selection:text-[#1557B0] relative overflow-x-hidden w-full">
      {/* Background Weather Atmosphere */}
      <AtmosphericBackdrop weatherRegime={regime} conditionCode={condition} />

      {/* Offline Banner if disconnected */}
      <OfflineBanner />

      {/* Reconnection Restored Notification Toast */}
      {justRestored && (
        <div className="bg-[#1557B0] text-white px-3 sm:px-4 py-2 flex items-center justify-between text-xs font-semibold shadow-md z-50 animate-in slide-in-from-top duration-300">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-cyan-300 shrink-0" />
            <span className="truncate">Connection restored — synchronized grounded forecast evidence from backend.</span>
          </div>
        </div>
      )}

      {/* App Core Layout Container */}
      <div className="flex flex-1 relative z-10 w-full min-w-0">
        {/* Desktop Sidebar */}
        <Sidebar />

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col min-w-0 pb-[calc(4.75rem+env(safe-area-inset-bottom,0px))] lg:pb-0">
          <Header />
          <main className="flex-1 p-3 sm:p-5 lg:p-8 max-w-7xl w-full mx-auto space-y-4 sm:space-y-6">
            <Outlet />
          </main>
        </div>
      </div>

      {/* Mobile Bottom Navigation */}
      <MobileNav />

      {/* Mobile Side Panel (Drawer: Chat History & All Hidden Mobile Features) */}
      <MobileSidePanel />

      {/* Global Alert Detail Modal */}
      {activeAlertModal && (
        <AlertDetailModal alert={activeAlertModal} onClose={() => setActiveAlertModal(null)} />
      )}
    </div>
  );
};

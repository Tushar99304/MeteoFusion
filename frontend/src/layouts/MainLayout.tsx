import React from 'react';
import { Outlet } from 'react-router-dom';
import { Header } from '../components/common/Header';
import { Sidebar } from '../components/common/Sidebar'; // wait, let's make sure path is correct!
import { MobileNav } from '../components/common/MobileNav';
import { OfflineBanner } from '../components/offline/OfflineBanner';
import { AlertDetailModal } from '../components/alerts/AlertDetailModal';
import { useWeatherStore } from '../store/useWeatherStore';
import { useNetworkStatus } from '../hooks/useNetworkStatus';
import { CheckCircle } from 'lucide-react';

export const MainLayout: React.FC = () => {
  const { activeAlertModal, setActiveAlertModal, syncData, checkHealth } = useWeatherStore();
  const { justRestored } = useNetworkStatus();

  React.useEffect(() => {
    void checkHealth();
    void syncData();
    // Bootstrapped once on mount; subsequent refreshes come from location changes/health polls.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="min-h-screen bg-[#F7FBF8] text-[#17352A] flex flex-col antialiased selection:bg-[#E8F5EE] selection:text-[#2E7D5B]">
      {/* Offline Banner if disconnected */}
      <OfflineBanner />

      {/* Reconnection Restored Notification Toast */}
      {justRestored && (
        <div className="bg-emerald-600 text-white px-4 py-2 flex items-center justify-between text-xs font-semibold shadow-md animate-in slide-in-from-top duration-300">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4" />
            <span>Connection restored — re-syncing grounded weather evidence from the backend.</span>
          </div>
        </div>
      )}

      {/* App Core Layout Container */}
      <div className="flex flex-1 relative">
        {/* Desktop Sidebar */}
        <Sidebar />

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col min-w-0 pb-16 lg:pb-0">
          <Header />
          <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto space-y-6">
            <Outlet />
          </main>
        </div>
      </div>

      {/* Mobile Bottom Navigation */}
      <MobileNav />

      {/* Global Alert Detail Modal */}
      {activeAlertModal && (
        <AlertDetailModal alert={activeAlertModal} onClose={() => setActiveAlertModal(null)} />
      )}
    </div>
  );
};

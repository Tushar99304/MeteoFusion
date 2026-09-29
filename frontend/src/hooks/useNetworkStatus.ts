import { useEffect, useState } from 'react';
import { useWeatherStore } from '../store/useWeatherStore';

export function useNetworkStatus() {
  const { setOnlineStatus, syncData, connection } = useWeatherStore();
  const [justRestored, setJustRestored] = useState(false);

  useEffect(() => {
    const handleOnline = () => {
      setOnlineStatus(true);
      setJustRestored(true);
      syncData();
      setTimeout(() => setJustRestored(false), 4000);
    };

    const handleOffline = () => {
      setOnlineStatus(false);
      setJustRestored(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [setOnlineStatus, syncData]);

  return {
    isOnline: connection.isOnline,
    justRestored,
    syncInProgress: connection.syncInProgress,
  };
}

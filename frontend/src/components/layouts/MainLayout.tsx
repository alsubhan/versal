
import React, { useState } from "react";
import { Navigate, useLocation, Outlet } from "react-router-dom";
import { Sidebar } from "@/components/layouts/Sidebar";
import { useAuth } from "@/hooks/useAuth";
import { ConfigIndicator } from '@/components/ConfigIndicator';
import { IssueReporter } from '@/components/shared/IssueReporter';
import { PerformanceDashboard } from '@/components/PerformanceDashboard';

export const MainLayout: React.FC = () => {
  const { isAuthenticated, loading, _instanceId } = useAuth();
  const location = useLocation();
  const [isPerformanceDashboardVisible, setIsPerformanceDashboardVisible] = useState(false);
  
  console.log(`🏗️ MainLayout using useAuth instance: ${_instanceId}`);

  const togglePerformanceDashboard = () => {
    setIsPerformanceDashboardVisible(!isPerformanceDashboardVisible);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    // Redirect to auth and remember the current location for after login
    return <Navigate to="/auth" state={{ from: location }} replace />;
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar onPerformanceToggle={togglePerformanceDashboard} />
      <div className="flex flex-col flex-1 overflow-hidden">
        <main className="flex-1 overflow-y-auto p-6 bg-background">
          <Outlet />
        </main>
      </div>
      <ConfigIndicator />
      <IssueReporter />
      {isPerformanceDashboardVisible && (
        <PerformanceDashboard 
          isVisible={isPerformanceDashboardVisible}
          onClose={() => setIsPerformanceDashboardVisible(false)}
        />
      )}
    </div>
  );
};

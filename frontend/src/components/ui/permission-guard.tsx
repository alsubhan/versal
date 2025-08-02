import React from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Lock, Loader2 } from 'lucide-react';

interface PermissionGuardProps {
  children: React.ReactNode;
  requiredPermission: string;
  fallbackMessage?: string;
}

/**
 * Simple PermissionGuard component:
 * 
 * 1. Shows loading spinner while auth and permissions are being determined
 * 2. After everything is loaded, either shows content or permission denied message
 * 
 * This works for both sidebar navigation and direct URL access.
 */
export const PermissionGuard: React.FC<PermissionGuardProps> = ({
  children,
  requiredPermission,
  fallbackMessage = "You do not have permission to view this page. Please contact an administrator."
}) => {
  const { hasPermission, loading, permissions } = useAuth();

  // Show loading spinner while auth state is being determined OR permissions are not yet loaded
  if (loading || permissions.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  // After loading and permissions are available, check permissions
  const hasRequiredPermission = hasPermission(requiredPermission);
  
  if (!hasRequiredPermission) {
    return (
      <div className="space-y-6">
        <Alert>
          <Lock className="h-4 w-4" />
          <AlertDescription>
            {fallbackMessage}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  // Render children if user has permission
  return <>{children}</>;
};

// Higher-order component for pages that need permission checks
export const withPermission = (
  WrappedComponent: React.ComponentType<any>,
  requiredPermission: string,
  fallbackMessage?: string
) => {
  return (props: any) => (
    <PermissionGuard 
      requiredPermission={requiredPermission}
      fallbackMessage={fallbackMessage}
    >
      <WrappedComponent {...props} />
    </PermissionGuard>
  );
}; 
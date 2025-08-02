
import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { 
  UploadCloud, 
  Download, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  RotateCcw
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import { PermissionGuard } from "@/components/ui/permission-guard";

// Mock backup data
const mockBackups = [
  {
    id: "1",
    name: "Full System Backup",
    type: "Full",
    size: "2.5 GB",
    createdAt: "2024-01-15T10:30:00Z",
    status: "Completed"
  },
  {
    id: "2",
    name: "Database Backup",
    type: "Database",
    size: "1.2 GB",
    createdAt: "2024-01-14T15:45:00Z",
    status: "Completed"
  },
  {
    id: "3",
    name: "Files Backup",
    type: "Files",
    size: "800 MB",
    createdAt: "2024-01-13T09:20:00Z",
    status: "Completed"
  }
];

const BackupPage = () => {
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [progress, setProgress] = useState(0);
  const { hasPermission } = useAuth();
  const canCreateBackup = hasPermission('backup_create');
  const canRestoreBackup = hasPermission('backup_restore');
  const { toast } = useToast();
  
  const handleBackup = () => {
    if (!canCreateBackup) {
      toast({
        title: "Permission Denied",
        description: "You do not have permission to create backups",
        variant: "destructive"
      });
      return;
    }
    
    setIsBackingUp(true);
    setProgress(0);
    
    // Simulate backup process
    const interval = setInterval(() => {
      setProgress((prevProgress) => {
        if (prevProgress >= 100) {
          clearInterval(interval);
          setIsBackingUp(false);
          toast({
            title: "Success",
            description: "Backup completed successfully!"
          });
          return 100;
        }
        return prevProgress + 10;
      });
    }, 500);
  };
  
  const formatDate = (dateString: string) => {
    const options: Intl.DateTimeFormatOptions = {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    };
    return new Date(dateString).toLocaleDateString(undefined, options);
  };
  
  return (
    <PermissionGuard 
      requiredPermission="backup_view"
      fallbackMessage="You do not have permission to view backup & restore. Please contact an administrator."
    >
      <div className="space-y-6">
        <h1 className="text-2xl font-bold tracking-tight">Backup & Restore</h1>
        
        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <UploadCloud className="text-primary" size={20} />
                Backup Data
              </CardTitle>
              <CardDescription>
                Create a backup of your system data
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {isBackingUp && (
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Creating backup...</span>
                    <span>{progress}%</span>
                  </div>
                  <Progress value={progress} />
                </div>
              )}
              
              {canCreateBackup ? (
                <Button 
                  onClick={handleBackup} 
                  disabled={isBackingUp}
                  className="w-full"
                >
                  <UploadCloud className="mr-2 h-4 w-4" />
                  {isBackingUp ? "Creating Backup..." : "Create Backup"}
                </Button>
              ) : (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span>
                        <Button 
                          disabled
                          className="w-full"
                        >
                          <UploadCloud className="mr-2 h-4 w-4" />
                          Create Backup
                        </Button>
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>
                      You do not have permission to create backups
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <RotateCcw className="text-primary" size={20} />
                Restore Data
              </CardTitle>
              <CardDescription>
                Restore system data from a backup file
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {canRestoreBackup ? (
                <Button variant="outline" className="w-full">
                  <Download className="mr-2 h-4 w-4" />
                  Restore from Backup
                </Button>
              ) : (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span>
                        <Button variant="outline" disabled className="w-full">
                          <Download className="mr-2 h-4 w-4" />
                          Restore from Backup
                        </Button>
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>
                      You do not have permission to restore backups
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </CardContent>
          </Card>
        </div>
        
        <Card>
          <CardHeader>
            <CardTitle>Backup History</CardTitle>
            <CardDescription>
              View and manage your previous backups
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-4 font-medium">Date</th>
                    <th className="text-left py-3 px-4 font-medium">Type</th>
                    <th className="text-left py-3 px-4 font-medium">Size</th>
                    <th className="text-left py-3 px-4 font-medium">Status</th>
                    <th className="text-right py-3 px-4 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {mockBackups.map((backup) => (
                    <tr key={backup.id} className="border-b">
                      <td className="py-3 px-4">{formatDate(backup.createdAt)}</td>
                      <td className="py-3 px-4">{backup.type}</td>
                      <td className="py-3 px-4">{backup.size}</td>
                      <td className="py-3 px-4">
                        <span 
                          className={`inline-flex items-center gap-1 ${
                            backup.status === "Completed" 
                              ? "text-green-600" 
                              : backup.status === "Failed" 
                                ? "text-red-600" 
                                : "text-amber-600"
                          }`}
                        >
                          {backup.status === "Completed" ? (
                            <CheckCircle2 size={14} />
                          ) : backup.status === "Failed" ? (
                            <AlertCircle size={14} />
                          ) : (
                            <Clock size={14} />
                          )}
                          {backup.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <Button variant="ghost" size="sm">
                          <Download size={14} className="mr-1" /> Download
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </PermissionGuard>
  );
};

export default BackupPage;

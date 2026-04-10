
import { useState, useEffect } from "react";
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

import { 
  getBackups, 
  createBackup, 
  restoreBackup, 
  deleteBackup,
  downloadBackup
} from "@/lib/api";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const BackupPage = () => {
  const [backups, setBackups] = useState<any[]>([]);
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  
  // Restore state
  const [restoreDialogOpen, setRestoreDialogOpen] = useState(false);
  const [selectedBackup, setSelectedBackup] = useState('');
  const [restoreConfirmText, setRestoreConfirmText] = useState('');
  const [isRestoring, setIsRestoring] = useState(false);

  // Delete state
  const [isDeleting, setIsDeleting] = useState<string | null>(null);

  const { hasPermission } = useAuth();
  const canViewBackups = hasPermission('backup_view');
  const canCreateBackup = hasPermission('backup_create');
  const canRestoreBackup = hasPermission('backup_restore');
  const canDeleteBackup = hasPermission('backup_delete');
  const { toast } = useToast();
  
  const fetchBackups = async () => {
    setIsLoading(true);
    try {
      const data = await getBackups();
      setBackups(data);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to fetch backups",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (canViewBackups) {
      fetchBackups();
    }
  }, [canViewBackups]);

  const handleBackup = async () => {
    if (!canCreateBackup) {
      toast({
        title: "Permission Denied",
        description: "You do not have permission to create backups",
        variant: "destructive"
      });
      return;
    }
    
    setIsBackingUp(true);
    
    try {
      const result = await createBackup();
      toast({
        title: "Success",
        description: "Backup completed successfully!"
      });
      fetchBackups();
      
      // Auto-download (Authenticated)
      if (result.filename) {
          handleDownload(result.filename);
      }
    } catch (error) {
       toast({
        title: "Error",
        description: "Failed to create backup",
        variant: "destructive"
      });
    } finally {
      setIsBackingUp(false);
    }
  };

  const handleDelete = async (filename: string) => {
    if (!canDeleteBackup) {
      toast({ title: "Permission Denied", description: "You do not have permission to delete backups", variant: "destructive"});
      return;
    }
    if (!confirm("Are you sure you want to delete this backup?")) return;

    setIsDeleting(filename);
    try {
      await deleteBackup(filename);
      toast({ title: "Success", description: "Backup deleted" });
      fetchBackups();
    } catch {
      toast({ title: "Error", description: "Failed to delete backup", variant: "destructive" });
    } finally {
      setIsDeleting(null);
    }
  };

  const confirmRestore = (filename: string) => {
    setSelectedBackup(filename);
    setRestoreConfirmText('');
    setRestoreDialogOpen(true);
  };

  const handleRestore = async () => {
    if (!canRestoreBackup) {
        toast({ title: "Permission Denied", description: "You do not have permission to restore backups", variant: "destructive"});
        return;
    }

    if (restoreConfirmText !== 'RESTORE') {
        toast({ title: "Error", description: "Type RESTORE to confirm", variant: "destructive"});
        return;
    }

    setIsRestoring(true);
    try {
        await restoreBackup(selectedBackup);
        toast({ title: "Success", description: "System restored successfully!" });
        setRestoreDialogOpen(false);
    } catch (error: any) {
        toast({ 
            title: "Error", 
            description: error.message || "Restore failed", 
            variant: "destructive" 
        });
    } finally {
        setIsRestoring(false);
    }
  };
  

  const downloadBlob = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const handleDownload = async (filename: string) => {
    try {
      const blob = await downloadBackup(filename);
      downloadBlob(blob, filename);
    } catch (error) {
       toast({
        title: "Download Failed",
        description: "Could not download the backup file.",
        variant: "destructive"
      });
    }
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
                Create a physical PostgreSQL backup of your system data.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {isBackingUp && (
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Running pg_dump...</span>
                  </div>
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
                      You do not have permission to manage backups
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
                Restore system data from a recent backup.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground mb-4">
                You can select a backup from the history below to restore your system. Ensure you have the 'RESTORE' confirmation ready.
              </p>
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
                  {isLoading ? (
                    <tr><td colSpan={5} className="py-4 text-center">Loading backups...</td></tr>
                  ) : backups.length === 0 ? (
                    <tr><td colSpan={5} className="py-4 text-center">No backups found</td></tr>
                  ) : backups.map((backup) => (
                    <tr key={backup.id} className="border-b">
                      <td className="py-3 px-4">{formatDate(backup.createdAt)}</td>
                      <td className="py-3 px-4">{backup.type}</td>
                      <td className="py-3 px-4">{backup.size}</td>
                      <td className="py-3 px-4">
                        <span 
                          className="inline-flex items-center gap-1 text-green-600"
                        >
                           <CheckCircle2 size={14} /> Completed
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right space-x-2">
                        <Button variant="ghost" size="sm" onClick={() => handleDownload(backup.filename || backup.name)}>
                          <Download size={14} className="mr-1" /> Download
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={() => confirmRestore(backup.name)}
                          disabled={!canRestoreBackup}
                        >
                          <RotateCcw size={14} className="mr-1" /> Restore
                        </Button>
                        <Button 
                          variant="destructive" 
                          size="sm" 
                          onClick={() => handleDelete(backup.name)} 
                          disabled={isDeleting === backup.name || !canDeleteBackup} 
                        >
                           Delete
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Restore Confirmation Dialog */}
        <Dialog open={restoreDialogOpen} onOpenChange={setRestoreDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Confirm System Restore</DialogTitle>
              <DialogDescription>
                 This action is <span className="font-bold text-destructive">DESTRUCTIVE</span> and will overwrite all current system data with the backup <b>{selectedBackup}</b>.
                 <br/><br/>
                 To confirm, type <b>RESTORE</b> below.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="confirm" className="text-right">Confirm</Label>
                <Input
                  id="confirm"
                  value={restoreConfirmText}
                  onChange={(e) => setRestoreConfirmText(e.target.value)}
                  className="col-span-3"
                  placeholder="Type RESTORE"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setRestoreDialogOpen(false)}>Cancel</Button>
              <Button variant="destructive" onClick={handleRestore} disabled={restoreConfirmText !== 'RESTORE' || isRestoring}>
                {isRestoring ? "Restoring..." : "Execute Restore"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </PermissionGuard>
  );
};

export default BackupPage;

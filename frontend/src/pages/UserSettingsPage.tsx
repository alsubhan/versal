import { useState, useEffect } from "react";
import { useTheme } from "next-themes";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Lock, User, Bell, Globe, Palette, Shield, Camera } from "lucide-react";
import { ChangePasswordDialog } from "@/components/dialogs/ChangePasswordDialog";
import { getUserSettings, createUserSetting, updateUserSetting } from "@/lib/api";

const UserSettingsPage = () => {
  const { user, hasPermission } = useAuth();
  const { theme, setTheme } = useTheme();
  const canViewSettings = hasPermission('settings_view');
  const canEditSettings = hasPermission('settings_edit');

  // State for user settings
  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false);
  const [userSettings, setUserSettings] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [userProfile, setUserProfile] = useState({
    fullName: user?.user_metadata?.full_name || "",
    email: user?.email || "",
    phone: "",
    avatar: ""
  });
  const [language, setLanguage] = useState("en");
  const [notifications, setNotifications] = useState({
    email: true,
    push: false,
    lowStock: true,
    newOrders: true,
    systemUpdates: false
  });

  // Fetch user settings from backend
  useEffect(() => {
    const fetchUserSettings = async () => {
      try {
        const data = await getUserSettings();
        if (data && Object.keys(data).length > 0) {
          setUserSettings(data);
          setLanguage(data.language || "en");
          setNotifications(data.notifications || {
            email: true,
            push: false,
            lowStock: true,
            newOrders: true,
            systemUpdates: false
          });
        }
      } catch (error) {
        console.error('Error fetching user settings:', error);
      } finally {
        setLoading(false);
      }
    };

    if (canViewSettings) {
      fetchUserSettings();
    }
  }, [canViewSettings]);

  // If user doesn't have permission to view settings, show access denied
  if (!canViewSettings) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold tracking-tight">User Settings</h1>
        <Alert>
          <Lock className="h-4 w-4" />
          <AlertDescription>
            You do not have permission to view user settings. Please contact an administrator.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const handleSaveProfile = async () => {
    if (!canEditSettings) {
      toast.error("You do not have permission to edit settings.");
      return;
    }
    
    try {
      const settingsData = {
        theme: theme,
        language: language,
        notifications: notifications,
        preferences: {
          profile: userProfile
        }
      };
      
      if (userSettings) {
        await updateUserSetting(settingsData);
      } else {
        await createUserSetting(settingsData);
      }
      
      toast.success("Profile updated successfully");
    } catch (error) {
      console.error('Error saving user settings:', error);
      toast.error('Failed to save profile');
    }
  };

  const handleDarkModeToggle = async () => {
    if (!canEditSettings) {
      toast.error("You do not have permission to change settings.");
      return;
    }
    
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
    
    try {
      const settingsData = {
        theme: newTheme,
        language: language,
        notifications: notifications,
        preferences: {
          profile: userProfile
        }
      };
      
      if (userSettings) {
        await updateUserSetting(settingsData);
      } else {
        await createUserSetting(settingsData);
      }
      
      toast.success(`Switched to ${newTheme} mode`);
    } catch (error) {
      console.error('Error saving theme setting:', error);
      toast.error('Failed to save theme preference');
    }
  };

  const handleLanguageChange = async (value: string) => {
    if (!canEditSettings) {
      toast.error("You do not have permission to change settings.");
      return;
    }
    
    setLanguage(value);
    
    try {
      const settingsData = {
        theme: theme,
        language: value,
        notifications: notifications,
        preferences: {
          profile: userProfile
        }
      };
      
      if (userSettings) {
        await updateUserSetting(settingsData);
      } else {
        await createUserSetting(settingsData);
      }
      
      toast.success("Language preference updated");
    } catch (error) {
      console.error('Error saving language setting:', error);
      toast.error('Failed to save language preference');
    }
  };

  const handleNotificationToggle = (key: string) => {
    if (!canEditSettings) {
      toast.error("You do not have permission to change settings.");
      return;
    }
    setNotifications(prev => ({
      ...prev,
      [key]: !prev[key as keyof typeof prev]
    }));
    toast.success("Notification preference updated");
  };

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase();
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold tracking-tight">User Settings</h1>
        <Badge variant="outline" className="flex items-center gap-1">
          <User className="h-3 w-3" />
          Personal Settings
        </Badge>
      </div>

      <div className="grid gap-6">
        {/* User Profile Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Profile Information
            </CardTitle>
            <CardDescription>
              Update your personal information and profile picture
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Avatar Section */}
            <div className="flex items-center gap-4">
              <div className="relative">
                <Avatar className="h-20 w-20">
                  <AvatarImage src={userProfile.avatar} alt={userProfile.fullName} />
                  <AvatarFallback className="text-lg">
                    {getInitials(userProfile.fullName)}
                  </AvatarFallback>
                </Avatar>
                <Button
                  size="sm"
                  variant="outline"
                  className="absolute -bottom-2 -right-2 h-8 w-8 rounded-full p-0"
                  disabled={!canEditSettings}
                >
                  <Camera className="h-4 w-4" />
                </Button>
              </div>
              <div className="space-y-1">
                <h3 className="font-medium">{userProfile.fullName || "User"}</h3>
                <p className="text-sm text-muted-foreground">{userProfile.email}</p>
                <Badge variant="secondary">Active</Badge>
              </div>
            </div>

            <Separator />

            {/* Profile Form */}
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="fullName">Full Name</Label>
                <Input
                  id="fullName"
                  value={userProfile.fullName}
                  onChange={(e) => setUserProfile(prev => ({ ...prev, fullName: e.target.value }))}
                  disabled={!canEditSettings}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email Address</Label>
                <Input
                  id="email"
                  type="email"
                  value={userProfile.email}
                  onChange={(e) => setUserProfile(prev => ({ ...prev, email: e.target.value }))}
                  disabled={!canEditSettings}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Phone Number</Label>
                <Input
                  id="phone"
                  value={userProfile.phone}
                  onChange={(e) => setUserProfile(prev => ({ ...prev, phone: e.target.value }))}
                  disabled={!canEditSettings}
                />
              </div>
            </div>

            <div className="flex gap-2">
              <Button onClick={handleSaveProfile} disabled={!canEditSettings}>
                Save Profile
              </Button>
              <Button 
                variant="outline" 
                onClick={() => setIsChangePasswordOpen(true)}
                className="flex items-center gap-2"
              >
                <Shield className="h-4 w-4" />
                Change Password
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Appearance & Preferences Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Palette className="h-5 w-5" />
              Appearance & Preferences
            </CardTitle>
            <CardDescription>
              Customize your interface appearance and language
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Dark Mode</Label>
                <p className="text-sm text-muted-foreground">
                  Switch between light and dark themes
                </p>
              </div>
              <Switch
                checked={theme === 'dark'}
                onCheckedChange={handleDarkModeToggle}
                disabled={!canEditSettings}
              />
            </div>

            <Separator />

            <div className="space-y-2">
              <Label htmlFor="language">Language</Label>
              <Select value={language} onValueChange={handleLanguageChange} disabled={!canEditSettings}>
                <SelectTrigger>
                  <SelectValue placeholder="Select language" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="en">English</SelectItem>
                  <SelectItem value="es">Español</SelectItem>
                  <SelectItem value="fr">Français</SelectItem>
                  <SelectItem value="de">Deutsch</SelectItem>
                  <SelectItem value="hi">हिंदी</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Notification Preferences Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5" />
              Notification Preferences
            </CardTitle>
            <CardDescription>
              Choose how and when you want to be notified
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Email Notifications</Label>
                <p className="text-sm text-muted-foreground">
                  Receive notifications via email
                </p>
              </div>
              <Switch
                checked={notifications.email}
                onCheckedChange={() => handleNotificationToggle('email')}
                disabled={!canEditSettings}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Push Notifications</Label>
                <p className="text-sm text-muted-foreground">
                  Receive browser push notifications
                </p>
              </div>
              <Switch
                checked={notifications.push}
                onCheckedChange={() => handleNotificationToggle('push')}
                disabled={!canEditSettings}
              />
            </div>

            <Separator />

            <div className="space-y-3">
              <h4 className="font-medium">Business Notifications</h4>
              
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Low Stock Alerts</Label>
                  <p className="text-sm text-muted-foreground">
                    Get notified when inventory is running low
                  </p>
                </div>
                <Switch
                  checked={notifications.lowStock}
                  onCheckedChange={() => handleNotificationToggle('lowStock')}
                  disabled={!canEditSettings}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>New Orders</Label>
                  <p className="text-sm text-muted-foreground">
                    Notify when new orders are received
                  </p>
                </div>
                <Switch
                  checked={notifications.newOrders}
                  onCheckedChange={() => handleNotificationToggle('newOrders')}
                  disabled={!canEditSettings}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>System Updates</Label>
                  <p className="text-sm text-muted-foreground">
                    Receive system maintenance notifications
                  </p>
                </div>
                <Switch
                  checked={notifications.systemUpdates}
                  onCheckedChange={() => handleNotificationToggle('systemUpdates')}
                  disabled={!canEditSettings}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Change Password Dialog */}
      <ChangePasswordDialog 
        open={isChangePasswordOpen} 
        onOpenChange={setIsChangePasswordOpen}
      />
    </div>
  );
};

export default UserSettingsPage; 
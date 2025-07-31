import { useState, useEffect, useRef } from 'react';
import { Navigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/hooks/useAuth';
import { Loader2, Package, Shield, Users } from 'lucide-react';
import { getPublicSystemSettings } from '@/lib/api';

export default function Auth() {
  const { signIn, signUp, loading, isAuthenticated } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [enableSignup, setEnableSignup] = useState(true);
  const [settingsLoading, setSettingsLoading] = useState(true);
  const settingsCompletedRef = useRef(false);

  // Fetch public system settings to check if signup is enabled
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        setSettingsLoading(true);
        settingsCompletedRef.current = false;
        const settings = await getPublicSystemSettings();
        
        const signupSetting = settings.find(s => s.key === 'enable_signup');
        const enableSignupValue = signupSetting ? signupSetting.value === true : false;
        setEnableSignup(enableSignupValue);
        
        settingsCompletedRef.current = true;
      } catch (error) {
        console.error('Error fetching settings:', error);
        // Default to disabled if there's an error
        setEnableSignup(false);
        settingsCompletedRef.current = true;
      } finally {
        setSettingsLoading(false);
      }
    };

    // Add timeout to prevent infinite loading
    const timeoutId = setTimeout(() => {
      if (!settingsCompletedRef.current) {
        console.warn('Settings fetch timeout, defaulting to disabled signup');
        setEnableSignup(false); // Changed from true to false
        setSettingsLoading(false);
        settingsCompletedRef.current = true;
      }
    }, 5000); // 5 second timeout (rolled back from 15 seconds)

    fetchSettings();

    return () => {
      clearTimeout(timeoutId);
      settingsCompletedRef.current = true;
    };
  }, []); // Remove settingsLoading from dependency array

  // Redirect if already authenticated
  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  const handleSignIn = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    
    const formData = new FormData(e.currentTarget);
    const email = formData.get('email') as string;
    const password = formData.get('password') as string;
    
    await signIn(email, password);
    setIsLoading(false);
  };

  const handleSignUp = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    
    const formData = new FormData(e.currentTarget);
    const email = formData.get('email') as string;
    const password = formData.get('password') as string;
    const username = formData.get('username') as string;
    const fullName = formData.get('fullName') as string;
    const role = formData.get('role') as string;
    
    await signUp(email, password, {
      username,
      full_name: fullName,
      role
    });
    setIsLoading(false);
  };

  if (loading || settingsLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted/50 flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="flex items-center justify-center space-x-2">
            <Package className="h-8 w-8 text-primary" />
            <h1 className="text-2xl font-bold">Versal WMS</h1>
          </div>
          <p className="text-muted-foreground">
            Warehouse Management System
          </p>
        </div>

        {/* Auth Forms */}
        <Card>
          <CardHeader>
            <CardTitle>Welcome</CardTitle>
            <CardDescription>
              {enableSignup ? 'Sign in to your account or create a new one' : 'Sign in to your account'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="signin" className="space-y-4">
              <TabsList className={`grid w-full ${enableSignup ? 'grid-cols-2' : 'grid-cols-1'}`}>
                <TabsTrigger value="signin">Sign In</TabsTrigger>
                {enableSignup && <TabsTrigger value="signup">Sign Up</TabsTrigger>}
              </TabsList>

              {/* Sign In Form */}
              <TabsContent value="signin" className="space-y-4">
                <form onSubmit={handleSignIn} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="signin-email">Email</Label>
                    <Input
                      id="signin-email"
                      name="email"
                      type="email"
                      placeholder="Enter your email"
                      required
                      disabled={isLoading}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signin-password">Password</Label>
                    <Input
                      id="signin-password"
                      name="password"
                      type="password"
                      placeholder="Enter your password"
                      required
                      disabled={isLoading}
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={isLoading}>
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Signing in...
                      </>
                    ) : (
                      'Sign In'
                    )}
                  </Button>
                </form>
              </TabsContent>

              {/* Sign Up Form - Only show if signup is enabled */}
              {enableSignup && (
                <TabsContent value="signup" className="space-y-4">
                  <form onSubmit={handleSignUp} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="username">Username</Label>
                        <Input
                          id="username"
                          name="username"
                          placeholder="Username"
                          required
                          disabled={isLoading}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="fullName">Full Name</Label>
                        <Input
                          id="fullName"
                          name="fullName"
                          placeholder="Full Name"
                          required
                          disabled={isLoading}
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="signup-email">Email</Label>
                      <Input
                        id="signup-email"
                        name="email"
                        type="email"
                        placeholder="Enter your email"
                        required
                        disabled={isLoading}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="signup-password">Password</Label>
                      <Input
                        id="signup-password"
                        name="password"
                        type="password"
                        placeholder="Create a password"
                        required
                        disabled={isLoading}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="role">Role</Label>
                      <Select name="role" defaultValue="staff" disabled={isLoading}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select your role" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="staff">
                            <div className="flex items-center space-x-2">
                              <Users className="h-4 w-4" />
                              <span>Staff</span>
                            </div>
                          </SelectItem>
                          <SelectItem value="manager">
                            <div className="flex items-center space-x-2">
                              <Shield className="h-4 w-4" />
                              <span>Manager</span>
                            </div>
                          </SelectItem>
                          <SelectItem value="admin">
                            <div className="flex items-center space-x-2">
                              <Shield className="h-4 w-4" />
                              <span>Admin</span>
                            </div>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <Button type="submit" className="w-full" disabled={isLoading}>
                      {isLoading ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Creating account...
                        </>
                      ) : (
                        'Create Account'
                      )}
                    </Button>
                  </form>
                </TabsContent>
              )}
            </Tabs>
          </CardContent>
        </Card>

        {/* Demo Credentials */}
        <Card className="border-dashed">
          <CardContent className="pt-6">
            <div className="text-center space-y-2">
              <h3 className="font-medium text-sm">Demo Credentials</h3>
              <div className="text-xs text-muted-foreground space-y-1">
                <p>Admin: admin@versal.com / admin123</p>
                <p>Manager: manager@versal.com / manager123</p>
                <p>Staff: staff@versal.com / staff123</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
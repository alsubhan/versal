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
  console.log('🔄 Auth component rendering...');
  const { signIn, signUp, loading, isAuthenticated, _instanceId } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [enableSignup, setEnableSignup] = useState(true);
  const [settingsLoading, setSettingsLoading] = useState(() => {
    // Check if settings were already fetched in this session
    const settingsFetched = sessionStorage.getItem('auth_settings_fetched');
    const signupEnabled = sessionStorage.getItem('auth_signup_enabled');
    
    if (settingsFetched === 'true' && signupEnabled !== null) {
      console.log('🔧 Using cached settings from session storage');
      setEnableSignup(signupEnabled === 'true');
      return false; // Don't show loading if we have cached settings
    }
    
    return true; // Show loading if no cached settings
  });
  const settingsCompletedRef = useRef(false);
  const isMounted = useRef(true);
  
  console.log(`🔍 Auth component state (useAuth instance: ${_instanceId}):`, { loading, isAuthenticated, settingsLoading, enableSignup });

  // Fetch public system settings to check if signup is enabled
  useEffect(() => {
    console.log('🔧 Settings useEffect running...');
    
    // Don't fetch settings if user is already authenticated
    if (isAuthenticated) {
      console.log('🔧 User already authenticated, skipping settings fetch');
      setSettingsLoading(false);
      return;
    }
    
    let timeoutId: NodeJS.Timeout;

    const fetchSettings = async () => {
      console.log('🔧 Starting settings fetch...');
      // Prevent multiple concurrent fetches
      if (settingsCompletedRef.current) {
        console.log('🔧 Settings already completed, skipping fetch');
        return;
      }
      
      try {
        console.log('🔧 Setting settingsLoading to true');
        setSettingsLoading(true);
        
        // Create abort controller for request cancellation
        const controller = new AbortController();
        timeoutId = setTimeout(() => {
          console.log('⏰ Settings fetch timeout (3s) - aborting');
          controller.abort();
        }, 3000); // 3 second timeout
        
        console.log('📡 Calling getPublicSystemSettings...');
        const settings = await getPublicSystemSettings(controller.signal);
        console.log('✅ Settings fetched successfully:', settings);
        
        // Always set the state, even if component unmounts
        // This prevents the infinite loading issue
        const signupSetting = settings.find(s => s.key === 'enable_signup');
        const enableSignupValue = signupSetting ? signupSetting.value === true : false;
        console.log('🔧 Signup setting:', { signupSetting, enableSignupValue });
        
        // Store in session storage for persistence across component unmounts
        sessionStorage.setItem('auth_settings_fetched', 'true');
        sessionStorage.setItem('auth_signup_enabled', enableSignupValue.toString());
        
        // Set both states atomically to prevent race conditions
        setEnableSignup(enableSignupValue);
        setSettingsLoading(false);
        
        settingsCompletedRef.current = true;
        clearTimeout(timeoutId);
        console.log('🔧 Settings fetch completed successfully');
      } catch (error) {
        console.error('❌ Error fetching settings:', error);
        
        // Always set the state, even if component unmounts
        // Default to disabled if there's an error
        sessionStorage.setItem('auth_settings_fetched', 'true');
        sessionStorage.setItem('auth_signup_enabled', 'false');
        
        setEnableSignup(false);
        setSettingsLoading(false);
        settingsCompletedRef.current = true;
        console.log('🔧 Settings fetch failed, defaulting to disabled signup');
      }
    };

    // Add fallback timeout
    const fallbackTimeoutId = setTimeout(() => {
      console.log('⏰ Fallback timeout (3s) triggered');
      if (!settingsCompletedRef.current) {
        console.warn('⏰ Settings fetch timeout, defaulting to disabled signup');
        sessionStorage.setItem('auth_settings_fetched', 'true');
        sessionStorage.setItem('auth_signup_enabled', 'false');
        
        setEnableSignup(false);
        setSettingsLoading(false);
        settingsCompletedRef.current = true;
      } else {
        console.log('⏰ Fallback timeout but settings already completed');
      }
    }, 3000); // 3 second fallback timeout to match abort timeout

    fetchSettings();

    return () => {
      console.log('🧹 Auth component cleanup - unmounting');
      clearTimeout(timeoutId);
      clearTimeout(fallbackTimeoutId);
      settingsCompletedRef.current = true;
    };
  }, [isAuthenticated]); // Add isAuthenticated to dependencies

  // Cleanup effect for component unmount
  useEffect(() => {
    return () => {
      isMounted.current = false;
    };
  }, []);

  // Redirect to main app if already authenticated
  if (isAuthenticated && !loading) {
    console.log('🔒 User authenticated, redirecting to main app...');
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

  // Debug logging
  console.log('🔍 Auth component render state:', { loading, settingsLoading, isAuthenticated });
  
  // This check is now handled by the redirect above
  
  if (loading || settingsLoading) {
    console.log('⏳ Showing loading spinner - loading:', loading, 'settingsLoading:', settingsLoading);
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
        <div className="ml-3 text-sm text-muted-foreground">
          {loading ? 'Initializing authentication...' : 'Loading settings...'}
        </div>
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

        {/* Demo Credentials 
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
        </Card> */}
      </div>
    </div>
  );
}
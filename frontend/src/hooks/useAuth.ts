import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { getSupabaseClient, getFallbackSupabaseClient } from '@/lib/supabase-config';
import { toast } from 'sonner';
import { performanceMonitor } from '@/lib/performance';

// Cache for user permissions to avoid redundant queries
const permissionsCache = new Map<string, { permissions: string[], role: string | null, timestamp: number }>();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

// Track active requests to prevent concurrent calls (legacy - keeping for compatibility)
const activeRequests = new Set<string>();

// Global flag to prevent multiple auth initializations
let isAuthInitializing = false;

export const useAuth = () => {
  // Add unique instance ID to track hook instances
  const instanceId = useRef(Math.random().toString(36).substr(2, 9));
  console.log(`🔧 useAuth hook instance created: ${instanceId.current}`);
  
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [supabase, setSupabase] = useState<any>(null);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [role, setRole] = useState<string | null>(null);
  const isSigningOutRef = useRef(false);
  const lastPermissionCheck = useRef<number>(0);
  const permissionCheckInterval = useRef<NodeJS.Timeout | null>(null);

  // Function to check if user is active with caching and rate limiting
  const checkUserStatus = useCallback(async (supabaseClient: any, userId: string) => {
    performanceMonitor.startTimer('auth-check-user-status');
    
    try {
      const { data: profileData, error: profileError } = await supabaseClient
        .from('profiles')
        .select('is_active')
        .eq('id', userId)
        .single();

      if (profileError) {
        console.error('Error fetching user profile:', profileError);
        return false;
      }

      return profileData.is_active;
    } catch (error) {
      console.error('Error checking user status:', error);
      return false;
    } finally {
      performanceMonitor.endTimer('auth-check-user-status');
    }
  }, []);

  // Function to handle deactivation
  const handleDeactivation = useCallback(async (supabaseClient: any) => {
    performanceMonitor.startTimer('auth-handle-deactivation');
    if (isSigningOutRef.current) return;
    isSigningOutRef.current = true;
    toast.error('Your account has been deactivated. Please contact an administrator.');
    await supabaseClient.auth.signOut();
    setSession(null);
    setUser(null);
    setLoading(false);
    performanceMonitor.endTimer('auth-handle-deactivation');
  }, []);

  // Optimized permission fetching with caching
  const fetchUserPermissions = useCallback(async (supabaseClient: any, userId: string) => {
    performanceMonitor.startTimer('auth-fetch-permissions');
    
    try {
      // Check cache first
      const cached = permissionsCache.get(userId);
      const now = Date.now();
      
      if (cached && (now - cached.timestamp) < CACHE_DURATION) {
        console.log('Using cached permissions for user:', userId);
        setPermissions(cached.permissions);
        setRole(cached.role);
        return;
      }

      // Rate limit permission checks
      if (now - lastPermissionCheck.current < 1000) {
        console.log('Skipping permission check - too recent');
        return;
      }
      
      lastPermissionCheck.current = now;
      console.log('Fetching permissions for user:', userId);
      
      // Get profile with role relation
      const { data: profile, error: profileError } = await supabaseClient
        .from('profiles')
        .select('role_id, roles(name, permissions)')
        .eq('id', userId)
        .single();
      
      if (profileError || !profile) {
        console.log('No profile found or error occurred');
        setPermissions([]);
        setRole(null);
        // Cache empty permissions
        permissionsCache.set(userId, { permissions: [], role: null, timestamp: now });
        return;
      }
      
      if (profile.roles) {
        const userPermissions = profile.roles.permissions || [];
        const userRole = profile.roles.name || null;
        
        console.log('Set permissions:', userPermissions);
        console.log('Set role:', userRole);
        
        setPermissions(userPermissions);
        setRole(userRole);
        
        // Cache the permissions
        permissionsCache.set(userId, { 
          permissions: userPermissions, 
          role: userRole, 
          timestamp: now 
        });
      } else {
        console.log('No role found for user');
        setPermissions([]);
        setRole(null);
        permissionsCache.set(userId, { permissions: [], role: null, timestamp: now });
      }
    } catch (e) {
      console.error('Error fetching permissions:', e);
      setPermissions([]);
      setRole(null);
    } finally {
      performanceMonitor.endTimer('auth-fetch-permissions');
    }
  }, []);

  // Optimized auth state change handler
  const handleAuthStateChange = useCallback(async (event: string, session: Session | null, supabaseClient: any) => {
    performanceMonitor.startTimer('auth-state-change');
    if (event === 'SIGNED_IN' && session?.user) {
      const isActive = await checkUserStatus(supabaseClient, session.user.id);
      if (!isActive) {
        await handleDeactivation(supabaseClient);
        return;
      }
      await fetchUserPermissions(supabaseClient, session.user.id);
    } else if (session?.user) {
      await fetchUserPermissions(supabaseClient, session.user.id);
    } else {
      setPermissions([]);
      setRole(null);
    }
    setSession(session);
    setUser(session?.user ?? null);
    setLoading(false);
    performanceMonitor.endTimer('auth-state-change');
  }, [checkUserStatus, handleDeactivation, fetchUserPermissions]);

  useEffect(() => {
    let mounted = true;
    let subscription: any = null;
    
    const initializeAuth = async () => {
      console.log(`🚀 Starting auth initialization for instance ${instanceId.current}...`);
      performanceMonitor.startTimer('auth-initialize');
      
      try {
        console.log('📡 Getting Supabase client...');
        // Get Supabase client (now with singleton protection)
        const client = await getSupabaseClient();
        
        if (!mounted) {
          console.log('❌ Component unmounted during client fetch');
          return;
        }
        
        console.log('✅ Supabase client obtained, setting up auth listener...');
        setSupabase(client);
        
        // Set up auth state listener
        const { data: { subscription: authSubscription } } = client.auth.onAuthStateChange(
          (event, session) => {
            console.log('🔄 Auth state change:', event, session?.user?.id);
            if (mounted) {
              handleAuthStateChange(event, session, client);
            }
          }
        );
        
        subscription = authSubscription;

        console.log('🔍 Checking for existing session...');
        // Check for existing session
        const { data: { session: existingSession } } = await client.auth.getSession();
        
        if (!mounted) {
          console.log('❌ Component unmounted during session check');
          return;
        }
        
        console.log('📋 Session check result:', existingSession ? 'Found session' : 'No session');
        
        // Set session and user state
        setSession(existingSession);
        setUser(existingSession?.user ?? null);
        
        // Handle user permissions if authenticated
        if (existingSession?.user) {
          console.log('👤 User authenticated, checking permissions...');
          try {
            // Check if existing user is still active
            const isActive = await checkUserStatus(client, existingSession.user.id);
            if (!isActive) {
              console.log('❌ User not active, handling deactivation...');
              await handleDeactivation(client);
              // Clear user state after deactivation
              setUser(null);
              setSession(null);
            } else {
              console.log('✅ User active, fetching permissions...');
              await fetchUserPermissions(client, existingSession.user.id);
            }
          } catch (permError) {
            console.error('Error handling user permissions:', permError);
            // Don't block auth initialization for permission errors
          }
        } else {
          console.log('👤 No authenticated user found');
          // Ensure user and session are explicitly set to null
          setUser(null);
          setSession(null);
        }
        
        // Always clear loading state
        if (mounted) {
          console.log('✅ Auth initialization complete, clearing loading state');
          setLoading(false);
        }
      } catch (error) {
        console.error('❌ Auth initialization failed:', error);
        if (mounted) {
          console.log('✅ Setting loading to false due to error');
          setLoading(false);
        }
      } finally {
        performanceMonitor.endTimer('auth-initialize');
      }
    };

    // Safety timeout to ensure loading state is cleared
    const loadingTimeout = setTimeout(() => {
      if (mounted) {
        console.warn('⏰ Auth initialization timeout - clearing loading state');
        setLoading(false);
      }
    }, 5000); // 5 second timeout

    initializeAuth();

    return () => {
      console.log(`🧹 Cleaning up useAuth instance ${instanceId.current}`);
      mounted = false;
      clearTimeout(loadingTimeout);
      if (subscription) {
        subscription.unsubscribe();
      }
    };
  }, []);

  // Reduced frequency of status checks (every 5 minutes instead of every minute)
  useEffect(() => {
    if (!user || !supabase) return;

    // Clear any existing interval
    if (permissionCheckInterval.current) {
      clearInterval(permissionCheckInterval.current);
    }

    permissionCheckInterval.current = setInterval(async () => {
      performanceMonitor.startTimer('auth-periodic-status-check');
      try {
        const isActive = await checkUserStatus(supabase, user.id);
        if (!isActive) {
          await handleDeactivation(supabase);
        }
      } catch (error) {
        console.error('Periodic status check failed:', error);
      } finally {
        performanceMonitor.endTimer('auth-periodic-status-check');
      }
    }, 10 * 60 * 1000); // Check every 10 minutes instead of 5

    return () => {
      if (permissionCheckInterval.current) {
        clearInterval(permissionCheckInterval.current);
      }
    };
  }, [user, supabase, checkUserStatus, handleDeactivation]);

  // Reset the flag on sign in
  useEffect(() => {
    if (user) isSigningOutRef.current = false;
  }, [user]);

  // Memoized permission checker to prevent unnecessary re-renders
  const hasPermission = useMemo(() => {
    return (perm: string) => {
      performanceMonitor.startTimer('auth-permission-check');
      console.log('Checking permission:', perm);
      console.log('Available permissions:', permissions);
      const hasPerm = permissions.includes(perm);
      console.log('Has permission:', hasPerm);
      performanceMonitor.endTimer('auth-permission-check');
      return hasPerm;
    };
  }, [permissions]);

  // Clear cache when user changes
  useEffect(() => {
    if (!user) {
      permissionsCache.clear();
    }
  }, [user]);

  // Cleanup function to prevent memory leaks
  useEffect(() => {
    return () => {
      // Clear the permission check interval
      if (permissionCheckInterval.current) {
        clearInterval(permissionCheckInterval.current);
      }
    };
  }, []);

  const signUp = async (email: string, password: string, userData?: { username?: string; full_name?: string; role?: string }) => {
    performanceMonitor.startTimer('auth-signup');
    if (!supabase) {
      toast.error('Supabase client not initialized');
      return { error: new Error('Supabase client not initialized') };
    }

    const redirectUrl = `${window.location.origin}/`;
    
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: userData
      }
    });

    if (error) {
      toast.error(error.message);
      return { error };
    }

    toast.success('Account created successfully!');
    performanceMonitor.endTimer('auth-signup');
    return { error: null };
  };

  const signIn = async (email: string, password: string) => {
    performanceMonitor.startTimer('auth-signin');
    
    // Prevent concurrent sign-in attempts
    if (activeRequests.has('signin')) {
      toast.error('Sign-in already in progress');
      return { error: new Error('Sign-in already in progress') };
    }
    
    if (!supabase) {
      toast.error('Supabase client not initialized');
      return { error: new Error('Supabase client not initialized') };
    }
    
    activeRequests.add('signin');

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (error) {
        toast.error(error.message);
        return { error };
      }

      // Check if user is active after successful authentication
      if (data.user) {
        try {
          const { data: profileData, error: profileError } = await supabase
            .from('profiles')
            .select('is_active')
            .eq('id', data.user.id)
            .single();

          if (profileError) {
            console.error('Error fetching user profile:', profileError);
            toast.error('Error checking user status');
            // Sign out the user since we can't verify their status
            await supabase.auth.signOut();
            return { error: new Error('Error checking user status') };
          }

          if (!profileData.is_active) {
            toast.error('Your account has been deactivated. Please contact an administrator.');
            // Sign out the inactive user
            await supabase.auth.signOut();
            return { error: new Error('Account is inactive') };
          }
        } catch (error) {
          console.error('Error checking user status:', error);
          toast.error('Error checking user status');
          // Sign out the user since we can't verify their status
          await supabase.auth.signOut();
          return { error: new Error('Error checking user status') };
        }
      }

      toast.success('Signed in successfully!');
      return { error: null };
    } catch (unexpectedError) {
      console.error('Unexpected error during sign-in:', unexpectedError);
      toast.error('An unexpected error occurred during sign-in');
      return { error: unexpectedError };
    } finally {
      activeRequests.delete('signin');
      performanceMonitor.endTimer('auth-signin');
    }
  };

  const signOut = async () => {
    performanceMonitor.startTimer('auth-signout');
    if (!supabase) {
      toast.error('Supabase client not initialized');
      return;
    }

    // Clear cache on sign out
    permissionsCache.clear();

    const { error } = await supabase.auth.signOut();
    if (error) {
      toast.error(error.message);
    } else {
      toast.success('Signed out successfully!');
    }
    performanceMonitor.endTimer('auth-signout');
  };

  // Debug logging for authentication state
  console.log(`🔍 useAuth state for instance ${instanceId.current}:`, { 
    user: user?.id, 
    session: !!session, 
    loading, 
    isAuthenticated: !!user 
  });
  
  return {
    user,
    session,
    supabase,
    loading,
    isAuthenticated: !!user,
    signUp,
    signIn,
    signOut,
    checkUserStatus,
    fetchUserPermissions,
    hasPermission,
    permissions,
    role,
    _instanceId: instanceId.current, // Debug: expose instance ID
  };
};
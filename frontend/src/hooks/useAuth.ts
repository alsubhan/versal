import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { getSupabaseClient, getFallbackSupabaseClient } from '@/lib/supabase-config';
import { toast } from 'sonner';

// Cache for user permissions to avoid redundant queries
const permissionsCache = new Map<string, { permissions: string[], role: string | null, timestamp: number }>();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

export const useAuth = () => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [supabase, setSupabase] = useState<any>(null);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [role, setRole] = useState<string | null>(null);
  const isSigningOutRef = useRef(false);
  const lastPermissionCheck = useRef<number>(0);
  const permissionCheckInterval = useRef<NodeJS.Timeout | null>(null);

  // Function to check if user is active with caching
  const checkUserStatus = useCallback(async (supabaseClient: any, userId: string) => {
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
    }
  }, []);

  // Function to handle deactivation
  const handleDeactivation = useCallback(async (supabaseClient: any) => {
    if (isSigningOutRef.current) return;
    isSigningOutRef.current = true;
    toast.error('Your account has been deactivated. Please contact an administrator.');
    await supabaseClient.auth.signOut();
    setSession(null);
    setUser(null);
    setLoading(false);
  }, []);

  // Optimized permission fetching with caching
  const fetchUserPermissions = useCallback(async (supabaseClient: any, userId: string) => {
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

      // Prevent multiple simultaneous permission checks
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
    }
  }, []);

  // Optimized auth state change handler
  const handleAuthStateChange = useCallback(async (event: string, session: Session | null, supabaseClient: any) => {
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
  }, [checkUserStatus, handleDeactivation, fetchUserPermissions]);

  useEffect(() => {
    const initializeAuth = async () => {
      try {
        // Try to get Supabase client from backend
        const client = await getSupabaseClient();
        setSupabase(client);
        
        // Set up auth state listener
        const { data: { subscription } } = client.auth.onAuthStateChange(
          (event, session) => {
            handleAuthStateChange(event, session, client);
          }
        );

        // Check for existing session
        const { data: { session: existingSession } } = await client.auth.getSession();
        if (existingSession?.user) {
          // Check if existing user is still active
          const isActive = await checkUserStatus(client, existingSession.user.id);
          if (!isActive) {
            await handleDeactivation(client);
            return;
          }
          await fetchUserPermissions(client, existingSession.user.id);
        }
        
        setSession(existingSession);
        setUser(existingSession?.user ?? null);
        setLoading(false);

        return () => subscription.unsubscribe();
      } catch (error) {
        console.error('Failed to get Supabase client from backend, using fallback:', error);
        // Use fallback client
        const fallbackClient = getFallbackSupabaseClient();
        setSupabase(fallbackClient);
        
        const { data: { subscription } } = fallbackClient.auth.onAuthStateChange(
          (event, session) => {
            handleAuthStateChange(event, session, fallbackClient);
          }
        );

        const { data: { session: existingSession } } = await fallbackClient.auth.getSession();
        if (existingSession?.user) {
          // Check if existing user is still active
          const isActive = await checkUserStatus(fallbackClient, existingSession.user.id);
          if (!isActive) {
            await handleDeactivation(fallbackClient);
            return;
          }
          await fetchUserPermissions(fallbackClient, existingSession.user.id);
        }
        
        setSession(existingSession);
        setUser(existingSession?.user ?? null);
        setLoading(false);

        return () => subscription.unsubscribe();
      }
    };

    initializeAuth();
  }, [handleAuthStateChange, checkUserStatus, handleDeactivation, fetchUserPermissions]);

  // Reduced frequency of status checks (every 5 minutes instead of every minute)
  useEffect(() => {
    if (!user || !supabase) return;

    // Clear any existing interval
    if (permissionCheckInterval.current) {
      clearInterval(permissionCheckInterval.current);
    }

    permissionCheckInterval.current = setInterval(async () => {
      const isActive = await checkUserStatus(supabase, user.id);
      if (!isActive) {
        await handleDeactivation(supabase);
      }
    }, 5 * 60 * 1000); // Check every 5 minutes

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
      console.log('Checking permission:', perm);
      console.log('Available permissions:', permissions);
      const hasPerm = permissions.includes(perm);
      console.log('Has permission:', hasPerm);
      return hasPerm;
    };
  }, [permissions]);

  // Clear cache when user changes
  useEffect(() => {
    if (!user) {
      permissionsCache.clear();
    }
  }, [user]);

  const signUp = async (email: string, password: string, userData?: { username?: string; full_name?: string; role?: string }) => {
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
    return { error: null };
  };

  const signIn = async (email: string, password: string) => {
    if (!supabase) {
      toast.error('Supabase client not initialized');
      return { error: new Error('Supabase client not initialized') };
    }

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
  };

  const signOut = async () => {
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
  };

  return {
    user,
    session,
    loading,
    isAuthenticated: !!user,
    signUp,
    signIn,
    signOut,
    permissions,
    role,
    hasPermission,
  };
};
import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

interface AdminUser {
  id: string;
  user_id: string;
  email: string;
  role: 'super_admin' | 'admin';
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  adminUser: AdminUser | null;
  isAdmin: boolean;
  isSuperAdmin: boolean;
  isLoading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [adminUser, setAdminUser] = useState<AdminUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        // Important: prevent "bounce back" to /admin/login while admin record loads
        setIsLoading(true);
        fetchAdminUser(session.user.id, session.user.email);
      } else {
        setIsLoading(false);
      }
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        if (session?.user) {
          // Important: prevent "bounce back" to /admin/login while admin record loads
          setIsLoading(true);
          // Use setTimeout to avoid Supabase deadlock
          setTimeout(() => {
            fetchAdminUser(session.user.id, session.user.email);
          }, 0);
        } else {
          setAdminUser(null);
          setIsLoading(false);
        }
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  const fetchAdminUser = async (userId: string, email?: string) => {
    try {
      const { data, error } = await supabase
        .from('admin_users')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      if (data) {
        setAdminUser(data as AdminUser);
      } else if (!data && email) {
        // Auto-create admin user if authenticated but no admin record exists
        const { data: newAdmin, error: insertError } = await supabase
          .from('admin_users')
          .insert({
            user_id: userId,
            email: email,
            role: 'admin'
          })
          .select()
          .single();
        
        if (!insertError && newAdmin) {
          setAdminUser(newAdmin as AdminUser);
        }
      }
    } catch (error) {
      console.error('Error fetching admin user:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error };
  };

  const signUp = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signUp({ email, password });
    
    if (!error && data.user) {
      // Create admin user record
      await supabase.from('admin_users').insert({
        user_id: data.user.id,
        email: email,
        role: 'admin'
      });
    }
    
    return { error };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setAdminUser(null);
  };

  const value = {
    user,
    session,
    adminUser,
    isAdmin: !!adminUser,
    isSuperAdmin: adminUser?.role === 'super_admin',
    isLoading,
    signIn,
    signUp,
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

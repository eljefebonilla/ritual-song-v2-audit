"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  type ReactNode,
} from "react";
import { createClient } from "@/lib/supabase/client";
import type { User } from "@supabase/supabase-js";
import type { UserRole } from "./grid-types";

interface Profile {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  voice_part: string | null;
  instrument: string | null;
  community_id: string | null;
  role: UserRole;
  avatar_url: string | null;
}

interface UserContextType {
  role: UserRole;
  setRole: (role: UserRole) => void;
  displayName: string;
  user: User | null;
  profile: Profile | null;
  isAuthenticated: boolean;
  isAdmin: boolean;
  signOut: () => Promise<void>;
}

const UserContext = createContext<UserContextType>({
  role: "member",
  setRole: () => {},
  displayName: "Guest",
  user: null,
  profile: null,
  isAuthenticated: false,
  isAdmin: false,
  signOut: async () => {},
});

export function UserProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [roleOverride, setRoleOverride] = useState<UserRole | null>(() => {
    if (typeof window === "undefined") return null;
    const stored = localStorage.getItem("rs_role_override");
    if (stored === "admin" || stored === "member") {
      // Sync cookie for server-side verifyAdmin()
      document.cookie = `rs_role_override=${stored};path=/;max-age=${60 * 60 * 24 * 365};SameSite=Lax`;
      return stored;
    }
    return null;
  });
  const [loading, setLoading] = useState(true);

  // Defer Supabase client creation to avoid SSR prerender failures
  // when NEXT_PUBLIC_ env vars aren't available at build time.
  const supabaseRef = useRef<ReturnType<typeof createClient> | null>(null);
  function getSupabase() {
    if (!supabaseRef.current) {
      supabaseRef.current = createClient();
    }
    return supabaseRef.current;
  }

  useEffect(() => {
    const supabase = getSupabase();

    // Get initial session
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user);
      if (user) {
        fetchProfile(user.id);
      }
      setLoading(false);
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      const newUser = session?.user ?? null;
      setUser(newUser);
      if (newUser) {
        fetchProfile(newUser.id);
      } else {
        setProfile(null);
        setRoleOverride(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function fetchProfile(userId: string) {
    const supabase = getSupabase();
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .single();
    if (data) {
      setProfile(data as Profile);
    }
  }

  async function signOut() {
    await getSupabase().auth.signOut();
    setUser(null);
    setProfile(null);
    setRoleOverride(null);
  }

  // Determine effective role
  // In local dev, default to admin so gate-code users get full access
  const isDev = process.env.NODE_ENV === "development";
  const dbRole = profile?.role ?? (isDev ? "admin" : "member");
  const role: UserRole = roleOverride ?? (user ? dbRole : (isDev ? "admin" : "member"));
  const isAdmin = role === "admin";

  // Allow role toggle for anyone (gate-code users can switch to Music Director view)
  function setRole(newRole: UserRole) {
    setRoleOverride(newRole);
    localStorage.setItem("rs_role_override", newRole);
    // Also set as cookie so server-side verifyAdmin() can read it
    document.cookie = `rs_role_override=${newRole};path=/;max-age=${60 * 60 * 24 * 365};SameSite=Lax`;
  }

  const displayName = profile?.full_name ?? (user ? "Member" : "Guest");
  const isAuthenticated = !!user;

  if (loading) {
    return (
      <UserContext.Provider
        value={{
          role: "member",
          setRole: () => {},
          displayName: "Loading...",
          user: null,
          profile: null,
          isAuthenticated: false,
          isAdmin: false,
          signOut: async () => {},
        }}
      >
        {children}
      </UserContext.Provider>
    );
  }

  return (
    <UserContext.Provider
      value={{
        role,
        setRole,
        displayName,
        user,
        profile,
        isAuthenticated,
        isAdmin,
        signOut,
      }}
    >
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  return useContext(UserContext);
}

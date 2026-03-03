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
  instrument_detail: string | null;
  musician_role: string | null;
  ensemble: string | null;
  role: UserRole;
  avatar_url: string | null;
}

interface UserContextType {
  role: UserRole;
  displayName: string;
  user: User | null;
  profile: Profile | null;
  isAuthenticated: boolean;
  isAdmin: boolean;
  signOut: () => Promise<void>;
}

const UserContext = createContext<UserContextType>({
  role: "member",
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
  }

  // Determine effective role from profile DB data only
  // In local dev, default to admin so gate-code users get full access
  const isDev = process.env.NODE_ENV === "development";
  const dbRole = profile?.role ?? (isDev ? "admin" : "member");
  const role: UserRole = user ? dbRole : (isDev ? "admin" : "member");
  const isAdmin = role === "admin";

  const displayName = profile?.full_name ?? (user ? "Member" : "Guest");
  const isAuthenticated = !!user;

  if (loading) {
    return (
      <UserContext.Provider
        value={{
          role: "member",
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

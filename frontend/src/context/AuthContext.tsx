import React, { createContext, useState, useEffect, useContext } from "react";
import { supabase } from "../utils/supabaseClient";

interface User {
  id: string;
  employeeId: string;
  name: string;
  phone: string;
  email: string;
  role: "OWNER" | "MANAGER" | "WORKER" | "CLIENT" | "TELECALLER";
  branch: string;
  joiningDate: string;
  agency: {
    id: string;
    name: string;
    slug: string;
  };
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  isOwner: boolean;
  isManager: boolean;
  isWorker: boolean;
  isClient: boolean;
  isTelecaller: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setUser(null);
        setLoading(false);
        return;
      }

      // Query public.users
      const { data: userData, error } = await supabase
        .from("users")
        .select(`
          *,
          agencies (
            agency_id,
            agency_name,
            email,
            phone
          )
        `)
        .eq("user_id", session.user.id)
        .single();

      if (error || !userData) {
        console.error("Profile not found in users table:", error);
        await supabase.auth.signOut();
        setUser(null);
        setLoading(false);
        alert("Your profile was not found in the database 'users' table. Please ensure you have completed Step 5 of the setup instructions (linking your Supabase Auth user ID to the public.users table in the SQL Editor).");
        return;
      }

      // If status is pending or inactive, reject login session
      if (userData.status !== "active") {
        console.warn("User account is not active:", userData.status);
        await supabase.auth.signOut();
        setUser(null);
        setLoading(false);
        alert(`Account status is ${userData.status.toUpperCase()}. Please contact your agency owner.`);
        return;
      }

      // Query employee ID if not owner
      let employeeId = "";
      let joiningDate = userData.created_at;

      if (userData.role !== "owner") {
        const { data: empData } = await supabase
          .from("employees")
          .select("*")
          .eq("user_id", userData.user_id)
          .maybeSingle();

        if (empData) {
          employeeId = empData.employee_id;
          joiningDate = empData.joining_date;
        }
      }

      setUser({
        id: userData.user_id,
        employeeId,
        name: userData.full_name,
        phone: userData.phone,
        email: userData.email,
        role: userData.role.toUpperCase() as "OWNER" | "MANAGER" | "WORKER" | "CLIENT" | "TELECALLER",
        branch: userData.branch || "Head Office",
        joiningDate,
        agency: {
          id: userData.agency_id,
          name: userData.agencies?.agency_name || "Star DSA",
          slug: userData.agencies?.agency_name?.toLowerCase().replace(/\s+/g, "-") || "star-dsa"
        }
      });
    } catch (err) {
      console.error("Failed to restore profile:", err);
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, _session) => {
      if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
        fetchProfile();
      } else if (event === "SIGNED_OUT") {
        setUser(null);
        setLoading(false);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const login = async (email: string, password: string) => {
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        throw new Error(error.message);
      }
      // fetchProfile will be automatically triggered by onAuthStateChange
    } catch (err) {
      throw err;
    }
  };

  const logout = async () => {
    await supabase.auth.signOut();
    setUser(null);
  };

  const isOwner = user?.role === "OWNER";
  const isManager = user?.role === "MANAGER";
  const isWorker = user?.role === "WORKER";
  const isClient = user?.role === "CLIENT";
  const isTelecaller = user?.role === "TELECALLER";

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        logout,
        isOwner,
        isManager,
        isWorker,
        isClient,
        isTelecaller
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

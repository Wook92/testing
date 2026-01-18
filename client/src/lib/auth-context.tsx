import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import type { User, Center } from "@shared/schema";
import { UserRole } from "@shared/schema";
import { queryClient } from "./queryClient";

interface AuthContextType {
  user: User | null;
  centers: Center[];
  selectedCenter: Center | null;
  isLoading: boolean;
  login: (username: string, password: string, rememberMe?: boolean) => Promise<boolean>;
  logout: () => void;
  selectCenter: (center: Center) => void;
}

// Helper to get storage based on rememberMe preference
function getStorage(): Storage {
  const rememberMe = localStorage.getItem("rememberMe") === "true";
  return rememberMe ? localStorage : sessionStorage;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [centers, setCenters] = useState<Center[]>([]);
  const [selectedCenter, setSelectedCenter] = useState<Center | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check both localStorage and sessionStorage for user data
    const storage = getStorage();
    const storedUser = storage.getItem("user") || localStorage.getItem("user");
    const storedCenter = storage.getItem("selectedCenter") || localStorage.getItem("selectedCenter");
    if (storedUser) {
      const parsedUser = JSON.parse(storedUser);
      setUser(parsedUser);
      fetchCentersForUser(parsedUser);
    }
    if (storedCenter) {
      setSelectedCenter(JSON.parse(storedCenter));
    }
    setIsLoading(false);
  }, []);

  // For admins, fetch all centers. For others, fetch only assigned centers.
  const fetchCentersForUser = async (currentUser: User) => {
    try {
      const isAdmin = currentUser.role >= UserRole.ADMIN;
      const url = isAdmin ? "/api/centers" : `/api/users/${currentUser.id}/centers`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setCenters(data);
        
        // Check if stored selectedCenter is still valid
        const storage = getStorage();
        const storedCenter = storage.getItem("selectedCenter") || localStorage.getItem("selectedCenter");
        let currentSelectedCenter = storedCenter ? JSON.parse(storedCenter) : null;
        
        // Validate that stored center exists in fetched centers
        const isValidCenter = currentSelectedCenter && data.some((c: Center) => c.id === currentSelectedCenter.id);
        
        if (!isValidCenter && data.length > 0) {
          // Stored center is invalid, use first available center
          console.log("Stored center is invalid, switching to:", data[0].name);
          setSelectedCenter(data[0]);
          storage.setItem("selectedCenter", JSON.stringify(data[0]));
          localStorage.setItem("selectedCenter", JSON.stringify(data[0]));
        } else if (isValidCenter) {
          // Update with fresh center data from server
          const freshCenter = data.find((c: Center) => c.id === currentSelectedCenter.id);
          setSelectedCenter(freshCenter);
          storage.setItem("selectedCenter", JSON.stringify(freshCenter));
        } else if (data.length > 0) {
          setSelectedCenter(data[0]);
          storage.setItem("selectedCenter", JSON.stringify(data[0]));
        }
      }
    } catch (error) {
      console.error("Failed to fetch centers:", error);
    }
  };

  const login = async (username: string, password: string, rememberMe: boolean = true): Promise<boolean> => {
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      if (res.ok) {
        const data = await res.json();
        queryClient.clear();
        setUser(data.user);
        
        // Use localStorage for persistent login, sessionStorage for session-only
        const storage = rememberMe ? localStorage : sessionStorage;
        storage.setItem("user", JSON.stringify(data.user));
        
        // For admins, fetch all centers. For others, use centers from login response.
        const isAdmin = data.user.role >= UserRole.ADMIN;
        if (isAdmin) {
          const centersRes = await fetch("/api/centers");
          if (centersRes.ok) {
            const allCenters = await centersRes.json();
            setCenters(allCenters);
            if (allCenters.length > 0) {
              setSelectedCenter(allCenters[0]);
              storage.setItem("selectedCenter", JSON.stringify(allCenters[0]));
            }
          }
        } else {
          setCenters(data.centers || []);
          if (data.centers?.length > 0) {
            setSelectedCenter(data.centers[0]);
            storage.setItem("selectedCenter", JSON.stringify(data.centers[0]));
          }
        }
        return true;
      }
      return false;
    } catch (error) {
      console.error("Login failed:", error);
      return false;
    }
  };

  const logout = () => {
    queryClient.clear();
    setUser(null);
    setCenters([]);
    setSelectedCenter(null);
    // Clear from both storages to ensure complete logout
    localStorage.removeItem("user");
    localStorage.removeItem("selectedCenter");
    sessionStorage.removeItem("user");
    sessionStorage.removeItem("selectedCenter");
  };

  const selectCenter = (center: Center) => {
    setSelectedCenter(center);
    const storage = getStorage();
    storage.setItem("selectedCenter", JSON.stringify(center));
  };

  return (
    <AuthContext.Provider value={{ user, centers, selectedCenter, isLoading, login, logout, selectCenter }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

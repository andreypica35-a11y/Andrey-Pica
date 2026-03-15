import React, { useState, useEffect, createContext, useContext } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, setDoc, updateDoc, serverTimestamp } from "firebase/firestore";
import { auth, db, handleFirestoreError, OperationType } from "../firebase";
import { UserProfile } from "../types";

interface AuthContextType {
  user: any | null;
  profile: UserProfile | null;
  loading: boolean;
  updateProfile: (data: Partial<UserProfile>) => Promise<void>;
  switchRole: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<any | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setUser(user);
      if (user) {
        try {
          const docRef = doc(db, "users", user.uid);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            const data = docSnap.data() as UserProfile;
            // Check if user should be admin based on email
            if (user.email === "andreypica35@gmail.com" && data.role !== "admin") {
              const updatedProfile = { ...data, role: "admin" as const };
              await updateDoc(docRef, { role: "admin" });
              setProfile(updatedProfile);
            } else {
              setProfile(data);
            }
          } else {
            // Auto-create profile if it doesn't exist
            const isAdminEmail = user.email === "andreypica35@gmail.com";
            const newProfile: UserProfile = {
              uid: user.uid,
              email: user.email || "",
              displayName: user.displayName || "User",
              photoURL: user.photoURL || "",
              role: isAdminEmail ? "admin" : "worker",
              isVerified: false,
              createdAt: serverTimestamp(),
              rating: 5,
              reviewCount: 0
            };
            await setDoc(docRef, newProfile);
            setProfile(newProfile);
          }
        } catch (error) {
          console.error("Error fetching/creating profile:", error);
        }
      } else {
        setProfile(null);
      }
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const updateProfile = async (data: Partial<UserProfile>) => {
    if (!user) return;
    try {
      const docRef = doc(db, "users", user.uid);
      await updateDoc(docRef, data);
      setProfile(prev => prev ? { ...prev, ...data } : null);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${user.uid}`);
    }
  };

  const switchRole = async () => {
    if (!user || !profile) return;
    const newRole = profile.role === "worker" ? "employer" : "worker";
    try {
      const docRef = doc(db, "users", user.uid);
      await updateDoc(docRef, { role: newRole });
      setProfile(prev => prev ? { ...prev, role: newRole } : null);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${user.uid}`);
    }
  };

  return (
    <AuthContext.Provider value={{ user, profile, loading, updateProfile, switchRole }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
};

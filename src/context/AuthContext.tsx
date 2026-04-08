import React, { useState, useEffect, createContext, useContext } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, setDoc, updateDoc, serverTimestamp, onSnapshot } from "firebase/firestore";
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
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      if (!user) {
        setProfile(null);
        setLoading(false);
      }
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!user) {
      setProfile(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    const publicDocRef = doc(db, "users", user.uid);
    const privateDocRef = doc(db, "users_private", user.uid);

    // Initialize profiles if they don't exist
    const initialize = async () => {
      try {
        const [publicSnap, privateSnap] = await Promise.all([
          getDoc(publicDocRef),
          getDoc(privateDocRef)
        ]);

        if (!publicSnap.exists()) {
          const isAdminEmail = user.email === "andreypica35@gmail.com";
          await setDoc(publicDocRef, {
            uid: user.uid,
            displayName: user.displayName || "User",
            photoURL: user.photoURL || "",
            role: isAdminEmail ? "admin" : "worker",
            isVerified: false,
            verificationStatus: 'unverified',
            createdAt: serverTimestamp(),
            lastActive: serverTimestamp(),
            rating: 5,
            reviewCount: 0,
            skills: [],
            experience: "",
            bio: ""
          });
        } else {
          // Update lastActive
          await updateDoc(publicDocRef, { lastActive: serverTimestamp() }).catch(() => {});
        }

        if (!privateSnap.exists()) {
          await setDoc(privateDocRef, {
            email: user.email || "",
            balance: 0,
            linkedAccounts: [],
            notificationPreferences: {
              newApplications: true,
              messages: true,
              gigStatusUpdates: true,
              marketing: false
            }
          });
        }
      } catch (error) {
        console.error("Error initializing profile:", error);
      }
    };

    initialize();

    // Set up real-time listeners
    let publicData: any = null;
    let privateData: any = null;

    const unsubPublic = onSnapshot(publicDocRef, (doc) => {
      if (doc.exists()) {
        publicData = doc.data();
        if (privateData) {
          setProfile({ ...publicData, ...privateData });
          setLoading(false);
        } else {
          setProfile(prev => prev ? { ...prev, ...publicData } : null);
        }
      }
    }, (error) => {
      console.error("Public profile listener error:", error);
      setLoading(false);
    });

    const unsubPrivate = onSnapshot(privateDocRef, (doc) => {
      if (doc.exists()) {
        privateData = doc.data();
        if (publicData) {
          setProfile({ ...publicData, ...privateData });
          setLoading(false);
        } else {
          setProfile(prev => prev ? { ...prev, ...privateData } : null);
        }
      }
    }, (error) => {
      console.error("Private profile listener error:", error);
      setLoading(false);
    });

    return () => {
      unsubPublic();
      unsubPrivate();
    };
  }, [user]);

  const updateProfile = async (data: Partial<UserProfile>) => {
    if (!user) return;
    try {
      const publicFields = ['displayName', 'photoURL', 'role', 'isVerified', 'verificationStatus', 'bio', 'skills', 'experience', 'rating', 'reviewCount'];
      const privateFields = ['email', 'phoneNumber', 'address', 'paymentNumber', 'linkedAccounts', 'balance', 'idType', 'idNumber', 'idImageURL', 'notificationPreferences'];

      const publicUpdate: any = {};
      const privateUpdate: any = {};

      Object.keys(data).forEach(key => {
        if (publicFields.includes(key)) publicUpdate[key] = (data as any)[key];
        if (privateFields.includes(key)) privateUpdate[key] = (data as any)[key];
      });

      if (Object.keys(publicUpdate).length > 0) {
        await updateDoc(doc(db, "users", user.uid), publicUpdate);
      }
      if (Object.keys(privateUpdate).length > 0) {
        await updateDoc(doc(db, "users_private", user.uid), privateUpdate);
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${user.uid}`);
    }
  };

  const switchRole = async () => {
    if (!user || !profile) {
      console.warn("Cannot switch role: No user or profile found");
      return;
    }
    
    // Don't switch if admin (unless they want to)
    if (profile.role === "admin") {
      console.log("Admin role detected, skipping switch or handle specifically");
      return;
    }

    const newRole = profile.role === "worker" ? "employer" : "worker";
    console.log(`Switching role from ${profile.role} to ${newRole} for user ${user.uid}`);
    
    try {
      await updateDoc(doc(db, "users", user.uid), { role: newRole });
      console.log("Role updated successfully in Firestore");
    } catch (error) {
      console.error("Error switching role:", error);
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

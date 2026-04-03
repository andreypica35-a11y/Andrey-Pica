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
    if (!user) return;

    const publicDocRef = doc(db, "users", user.uid);
    
    // Update lastActive and check admin role once on mount
    getDoc(publicDocRef).then(docSnap => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (user.email === "andreypica35@gmail.com" && data.role !== "admin") {
          updateDoc(publicDocRef, { role: "admin", lastActive: serverTimestamp() }).catch(err => console.error("Failed to set admin:", err));
        } else {
          updateDoc(publicDocRef, { lastActive: serverTimestamp() }).catch(err => console.error("Failed to update lastActive:", err));
        }
      }
    }).catch(err => console.error("Failed to fetch profile for update:", err));
  }, [user]);

  useEffect(() => {
    if (!user) return;

    const publicDocRef = doc(db, "users", user.uid);
    const privateDocRef = doc(db, "users_private", user.uid);

    let publicData: any = null;
    let privateData: any = null;

    const updateMergedProfile = () => {
      if (publicData && privateData) {
        setProfile({ ...publicData, ...privateData });
        setLoading(false);
      }
    };

    const fetchProfile = async () => {
      try {
        const [publicSnap, privateSnap] = await Promise.all([
          getDoc(publicDocRef),
          getDoc(privateDocRef)
        ]);

        if (publicSnap.exists()) {
          publicData = publicSnap.data();
        } else {
          // Create initial public profile
          const isAdminEmail = user.email === "andreypica35@gmail.com";
          const newPublicProfile = {
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
          };
          await setDoc(publicDocRef, newPublicProfile);
          publicData = newPublicProfile;
        }

        if (privateSnap.exists()) {
          privateData = privateSnap.data();
        } else {
          // Create initial private profile
          const newPrivateProfile = {
            email: user.email || "",
            balance: 0,
            linkedAccounts: [],
            notificationPreferences: {
              newApplications: true,
              messages: true,
              gigStatusUpdates: true,
              marketing: false
            }
          };
          await setDoc(privateDocRef, newPrivateProfile);
          privateData = newPrivateProfile;
        }

        updateMergedProfile();
      } catch (error) {
        console.error("Error fetching profile:", error);
        try {
          handleFirestoreError(error, OperationType.GET, `users/${user.uid}`);
        } catch (e) {}
        setLoading(false);
      }
    };

    fetchProfile();
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
    if (!user || !profile) return;
    const newRole = profile.role === "worker" ? "employer" : "worker";
    try {
      await updateDoc(doc(db, "users", user.uid), { role: newRole });
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

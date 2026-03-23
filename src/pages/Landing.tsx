import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { signInWithPopup } from "firebase/auth";
import { auth, googleProvider } from "../firebase";
import { motion } from "motion/react";
import { Button, Card } from "../components/UI";
import { Clock, Wallet, Shield } from "lucide-react";
import { toast } from "sonner";

export const LandingPage = () => {
  const { user, profile } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user && profile) {
      navigate("/dashboard");
    }
  }, [user, profile, navigate]);

  const [signingIn, setSigningIn] = React.useState(false);

  const handleSignIn = async () => {
    if (signingIn) return;
    setSigningIn(true);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error: any) {
      // Ignore cancellation errors
      if (error.code === 'auth/cancelled-popup-request' || error.code === 'auth/popup-closed-by-user') {
        return;
      }
      
      if (error.code === 'auth/network-request-failed') {
        toast.error("Network error: Please check your internet connection or disable any ad-blockers/privacy extensions that might be blocking Google Sign-In.");
      } else {
        console.error("Sign in error:", error);
        toast.error(`Sign in failed: ${error.message}`);
      }
    } finally {
      setSigningIn(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-50 flex flex-col">
      <nav className="p-6 flex justify-between items-center max-w-7xl mx-auto w-full">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 bg-emerald-600 rounded-xl flex items-center justify-center text-white font-bold text-xl">R</div>
          <span className="text-2xl font-bold tracking-tight text-zinc-900">Raketero</span>
        </div>
        <Button onClick={handleSignIn} disabled={signingIn} variant="outline">
          {signingIn ? "Signing in..." : "Sign In"}
        </Button>
      </nav>

      <main className="flex-1 flex flex-col items-center justify-center px-6 text-center max-w-4xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <span className="px-4 py-1.5 bg-emerald-100 text-emerald-700 rounded-full text-sm font-semibold mb-6 inline-block">
            Local Gigs & Side Hustles
          </span>
          <h1 className="text-5xl md:text-7xl font-bold text-zinc-900 tracking-tight mb-6 leading-tight">
            Find your next <span className="text-emerald-600 italic">raket</span> today.
          </h1>
          <p className="text-xl text-zinc-600 mb-10 max-w-2xl mx-auto">
            The platform connecting local workers with quick help. Delivery, cleaning, repairs, and more.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button onClick={handleSignIn} disabled={signingIn} size="lg" className="w-full sm:w-auto">
              {signingIn ? "Please wait..." : "Start Earning"}
            </Button>
            <Button onClick={handleSignIn} disabled={signingIn} variant="secondary" size="lg" className="w-full sm:w-auto">
              {signingIn ? "Please wait..." : "Hire a Raketero"}
            </Button>
          </div>
        </motion.div>

        <div className="mt-20 grid grid-cols-1 md:grid-cols-3 gap-8 w-full">
          {[
            { icon: <Clock className="w-6 h-6 text-emerald-600" />, title: "Quick Gigs", desc: "Find tasks that fit your schedule perfectly." },
            { icon: <Wallet className="w-6 h-6 text-emerald-600" />, title: "Fast Payments", desc: "Secure GCash & Maya payments with low service fees." },
            { icon: <Shield className="w-6 h-6 text-emerald-600" />, title: "Verified Users", desc: "Work and hire with confidence through our verification system." }
          ].map((feature, i) => (
            <Card key={i} className="p-8 text-left hover:border-emerald-200 transition-colors">
              <div className="mb-4">{feature.icon}</div>
              <h3 className="text-xl font-bold mb-2">{feature.title}</h3>
              <p className="text-zinc-600">{feature.desc}</p>
            </Card>
          ))}
        </div>
      </main>

      <footer className="p-10 border-t border-zinc-200 text-center text-zinc-500 text-sm">
        © 2026 Raketero Platform. All rights reserved.
      </footer>
    </div>
  );
};

import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { signOut } from "firebase/auth";
import { auth } from "../firebase";
import { 
  Briefcase, 
  User, 
  PlusCircle, 
  MessageSquare, 
  LogOut, 
  Shield, 
  Menu, 
  X,
  LayoutDashboard,
  RefreshCw,
  Wallet
} from "lucide-react";
import { cn } from "./UI";
import { toast } from "sonner";

export const DashboardLayout = ({ children }: { children: React.ReactNode }) => {
  const { profile, switchRole } = useAuth();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [switching, setSwitching] = useState(false);
  const navigate = useNavigate();

  const handleLogout = async () => {
    await signOut(auth);
    navigate("/");
  };

  const handleSwitchRole = async () => {
    if (!profile) return;
    setSwitching(true);
    const targetRole = profile.role === "worker" ? "Employer" : "Worker";
    const toastId = toast.loading(`Switching to ${targetRole} mode...`);
    
    try {
      await switchRole();
      toast.success(`Switched to ${targetRole} mode`, { id: toastId });
      navigate("/dashboard");
    } catch (error) {
      toast.error("Failed to switch role", { id: toastId });
    } finally {
      setSwitching(false);
    }
  };

  const navItems = [
    { label: "Dashboard", icon: <LayoutDashboard className="w-5 h-5" />, path: "/dashboard" },
    { label: "Wallet", icon: <Wallet className="w-5 h-5" />, path: "/wallet" },
    { label: "Messages", icon: <MessageSquare className="w-5 h-5" />, path: "/messages" },
    { label: "Profile", icon: <User className="w-5 h-5" />, path: "/profile" },
  ];

  if (profile?.role === "employer") {
    navItems.splice(1, 0, { label: "Post a Gig", icon: <PlusCircle className="w-5 h-5" />, path: "/post-gig" });
  }

  if (profile?.role === "admin") {
    navItems.push({ label: "Admin Panel", icon: <Shield className="w-5 h-5" />, path: "/admin" });
  }

  return (
    <div className="min-h-screen bg-zinc-50 flex flex-col md:flex-row">
      {/* Mobile Header */}
      <div className="md:hidden bg-white border-b border-zinc-200 p-4 flex justify-between items-center sticky top-0 z-50">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-emerald-600 rounded-lg flex items-center justify-center text-white font-bold">R</div>
          <span className="font-bold text-zinc-900">Raketero</span>
        </div>
        <button onClick={() => setIsMenuOpen(!isMenuOpen)}>
          {isMenuOpen ? <X /> : <Menu />}
        </button>
      </div>

      {/* Sidebar */}
      <aside className={cn(
        "fixed inset-0 z-40 bg-white border-r border-zinc-200 w-64 transform transition-transform md:relative md:translate-x-0",
        isMenuOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="p-6 hidden md:flex items-center gap-2 mb-8">
          <div className="w-10 h-10 bg-emerald-600 rounded-xl flex items-center justify-center text-white font-bold text-xl">R</div>
          <span className="text-2xl font-bold tracking-tight text-zinc-900">Raketero</span>
        </div>

        <nav className="px-4 space-y-1">
          {navItems.map((item) => (
            <Link 
              key={item.path} 
              to={item.path}
              onClick={() => setIsMenuOpen(false)}
              className="flex items-center gap-3 px-4 py-3 text-zinc-600 hover:bg-zinc-50 hover:text-emerald-600 rounded-xl transition-colors"
            >
              {item.icon}
              <span className="font-medium">{item.label}</span>
            </Link>
          ))}
        </nav>

        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-zinc-100">
          <button 
            onClick={handleSwitchRole}
            disabled={switching}
            className="flex items-center gap-3 w-full px-4 py-3 mb-2 text-emerald-600 hover:bg-emerald-50 rounded-xl transition-colors disabled:opacity-50"
          >
            <RefreshCw className={cn("w-5 h-5", switching && "animate-spin")} />
            <span className="font-medium">Switch to {profile?.role === "worker" ? "Employer" : "Worker"}</span>
          </button>

          <div className="flex items-center gap-3 p-3 mb-4">
            <img src={profile?.photoURL || `https://ui-avatars.com/api/?name=${profile?.displayName}`} className="w-10 h-10 rounded-full bg-zinc-200" alt="" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold truncate">{profile?.displayName}</p>
              <p className="text-xs text-zinc-500 capitalize">{profile?.role}</p>
            </div>
          </div>
          <button 
            onClick={handleLogout}
            className="flex items-center gap-3 w-full px-4 py-3 text-red-600 hover:bg-red-50 rounded-xl transition-colors"
          >
            <LogOut className="w-5 h-5" />
            <span className="font-medium">Logout</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-6 md:p-10 max-w-7xl mx-auto w-full">
        {children}
      </main>
    </div>
  );
};

import React from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { LandingPage } from "./pages/Landing";
import { Dashboard } from "./pages/Dashboard";
import { PostGig } from "./pages/PostGig";
import { GigDetails } from "./pages/GigDetails";
import { Messages } from "./pages/Messages";
import { Profile } from "./pages/Profile";
import { AdminPanel } from "./pages/Admin";

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, profile, loading } = useAuth();
  
  if (loading) return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  if (!user) return <Navigate to="/" />;
  
  return <>{children}</>;
};

export default function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          
          <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="/post-gig" element={<ProtectedRoute><PostGig /></ProtectedRoute>} />
          <Route path="/gig/:id" element={<ProtectedRoute><GigDetails /></ProtectedRoute>} />
          <Route path="/messages" element={<ProtectedRoute><Messages /></ProtectedRoute>} />
          <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
          <Route path="/admin" element={<ProtectedRoute><AdminPanel /></ProtectedRoute>} />
          
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

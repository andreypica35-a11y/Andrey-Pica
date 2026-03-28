import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { collection, query, where, onSnapshot, orderBy } from "firebase/firestore";
import { db, handleFirestoreError, OperationType } from "../firebase";
import { useAuth } from "../context/AuthContext";
import { Gig } from "../types";
import { DashboardLayout } from "../components/Layout";
import { Card, Button } from "../components/UI";
import { PlusCircle, Search, MapPin, Clock, Wallet, Shield, CheckCircle } from "lucide-react";
import { format } from "date-fns";

export const Dashboard = () => {
  const { profile } = useAuth();
  const [gigs, setGigs] = useState<Gig[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Cleanup expired gigs
    fetch("/api/gigs/cleanup", { method: "POST" }).catch(err => console.error("Cleanup failed:", err));
  }, []);

  useEffect(() => {
    if (!profile) return;

    const q = profile.role === "worker" 
      ? query(collection(db, "gigs"), where("status", "==", "open"), orderBy("createdAt", "desc"))
      : query(collection(db, "gigs"), where("employerId", "==", profile.uid), orderBy("createdAt", "desc"));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const allGigs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Gig));
      // For workers, we only want open gigs (already filtered by query)
      // For employers, we show all their gigs, but we might want to label expired ones
      setGigs(allGigs);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, "gigs");
      setLoading(false);
    });

    return unsubscribe;
  }, [profile]);

  const [showExpired, setShowExpired] = useState(false);

  const filteredGigs = profile?.role === "worker" 
    ? gigs 
    : gigs.filter(g => showExpired || g.status !== "expired");

  return (
    <DashboardLayout>
      <div className="mb-10 flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
        <div>
          <h1 className="text-4xl font-bold text-zinc-900 tracking-tight mb-2">
            Hello, {profile?.displayName?.split(' ')[0]}!
          </h1>
          <p className="text-zinc-500">
            {profile?.role === "worker" ? "Find your next raket nearby." : "Manage your posted gigs and applicants."}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {profile?.role === "employer" && (
            <>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setShowExpired(!showExpired)}
                className={showExpired ? "bg-zinc-100" : ""}
              >
                {showExpired ? "Hide Expired" : "Show Expired"}
              </Button>
              <Link to="/post-gig">
                <Button className="gap-2">
                  <PlusCircle className="w-5 h-5" />
                  Post a Gig
                </Button>
              </Link>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <h2 className="text-xl font-bold flex items-center gap-2">
            {profile?.role === "worker" ? "Available Gigs" : "Your Gigs"}
            <span className="px-2 py-0.5 bg-zinc-100 text-zinc-500 rounded-md text-xs">{filteredGigs.length}</span>
          </h2>

          {loading ? (
            <div className="space-y-4">
              {[1, 2, 3].map(i => <div key={i} className="h-32 bg-zinc-100 rounded-2xl animate-pulse" />)}
            </div>
          ) : filteredGigs.length > 0 ? (
            <div className="space-y-4">
              {filteredGigs.map((gig) => (
                <Card key={gig.id} className="p-6 hover:border-emerald-200 transition-all group">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-bold text-emerald-600 uppercase tracking-wider block">{gig.category}</span>
                        {gig.status === "expired" && (
                          <span className="text-[10px] font-bold bg-red-100 text-red-600 px-1.5 py-0.5 rounded uppercase tracking-wider">Expired</span>
                        )}
                      </div>
                      <h3 className="text-xl font-bold group-hover:text-emerald-600 transition-colors">{gig.title}</h3>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold text-zinc-900">₱{gig.payment}</p>
                      <p className="text-xs text-zinc-500">{gig.duration}</p>
                    </div>
                  </div>
                  <p className="text-zinc-600 text-sm mb-6 line-clamp-2">{gig.description}</p>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4 text-xs text-zinc-500">
                      <div className="flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        {gig.location}
                      </div>
                      <div className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {gig.createdAt?.toDate ? format(gig.createdAt.toDate(), "MMM d, h:mm a") : "Just now"}
                      </div>
                    </div>
                    <Link to={`/gig/${gig.id}`}>
                      <Button variant="outline" size="sm">View Details</Button>
                    </Link>
                  </div>
                </Card>
              ))}
            </div>
          ) : (
            <div className="text-center py-20 bg-zinc-50 rounded-3xl border-2 border-dashed border-zinc-200">
              <div className="w-16 h-16 bg-zinc-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Search className="w-8 h-8 text-zinc-400" />
              </div>
              <p className="text-zinc-500">No gigs found at the moment.</p>
            </div>
          )}
        </div>

        <div className="space-y-8">
          <Card className="p-6 bg-emerald-600 text-white">
            <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
              <Wallet className="w-5 h-5" />
              Wallet Balance
            </h3>
            <p className="text-4xl font-bold mb-2">₱{(profile?.balance || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
            <p className="text-emerald-100 text-sm mb-6">Connect your GCash or Maya to withdraw earnings.</p>
            <Link to="/wallet">
              <Button variant="secondary" className="w-full bg-white text-emerald-600 hover:bg-zinc-50">Manage Wallet</Button>
            </Link>
          </Card>

          <Card className="p-6">
            <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
              <Shield className="w-5 h-5" />
              Verification Status
            </h3>
            <div className="flex items-center gap-3 mb-4">
              {profile?.isVerified ? (
                <div className="w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-600">
                  <CheckCircle className="w-6 h-6" />
                </div>
              ) : (
                <div className="w-10 h-10 bg-zinc-100 rounded-full flex items-center justify-center text-zinc-400">
                  <Shield className="w-6 h-6" />
                </div>
              )}
              <div>
                <p className="font-bold">{profile?.isVerified ? "Verified User" : "Not Verified"}</p>
                <p className="text-xs text-zinc-500">{profile?.isVerified ? "You have full access." : "Verify to build trust."}</p>
              </div>
            </div>
            {!profile?.isVerified && (
              <Link to="/profile">
                <Button variant="outline" className="w-full">Get Verified</Button>
              </Link>
            )}
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
};

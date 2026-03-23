import React, { useState, useEffect } from "react";
import { collection, query, where, onSnapshot, orderBy, limit } from "firebase/firestore";
import { db, handleFirestoreError, OperationType } from "../firebase";
import { useAuth } from "../context/AuthContext";
import { Transaction } from "../types";
import { DashboardLayout } from "../components/Layout";
import { Card, Button, Badge } from "../components/UI";
import { Wallet as WalletIcon, ArrowUpRight, ArrowDownLeft, CreditCard, History, ExternalLink, AlertCircle } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

export const Wallet = () => {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [withdrawing, setWithdrawing] = useState(false);

  useEffect(() => {
    if (!profile) return;

    const field = profile.role === "worker" ? "workerId" : "employerId";
    const q = query(
      collection(db, "transactions"),
      where(field, "==", profile.uid),
      orderBy("createdAt", "desc"),
      limit(20)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setTransactions(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Transaction)));
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, "transactions");
      setLoading(false);
    });

    return unsubscribe;
  }, [profile]);

  const handleWithdraw = () => {
    if (!profile?.gcashNumber) {
      toast.error("Please link a GCash or Maya number in your profile first.");
      return;
    }
    if ((profile?.balance || 0) < 100) {
      toast.error("Minimum withdrawal amount is ₱100.");
      return;
    }

    setWithdrawing(true);
    // Simulate withdrawal process
    setTimeout(() => {
      toast.success("Withdrawal request submitted! Funds will be transferred to your linked account within 24 hours.");
      setWithdrawing(false);
    }, 2000);
  };

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <WalletIcon className="w-8 h-8 text-emerald-600" />
            Your Wallet
          </h1>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-10">
          <Card className="p-8 bg-emerald-600 text-white md:col-span-2 relative overflow-hidden">
            <div className="relative z-10">
              <p className="text-emerald-100 text-sm font-bold uppercase tracking-wider mb-2">Available Balance</p>
              <h2 className="text-5xl font-bold mb-6">₱{(profile?.balance || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</h2>
              <div className="flex flex-wrap gap-4">
                <Button 
                  onClick={handleWithdraw} 
                  disabled={withdrawing}
                  className="bg-white text-emerald-600 hover:bg-emerald-50 border-none"
                >
                  {withdrawing ? "Processing..." : "Withdraw Funds"}
                </Button>
                <Button variant="outline" className="border-emerald-400 text-white hover:bg-emerald-500">
                  Add Funds
                </Button>
              </div>
            </div>
            <WalletIcon className="absolute -right-8 -bottom-8 w-48 h-48 text-emerald-500/20 rotate-12" />
          </Card>

          <Card className="p-6 flex flex-col justify-between">
            <div>
              <h3 className="font-bold text-zinc-500 text-xs uppercase tracking-widest mb-4">Linked Account</h3>
              {profile?.gcashNumber ? (
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center text-blue-600">
                    <CreditCard className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="font-bold text-zinc-900">GCash / Maya</p>
                    <p className="text-sm text-zinc-500">{profile.gcashNumber}</p>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-3 text-zinc-400 italic text-sm">
                  <AlertCircle className="w-5 h-5" />
                  No account linked
                </div>
              )}
            </div>
            <Button variant="ghost" size="sm" className="w-full mt-4 text-emerald-600">
              Update Method
            </Button>
          </Card>
        </div>

        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <History className="w-5 h-5 text-zinc-400" />
              Recent Transactions
            </h2>
            <Button variant="ghost" size="sm" className="text-zinc-500">View All</Button>
          </div>

          {loading ? (
            <div className="space-y-4">
              {[1, 2, 3].map(i => <div key={i} className="h-20 bg-zinc-100 rounded-2xl animate-pulse" />)}
            </div>
          ) : transactions.length > 0 ? (
            <div className="space-y-3">
              {transactions.map((tx) => (
                <Card key={tx.id} className="p-4 flex items-center justify-between hover:border-zinc-300 transition-colors">
                  <div className="flex items-center gap-4">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                      profile?.role === 'worker' ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'
                    }`}>
                      {profile?.role === 'worker' ? <ArrowDownLeft className="w-5 h-5" /> : <ArrowUpRight className="w-5 h-5" />}
                    </div>
                    <div>
                      <p className="font-bold text-zinc-900">
                        {profile?.role === 'worker' ? 'Gig Earnings' : 'Gig Payment'}
                      </p>
                      <p className="text-xs text-zinc-500">
                        {tx.createdAt?.toDate ? format(tx.createdAt.toDate(), "MMM d, yyyy • h:mm a") : "Recently"}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`font-bold text-lg ${
                      profile?.role === 'worker' ? 'text-emerald-600' : 'text-zinc-900'
                    }`}>
                      {profile?.role === 'worker' ? '+' : '-'}₱{tx.amount.toLocaleString()}
                    </p>
                    <div className="flex items-center justify-end gap-1 text-[10px] text-zinc-400 uppercase font-bold">
                      <Badge variant="success" className="text-[8px] px-1.5 py-0">{tx.status}</Badge>
                      <span className="ml-1">{tx.method}</span>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          ) : (
            <div className="text-center py-16 bg-zinc-50 rounded-3xl border-2 border-dashed border-zinc-200">
              <p className="text-zinc-500">No transactions found.</p>
            </div>
          )}
        </div>

        <div className="mt-12 p-6 bg-zinc-100 rounded-3xl flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-zinc-400">
              <ExternalLink className="w-6 h-6" />
            </div>
            <div>
              <p className="font-bold text-zinc-900">Need help with payments?</p>
              <p className="text-sm text-zinc-500">Check our FAQ or contact support for assistance.</p>
            </div>
          </div>
          <Button variant="outline" onClick={() => navigate("/help")}>Help Center</Button>
        </div>
      </div>
    </DashboardLayout>
  );
};

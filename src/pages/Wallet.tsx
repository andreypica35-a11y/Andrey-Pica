import React, { useState, useEffect } from "react";
import { collection, query, where, onSnapshot, orderBy, limit, addDoc, serverTimestamp } from "firebase/firestore";
import { db, auth, handleFirestoreError, OperationType } from "../firebase";
import { useAuth } from "../context/AuthContext";
import { Transaction, LinkedAccount } from "../types";
import { DashboardLayout } from "../components/Layout";
import { Card, Button, Badge, Input } from "../components/UI";
import { Wallet as WalletIcon, ArrowUpRight, ArrowDownLeft, CreditCard, History, ExternalLink, AlertCircle, Plus, X, Trash2, CheckCircle2 } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { increment, updateDoc, doc, arrayUnion, arrayRemove } from "firebase/firestore";
import { motion, AnimatePresence } from "motion/react";

export const Wallet = () => {
  const { profile, updateProfile } = useAuth();
  const navigate = useNavigate();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [withdrawing, setWithdrawing] = useState(false);
  const [showAddFunds, setShowAddFunds] = useState(false);
  const [showLinkAccount, setShowLinkAccount] = useState(false);
  const [addAmount, setAddAmount] = useState("");
  const [adding, setAdding] = useState(false);
  
  const [newAccount, setNewAccount] = useState({
    provider: "gcash" as LinkedAccount["provider"],
    accountName: "",
    accountNumber: ""
  });
  const [showAllTransactions, setShowAllTransactions] = useState(false);

  useEffect(() => {
    if (!profile) return;

    const q = query(
      collection(db, "transactions"),
      where("userId", "==", profile.uid),
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

  const handleWithdraw = async () => {
    const defaultAccount = profile?.linkedAccounts?.find(a => a.isDefault) || profile?.linkedAccounts?.[0];
    
    if (!defaultAccount && !profile?.paymentNumber) {
      toast.error("Please link a payment account first.");
      return;
    }
    const balance = profile?.balance || 0;
    if (balance < 100) {
      toast.error("Minimum withdrawal amount is ₱100.");
      return;
    }

    setWithdrawing(true);
    try {
      const idToken = await auth.currentUser?.getIdToken();
      if (!idToken) throw new Error("Authentication required");

      const response = await fetch("/api/payments/withdraw", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${idToken}`
        },
        body: JSON.stringify({
          amount: balance,
          method: defaultAccount?.provider || "linked account"
        })
      });
      
      const result = await response.json();
      if (result.success) {
        toast.success(`Withdrawal request for ₱${balance.toLocaleString()} submitted! Funds will be transferred within 24 hours.`);
      } else {
        throw new Error(result.error || "Failed to process withdrawal");
      }
    } catch (error: any) {
      console.error("Withdrawal error:", error);
      toast.error(error.message || "Failed to process withdrawal. Please try again.");
    } finally {
      setWithdrawing(false);
    }
  };

  const handleAddFunds = async () => {
    const amount = parseFloat(addAmount);
    if (isNaN(amount) || amount <= 0) {
      toast.error("Please enter a valid amount.");
      return;
    }

    if (!profile) return;
    setAdding(true);

    try {
      const idToken = await auth.currentUser?.getIdToken();
      if (!idToken) throw new Error("Authentication required");

      const response = await fetch("/api/payments/topup", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${idToken}`
        },
        body: JSON.stringify({
          amount,
          method: "Top-up"
        })
      });
      
      const result = await response.json();
      if (result.success) {
        toast.success(`Successfully added ₱${amount.toLocaleString()} to your wallet!`);
        setShowAddFunds(false);
        setAddAmount("");
      } else {
        throw new Error(result.error || "Failed to add funds");
      }
    } catch (error: any) {
      console.error("Error adding funds:", error);
      toast.error(error.message || "Failed to add funds. Please try again.");
    } finally {
      setAdding(false);
    }
  };

  const handleLinkAccount = async () => {
    if (!newAccount.accountName || !newAccount.accountNumber) {
      toast.error("Please fill in all fields.");
      return;
    }

    if (!profile) return;
    setAdding(true);

    try {
      const account: LinkedAccount = {
        id: Math.random().toString(36).substring(7),
        ...newAccount,
        isDefault: (profile.linkedAccounts?.length || 0) === 0,
        createdAt: new Date().toISOString()
      };

      await updateDoc(doc(db, "users_private", profile.uid), {
        linkedAccounts: arrayUnion(account)
      });

      toast.success(`${newAccount.provider.toUpperCase()} account linked successfully!`);
      setShowLinkAccount(false);
      setNewAccount({ provider: "gcash", accountName: "", accountNumber: "" });
    } catch (error) {
      toast.error("Failed to link account.");
    } finally {
      setAdding(false);
    }
  };

  const removeAccount = async (account: LinkedAccount) => {
    if (!profile) return;
    try {
      await updateDoc(doc(db, "users_private", profile.uid), {
        linkedAccounts: arrayRemove(account)
      });
      toast.success("Account removed.");
    } catch (error) {
      toast.error("Failed to remove account.");
    }
  };

  const setDefaultAccount = async (account: LinkedAccount) => {
    if (!profile || !profile.linkedAccounts) return;
    try {
      const updatedAccounts = profile.linkedAccounts.map(a => ({
        ...a,
        isDefault: a.id === account.id
      }));
      await updateDoc(doc(db, "users_private", profile.uid), {
        linkedAccounts: updatedAccounts
      });
      toast.success("Default account updated.");
    } catch (error) {
      toast.error("Failed to update default account.");
    }
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
                <Button 
                  variant="outline" 
                  className="border-emerald-400 text-white hover:bg-emerald-500"
                  onClick={() => setShowAddFunds(true)}
                >
                  Add Funds
                </Button>
              </div>
            </div>
            <WalletIcon className="absolute -right-8 -bottom-8 w-48 h-48 text-emerald-500/20 rotate-12" />
          </Card>

          <Card className="p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-zinc-500 text-xs uppercase tracking-widest">Linked Accounts</h3>
              <button onClick={() => setShowLinkAccount(true)} className="text-emerald-600 hover:text-emerald-700">
                <Plus className="w-4 h-4" />
              </button>
            </div>
            
            <div className="space-y-4 max-h-[200px] overflow-y-auto pr-2">
              {profile?.linkedAccounts && profile.linkedAccounts.length > 0 ? (
                profile.linkedAccounts.map(account => (
                  <div key={account.id} className="group flex items-center justify-between p-3 bg-zinc-50 rounded-xl border border-zinc-100 hover:border-emerald-200 transition-all">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                        account.provider === 'gcash' ? 'bg-blue-50 text-blue-600' : 
                        account.provider === 'maya' ? 'bg-zinc-900 text-white' : 'bg-emerald-50 text-emerald-600'
                      }`}>
                        <CreditCard className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-zinc-900 flex items-center gap-1">
                          {account.provider.toUpperCase()}
                          {account.isDefault && <CheckCircle2 className="w-3 h-3 text-emerald-500" />}
                        </p>
                        <p className="text-[10px] text-zinc-500">{account.accountNumber}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      {!account.isDefault && (
                        <button onClick={() => setDefaultAccount(account)} className="p-1 text-zinc-400 hover:text-emerald-600">
                          <CheckCircle2 className="w-4 h-4" />
                        </button>
                      )}
                      <button onClick={() => removeAccount(account)} className="p-1 text-zinc-400 hover:text-red-600">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))
              ) : profile?.paymentNumber ? (
                <div className="p-3 bg-zinc-50 rounded-xl border border-zinc-100">
                  <p className="text-xs font-bold text-zinc-900">Legacy GCash</p>
                  <p className="text-[10px] text-zinc-500">{profile.paymentNumber}</p>
                </div>
              ) : (
                <div className="text-center py-4 text-zinc-400 italic text-xs">
                  No accounts linked
                </div>
              )}
            </div>
            
            <Button 
              variant="ghost" 
              size="sm" 
              className="w-full mt-4 text-emerald-600 text-xs"
              onClick={() => setShowLinkAccount(true)}
            >
              Link New Account
            </Button>
          </Card>
        </div>

        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <History className="w-5 h-5 text-zinc-400" />
              Recent Transactions
            </h2>
            <Button 
              variant="ghost" 
              size="sm" 
              className="text-zinc-500"
              onClick={() => setShowAllTransactions(true)}
            >
              View All
            </Button>
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
                      tx.type === 'deposit' ? 'bg-emerald-50 text-emerald-600' : 
                      tx.type === 'withdrawal' ? 'bg-amber-50 text-amber-600' :
                      profile?.role === 'worker' ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'
                    }`}>
                      {tx.type === 'deposit' ? <Plus className="w-5 h-5" /> : 
                       tx.type === 'withdrawal' ? <ArrowUpRight className="w-5 h-5" /> :
                       profile?.role === 'worker' ? <ArrowDownLeft className="w-5 h-5" /> : <ArrowUpRight className="w-5 h-5" />}
                    </div>
                    <div>
                      <p className="font-bold text-zinc-900">
                        {tx.type === 'deposit' ? 'Top-up' : 
                         tx.type === 'withdrawal' ? 'Withdrawal' :
                         profile?.role === 'worker' ? 'Gig Earnings' : 'Gig Payment'}
                      </p>
                      <p className="text-xs text-zinc-500">
                        {tx.createdAt?.toDate ? format(tx.createdAt.toDate(), "MMM d, yyyy • h:mm a") : "Recently"}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`font-bold text-lg ${
                      tx.type === 'deposit' || (profile?.role === 'worker' && tx.type === 'payment') ? 'text-emerald-600' : 'text-zinc-900'
                    }`}>
                      {tx.type === 'deposit' || (profile?.role === 'worker' && tx.type === 'payment') ? '+' : '-'}₱{(profile?.role === 'worker' && tx.type === 'payment' ? tx.workerAmount : tx.amount).toLocaleString()}
                    </p>
                    {tx.serviceFee > 0 && profile?.role === 'employer' && (
                      <p className="text-[10px] text-zinc-400">Incl. 10% fee (₱{tx.serviceFee.toLocaleString()})</p>
                    )}
                    <div className="flex items-center justify-end gap-1 text-[10px] text-zinc-400 uppercase font-bold">
                      <Badge variant={tx.status === 'completed' ? 'success' : tx.status === 'pending' ? 'warning' : 'error'} className="text-[8px] px-1.5 py-0">{tx.status}</Badge>
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

      <AnimatePresence>
        {showAddFunds && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-[2.5rem] w-full max-w-md overflow-hidden shadow-2xl"
            >
              <div className="p-8 border-b border-zinc-100 flex justify-between items-center">
                <h2 className="text-2xl font-bold">Add Funds</h2>
                <button onClick={() => setShowAddFunds(false)} className="p-2 hover:bg-zinc-100 rounded-full transition-colors">
                  <X className="w-6 h-6" />
                </button>
              </div>
              <div className="p-8">
                <div className="mb-8">
                  <label className="block text-sm font-bold text-zinc-400 uppercase tracking-wider mb-3">Amount to Add (₱)</label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-2xl font-bold text-zinc-400">₱</span>
                    <input 
                      type="number"
                      value={addAmount}
                      onChange={(e) => setAddAmount(e.target.value)}
                      className="w-full bg-zinc-50 border-none rounded-2xl py-4 pl-10 pr-4 text-2xl font-bold focus:ring-2 focus:ring-emerald-500 transition-all"
                      placeholder="0.00"
                    />
                  </div>
                </div>

                {addAmount && parseFloat(addAmount) > 0 && (
                  <div className="mb-8 p-6 bg-emerald-50 rounded-3xl border border-emerald-100 flex flex-col items-center">
                    <p className="text-xs font-bold text-emerald-700 uppercase tracking-widest mb-4">Scan to Pay via {newAccount.provider.toUpperCase()}</p>
                    <div className="bg-white p-4 rounded-2xl shadow-sm mb-4">
                      <img 
                        src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=raketero_topup_${profile?.uid}_${addAmount}`} 
                        alt="Payment QR Code"
                        className="w-40 h-40"
                      />
                    </div>
                    <p className="text-[10px] text-emerald-600 text-center">
                      Scan this QR code with your {newAccount.provider.toUpperCase()} app to complete the payment of ₱{parseFloat(addAmount).toLocaleString()}.
                    </p>
                  </div>
                )}

                <div className="grid grid-cols-3 gap-3 mb-8">
                  {[500, 1000, 2000].map(amount => (
                    <button 
                      key={amount}
                      onClick={() => setAddAmount(amount.toString())}
                      className="py-3 rounded-xl border-2 border-zinc-100 font-bold text-zinc-600 hover:border-emerald-500 hover:text-emerald-600 transition-all"
                    >
                      +₱{amount}
                    </button>
                  ))}
                </div>

                <div className="space-y-4">
                  <Button 
                    className="w-full h-14 text-lg"
                    onClick={handleAddFunds}
                    disabled={adding}
                  >
                    {adding ? "Processing..." : "Confirm & Add Funds"}
                  </Button>
                  <p className="text-center text-xs text-zinc-400">
                    By adding funds, you agree to our terms of service. 
                    Funds will be added instantly to your balance.
                  </p>
                </div>
              </div>
            </motion.div>
          </div>
        )}

        {showLinkAccount && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-[2.5rem] w-full max-w-md overflow-hidden shadow-2xl"
            >
              <div className="p-8 border-b border-zinc-100 flex justify-between items-center">
                <h2 className="text-2xl font-bold">Link Account</h2>
                <button onClick={() => setShowLinkAccount(false)} className="p-2 hover:bg-zinc-100 rounded-full transition-colors">
                  <X className="w-6 h-6" />
                </button>
              </div>
              <div className="p-8 space-y-6">
                <div className="space-y-2">
                  <label className="text-sm font-bold text-zinc-500">Provider</label>
                  <div className="grid grid-cols-2 gap-3">
                    {['gcash', 'maya', 'bank', 'paypal'].map(p => (
                      <button 
                        key={p}
                        onClick={() => setNewAccount({...newAccount, provider: p as any})}
                        className={`py-3 rounded-xl border-2 font-bold capitalize transition-all ${
                          newAccount.provider === p ? 'border-emerald-500 bg-emerald-50 text-emerald-600' : 'border-zinc-100 text-zinc-500'
                        }`}
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-bold text-zinc-500">Account Name</label>
                  <Input 
                    value={newAccount.accountName}
                    onChange={e => setNewAccount({...newAccount, accountName: e.target.value})}
                    placeholder="e.g. Juan Dela Cruz"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-bold text-zinc-500">Account Number</label>
                  <Input 
                    value={newAccount.accountNumber}
                    onChange={e => setNewAccount({...newAccount, accountNumber: e.target.value})}
                    placeholder={newAccount.provider === 'bank' ? 'Account Number' : '09123456789'}
                  />
                </div>

                <Button 
                  className="w-full h-14 text-lg"
                  onClick={handleLinkAccount}
                  disabled={adding}
                >
                  {adding ? "Linking..." : "Link Account"}
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      {/* View All Transactions Modal */}
      <AnimatePresence>
        {showAllTransactions && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-2xl bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden shadow-2xl"
            >
              <div className="p-6 border-zinc-800 flex items-center justify-between border-b">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center">
                    <History className="w-5 h-5 text-zinc-400" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-white">Full Transaction History</h3>
                    <p className="text-sm text-zinc-400">View all your past activities</p>
                  </div>
                </div>
                <Button variant="ghost" size="icon" onClick={() => setShowAllTransactions(false)}>
                  <X className="w-5 h-5" />
                </Button>
              </div>

              <div className="p-6 max-h-[60vh] overflow-y-auto custom-scrollbar">
                {transactions.length === 0 ? (
                  <div className="text-center py-12">
                    <History className="w-12 h-12 text-zinc-700 mx-auto mb-4" />
                    <p className="text-zinc-500">No transactions found.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {transactions.map((tx) => (
                      <div key={tx.id} className="flex items-center justify-between p-4 bg-zinc-800/50 border border-zinc-800 rounded-xl">
                        <div className="flex items-center gap-4">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                            tx.type === 'topup' || tx.type === 'deposit' ? 'bg-emerald-500/10 text-emerald-500' : 
                            tx.type === 'withdraw' ? 'bg-amber-500/10 text-amber-500' : 
                            'bg-blue-500/10 text-blue-500'
                          }`}>
                            {tx.type === 'topup' || tx.type === 'deposit' ? <ArrowDownLeft className="w-5 h-5" /> : 
                             tx.type === 'withdraw' ? <ArrowUpRight className="w-5 h-5" /> : 
                             <CreditCard className="w-5 h-5" />}
                          </div>
                          <div>
                            <p className="font-medium text-white capitalize">{tx.type.replace('_', ' ')}</p>
                            <p className="text-xs text-zinc-500">
                              {tx.createdAt?.toDate ? format(tx.createdAt.toDate(), "MMM d, yyyy • h:mm a") : "Date unavailable"}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className={`font-semibold ${
                            tx.type === 'topup' || tx.type === 'deposit' ? 'text-emerald-500' : 'text-white'
                          }`}>
                            {tx.type === 'topup' || tx.type === 'deposit' ? '+' : '-'} ₱{tx.amount.toLocaleString()}
                          </p>
                          <Badge variant="outline" className={`text-[10px] uppercase ${
                            tx.status === 'completed' ? 'border-emerald-500/20 text-emerald-500' : 
                            tx.status === 'pending' ? 'border-amber-500/20 text-amber-500' : 
                            'border-red-500/20 text-red-500'
                          }`}>
                            {tx.status}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="p-6 border-t border-zinc-800 bg-zinc-900/50 flex justify-end">
                <Button variant="outline" onClick={() => setShowAllTransactions(false)}>Close</Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </DashboardLayout>
  );
};

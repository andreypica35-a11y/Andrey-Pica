import React, { useState, useEffect } from "react";
import { collection, query, onSnapshot, updateDoc, doc, deleteDoc } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../context/AuthContext";
import { UserProfile, Gig, Transaction } from "../types";
import { DashboardLayout } from "../components/Layout";
import { Card, Button, Badge } from "../components/UI";
import { Shield, User, Briefcase, DollarSign, Trash2, CheckCircle, XCircle } from "lucide-react";

export const AdminPanel = () => {
  const { profile } = useAuth();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [gigs, setGigs] = useState<Gig[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [activeTab, setActiveTab] = useState<'users' | 'gigs' | 'transactions'>('users');

  useEffect(() => {
    if (profile?.role !== "admin") return;

    const unsubUsers = onSnapshot(collection(db, "users"), (snap) => {
      setUsers(snap.docs.map(d => ({ ...d.data() } as UserProfile)));
    });
    const unsubGigs = onSnapshot(collection(db, "gigs"), (snap) => {
      setGigs(snap.docs.map(d => ({ id: d.id, ...d.data() } as Gig)));
    });
    const unsubTrans = onSnapshot(collection(db, "transactions"), (snap) => {
      setTransactions(snap.docs.map(d => ({ id: d.id, ...d.data() } as Transaction)));
    });

    return () => { unsubUsers(); unsubGigs(); unsubTrans(); };
  }, [profile]);

  const handleVerifyUser = async (uid: string, status: boolean) => {
    await updateDoc(doc(db, "users", uid), { isVerified: status });
  };

  const handleDeleteGig = async (id: string) => {
    if (confirm("Are you sure you want to delete this gig?")) {
      await deleteDoc(doc(db, "gigs", id));
    }
  };

  if (profile?.role !== "admin") return <DashboardLayout>Access Denied</DashboardLayout>;

  return (
    <DashboardLayout>
      <h1 className="text-3xl font-bold mb-8 flex items-center gap-2">
        <Shield className="w-8 h-8 text-emerald-600" />
        Admin Control Panel
      </h1>

      <div className="flex gap-4 mb-8">
        <Button variant={activeTab === 'users' ? 'primary' : 'outline'} onClick={() => setActiveTab('users')}>Users</Button>
        <Button variant={activeTab === 'gigs' ? 'primary' : 'outline'} onClick={() => setActiveTab('gigs')}>Gigs</Button>
        <Button variant={activeTab === 'transactions' ? 'primary' : 'outline'} onClick={() => setActiveTab('transactions')}>Transactions</Button>
      </div>

      {activeTab === 'users' && (
        <div className="space-y-4">
          {users.map(user => (
            <Card key={user.uid} className="p-6 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <img src={user.photoURL || `https://ui-avatars.com/api/?name=${user.displayName}`} className="w-12 h-12 rounded-full" alt="" />
                <div>
                  <p className="font-bold flex items-center gap-2">
                    {user.displayName}
                    {user.isVerified && <CheckCircle className="w-4 h-4 text-emerald-500" />}
                  </p>
                  <p className="text-xs text-zinc-500">{user.email} • <span className="capitalize">{user.role}</span></p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {user.isVerified ? (
                  <Button variant="outline" size="sm" onClick={() => handleVerifyUser(user.uid, false)} className="text-red-600">Revoke Verify</Button>
                ) : (
                  <Button size="sm" onClick={() => handleVerifyUser(user.uid, true)}>Verify User</Button>
                )}
                <Badge variant={user.isVerified ? 'success' : 'default'}>{user.isVerified ? 'Verified' : 'Unverified'}</Badge>
              </div>
            </Card>
          ))}
        </div>
      )}

      {activeTab === 'gigs' && (
        <div className="space-y-4">
          {gigs.map(gig => (
            <Card key={gig.id} className="p-6 flex items-center justify-between">
              <div>
                <p className="font-bold">{gig.title}</p>
                <p className="text-xs text-zinc-500">Posted by {gig.employerName} • ₱{gig.payment}</p>
              </div>
              <div className="flex items-center gap-4">
                <Badge>{gig.status}</Badge>
                <button onClick={() => handleDeleteGig(gig.id)} className="text-red-500 hover:text-red-700">
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {activeTab === 'transactions' && (
        <div className="space-y-4">
          {transactions.map(tx => (
            <Card key={tx.id} className="p-6 flex items-center justify-between">
              <div>
                <p className="font-bold">₱{tx.amount}</p>
                <p className="text-xs text-zinc-500">Fee: ₱{tx.serviceFee} • Worker: ₱{tx.workerAmount}</p>
              </div>
              <Badge variant="success">{tx.status}</Badge>
            </Card>
          ))}
        </div>
      )}
    </DashboardLayout>
  );
};

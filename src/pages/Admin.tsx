import React, { useState, useEffect } from "react";
import { collection, query, onSnapshot, updateDoc, doc, deleteDoc } from "firebase/firestore";
import { db, handleFirestoreError, OperationType } from "../firebase";
import { useAuth } from "../context/AuthContext";
import { UserProfile, Gig, Transaction } from "../types";
import { DashboardLayout } from "../components/Layout";
import { Card, Button, Badge } from "../components/UI";
import { Shield, User, Briefcase, DollarSign, Trash2, CheckCircle, XCircle } from "lucide-react";
import { motion } from "motion/react";
import { toast } from "sonner";

export const AdminPanel = () => {
  const { profile } = useAuth();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [gigs, setGigs] = useState<Gig[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [activeTab, setActiveTab] = useState<'users' | 'gigs' | 'transactions' | 'verifications'>('users');
  const [gigToDelete, setGigToDelete] = useState<string | null>(null);
  const [selectedUserForReview, setSelectedUserForReview] = useState<UserProfile | null>(null);

  useEffect(() => {
    if (profile?.role !== "admin") return;

    const unsubUsers = onSnapshot(collection(db, "users"), (snap) => {
      setUsers(snap.docs.map(d => ({ ...d.data() } as UserProfile)));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, "users");
    });
    const unsubGigs = onSnapshot(collection(db, "gigs"), (snap) => {
      setGigs(snap.docs.map(d => ({ id: d.id, ...d.data() } as Gig)));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, "gigs");
    });
    const unsubTrans = onSnapshot(collection(db, "transactions"), (snap) => {
      setTransactions(snap.docs.map(d => ({ id: d.id, ...d.data() } as Transaction)));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, "transactions");
    });

    return () => { unsubUsers(); unsubGigs(); unsubTrans(); };
  }, [profile]);

  const handleVerifyUser = async (uid: string, status: boolean, verificationStatus: UserProfile['verificationStatus'] = 'verified') => {
    try {
      await updateDoc(doc(db, "users", uid), { 
        isVerified: status,
        verificationStatus: status ? 'verified' : verificationStatus
      });
      toast.success(`User verification ${status ? 'approved' : 'updated'}!`);
      setSelectedUserForReview(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${uid}`);
      toast.error("Failed to update user verification.");
    }
  };

  const handleDeleteGig = async () => {
    if (!gigToDelete) return;
    try {
      await deleteDoc(doc(db, "gigs", gigToDelete));
      toast.success("Gig deleted successfully!");
      setGigToDelete(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `gigs/${gigToDelete}`);
      toast.error("Failed to delete gig.");
    }
  };

  if (profile?.role !== "admin") return <DashboardLayout>Access Denied</DashboardLayout>;

  const pendingVerifications = users.filter(u => u.verificationStatus === 'pending');

  return (
    <DashboardLayout>
      <h1 className="text-3xl font-bold mb-8 flex items-center gap-2">
        <Shield className="w-8 h-8 text-emerald-600" />
        Admin Control Panel
      </h1>

      <div className="flex flex-wrap gap-4 mb-8">
        <Button variant={activeTab === 'users' ? 'primary' : 'outline'} onClick={() => setActiveTab('users')}>Users</Button>
        <Button variant={activeTab === 'verifications' ? 'primary' : 'outline'} onClick={() => setActiveTab('verifications')} className="relative">
          Verifications
          {pendingVerifications.length > 0 && (
            <span className="absolute -top-2 -right-2 bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
              {pendingVerifications.length}
            </span>
          )}
        </Button>
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
                  <Button variant="outline" size="sm" onClick={() => handleVerifyUser(user.uid, false, 'unverified')} className="text-red-600">Revoke Verify</Button>
                ) : (
                  <Button size="sm" onClick={() => handleVerifyUser(user.uid, true)}>Verify User</Button>
                )}
                <Badge variant={user.isVerified ? 'success' : 'default'}>{user.isVerified ? 'Verified' : 'Unverified'}</Badge>
              </div>
            </Card>
          ))}
        </div>
      )}

      {activeTab === 'verifications' && (
        <div className="space-y-4">
          {pendingVerifications.length === 0 ? (
            <div className="text-center py-12 bg-zinc-50 rounded-3xl border border-dashed border-zinc-200">
              <p className="text-zinc-500">No pending verification requests.</p>
            </div>
          ) : (
            pendingVerifications.map(user => (
              <Card key={user.uid} className="p-6 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <img src={user.photoURL || `https://ui-avatars.com/api/?name=${user.displayName}`} className="w-12 h-12 rounded-full" alt="" />
                  <div>
                    <p className="font-bold">{user.displayName}</p>
                    <p className="text-xs text-zinc-500">{user.idType}: {user.idNumber}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="outline" onClick={() => setSelectedUserForReview(user)}>Review ID</Button>
                  <Button size="sm" onClick={() => handleVerifyUser(user.uid, true)}>Approve</Button>
                  <Button size="sm" variant="outline" className="text-red-600" onClick={() => handleVerifyUser(user.uid, false, 'rejected')}>Reject</Button>
                </div>
              </Card>
            ))
          )}
        </div>
      )}

      {selectedUserForReview && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl p-8"
          >
            <div className="flex justify-between items-start mb-6">
              <h2 className="text-2xl font-bold">Review ID Document</h2>
              <button onClick={() => setSelectedUserForReview(null)} className="text-zinc-400 hover:text-zinc-600">
                <XCircle className="w-6 h-6" />
              </button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-bold text-zinc-400 uppercase">User</label>
                  <p className="font-bold">{selectedUserForReview.displayName}</p>
                </div>
                <div>
                  <label className="text-xs font-bold text-zinc-400 uppercase">ID Type</label>
                  <p className="font-bold">{selectedUserForReview.idType}</p>
                </div>
                <div>
                  <label className="text-xs font-bold text-zinc-400 uppercase">ID Number</label>
                  <p className="font-bold">{selectedUserForReview.idNumber}</p>
                </div>
              </div>
              <div className="aspect-video bg-zinc-100 rounded-2xl overflow-hidden flex items-center justify-center border border-zinc-200">
                {selectedUserForReview.idImageURL ? (
                  <img src={selectedUserForReview.idImageURL} className="w-full h-full object-contain" alt="ID Document" />
                ) : (
                  <div className="text-center p-4">
                    <Shield className="w-8 h-8 text-zinc-300 mx-auto mb-2" />
                    <p className="text-xs text-zinc-400">No image provided</p>
                  </div>
                )}
              </div>
            </div>

            <div className="flex gap-3">
              <Button 
                onClick={() => handleVerifyUser(selectedUserForReview.uid, true)}
                className="flex-1"
              >
                Approve Verification
              </Button>
              <Button 
                variant="outline" 
                onClick={() => handleVerifyUser(selectedUserForReview.uid, false, 'rejected')}
                className="flex-1 text-red-600"
              >
                Reject Request
              </Button>
            </div>
          </motion.div>
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
                <button onClick={() => setGigToDelete(gig.id)} className="text-red-500 hover:text-red-700">
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

      {gigToDelete && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl p-8"
          >
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center text-red-600 mx-auto mb-6">
              <Trash2 className="w-8 h-8" />
            </div>
            <h2 className="text-2xl font-bold text-center mb-2">Delete Gig?</h2>
            <p className="text-zinc-600 text-center mb-8">
              Are you sure you want to delete this gig? This action cannot be undone.
            </p>
            <div className="flex flex-col gap-3">
              <Button 
                onClick={handleDeleteGig}
                className="w-full bg-red-600 hover:bg-red-700"
              >
                Yes, Delete Gig
              </Button>
              <Button 
                variant="ghost" 
                onClick={() => setGigToDelete(null)}
                className="w-full"
              >
                Cancel
              </Button>
            </div>
          </motion.div>
        </div>
      )}
    </DashboardLayout>
  );
};

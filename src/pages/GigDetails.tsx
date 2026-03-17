import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { doc, getDoc, collection, addDoc, query, where, onSnapshot, serverTimestamp, updateDoc, setDoc } from "firebase/firestore";
import { db, handleFirestoreError, OperationType } from "../firebase";
import { useAuth } from "../context/AuthContext";
import { Gig, Application, UserProfile } from "../types";
import { DashboardLayout } from "../components/Layout";
import { Card, Button, Badge, cn } from "../components/UI";
import { motion } from "motion/react";
import { MapPin, Clock, DollarSign, User, Shield, CheckCircle, AlertCircle, MessageSquare, X, Star } from "lucide-react";
import { format } from "date-fns";

const WorkerProfileModal = ({ worker, onClose }: { worker: UserProfile, onClose: () => void }) => (
  <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="bg-white rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl"
    >
      <div className="p-6 border-b border-zinc-100 flex justify-between items-center">
        <h2 className="text-xl font-bold">Worker Profile</h2>
        <button onClick={onClose} className="p-2 hover:bg-zinc-100 rounded-full transition-colors">
          <X className="w-5 h-5" />
        </button>
      </div>
      <div className="p-8 overflow-y-auto max-h-[80vh]">
        <div className="flex flex-col sm:flex-row gap-8 mb-8">
          <img src={worker.photoURL || `https://ui-avatars.com/api/?name=${worker.displayName}`} className="w-32 h-32 rounded-3xl object-cover border-4 border-emerald-50" alt="" />
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <h3 className="text-3xl font-bold">{worker.displayName}</h3>
              {worker.isVerified && <CheckCircle className="w-6 h-6 text-emerald-500" />}
            </div>
            <div className="flex items-center gap-4 text-zinc-500 mb-4">
              <div className="flex items-center gap-1 text-amber-500 font-bold">
                <Star className="w-4 h-4 fill-current" />
                {worker.rating} <span className="text-zinc-400 font-normal">({worker.reviewCount} reviews)</span>
              </div>
              <div className="flex items-center gap-1">
                <MapPin className="w-4 h-4" />
                {worker.address || "Location not set"}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {worker.skills?.map(skill => (
                <Badge key={skill}>{skill}</Badge>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div>
            <h4 className="text-sm font-bold text-zinc-400 uppercase tracking-wider mb-2">Bio</h4>
            <p className="text-zinc-600 leading-relaxed">{worker.bio || "No bio provided."}</p>
          </div>
          <div>
            <h4 className="text-sm font-bold text-zinc-400 uppercase tracking-wider mb-2">Experience</h4>
            <p className="text-zinc-600 leading-relaxed">{worker.experience || "No experience listed."}</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-6 border-t border-zinc-100">
            <div>
              <h4 className="text-sm font-bold text-zinc-400 uppercase tracking-wider mb-1">Verification Status</h4>
              <p className="flex items-center gap-2 font-medium">
                {worker.isVerified ? (
                  <><Shield className="w-4 h-4 text-emerald-500" /> Fully Verified</>
                ) : (
                  <><AlertCircle className="w-4 h-4 text-amber-500" /> Pending Verification</>
                )}
              </p>
            </div>
            {worker.isVerified && (
              <div>
                <h4 className="text-sm font-bold text-zinc-400 uppercase tracking-wider mb-1">ID Type</h4>
                <p className="font-medium">{worker.idType}</p>
              </div>
            )}
          </div>
        </div>
      </div>
      <div className="p-6 bg-zinc-50 border-t border-zinc-100 flex justify-end">
        <Button onClick={onClose}>Close Profile</Button>
      </div>
    </motion.div>
  </div>
);

export const GigDetails = () => {
  const { id } = useParams<{ id: string }>();
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [gig, setGig] = useState<Gig | null>(null);
  const [employer, setEmployer] = useState<UserProfile | null>(null);
  const [applications, setApplications] = useState<Application[]>([]);
  const [hasApplied, setHasApplied] = useState(false);
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState("gcash");
  const [paying, setPaying] = useState(false);
  const [selectedWorker, setSelectedWorker] = useState<UserProfile | null>(null);
  const [showPaymentConfirm, setShowPaymentConfirm] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error', message: string } | null>(null);

  const fetchWorkerProfile = async (workerId: string) => {
    try {
      const workerDoc = await getDoc(doc(db, "users", workerId));
      if (workerDoc.exists()) {
        setSelectedWorker(workerDoc.data() as UserProfile);
      }
    } catch (error) {
      console.error("Error fetching worker profile:", error);
    }
  };

  useEffect(() => {
    if (!id) return;

    const fetchGig = async () => {
      try {
        const gigDoc = await getDoc(doc(db, "gigs", id));
        if (gigDoc.exists()) {
          const gigData = { id: gigDoc.id, ...gigDoc.data() } as Gig;
          setGig(gigData);
          
          // Fetch employer profile
          const empDoc = await getDoc(doc(db, "users", gigData.employerId));
          if (empDoc.exists()) {
            setEmployer(empDoc.data() as UserProfile);
          }
        }
      } catch (error) {
        console.error("Error fetching gig:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchGig();

    // Listen for applications if employer and owner
    if (profile?.role === "employer" && gig?.employerId === profile.uid) {
      const q = query(collection(db, "gigs", id, "applications"));
      return onSnapshot(q, (snapshot) => {
        setApplications(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Application)));
      }, (error) => {
        handleFirestoreError(error, OperationType.LIST, `gigs/${id}/applications`);
      });
    } else if (profile?.role === "worker") {
      // Check if worker has already applied
      const q = query(collection(db, "gigs", id, "applications"), where("workerId", "==", profile.uid));
      return onSnapshot(q, (snapshot) => {
        setHasApplied(!snapshot.empty);
      }, (error) => {
        handleFirestoreError(error, OperationType.LIST, `gigs/${id}/applications`);
      });
    }
  }, [id, profile, gig?.employerId]);

  const handleApply = async () => {
    if (!profile || !id || !gig) return;
    setApplying(true);
    try {
      await addDoc(collection(db, "gigs", id, "applications"), {
        gigId: id,
        workerId: profile.uid,
        workerName: profile.displayName,
        status: "pending",
        createdAt: serverTimestamp()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `gigs/${id}/applications`);
    } finally {
      setApplying(false);
    }
  };

  const handleAcceptApplication = async (app: Application) => {
    if (!id || !gig) return;
    try {
      // Update application status
      await updateDoc(doc(db, "gigs", id, "applications", app.id), {
        status: "accepted"
      });
      // Update gig status and workerId
      await updateDoc(doc(db, "gigs", id), {
        status: "in-progress",
        workerId: app.workerId
      });
      // Reject other applications
      applications.forEach(async (otherApp) => {
        if (otherApp.id !== app.id) {
          await updateDoc(doc(db, "gigs", id, "applications", otherApp.id), {
            status: "rejected"
          });
        }
      });
    } catch (error) {
      console.error("Error accepting application:", error);
    }
  };

  const handleMarkAsDone = async () => {
    if (!id || !gig) return;
    try {
      await updateDoc(doc(db, "gigs", id), { status: "review" });
      setFeedback({ type: 'success', message: "Gig marked as done. Waiting for employer confirmation." });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `gigs/${id}`);
    }
  };

  const handlePayment = async () => {
    if (!gig || !id) return;
    setPaying(true);
    try {
      const response = await fetch("/api/payments/process", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: gig.payment,
          gigId: id,
          employerId: gig.employerId,
          workerId: gig.workerId,
          method: paymentMethod
        })
      });
      const result = await response.json();
      if (result.success) {
        // Update gig to completed
        await updateDoc(doc(db, "gigs", id), { 
          status: "completed",
          completedAt: serverTimestamp()
        });
        // Create transaction record
        await addDoc(collection(db, "transactions"), {
          ...result,
          createdAt: serverTimestamp()
        });
        setFeedback({ type: 'success', message: `Gig confirmed completed! Payment via ${paymentMethod.toUpperCase()} released.` });
        setTimeout(() => navigate("/dashboard"), 2000);
      }
    } catch (error) {
      console.error("Payment error:", error);
      setFeedback({ type: 'error', message: "Payment failed. Please try again." });
    } finally {
      setPaying(false);
    }
  };

  const handleCancel = async () => {
    if (!id || !gig) return;
    try {
      await updateDoc(doc(db, "gigs", id), { status: "cancelled" });
      setFeedback({ type: 'success', message: "Gig has been cancelled." });
      setTimeout(() => navigate("/dashboard"), 2000);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `gigs/${id}`);
    }
  };

  const handleStartChat = async (otherUser: UserProfile) => {
    if (!profile) return;
    const chatId = [profile.uid, otherUser.uid].sort().join("_");
    const chatRef = doc(db, "chats", chatId);
    const chatSnap = await getDoc(chatRef);

    if (!chatSnap.exists()) {
      await setDoc(chatRef, {
        participants: [profile.uid, otherUser.uid],
        participantNames: {
          [profile.uid]: profile.displayName,
          [otherUser.uid]: otherUser.displayName
        },
        updatedAt: serverTimestamp()
      });
    }
    navigate("/messages");
  };

  if (loading) return <DashboardLayout><div className="animate-pulse space-y-4"><div className="h-12 bg-zinc-200 rounded-xl w-1/2" /><div className="h-64 bg-zinc-200 rounded-2xl" /></div></DashboardLayout>;
  if (!gig) return <DashboardLayout><div>Gig not found.</div></DashboardLayout>;

  return (
    <DashboardLayout>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          <div>
            <div className="flex items-center gap-2 mb-4">
              <Badge variant={
                gig.status === 'open' ? 'success' : 
                gig.status === 'cancelled' ? 'error' : 
                gig.status === 'review' ? 'warning' :
                gig.status === 'completed' ? 'success' : 'warning'
              }>
                {gig.status === 'review' ? 'Under Review' : gig.status}
              </Badge>
              <Badge>{gig.category}</Badge>
            </div>
            <h1 className="text-4xl font-bold tracking-tight mb-4">{gig.title}</h1>
            <div className="flex flex-wrap gap-6 text-zinc-500">
              <div className="flex items-center gap-2"><MapPin className="w-5 h-5" /> {gig.location}</div>
              <div className="flex items-center gap-2"><Clock className="w-5 h-5" /> {gig.duration}</div>
              <div className="flex items-center gap-2"><DollarSign className="w-5 h-5" /> ₱{gig.payment}</div>
            </div>
          </div>

          <Card className="p-8">
            <h2 className="text-xl font-bold mb-4">Description</h2>
            <p className="text-zinc-600 whitespace-pre-wrap leading-relaxed">{gig.description}</p>
          </Card>

          {profile?.role === "employer" && gig.employerId === profile.uid && (
            <div className="space-y-4">
              <h2 className="text-xl font-bold">Applicants ({applications.length})</h2>
              {applications.length > 0 ? (
                <div className="space-y-4">
                  {applications.map(app => (
                    <Card key={app.id} className="p-6 flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-zinc-100 rounded-full flex items-center justify-center overflow-hidden">
                          <img src={`https://ui-avatars.com/api/?name=${app.workerName}`} alt="" />
                        </div>
                        <div>
                          <p className="font-bold">{app.workerName}</p>
                          <div className="flex gap-3 mt-1">
                            <button 
                              onClick={() => fetchWorkerProfile(app.workerId)}
                              className="text-xs text-emerald-600 font-semibold hover:underline"
                            >
                              View Profile
                            </button>
                            <button 
                              onClick={async () => {
                                const workerDoc = await getDoc(doc(db, "users", app.workerId));
                                if (workerDoc.exists()) {
                                  handleStartChat(workerDoc.data() as UserProfile);
                                }
                              }}
                              className="text-xs text-zinc-500 font-semibold hover:underline flex items-center gap-1"
                            >
                              <MessageSquare className="w-3 h-3" /> Message
                            </button>
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        {app.status === "pending" && gig.status === "open" && (
                          <Button onClick={() => handleAcceptApplication(app)} size="sm">Accept</Button>
                        )}
                        <Badge variant={app.status === 'accepted' ? 'success' : app.status === 'rejected' ? 'error' : 'default'}>
                          {app.status}
                        </Badge>
                      </div>
                    </Card>
                  ))}
                </div>
              ) : (
                <p className="text-zinc-500 italic">No applications yet.</p>
              )}
            </div>
          )}
        </div>

        <div className="space-y-8">
          {profile?.role === "employer" && gig.employerId === profile.uid && gig.workerId && (
            <Card className="p-6">
              <h3 className="font-bold mb-4">Assigned Worker</h3>
              <div className="flex items-center gap-4 mb-6">
                <div className="w-12 h-12 bg-zinc-100 rounded-full flex items-center justify-center">
                  <User className="w-6 h-6 text-zinc-400" />
                </div>
                <div>
                  <p className="font-bold">Worker Assigned</p>
                  <p className="text-xs text-zinc-500">Currently working on this gig</p>
                </div>
              </div>
              <Button 
                variant="outline" 
                className="w-full mb-4"
                onClick={() => gig.workerId && fetchWorkerProfile(gig.workerId)}
              >
                View Profile
              </Button>
              <Button 
                variant="ghost" 
                className="w-full gap-2"
                onClick={async () => {
                  if (gig.workerId) {
                    const workerDoc = await getDoc(doc(db, "users", gig.workerId));
                    if (workerDoc.exists()) {
                      handleStartChat(workerDoc.data() as UserProfile);
                    }
                  }
                }}
              >
                <MessageSquare className="w-4 h-4" /> Message Worker
              </Button>
            </Card>
          )}

          <Card className="p-6">
            <h3 className="font-bold mb-4">Employer</h3>
            <div className="flex items-center gap-4 mb-6">
              <img src={employer?.photoURL || `https://ui-avatars.com/api/?name=${employer?.displayName}`} className="w-12 h-12 rounded-full" alt="" />
              <div>
                <p className="font-bold flex items-center gap-1">
                  {employer?.displayName}
                  {employer?.isVerified && <CheckCircle className="w-4 h-4 text-emerald-500" />}
                </p>
                <p className="text-xs text-zinc-500">Member since 2026</p>
              </div>
            </div>
            <Button variant="outline" className="w-full mb-4">View Profile</Button>
            <Button 
              variant="ghost" 
              className="w-full gap-2"
              onClick={() => employer && handleStartChat(employer)}
            >
              <MessageSquare className="w-4 h-4" /> Message Employer
            </Button>
          </Card>

          {profile?.role === "worker" && gig.status === "open" && (
            <Card className="p-6 border-emerald-200 bg-emerald-50">
              <h3 className="font-bold mb-2">Interested in this gig?</h3>
              <p className="text-sm text-zinc-600 mb-6">Apply now and the employer will review your profile.</p>
              <Button 
                onClick={handleApply} 
                disabled={hasApplied || applying} 
                className="w-full"
              >
                {hasApplied ? "Already Applied" : applying ? "Applying..." : "Apply for Gig"}
              </Button>
            </Card>
          )}

          {profile?.role === "worker" && gig.status === "in-progress" && gig.workerId === profile.uid && (
            <Card className="p-6 border-emerald-200 bg-emerald-50">
              <h3 className="font-bold mb-2">Gig in Progress</h3>
              <p className="text-sm text-zinc-600 mb-6">Finished the task? Mark it as done to notify the employer.</p>
              <Button 
                onClick={handleMarkAsDone} 
                className="w-full"
              >
                Mark as Done
              </Button>
            </Card>
          )}

          {profile?.role === "worker" && gig.status === "review" && gig.workerId === profile.uid && (
            <Card className="p-6 border-amber-100 bg-amber-50">
              <h3 className="font-bold mb-2">Under Review</h3>
              <p className="text-sm text-zinc-600 mb-4">You've marked this gig as done. The employer is currently reviewing the work.</p>
              <div className="flex items-center gap-2 text-amber-600 text-xs font-bold">
                <Clock className="w-4 h-4" />
                AWAITING CONFIRMATION
              </div>
            </Card>
          )}

          {profile?.role === "employer" && gig.employerId === profile.uid && (gig.status === "open" || gig.status === "in-progress" || gig.status === "review") && (
            <Card className="p-6 border-red-100 bg-red-50/50">
              <h3 className="font-bold text-red-900 mb-2">Manage Gig</h3>
              <p className="text-sm text-red-700 mb-4">Need to stop this gig? You can cancel it before it's completed.</p>
              <Button 
                variant="outline" 
                onClick={() => setShowCancelConfirm(true)}
                className="w-full border-red-200 text-red-600 hover:bg-red-100 hover:text-red-700"
              >
                Cancel Gig
              </Button>
            </Card>
          )}

          {gig.status === "completed" && (
            <Card className="p-6 border-emerald-200 bg-emerald-50">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-600">
                  <CheckCircle className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-bold text-emerald-900">Gig Completed</h3>
                  <p className="text-xs text-emerald-700">
                    {gig.completedAt?.toDate ? format(gig.completedAt.toDate(), "MMMM d, yyyy") : "Recently"}
                  </p>
                </div>
              </div>
              <p className="text-sm text-zinc-600 mb-6">
                This gig has been successfully completed and payment has been released.
              </p>
              <Button variant="outline" className="w-full" onClick={() => navigate("/dashboard")}>
                Return to Dashboard
              </Button>
            </Card>
          )}

          {profile?.role === "employer" && (gig.status === "in-progress" || gig.status === "review") && gig.employerId === profile.uid && (
            <Card className="p-6 border-emerald-200 bg-emerald-50">
              <h3 className="font-bold mb-2">
                {gig.status === "review" ? "Confirm Completion" : "Gig in Progress"}
              </h3>
              <p className="text-sm text-zinc-600 mb-6">
                {gig.status === "review" 
                  ? "The worker has marked the job as done. Please review the work and confirm to release payment." 
                  : "Once the task is done, you can confirm completion and release the payment."}
              </p>
              
              <div className="space-y-3 mb-6">
                <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Select Payment Method</p>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { id: 'gcash', name: 'GCash' },
                    { id: 'maya', name: 'Maya' },
                    { id: 'grabpay', name: 'GrabPay' },
                    { id: 'bank', name: 'Bank Transfer' }
                  ].map(method => (
                    <button
                      key={method.id}
                      onClick={() => setPaymentMethod(method.id)}
                      className={`px-4 py-2 text-sm rounded-lg border transition-all ${
                        paymentMethod === method.id 
                          ? 'bg-emerald-600 border-emerald-600 text-white shadow-sm' 
                          : 'bg-white border-zinc-200 text-zinc-600 hover:border-emerald-300'
                      }`}
                    >
                      {method.name}
                    </button>
                  ))}
                </div>
              </div>

              <Button 
                onClick={() => setShowPaymentConfirm(true)} 
                disabled={paying}
                className="w-full"
              >
                {paying ? "Processing..." : gig.status === "review" ? "Confirm & Release Payment" : `Release Payment (₱${gig.payment})`}
              </Button>
            </Card>
          )}
        </div>
      </div>

      {feedback && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className={cn(
              "px-6 py-3 rounded-2xl shadow-xl flex items-center gap-3",
              feedback.type === 'success' ? "bg-emerald-600 text-white" : "bg-red-600 text-white"
            )}
          >
            {feedback.type === 'success' ? <CheckCircle className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
            <p className="font-bold text-sm">{feedback.message}</p>
            <button onClick={() => setFeedback(null)} className="p-1 hover:bg-white/20 rounded-full">
              <X className="w-4 h-4" />
            </button>
          </motion.div>
        </div>
      )}

      {showCancelConfirm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl p-8"
          >
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center text-red-600 mx-auto mb-6">
              <AlertCircle className="w-8 h-8" />
            </div>
            <h2 className="text-2xl font-bold text-center mb-2">Cancel Gig?</h2>
            <p className="text-zinc-600 text-center mb-8">
              Are you sure you want to cancel this gig? This action cannot be undone and will notify any applicants or workers.
            </p>
            <div className="flex flex-col gap-3">
              <Button 
                onClick={() => {
                  setShowCancelConfirm(false);
                  handleCancel();
                }}
                className="w-full bg-red-600 hover:bg-red-700"
              >
                Yes, Cancel Gig
              </Button>
              <Button 
                variant="ghost" 
                onClick={() => setShowCancelConfirm(false)}
                className="w-full"
              >
                Go Back
              </Button>
            </div>
          </motion.div>
        </div>
      )}

      {showPaymentConfirm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl p-8"
          >
            <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center text-amber-600 mx-auto mb-6">
              <AlertCircle className="w-8 h-8" />
            </div>
            <h2 className="text-2xl font-bold text-center mb-2">Confirm Payment?</h2>
            <p className="text-zinc-600 text-center mb-8">
              You are about to release <span className="font-bold text-zinc-900">₱{gig.payment}</span> to the worker via <span className="font-bold text-zinc-900 uppercase">{paymentMethod}</span>. This action cannot be reversed.
            </p>
            <div className="flex flex-col gap-3">
              <Button 
                onClick={() => {
                  setShowPaymentConfirm(false);
                  handlePayment();
                }}
                className="w-full"
                disabled={paying}
              >
                {paying ? "Processing..." : "Yes, Release Payment"}
              </Button>
              <Button 
                variant="ghost" 
                onClick={() => setShowPaymentConfirm(false)}
                className="w-full"
                disabled={paying}
              >
                Cancel
              </Button>
            </div>
          </motion.div>
        </div>
      )}

      {selectedWorker && (
        <WorkerProfileModal 
          worker={selectedWorker} 
          onClose={() => setSelectedWorker(null)} 
        />
      )}
    </DashboardLayout>
  );
};

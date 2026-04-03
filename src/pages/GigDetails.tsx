import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { doc, getDoc, collection, addDoc, query, where, serverTimestamp, updateDoc, setDoc, increment, getDocs } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { auth, db, storage, handleFirestoreError, OperationType } from "../firebase";
import { useAuth } from "../context/AuthContext";
import { Gig, Application, UserProfile } from "../types";
import { DashboardLayout } from "../components/Layout";
import { Card, Button, Badge, cn } from "../components/UI";
import { motion } from "motion/react";
import { MapPin, Clock, DollarSign, User, Shield, CheckCircle, AlertCircle, MessageSquare, X, Star } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

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
  const [cancelling, setCancelling] = useState(false);
  const [hasReviewed, setHasReviewed] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);

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

    const fetchData = async () => {
      setLoading(true);
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
        } else {
          setGig(null);
        }

        // Fetch applications if employer and owner
        if (profile?.role === "employer" && gig?.employerId === profile.uid) {
          const q = query(collection(db, "gigs", id, "applications"));
          const snapshot = await getDocs(q);
          setApplications(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Application)));
        } else if (profile?.role === "worker") {
          // Check if worker has already applied
          const q = query(collection(db, "gigs", id, "applications"), where("workerId", "==", profile.uid));
          const snapshot = await getDocs(q);
          setHasApplied(!snapshot.empty);
        }
      } catch (error) {
        handleFirestoreError(error, OperationType.GET, `gigs/${id}`);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [id, profile]);

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
      toast.success("Application submitted successfully!");
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
      const rejectionPromises = applications
        .filter(otherApp => otherApp.id !== app.id)
        .map(otherApp => 
          updateDoc(doc(db, "gigs", id, "applications", otherApp.id), {
            status: "rejected"
          })
        );
      await Promise.all(rejectionPromises);
      toast.success(`Accepted ${app.workerName}'s application!`);
    } catch (error) {
      console.error("Error accepting application:", error);
      toast.error("Failed to accept application.");
    }
  };

  const handleMarkAsDone = async () => {
    if (!id || !gig) return;
    try {
      await updateDoc(doc(db, "gigs", id), { status: "review" });
      toast.success("Gig marked as done. Waiting for employer confirmation.");
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `gigs/${id}`);
    }
  };

  const handlePayment = async () => {
    if (!gig || !id || !profile) return;
    setPaying(true);
    try {
      const idToken = await auth.currentUser?.getIdToken();
      if (!idToken) throw new Error("Authentication required");

      const response = await fetch("/api/payments/process", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${idToken}`
        },
        body: JSON.stringify({
          amount: gig.payment,
          gigId: id,
          employerId: gig.employerId,
          workerId: gig.workerId,
          method: paymentMethod
        })
      });
      
      let result: any;
      try {
        result = await response.json();
      } catch (e) {
        throw new Error("Server error: Failed to process payment response.");
      }

      if (response.ok && result.success) {
        toast.success(`Gig confirmed completed! Payment via ${paymentMethod.toUpperCase()} released.`);
        setTimeout(() => navigate("/dashboard"), 2000);
      } else {
        throw new Error(result.error || "Payment failed");
      }
    } catch (error: any) {
      console.error("Payment error:", error);
      toast.error(error.message || "Payment failed. Please try again.");
    } finally {
      setPaying(false);
    }
  };

  const handleCancel = async () => {
    if (!id || !gig) return;
    setCancelling(true);
    try {
      await updateDoc(doc(db, "gigs", id), { status: "cancelled" });
      toast.success("Gig has been cancelled.");
      setShowCancelConfirm(false);
      setTimeout(() => navigate("/dashboard"), 2000);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `gigs/${id}`);
    } finally {
      setCancelling(false);
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
    navigate("/messages", { state: { chatId } });
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !id || !gig) return;

    // Check file size (500KB limit)
    if (file.size > 500 * 1024) {
      toast.error("File size exceeds 500KB limit.");
      return;
    }

    setUploadingImage(true);
    try {
      const storageRef = ref(storage, `gigs/${id}/completion_${Date.now()}_${file.name}`);
      const snapshot = await uploadBytes(storageRef, file);
      const downloadURL = await getDownloadURL(snapshot.ref);

      await updateDoc(doc(db, "gigs", id), {
        completionImageURL: downloadURL
      });
      toast.success("Completion photo uploaded successfully!");
    } catch (error: any) {
      console.error("Error uploading image:", error);
      toast.error(error.message || "Failed to upload image.");
    } finally {
      setUploadingImage(false);
    }
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
                gig.status === 'expired' ? 'error' :
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

          {profile?.role === "worker" && gig.status === "expired" && (
            <Card className="p-6 border-red-100 bg-red-50">
              <h3 className="font-bold text-red-900 mb-2">Gig Expired</h3>
              <p className="text-sm text-red-700 mb-6">This gig has expired and is no longer accepting applications.</p>
              <Button variant="outline" className="w-full" onClick={() => navigate("/dashboard")}>
                Return to Dashboard
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

              <div className="mb-6 p-4 bg-white rounded-2xl border border-emerald-100">
                <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">Proof of Completion</p>
                {gig.completionImageURL ? (
                  <div className="space-y-3">
                    <img 
                      src={gig.completionImageURL} 
                      alt="Proof of completion" 
                      className="w-full h-40 object-cover rounded-xl border border-zinc-100"
                      referrerPolicy="no-referrer"
                    />
                    <label className="block text-center cursor-pointer text-emerald-600 text-xs font-bold hover:underline">
                      Change Photo
                      <input type="file" className="hidden" accept="image/*" onChange={handleImageUpload} disabled={uploadingImage} />
                    </label>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-8 border-2 border-dashed border-emerald-200 rounded-xl bg-emerald-50/50">
                    <input 
                      type="file" 
                      id="completion-upload" 
                      className="hidden" 
                      accept="image/*" 
                      onChange={handleImageUpload}
                      disabled={uploadingImage}
                    />
                    <label 
                      htmlFor="completion-upload" 
                      className="cursor-pointer flex flex-col items-center gap-2"
                    >
                      <div className="w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-600">
                        <CheckCircle className="w-6 h-6" />
                      </div>
                      <span className="text-sm font-bold text-emerald-700">
                        {uploadingImage ? "Uploading..." : "Upload Proof of Work"}
                      </span>
                      <span className="text-[10px] text-zinc-500">Max size: 500KB</span>
                    </label>
                  </div>
                )}
              </div>

              <Button 
                onClick={() => {
                  setHasReviewed(false);
                  setShowPaymentConfirm(true);
                }} 
                disabled={paying || !gig.completionImageURL || uploadingImage}
                className="w-full"
              >
                {paying ? "Processing..." : gig.status === "review" ? "Review & Release Payment" : `Release Payment (₱${gig.payment})`}
              </Button>
            </Card>
          )}
        </div>
      </div>

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
                onClick={handleCancel}
                disabled={cancelling}
                className="w-full bg-red-600 hover:bg-red-700"
              >
                {cancelling ? "Cancelling..." : "Yes, Cancel Gig"}
              </Button>
              <Button 
                variant="ghost" 
                onClick={() => setShowCancelConfirm(false)}
                disabled={cancelling}
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
            <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-600 mx-auto mb-6">
              <DollarSign className="w-8 h-8" />
            </div>
            <h2 className="text-2xl font-bold text-center mb-2">Confirm Payment Release</h2>
            <p className="text-zinc-600 text-center mb-6">
              Please review the payment details below before proceeding.
            </p>

            <div className="bg-zinc-50 rounded-2xl p-6 mb-6 border border-zinc-100 space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-zinc-500 text-sm">Gig Payment</span>
                <span className="font-bold text-zinc-900">₱{gig.payment.toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-zinc-500 text-sm">Service Fee (10%)</span>
                <span className="font-bold text-zinc-900">₱{(gig.payment * 0.1).toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center pt-4 border-t border-zinc-200">
                <span className="text-zinc-900 font-bold">Total to Pay</span>
                <span className="text-2xl font-bold text-emerald-600">₱{(gig.payment * 1.1).toLocaleString()}</span>
              </div>
              
              <div className="flex flex-col items-center py-4 bg-white rounded-xl border border-emerald-100">
                <p className="text-[10px] font-bold text-emerald-700 uppercase tracking-widest mb-3">Scan QR to Pay via {paymentMethod.toUpperCase()}</p>
                <img 
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=raketero_gig_${id}_${gig.payment * 1.1}`} 
                  alt="Payment QR" 
                  className="w-32 h-32 mb-3"
                />
                <p className="text-[10px] text-zinc-400 text-center px-4">
                  Scan this code with your {paymentMethod.toUpperCase()} app to authorize the ₱{(gig.payment * 1.1).toLocaleString()} payment.
                </p>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-zinc-500 text-sm">Payment Method</span>
                <span className="font-bold uppercase text-zinc-900">{paymentMethod}</span>
              </div>
              <div className="pt-4 border-t border-zinc-200">
                <div className="flex items-start gap-3">
                  <input 
                    type="checkbox" 
                    id="modal-review-confirm" 
                    checked={hasReviewed}
                    onChange={(e) => setHasReviewed(e.target.checked)}
                    className="mt-1 w-4 h-4 rounded border-zinc-300 text-emerald-600 focus:ring-emerald-500"
                  />
                  <label htmlFor="modal-review-confirm" className="text-sm text-zinc-600 leading-tight cursor-pointer">
                    I have scanned the QR code and authorized the payment. I confirm that the work has been completed satisfactorily.
                  </label>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-3">
              <Button 
                onClick={() => {
                  setShowPaymentConfirm(false);
                  handlePayment();
                }}
                className="w-full h-12 text-lg"
                disabled={paying || !hasReviewed}
              >
                {paying ? "Processing..." : "Confirm & Release Payment"}
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

import React, { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { doc, getDoc, setDoc, updateDoc, serverTimestamp, onSnapshot, collection, addDoc } from "firebase/firestore";
import { auth, db, handleFirestoreError, OperationType } from "../firebase";
import { DashboardLayout } from "../components/Layout";
import { Card, Button, Input } from "../components/UI";
import { User, Shield, CheckCircle, Wallet, Star, Bell, CreditCard, CheckCircle2, ChevronRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { motion } from "motion/react";
import { toast } from "sonner";
import { PhoneAuth } from "../components/PhoneAuth";
import { safeFetch } from "../lib/api";

export const Profile = () => {
  const { profile, updateProfile } = useAuth();
  const navigate = useNavigate();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [verifyingPhone, setVerifyingPhone] = useState(false);
  const [formData, setFormData] = useState({
    displayName: profile?.displayName || "",
    bio: profile?.bio || "",
    phoneNumber: profile?.phoneNumber || "",
    address: profile?.address || "",
    skills: profile?.skills?.join(", ") || "",
    experience: profile?.experience || "",
    idType: profile?.idType || "",
    idNumber: profile?.idNumber || "",
    idImageURL: profile?.idImageURL || "",
    photoURL: profile?.photoURL || "",
    notificationPreferences: profile?.notificationPreferences || {
      newApplications: true,
      messages: true,
      gigStatusUpdates: true,
      marketing: false
    }
  });

  const handleSave = async () => {
    setSaving(true);
    try {
      const isIdComplete = formData.idType && formData.idNumber && formData.idImageURL;
      const shouldSetPending = isIdComplete && profile?.verificationStatus === 'unverified';

      const updateData: any = {
        displayName: formData.displayName,
        bio: formData.bio,
        phoneNumber: formData.phoneNumber,
        address: formData.address,
        skills: formData.skills.split(",").map(s => s.trim()).filter(s => s !== ""),
        experience: formData.experience,
        idType: formData.idType,
        idNumber: formData.idNumber,
        idImageURL: formData.idImageURL,
        notificationPreferences: formData.notificationPreferences
      };

      if (shouldSetPending) {
        updateData.verificationStatus = 'pending';
      }

      if (formData.photoURL !== profile?.photoURL) {
        updateData.photoURL = formData.photoURL;
      }

      await updateProfile(updateData);

      if (shouldSetPending) {
        // Notify admin
        await addDoc(collection(db, "notifications"), {
          type: "verification_request",
          userId: profile?.uid,
          userName: formData.displayName || profile?.displayName,
          message: `New verification request from ${formData.displayName || profile?.displayName}`,
          read: false,
          createdAt: serverTimestamp()
        });
        toast.success('Profile updated and verification request submitted!');
      } else {
        toast.success('Profile updated successfully!');
      }
      
      setEditing(false);
    } catch (error) {
      console.error("Save error:", error);
      toast.error('Failed to update profile.');
    } finally {
      setSaving(false);
    }
  };

  const handleVerifySubmit = async () => {
    if (!formData.idType || !formData.idNumber) {
      toast.error('Please fill in ID details first.');
      return;
    }
    setSaving(true);
    try {
      const idToken = await auth.currentUser?.getIdToken();
      if (!idToken) throw new Error("Authentication required");

      const result = await safeFetch("/api/verify-id", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${idToken}`
        },
        body: JSON.stringify({
          idType: formData.idType,
          idNumber: formData.idNumber,
          idImageURL: formData.idImageURL
        })
      });

      if (result.success) {
        toast.success('ID verified successfully! You are now a verified worker.');
      } else {
        throw new Error(result.message || "Verification failed");
      }
    } catch (error: any) {
      console.error("Verification error:", error);
      toast.error(error.message || 'Failed to submit verification.');
    } finally {
      setSaving(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 500000) { // 500KB limit for base64
        toast.error("Image is too large. Please select an image smaller than 500KB.");
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData({ ...formData, idImageURL: reader.result as string });
      };
      reader.readAsDataURL(file);
    }
  };

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 500000) { // 500KB limit for base64
        toast.error("Image is too large. Please select an image smaller than 500KB.");
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData({ ...formData, photoURL: reader.result as string });
      };
      reader.readAsDataURL(file);
    }
  };

  const togglePreference = (key: keyof typeof formData.notificationPreferences) => {
    if (!editing) return;
    setFormData({
      ...formData,
      notificationPreferences: {
        ...formData.notificationPreferences,
        [key]: !formData.notificationPreferences[key]
      }
    });
  };

  React.useEffect(() => {
    if (profile && !editing) {
      setFormData({
        displayName: profile.displayName || "",
        bio: profile.bio || "",
        phoneNumber: profile.phoneNumber || "",
        address: profile.address || "",
        skills: profile.skills?.join(", ") || "",
        experience: profile.experience || "",
        idType: profile.idType || "",
        idNumber: profile.idNumber || "",
        idImageURL: profile.idImageURL || "",
        photoURL: profile.photoURL || "",
        notificationPreferences: profile.notificationPreferences || {
          newApplications: true,
          messages: true,
          gigStatusUpdates: true,
          marketing: false
        }
      });
    }
  }, [profile, editing]);

  return (
    <DashboardLayout>
      <div className="max-w-3xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold">Your Profile</h1>
          <Button 
            variant={editing ? "primary" : "outline"} 
            onClick={() => editing ? handleSave() : setEditing(true)}
            disabled={saving}
          >
            {saving ? "Saving..." : editing ? "Save Changes" : "Edit Profile"}
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <Card className="p-6 text-center">
            <div className="relative w-24 h-24 mx-auto mb-4">
              <img 
                src={formData.photoURL || profile?.photoURL || `https://ui-avatars.com/api/?name=${profile?.displayName}`} 
                className="w-full h-full rounded-full border-4 border-emerald-50 object-cover" 
                alt="" 
              />
              {editing && (
                <label 
                  htmlFor="photo-upload" 
                  className="absolute bottom-0 right-0 p-1.5 bg-emerald-600 rounded-full text-white cursor-pointer hover:bg-emerald-700 transition-colors shadow-lg"
                >
                  <CreditCard className="w-3 h-3" />
                  <input 
                    type="file" 
                    id="photo-upload" 
                    className="hidden" 
                    accept="image/*" 
                    onChange={handlePhotoChange} 
                  />
                </label>
              )}
            </div>
            <h2 className="text-xl font-bold flex items-center justify-center gap-1">
              {profile?.displayName}
              {profile?.isVerified && <CheckCircle className="w-5 h-5 text-emerald-500" />}
            </h2>
            <p className="text-zinc-500 capitalize mb-4">{profile?.role}</p>
            <div className="flex items-center justify-center gap-1 text-amber-500 font-bold">
              <Star className="w-4 h-4 fill-current" />
              {profile?.rating} <span className="text-zinc-400 font-normal">({profile?.reviewCount})</span>
            </div>
          </Card>

          <div className="md:col-span-2 space-y-6">
            <Card className="p-8">
              <div className="space-y-6">
                <div className="space-y-2">
                  <label className="text-sm font-bold text-zinc-500">Full Name</label>
                  {editing ? (
                    <Input value={formData.displayName} onChange={e => setFormData({...formData, displayName: e.target.value})} />
                  ) : (
                    <p className="text-lg font-medium">{profile?.displayName}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-bold text-zinc-500">Email Address</label>
                  <p className="text-lg font-medium">{profile?.email}</p>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-bold text-zinc-500">Phone Number</label>
                  {editing ? (
                    <div className="space-y-2">
                      <Input value={formData.phoneNumber} onChange={e => setFormData({...formData, phoneNumber: e.target.value})} placeholder="09123456789" />
                      {!verifyingPhone ? (
                        <Button variant="outline" size="sm" onClick={() => setVerifyingPhone(true)}>Verify Phone Number</Button>
                      ) : (
                        <div className="p-4 border border-zinc-200 rounded-xl">
                          <PhoneAuth onVerified={(phone) => {
                            setFormData({...formData, phoneNumber: phone});
                            setVerifyingPhone(false);
                            toast.success("Phone number verified and updated!");
                          }} />
                          <Button variant="ghost" size="sm" className="mt-2" onClick={() => setVerifyingPhone(false)}>Cancel</Button>
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="text-lg font-medium">{profile?.phoneNumber || "Not set"}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-bold text-zinc-500">Address</label>
                  {editing ? (
                    <Input value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} placeholder="City, Province" />
                  ) : (
                    <p className="text-lg font-medium">{profile?.address || "Not set"}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-bold text-zinc-500">Bio</label>
                  {editing ? (
                    <textarea 
                      className="w-full rounded-xl border border-zinc-200 p-4 text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                      value={formData.bio} 
                      onChange={e => setFormData({...formData, bio: e.target.value})} 
                      placeholder="Tell us about yourself..."
                    />
                  ) : (
                    <p className="text-zinc-600">{profile?.bio || "No bio yet."}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-bold text-zinc-500">Payment Methods</label>
                  <div className="space-y-3">
                    {profile?.linkedAccounts && profile.linkedAccounts.length > 0 ? (
                      profile.linkedAccounts.map(account => (
                        <div key={account.id} className="flex items-center justify-between p-3 bg-zinc-50 rounded-xl border border-zinc-100">
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
                        </div>
                      ))
                    ) : profile?.paymentNumber ? (
                      <div className="p-3 bg-zinc-50 rounded-xl border border-zinc-100">
                        <p className="text-xs font-bold text-zinc-900">Legacy GCash</p>
                        <p className="text-[10px] text-zinc-500">{profile.paymentNumber}</p>
                      </div>
                    ) : (
                      <p className="text-sm text-zinc-500 italic">No payment methods linked.</p>
                    )}
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="w-full text-xs"
                      onClick={() => navigate("/wallet")}
                    >
                      Manage in Wallet
                    </Button>
                  </div>
                </div>

                {profile?.role === "worker" && (
                  <>
                    <div className="pt-6 border-t border-zinc-100">
                      <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                        <Shield className="w-5 h-5 text-emerald-600" />
                        ID Verification
                      </h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <label className="text-sm font-bold text-zinc-500">ID Type</label>
                          {editing ? (
                            <select 
                              className="w-full h-11 rounded-xl border border-zinc-200 bg-white px-4 text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                              value={formData.idType}
                              onChange={e => setFormData({...formData, idType: e.target.value})}
                            >
                              <option value="">Select ID Type</option>
                              <option value="National ID">National ID</option>
                              <option value="Driver's License">Driver's License</option>
                              <option value="Passport">Passport</option>
                              <option value="UMID">UMID</option>
                              <option value="Postal ID">Postal ID</option>
                            </select>
                          ) : (
                            <p className="font-medium">{profile?.idType || "Not submitted"}</p>
                          )}
                        </div>
                        <div className="space-y-2">
                          <label className="text-sm font-bold text-zinc-500">ID Number</label>
                          {editing ? (
                            <Input value={formData.idNumber} onChange={e => setFormData({...formData, idNumber: e.target.value})} placeholder="Enter ID number" />
                          ) : (
                            <p className="font-medium">{profile?.idNumber ? "****" + profile.idNumber.slice(-4) : "Not submitted"}</p>
                          )}
                        </div>
                      </div>

      {editing && (
                        <div className="mt-4 p-4 bg-emerald-50/50 rounded-2xl border border-emerald-100/50">
                          <label className="text-sm font-bold text-emerald-900 mb-2 block">Upload ID Image</label>
                          <p className="text-xs text-emerald-700 mb-4">
                            Please upload a clear photo of your ID. Max file size: 500KB.
                            Supported formats: JPG, PNG.
                          </p>
                          <div className="flex items-center gap-4">
                            <input 
                              type="file" 
                              id="id-image-upload"
                              accept="image/*" 
                              onChange={handleFileChange}
                              className="hidden"
                            />
                            <label 
                              htmlFor="id-image-upload"
                              className="cursor-pointer px-4 py-2 bg-white border border-emerald-200 rounded-xl text-sm font-medium text-emerald-700 hover:bg-emerald-50 transition-colors"
                            >
                              Choose File
                            </label>
                            {formData.idImageURL && (
                              <span className="text-xs text-emerald-600 font-medium flex items-center gap-1">
                                <CheckCircle2 className="w-3 h-3" />
                                Image selected
                              </span>
                            )}
                          </div>
                        </div>
                      )}

                      {!profile?.isVerified && !editing && profile?.verificationStatus !== 'pending' && (
                        <div className="mt-6 p-6 bg-emerald-50 rounded-3xl border border-emerald-100">
                          <div className="flex items-center gap-3 mb-4 text-emerald-800">
                            <Shield className="w-6 h-6" />
                            <h3 className="font-bold">Ready for Verification?</h3>
                          </div>
                          <p className="text-sm text-emerald-700 mb-6">
                            You've provided your ID details. Get verified now to unlock more gigs and build trust with employers.
                          </p>
                          <Button 
                            className="w-full h-12 shadow-lg shadow-emerald-200" 
                            onClick={handleVerifySubmit}
                            disabled={saving || !formData.idType || !formData.idNumber || !formData.idImageURL}
                          >
                            {saving ? "Verifying ID..." : "Verify ID Now"}
                          </Button>
                        </div>
                      )}

                      {profile?.verificationStatus === 'pending' && !editing && (
                        <div className="mt-4 p-4 bg-amber-50 border border-amber-100 rounded-xl flex gap-3">
                          <Shield className="w-5 h-5 text-amber-600 shrink-0" />
                          <p className="text-sm text-amber-800">
                            Your ID is currently under review. Once verified, you'll get a badge and more gig opportunities.
                          </p>
                        </div>
                      )}
                      
                      {profile?.verificationStatus === 'rejected' && !editing && (
                        <div className="mt-4 p-4 bg-red-50 border border-red-100 rounded-xl flex gap-3">
                          <Shield className="w-5 h-5 text-red-600 shrink-0" />
                          <p className="text-sm text-red-800">
                            Your verification was rejected. Please update your ID details and try again.
                          </p>
                        </div>
                      )}
                    </div>

                    <div className="space-y-2 pt-6 border-t border-zinc-100">
                      <label className="text-sm font-bold text-zinc-500">Skills (comma separated)</label>
                      {editing ? (
                        <Input value={formData.skills} onChange={e => setFormData({...formData, skills: e.target.value})} />
                      ) : (
                        <div className="flex flex-wrap gap-2">
                          {profile.skills?.map(skill => (
                            <span key={skill} className="px-3 py-1 bg-zinc-100 rounded-full text-sm">{skill}</span>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-bold text-zinc-500">Experience</label>
                      {editing ? (
                        <textarea 
                          className="w-full rounded-xl border border-zinc-200 p-4 text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                          value={formData.experience} 
                          onChange={e => setFormData({...formData, experience: e.target.value})} 
                        />
                      ) : (
                        <p className="text-zinc-600">{profile.experience || "No experience listed."}</p>
                      )}
                    </div>
                  </>
                )}

                <div className="pt-6 border-t border-zinc-100">
                  <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                    <Bell className="w-5 h-5 text-emerald-600" />
                    Notification Preferences
                  </h3>
                  <div className="space-y-4">
                    {[
                      { key: 'newApplications', label: 'New Gig Applications', desc: 'Get notified when someone applies to your gig.' },
                      { key: 'messages', label: 'Messages', desc: 'Get notified when you receive a new message.' },
                      { key: 'gigStatusUpdates', label: 'Gig Status Updates', desc: 'Get notified when your gig status changes.' },
                      { key: 'marketing', label: 'Marketing & Promotions', desc: 'Receive updates about new features and offers.' },
                    ].map((pref) => (
                      <div key={pref.key} className="flex items-center justify-between py-2">
                        <div>
                          <p className="font-medium text-zinc-900">{pref.label}</p>
                          <p className="text-sm text-zinc-500">{pref.desc}</p>
                        </div>
                        <button
                          onClick={() => togglePreference(pref.key as any)}
                          disabled={!editing}
                          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
                            formData.notificationPreferences[pref.key as keyof typeof formData.notificationPreferences]
                              ? 'bg-emerald-600'
                              : 'bg-zinc-200'
                          } ${!editing ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                        >
                          <span
                            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                              formData.notificationPreferences[pref.key as keyof typeof formData.notificationPreferences]
                                ? 'translate-x-6'
                                : 'translate-x-1'
                            }`}
                          />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

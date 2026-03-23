import React, { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { DashboardLayout } from "../components/Layout";
import { Card, Button, Input } from "../components/UI";
import { User, Shield, CheckCircle, Wallet, Star, Bell } from "lucide-react";
import { motion } from "motion/react";
import { toast } from "sonner";

export const Profile = () => {
  const { profile, updateProfile } = useAuth();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    displayName: profile?.displayName || "",
    bio: profile?.bio || "",
    phoneNumber: profile?.phoneNumber || "",
    address: profile?.address || "",
    skills: profile?.skills?.join(", ") || "",
    experience: profile?.experience || "",
    paymentNumber: profile?.gcashNumber || "",
    idType: profile?.idType || "",
    idNumber: profile?.idNumber || "",
    idImageURL: profile?.idImageURL || "",
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
      await updateProfile({
        displayName: formData.displayName,
        bio: formData.bio,
        phoneNumber: formData.phoneNumber,
        address: formData.address,
        skills: formData.skills.split(",").map(s => s.trim()).filter(s => s !== ""),
        experience: formData.experience,
        gcashNumber: formData.paymentNumber,
        idType: formData.idType,
        idNumber: formData.idNumber,
        idImageURL: formData.idImageURL,
        notificationPreferences: formData.notificationPreferences
      });
      toast.success('Profile updated successfully!');
      setEditing(false);
    } catch (error) {
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
      await updateProfile({
        idType: formData.idType,
        idNumber: formData.idNumber,
        idImageURL: formData.idImageURL,
        verificationStatus: 'pending'
      });
      toast.success('Verification request submitted!');
    } catch (error) {
      toast.error('Failed to submit verification.');
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
        paymentNumber: profile.gcashNumber || "",
        idType: profile.idType || "",
        idNumber: profile.idNumber || "",
        idImageURL: profile.idImageURL || "",
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
            <img src={profile?.photoURL || `https://ui-avatars.com/api/?name=${profile?.displayName}`} className="w-24 h-24 rounded-full mx-auto mb-4 border-4 border-emerald-50" alt="" />
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
                    <Input value={formData.phoneNumber} onChange={e => setFormData({...formData, phoneNumber: e.target.value})} placeholder="09123456789" />
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
                  <label className="text-sm font-bold text-zinc-500">Payment Number (GCash/Maya)</label>
                  {editing ? (
                    <Input value={formData.paymentNumber} onChange={e => setFormData({...formData, paymentNumber: e.target.value})} placeholder="09123456789" />
                  ) : (
                    <p className="text-lg font-medium">{profile?.gcashNumber || "Not set"}</p>
                  )}
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
                        <div className="mt-4 space-y-2">
                          <label className="text-sm font-bold text-zinc-500">ID Document Image</label>
                          <input 
                            type="file" 
                            accept="image/*" 
                            onChange={handleFileChange}
                            className="w-full text-sm text-zinc-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-emerald-50 file:text-emerald-700 hover:file:bg-emerald-100"
                          />
                        </div>
                      )}

                      {!profile?.isVerified && !editing && profile?.verificationStatus !== 'pending' && (
                        <div className="mt-6">
                          <Button 
                            className="w-full" 
                            onClick={handleVerifySubmit}
                            disabled={saving || !profile?.idType || !profile?.idNumber}
                          >
                            Submit for Verification
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

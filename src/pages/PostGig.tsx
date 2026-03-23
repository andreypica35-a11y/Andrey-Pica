import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { db, handleFirestoreError, OperationType } from "../firebase";
import { useAuth } from "../context/AuthContext";
import { DashboardLayout } from "../components/Layout";
import { Card, Button, Input } from "../components/UI";
import { toast } from "sonner";

export const PostGig = () => {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    const formData = new FormData(e.currentTarget);
    
    try {
      const gigData = {
        employerId: profile?.uid,
        employerName: profile?.displayName,
        title: formData.get("title"),
        description: formData.get("description"),
        category: formData.get("category"),
        payment: Number(formData.get("payment")),
        location: formData.get("location"),
        duration: formData.get("duration"),
        status: "open",
        createdAt: serverTimestamp(),
      };
      
      await addDoc(collection(db, "gigs"), gigData);
      toast.success("Gig posted successfully!");
      navigate("/dashboard");
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, "gigs");
      toast.error("Failed to post gig.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">Post a New Gig</h1>
        <Card className="p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <label className="text-sm font-bold text-zinc-700">Gig Title</label>
              <Input name="title" placeholder="e.g. Help moving furniture" required />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-bold text-zinc-700">Category</label>
                <select name="category" className="w-full h-11 rounded-xl border border-zinc-200 px-4 text-sm focus:ring-2 focus:ring-emerald-500 outline-none">
                  <option>Delivery</option>
                  <option>House Cleaning</option>
                  <option>Moving Help</option>
                  <option>Repair Services</option>
                  <option>Event Staff</option>
                  <option>Tutoring</option>
                  <option>Errands</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-bold text-zinc-700">Payment (₱)</label>
                <Input name="payment" type="number" placeholder="1000" required />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-bold text-zinc-700">Location</label>
                <Input name="location" placeholder="e.g. Quezon City" required />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-bold text-zinc-700">Duration</label>
                <Input name="duration" placeholder="e.g. 2 hours" required />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-bold text-zinc-700">Description</label>
              <textarea 
                name="description" 
                rows={4} 
                className="w-full rounded-xl border border-zinc-200 p-4 text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                placeholder="Describe the task in detail..."
                required
              ></textarea>
            </div>

            <Button type="submit" disabled={loading} className="w-full" size="lg">
              {loading ? "Posting..." : "Post Gig"}
            </Button>
          </form>
        </Card>
      </div>
    </DashboardLayout>
  );
};

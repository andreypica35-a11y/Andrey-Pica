export type UserRole = "worker" | "employer" | "admin";

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  photoURL: string;
  role: UserRole;
  isVerified: boolean;
  bio?: string;
  phoneNumber?: string;
  address?: string;
  skills?: string[];
  experience?: string;
  gcashNumber?: string;
  idType?: string;
  idNumber?: string;
  idImageURL?: string;
  rating?: number;
  reviewCount?: number;
  createdAt: any;
}

export interface Gig {
  id: string;
  employerId: string;
  employerName: string;
  title: string;
  description: string;
  category: string;
  payment: number;
  location: string;
  duration: string;
  status: "open" | "in-progress" | "review" | "completed" | "cancelled";
  workerId?: string;
  createdAt: any;
}

export interface Application {
  id: string;
  gigId: string;
  workerId: string;
  workerName: string;
  status: "pending" | "accepted" | "rejected";
  createdAt: any;
}

export interface Transaction {
  id: string;
  gigId: string;
  employerId: string;
  workerId: string;
  amount: number;
  serviceFee: number;
  workerAmount: number;
  method: string;
  status: "pending" | "completed" | "failed";
  createdAt: any;
}

export interface Message {
  id: string;
  chatId: string;
  senderId: string;
  text: string;
  createdAt: any;
}

export type UserRole = "worker" | "employer" | "admin";
export type VerificationStatus = "unverified" | "pending" | "verified" | "rejected";

export interface NotificationPreferences {
  newApplications: boolean;
  messages: boolean;
  gigStatusUpdates: boolean;
  marketing: boolean;
}

export interface LinkedAccount {
  id: string;
  provider: "gcash" | "maya" | "bank" | "paypal";
  accountName: string;
  accountNumber: string;
  isDefault: boolean;
  createdAt: any;
}

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  photoURL: string;
  role: UserRole;
  isVerified: boolean;
  verificationStatus?: VerificationStatus;
  bio?: string;
  phoneNumber?: string;
  address?: string;
  skills?: string[];
  experience?: string;
  paymentNumber?: string; // Legacy field, keeping for compatibility
  linkedAccounts?: LinkedAccount[];
  balance?: number;
  idType?: string;
  idNumber?: string;
  idImageURL?: string;
  verifiedAt?: any;
  rating?: number;
  reviewCount?: number;
  notificationPreferences?: NotificationPreferences;
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
  status: "open" | "in-progress" | "review" | "completed" | "cancelled" | "expired";
  workerId?: string;
  createdAt: any;
  completedAt?: any;
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
  transactionId?: string;
  gigId?: string;
  employerId?: string;
  workerId?: string;
  userId: string;
  amount: number;
  serviceFee: number;
  workerAmount: number;
  method: string;
  status: "pending" | "completed" | "failed";
  type?: "payment" | "deposit" | "withdrawal";
  createdAt: any;
}

export interface Message {
  id: string;
  chatId: string;
  senderId: string;
  text: string;
  createdAt: any;
}

export interface Chat {
  id: string;
  participants: string[];
  participantNames: { [key: string]: string };
  lastMessage?: string;
  updatedAt: any;
}

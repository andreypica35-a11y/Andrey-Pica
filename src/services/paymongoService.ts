import axios from "axios";
import { auth } from "../firebase";

const API_BASE = "/api/paymongo";

const getAuthHeaders = async () => {
  const token = await auth.currentUser?.getIdToken();
  return {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  };
};

export const createPaymentIntent = async (amount: number, currency: string = "PHP", description: string = "Payment for gig") => {
  const headers = await getAuthHeaders();
  const response = await axios.post(`${API_BASE}/payment-intent`, { amount, currency, description }, headers);
  return response.data;
};

export const createPaymentLink = async (amount: number, description: string = "Payment link") => {
  const headers = await getAuthHeaders();
  const response = await axios.post(`${API_BASE}/payment-link`, { amount, description }, headers);
  return response.data;
};

export const getPaymentStatus = async (id: string) => {
  const headers = await getAuthHeaders();
  const response = await axios.get(`${API_BASE}/payment/${id}`, headers);
  return response.data;
};

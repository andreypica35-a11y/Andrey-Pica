import React, { useState, useRef, useEffect } from "react";
import { auth, RecaptchaVerifier, signInWithPhoneNumber } from "../firebase";
import { Button, Input } from "./UI";
import { toast } from "sonner";
import { ConfirmationResult } from "firebase/auth";

export const PhoneAuth = ({ onVerified }: { onVerified: (phoneNumber: string) => void }) => {
  const [phoneNumber, setPhoneNumber] = useState("");
  const [otp, setOtp] = useState("");
  const [confirmationResult, setConfirmationResult] = useState<ConfirmationResult | null>(null);
  const [loading, setLoading] = useState(false);
  const recaptchaContainer = useRef<HTMLDivElement>(null);
  const recaptchaVerifier = useRef<RecaptchaVerifier | null>(null);

  useEffect(() => {
    if (recaptchaContainer.current) {
      recaptchaVerifier.current = new RecaptchaVerifier(auth, recaptchaContainer.current, {
        size: "invisible",
      });
    }
    return () => {
      recaptchaVerifier.current?.clear();
    };
  }, []);

  const handleSendOtp = async () => {
    if (!phoneNumber.startsWith("+")) {
      toast.error("Please include country code (e.g., +63 for Philippines)");
      return;
    }
    setLoading(true);
    try {
      const result = await signInWithPhoneNumber(auth, phoneNumber, recaptchaVerifier.current!);
      setConfirmationResult(result);
      toast.success("OTP sent!");
    } catch (error: any) {
      console.error(error);
      toast.error("Failed to send OTP: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    setLoading(true);
    try {
      await confirmationResult?.confirm(otp);
      toast.success("Phone verified!");
      onVerified(phoneNumber);
    } catch (error: any) {
      console.error(error);
      toast.error("Invalid OTP");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div ref={recaptchaContainer} />
      {!confirmationResult ? (
        <>
          <Input
            value={phoneNumber}
            onChange={(e) => setPhoneNumber(e.target.value)}
            placeholder="+639123456789"
          />
          <Button onClick={handleSendOtp} disabled={loading} className="w-full">
            {loading ? "Sending..." : "Send OTP"}
          </Button>
        </>
      ) : (
        <>
          <Input
            value={otp}
            onChange={(e) => setOtp(e.target.value)}
            placeholder="Enter OTP"
          />
          <Button onClick={handleVerifyOtp} disabled={loading} className="w-full">
            {loading ? "Verifying..." : "Verify OTP"}
          </Button>
        </>
      )}
    </div>
  );
};

import React, { useState, useEffect } from "react";
import { collection, query, where, onSnapshot, addDoc, serverTimestamp, orderBy } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../context/AuthContext";
import { Message } from "../types";
import { DashboardLayout } from "../components/Layout";
import { Card, Button, Input } from "../components/UI";
import { Send } from "lucide-react";
import { format } from "date-fns";

export const Messages = () => {
  const { profile } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  // In a real app, we'd have a list of chats. For this demo, we'll use a global chat or a specific one.
  const chatId = "global_demo_chat"; 

  useEffect(() => {
    const q = query(
      collection(db, "chats", chatId, "messages"),
      orderBy("createdAt", "asc")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setMessages(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Message)));
    }, (error) => {
      console.error("Messages snapshot error:", error);
    });

    return unsubscribe;
  }, [chatId]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !profile) return;

    try {
      await addDoc(collection(db, "chats", chatId, "messages"), {
        chatId,
        senderId: profile.uid,
        senderName: profile.displayName,
        text: newMessage,
        createdAt: serverTimestamp()
      });
      setNewMessage("");
    } catch (error) {
      console.error("Error sending message:", error);
    }
  };

  return (
    <DashboardLayout>
      <div className="h-[calc(100vh-200px)] flex flex-col">
        <h1 className="text-3xl font-bold mb-6">Messages</h1>
        
        <Card className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {messages.map((msg) => (
              <div 
                key={msg.id} 
                className={cn(
                  "flex flex-col max-w-[80%]",
                  msg.senderId === profile?.uid ? "ml-auto items-end" : "mr-auto items-start"
                )}
              >
                <div className={cn(
                  "px-4 py-2 rounded-2xl text-sm",
                  msg.senderId === profile?.uid ? "bg-emerald-600 text-white" : "bg-zinc-100 text-zinc-900"
                )}>
                  {msg.text}
                </div>
                <span className="text-[10px] text-zinc-400 mt-1">
                  {msg.createdAt?.toDate ? format(msg.createdAt.toDate(), "h:mm a") : "Sending..."}
                </span>
              </div>
            ))}
          </div>

          <form onSubmit={handleSendMessage} className="p-4 border-t border-zinc-100 flex gap-2">
            <Input 
              value={newMessage} 
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Type your message..." 
            />
            <Button type="submit" size="sm" className="h-11 w-11 p-0">
              <Send className="w-5 h-5" />
            </Button>
          </form>
        </Card>
      </div>
    </DashboardLayout>
  );
};

function cn(...inputs: any[]) {
  return inputs.filter(Boolean).join(" ");
}

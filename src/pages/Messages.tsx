import React, { useState, useEffect, useRef } from "react";
import { collection, query, where, onSnapshot, addDoc, serverTimestamp, orderBy, doc, updateDoc, setDoc, getDoc } from "firebase/firestore";
import { db, handleFirestoreError, OperationType } from "../firebase";
import { useAuth } from "../context/AuthContext";
import { Message, Chat } from "../types";
import { DashboardLayout } from "../components/Layout";
import { Card, Button, Input, cn } from "../components/UI";
import { Send, MessageSquare, User, Search } from "lucide-react";
import { format } from "date-fns";

export const Messages = () => {
  const { profile } = useAuth();
  const [chats, setChats] = useState<Chat[]>([]);
  const [selectedChat, setSelectedChat] = useState<Chat | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (!profile) return;

    const q = query(
      collection(db, "chats"),
      where("participants", "array-contains", profile.uid),
      orderBy("updatedAt", "desc")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const chatList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Chat));
      setChats(chatList);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, "chats");
      setLoading(false);
    });

    return unsubscribe;
  }, [profile]);

  useEffect(() => {
    if (!selectedChat) {
      setMessages([]);
      return;
    }

    const q = query(
      collection(db, "chats", selectedChat.id, "messages"),
      orderBy("createdAt", "asc")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setMessages(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Message)));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, `chats/${selectedChat.id}/messages`);
    });

    return unsubscribe;
  }, [selectedChat]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !profile || !selectedChat) return;

    const text = newMessage;
    setNewMessage("");

    try {
      await addDoc(collection(db, "chats", selectedChat.id, "messages"), {
        chatId: selectedChat.id,
        senderId: profile.uid,
        text,
        createdAt: serverTimestamp()
      });

      await updateDoc(doc(db, "chats", selectedChat.id), {
        lastMessage: text,
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `chats/${selectedChat.id}/messages`);
    }
  };

  const getOtherParticipantName = (chat: Chat) => {
    if (!profile) return "User";
    const otherId = chat.participants.find(id => id !== profile.uid);
    return otherId ? chat.participantNames[otherId] || "User" : "User";
  };

  return (
    <DashboardLayout>
      <div className="h-[calc(100vh-140px)] flex flex-col md:flex-row gap-6">
        {/* Chat List Sidebar */}
        <div className="w-full md:w-80 flex flex-col gap-4">
          <h1 className="text-3xl font-bold">Messages</h1>
          <Card className="flex-1 flex flex-col overflow-hidden">
            <div className="p-4 border-b border-zinc-100">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                <Input className="pl-9 bg-zinc-50 border-none" placeholder="Search chats..." />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto">
              {loading ? (
                <div className="p-8 text-center text-zinc-400 text-sm">Loading chats...</div>
              ) : chats.length === 0 ? (
                <div className="p-8 text-center text-zinc-400 text-sm">No conversations yet.</div>
              ) : (
                chats.map(chat => (
                  <button
                    key={chat.id}
                    onClick={() => setSelectedChat(chat)}
                    className={cn(
                      "w-full p-4 flex gap-3 text-left transition-colors border-b border-zinc-50",
                      selectedChat?.id === chat.id ? "bg-emerald-50 border-emerald-100" : "hover:bg-zinc-50"
                    )}
                  >
                    <div className="w-12 h-12 rounded-full bg-zinc-100 flex items-center justify-center flex-shrink-0">
                      <User className="w-6 h-6 text-zinc-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-baseline mb-1">
                        <p className="font-bold text-zinc-900 truncate">{getOtherParticipantName(chat)}</p>
                        <span className="text-[10px] text-zinc-400">
                          {chat.updatedAt?.toDate ? format(chat.updatedAt.toDate(), "MMM d") : ""}
                        </span>
                      </div>
                      <p className="text-xs text-zinc-500 truncate">{chat.lastMessage || "No messages yet"}</p>
                    </div>
                  </button>
                ))
              )}
            </div>
          </Card>
        </div>

        {/* Message View */}
        <div className="flex-1 flex flex-col min-w-0">
          {selectedChat ? (
            <Card className="flex-1 flex flex-col overflow-hidden">
              <div className="p-4 border-b border-zinc-100 flex items-center gap-3 bg-white sticky top-0 z-10">
                <div className="w-10 h-10 rounded-full bg-zinc-100 flex items-center justify-center">
                  <User className="w-5 h-5 text-zinc-400" />
                </div>
                <div>
                  <p className="font-bold text-zinc-900">{getOtherParticipantName(selectedChat)}</p>
                  <p className="text-[10px] text-emerald-600 font-bold uppercase tracking-wider">Online</p>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-zinc-50/30">
                {messages.map((msg) => (
                  <div 
                    key={msg.id} 
                    className={cn(
                      "flex flex-col max-w-[80%]",
                      msg.senderId === profile?.uid ? "ml-auto items-end" : "mr-auto items-start"
                    )}
                  >
                    <div className={cn(
                      "px-4 py-2 rounded-2xl text-sm shadow-sm",
                      msg.senderId === profile?.uid 
                        ? "bg-emerald-600 text-white rounded-tr-none" 
                        : "bg-white text-zinc-900 border border-zinc-100 rounded-tl-none"
                    )}>
                      {msg.text}
                    </div>
                    <span className="text-[10px] text-zinc-400 mt-1 px-1">
                      {msg.createdAt?.toDate ? format(msg.createdAt.toDate(), "h:mm a") : "Sending..."}
                    </span>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>

              <form onSubmit={handleSendMessage} className="p-4 border-t border-zinc-100 flex gap-2 bg-white">
                <Input 
                  value={newMessage} 
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="Type your message..." 
                  className="bg-zinc-50 border-none h-12"
                />
                <Button type="submit" size="sm" className="h-12 w-12 p-0 rounded-xl">
                  <Send className="w-5 h-5" />
                </Button>
              </form>
            </Card>
          ) : (
            <div className="flex-1 flex items-center justify-center bg-zinc-50/50 rounded-3xl border border-dashed border-zinc-200">
              <div className="text-center">
                <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-sm">
                  <MessageSquare className="w-8 h-8 text-zinc-300" />
                </div>
                <p className="text-zinc-500 font-medium">Select a conversation to start messaging</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
};

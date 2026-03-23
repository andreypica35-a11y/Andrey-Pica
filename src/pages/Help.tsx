import React, { useState } from "react";
import { DashboardLayout } from "../components/Layout";
import { Card, Button, Input } from "../components/UI";
import { 
  Search, 
  HelpCircle, 
  Book, 
  MessageCircle, 
  ShieldCheck, 
  Wallet as WalletIcon, 
  User, 
  ChevronRight,
  ChevronDown
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { toast } from "sonner";

interface FAQItemProps {
  question: string;
  answer: string;
}

const FAQItem: React.FC<FAQItemProps> = ({ question, answer }) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="border-b border-zinc-100 last:border-0">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="w-full py-6 flex items-center justify-between text-left hover:text-emerald-600 transition-colors"
      >
        <span className="text-lg font-medium pr-8">{question}</span>
        {isOpen ? <ChevronDown className="w-5 h-5 shrink-0" /> : <ChevronRight className="w-5 h-5 shrink-0" />}
      </button>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <p className="pb-6 text-zinc-600 leading-relaxed">
              {answer}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export const HelpCenter = () => {
  const [searchQuery, setSearchQuery] = useState("");

  const categories = [
    { icon: <WalletIcon className="w-6 h-6" />, title: "Payments & Wallet", count: 12 },
    { icon: <ShieldCheck className="w-6 h-6" />, title: "Safety & Trust", count: 8 },
    { icon: <User className="w-6 h-6" />, title: "Account & Profile", count: 15 },
    { icon: <Book className="w-6 h-6" />, title: "Gig Guidelines", count: 10 },
  ];

  const faqs = [
    {
      question: "How do I withdraw my earnings?",
      answer: "You can withdraw your earnings through your Wallet page. Simply click 'Withdraw Funds' and enter your GCash or Maya number. Withdrawals are typically processed within 24 hours. Minimum withdrawal is ₱100."
    },
    {
      question: "Is my payment secure?",
      answer: "Yes, we use a secure escrow system. When an employer hires a worker, the payment is held by our platform. Once the worker marks the gig as done and the employer confirms, the funds are released to the worker's wallet."
    },
    {
      question: "How do I get verified?",
      answer: "To get verified, go to your Profile page and upload a valid government ID. Our admin team will review your application within 1-2 business days. Verified users get a badge and have higher trust from employers."
    },
    {
      question: "What happens if a gig is cancelled?",
      answer: "If a gig is cancelled before work begins, the employer receives a full refund. If work has already started, we encourage both parties to reach a fair resolution. Our support team can mediate disputes if necessary."
    },
    {
      question: "How do I contact support directly?",
      answer: "If you can't find the answer in our FAQ, you can reach out to our support team via the 'Contact Support' button below or email us at support@gigflow.ph."
    }
  ];

  const filteredFaqs = faqs.filter(faq => 
    faq.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
    faq.answer.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold mb-4">How can we help you?</h1>
          <p className="text-zinc-500 text-lg mb-8">Search our knowledge base or browse categories below.</p>
          <div className="relative max-w-2xl mx-auto">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400 w-5 h-5" />
            <Input 
              className="pl-12 h-14 text-lg rounded-2xl shadow-sm border-zinc-200"
              placeholder="Search for help..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 mb-16">
          {categories.map((cat, idx) => (
            <Card key={idx} className="p-6 hover:border-emerald-500 transition-all cursor-pointer group">
              <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center mb-4 group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                {cat.icon}
              </div>
              <h3 className="font-bold mb-1">{cat.title}</h3>
              <p className="text-xs text-zinc-400 font-medium uppercase tracking-wider">{cat.count} Articles</p>
            </Card>
          ))}
        </div>

        <div className="mb-16">
          <h2 className="text-2xl font-bold mb-8 flex items-center gap-2">
            <HelpCircle className="w-6 h-6 text-emerald-600" />
            Frequently Asked Questions
          </h2>
          <Card className="p-2 divide-y divide-zinc-100">
            {filteredFaqs.length > 0 ? (
              filteredFaqs.map((faq, idx) => (
                <FAQItem key={idx} question={faq.question} answer={faq.answer} />
              ))
            ) : (
              <div className="p-12 text-center text-zinc-500">
                No results found for "{searchQuery}"
              </div>
            )}
          </Card>
        </div>

        <div className="bg-emerald-600 rounded-[2.5rem] p-12 text-white text-center relative overflow-hidden">
          <div className="relative z-10">
            <h2 className="text-3xl font-bold mb-4">Still need assistance?</h2>
            <p className="text-emerald-100 mb-8 max-w-md mx-auto">Our support team is available 24/7 to help you with any issues or questions you might have.</p>
            <div className="flex flex-wrap justify-center gap-4">
              <Button 
                className="bg-white text-emerald-600 hover:bg-emerald-50 border-none px-8"
                onClick={() => toast.success("Support chat is currently offline. Please try again later or email us.")}
              >
                <MessageCircle className="w-5 h-5 mr-2" />
                Contact Support
              </Button>
              <Button 
                variant="outline" 
                className="border-emerald-400 text-white hover:bg-emerald-500 px-8"
                onClick={() => window.location.href = "mailto:support@gigflow.ph"}
              >
                Email Us
              </Button>
            </div>
          </div>
          <HelpCircle className="absolute -right-12 -bottom-12 w-64 h-64 text-emerald-500/20 rotate-12" />
        </div>
      </div>
    </DashboardLayout>
  );
};

import React, { useState, useRef, useEffect } from 'react';
import { X, Send, Bot, Sparkles, LifeBuoy, Minus, Maximize2 } from 'lucide-react';

export default function HelpChatWindow() {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [inputText, setInputText] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef(null);

  const [messages, setMessages] = useState([
    {
      id: 1,
      sender: "bot",
      text: "Hi there! 👋 I'm your Smart Assistant.\n\nI can understand multiple languages! (Hindi, English, etc.)\nAsk me how to:\n📦 Create Orders / Order kaise banaye\n🔄 Returns / Wapas kaise karein\n🚚 Dispatch tracking",
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
  ]);

  const quickActions = ["Order kaise banaye?", "How to process returns?", "Stock check karna hai"];

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    if (isOpen && !isMinimized) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isTyping, isOpen, isMinimized]);

  // ==========================================
  // 🧠 SMART MULTI-LINGUAL LOGIC (MOCK)
  // ==========================================
  const generateBotResponse = async (text) => {
    const apiKey = import.meta.env.VITE_OPENAI_API_KEY;

    // 🚀 Use Real AI if the API key is available in the .env file
    if (apiKey) {
      try {
        const response = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${apiKey}`
          },
          body: JSON.stringify({
            model: "gpt-3.5-turbo",
            messages: [
              { role: "system", content: "You are a helpful software assistant for an Inventory App. Reply in the same language the user speaks. Keep answers concise." },
              { role: "user", content: text }
            ]
          })
        });
        
        if (response.ok) {
          const data = await response.json();
          return data.choices[0].message.content;
        } else {
          console.error("OpenAI API Error:", await response.text());
        }
      } catch(e) {
        console.error("Network error with AI:", e);
      }
    }

    // ==========================================
    // FALLBACK TO MOCK LOGIC (If API fails or no key is provided)
    // ==========================================
    const t = text.toLowerCase();

    // Language Detection (Basic Hindi/Hinglish vs English)
    const isHindi = t.match(/(kaise|kya|kahan|mujhe|wapas|naya|banao|hai|karo|batao|karna|check|kitna)/i);

    // 1. Order Creation
    if (t.match(/(order|create|new|naya|banao|make|add)/)) {
      if (isHindi) return "🛒 **Naya Order Banane Ke Liye:**\n\n1. 'Order Processing' tab mein jayein.\n2. ✨ 'Create Order' button dabayein.\n3. Customer platform (GeM, Amazon) chune.\n4. Model aur Serial number select karein.\n5. Submit karein! Serial automatic 'Dispatched' ho jayega.";
      return "🛒 **To Create a New Order:**\n\n1. Go to the 'Order Processing' tab.\n2. Click the ✨ 'Create Order' button.\n3. Select Platform & Serial Number.\n4. Click Submit. The serial status will automatically change to 'Dispatched'.";
    }

    // 2. Returns Handling
    if (t.match(/(return|wapas|lautana|kharab|damaged|rto)/)) {
      if (isHindi) return "🔄 **Return (Wapas) Lene Ke Liye:**\n\n1. 'Returns' module mein jayein.\n2. 'Add Return' par click karein.\n3. Serial Number dalein aur condition (Good/Damaged) chune.\n💡 *Tip:* Agar condition 'Good' hai, toh printer seedha aapke Available stock mein wapas aa jayega!";
      return "🔄 **When a Return Happens:**\n\n1. Go to the 'Returns' module.\n2. Click 'Add Return'.\n3. Enter Serial Number & Condition.\n💡 *Tip:* If marked 'Good', the item goes straight back to your Available Inventory!";
    }

    // 3. Dispatch / Tracking
    if (t.match(/(dispatch|track|courier|bhejna|status)/)) {
      if (isHindi) return "🚚 **Tracking/Dispatch Update Karna:**\n\n1. 'Active Orders' mein order open karein.\n2. 'Update Status' mein jayein.\n3. Tracking ID dalein aur status 'Dispatched' kar dein.\n(Aap E-Way bill aur POD bhi upload kar sakte hain!)";
      return "🚚 **To Update Dispatch & Tracking:**\n\n1. Open Order in 'Active Orders'.\n2. Scroll to 'Update Status'.\n3. Enter Tracking ID and change status to 'Dispatched'.";
    }

    // 4. Stock / Inventory
    if (t.match(/(stock|inventory|bacha|kitna|available)/)) {
      if (isHindi) return "📦 **Stock Check Karna:**\n\n'Dashboard' ya 'Reports' page par jayein. Wahan aapko har model ka exact count dikhega ki kitne 'Available' hain aur kitne 'Dispatched' ho chuke hain.";
      return "📦 **Checking Stock:**\n\nNavigate to your 'Dashboard'. There you can see exactly how many serials are 'Available' or 'Dispatched'.";
    }

    // 5. Greetings
    if (t.match(/(hi|hello|hey|namaste|salam|hola)/)) {
      if (isHindi || t.includes('namaste')) return "Namaste! 🙏 Main aapki kya madad kar sakta hoon? (Jaise: 'Order kaise banaye?' puchiye)";
      return "Hello! 👋 I am ready to help. Try asking me: 'How do I process a return?'";
    }

    // Default Fallback
    if (isHindi) return "Mujhe theek se samajh nahi aaya. 🤔\nAap mujhse yeh pooch sakte hain:\n- Naya order kaise banaye?\n- Item return kaise karein?\n- Stock kahan dekhein?";
    return "I'm not exactly sure what you mean. 🤔\nTry asking:\n- How to create an order?\n- How to process a return?\n- How to check stock?";
  };

  const handleSendMessage = async (textToSend = inputText) => {
    if (!textToSend.trim()) return;

    const userMsg = {
      id: Date.now(),
      sender: "user",
      text: textToSend,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
    
    setMessages(prev => [...prev, userMsg]);
    setInputText("");
    setIsTyping(true);

    // Get smart response
    const botResponseText = await generateBotResponse(textToSend);

    setTimeout(() => {
      const botMsg = {
        id: Date.now() + 1,
        sender: "bot",
        text: botResponseText,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      setMessages(prev => [...prev, botMsg]);
      setIsTyping(false);
    }, 1200); // Slight delay to feel like "typing"
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <>
      {/* 1. Trigger Button */}
      {(!isOpen) && (
        <button
          onClick={() => { setIsOpen(true); setIsMinimized(false); }}
          className="fixed bottom-6 right-6 z-[90] flex items-center gap-2 px-5 py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-full shadow-xl hover:-translate-y-1 transition-all duration-300 font-bold text-sm border border-slate-700"
        >
          <LifeBuoy size={18} />
          Help & Support
        </button>
      )}

      {/* 2. The Gmail-Style Popup Window */}
      <div 
        className={`fixed right-4 sm:right-12 bottom-0 z-[100] w-[360px] sm:w-[400px] bg-white rounded-t-xl shadow-2xl border border-slate-300 flex flex-col transition-all duration-300 ease-in-out transform origin-bottom
        ${isOpen ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0 pointer-events-none'}
        ${isMinimized ? 'h-[48px]' : 'h-[500px] max-h-[80vh]'}`}
      >
        {/* Header */}
        <div 
          onClick={() => setIsMinimized(!isMinimized)}
          className="bg-slate-800 hover:bg-slate-700 transition-colors px-4 h-[48px] rounded-t-xl flex items-center justify-between cursor-pointer select-none border-b border-slate-700"
        >
          <div className="flex items-center gap-2.5">
            <Bot size={18} className="text-white" />
            <h2 className="text-sm font-bold text-white tracking-wide">Help & Support</h2>
          </div>
          <div className="flex items-center gap-1">
            <button 
              onClick={(e) => { e.stopPropagation(); setIsMinimized(!isMinimized); }}
              className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-600 rounded transition-colors"
            >
              {isMinimized ? <Maximize2 size={14} /> : <Minus size={16} />}
            </button>
            <button 
              onClick={(e) => { e.stopPropagation(); setIsOpen(false); setIsMinimized(false); }}
              className="p-1.5 text-slate-300 hover:text-white hover:bg-red-500 rounded transition-colors"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Chat Body & Footer */}
        {!isMinimized && (
          <div className="flex flex-col flex-1 overflow-hidden">
            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-4 bg-slate-50 space-y-4">
              {messages.map((msg) => (
                <div key={msg.id} className={`flex ${msg.sender === "user" ? "justify-end" : "justify-start"} items-end gap-2.5`}>
                  
                  {msg.sender === "bot" && (
                    <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center flex-shrink-0 mb-1 shadow-sm">
                      <Bot size={14} className="text-slate-600" />
                    </div>
                  )}

                  <div className={`max-w-[85%] flex flex-col ${msg.sender === "user" ? "items-end" : "items-start"}`}>
                    <div 
                      className={`px-3.5 py-2.5 text-sm shadow-sm whitespace-pre-wrap leading-relaxed ${
                        msg.sender === "user" 
                          ? "bg-slate-800 text-white rounded-2xl rounded-br-sm" 
                          : "bg-white border border-slate-200 text-slate-700 rounded-2xl rounded-bl-sm"
                      }`}
                    >
                      {msg.text}
                    </div>
                    <span className="text-[10px] text-slate-400 mt-1 px-1 font-medium">{msg.time}</span>
                  </div>

                </div>
              ))}

              {/* Typing Indicator */}
              {isTyping && (
                <div className="flex justify-start items-end gap-2.5">
                  <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center flex-shrink-0 mb-1 shadow-sm">
                    <Bot size={14} className="text-slate-600" />
                  </div>
                  <div className="bg-white border border-slate-200 px-4 py-3.5 rounded-2xl rounded-bl-sm shadow-sm flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce"></div>
                    <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                    <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} className="h-1" />
            </div>

            {/* Quick Actions */}
            {messages.length < 3 && !isTyping && (
              <div className="bg-slate-50 px-3 pb-3 flex overflow-x-auto gap-2 no-scrollbar border-b border-slate-100">
                {quickActions.map((action, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSendMessage(action)}
                    className="whitespace-nowrap px-3 py-1.5 bg-white border border-slate-200 text-slate-700 rounded-full text-[11px] font-bold shadow-sm hover:bg-slate-100 transition-colors flex items-center gap-1.5"
                  >
                    <Sparkles size={12} className="text-amber-500" /> {action}
                  </button>
                ))}
              </div>
            )}

            {/* Input Footer */}
            <div className="p-3 bg-white border-t border-slate-200">
              <div className="flex items-center gap-2 bg-slate-100 border border-slate-200 rounded-xl p-1.5 focus-within:border-slate-400 focus-within:bg-white transition-all">
                <input
                  type="text"
                  placeholder="Type in English or Hindi..."
                  className="flex-1 bg-transparent border-none outline-none px-2 py-1.5 text-sm text-slate-700 placeholder:text-slate-400"
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyDown={handleKeyDown}
                />
                <button
                  onClick={() => handleSendMessage()}
                  disabled={!inputText.trim() || isTyping}
                  className="p-2 bg-slate-800 text-white rounded-lg hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <Send size={16} className={inputText.trim() ? "translate-x-0.5 -translate-y-0.5" : ""} />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
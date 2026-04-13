import React, { useEffect, useRef, useState } from 'react';
import { X, Send, Bot, Sparkles, LifeBuoy, Minus, Maximize2 } from 'lucide-react';

const INITIAL_MESSAGE = {
  id: 1,
  sender: 'bot',
  text: "Hi there! I'm your Smart Assistant.\n\nI can help in Hindi and English.\nAsk me how to create orders, process returns, or track dispatches.",
  time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
};

const QUICK_ACTIONS = [
  'Order kaise banaye?',
  'How to process returns?',
  'Stock check karna hai'
];

const getCurrentTimeLabel = () =>
  new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

const getFallbackResponse = (text) => {
  const normalized = text.toLowerCase();
  const isHindi = /(kaise|kya|kahan|mujhe|wapas|naya|banao|hai|karo|batao|karna|check|kitna)/i.test(normalized);

  if (/(order|create|new|naya|banao|make|add)/.test(normalized)) {
    if (isHindi) {
      return "Naya order banane ke liye Order Processing tab kholiye, Create Order button dabaiye, model aur serial select karke submit kariye.";
    }
    return "To create a new order, open Order Processing, click Create Order, select the model and serial, then submit.";
  }

  if (/(return|wapas|lautana|damaged|rto)/.test(normalized)) {
    if (isHindi) {
      return "Return ke liye Returns module me jaiye, serial number enter kijiye, condition select kijiye aur reason ke saath save kijiye.";
    }
    return "For returns, open the Returns module, enter the serial number, choose the condition, add the reason, and save it.";
  }

  if (/(dispatch|track|courier|bhejna|status)/.test(normalized)) {
    if (isHindi) {
      return "Dispatch update ke liye order open karke status aur tracking ID update kijiye. Zarurat ho to document bhi upload kar sakte hain.";
    }
    return "To update dispatch and tracking, open the order, change the status, and save the tracking ID. You can also upload documents if needed.";
  }

  if (/(stock|inventory|available|bacha)/.test(normalized)) {
    if (isHindi) {
      return 'Stock dekhne ke liye Dashboard ya Serials tab use kijiye. Wahan available aur dispatched count turant dikhega.';
    }
    return 'Use the Dashboard or Serials tab to check stock. You can quickly see available and dispatched counts there.';
  }

  if (/(hi|hello|hey|namaste)/.test(normalized)) {
    return isHindi
      ? 'Namaste! Aap order, returns, dispatch, ya stock ke baare me pooch sakte hain.'
      : 'Hello! You can ask me about orders, returns, dispatch, or stock.';
  }

  return isHindi
    ? 'Main abhi basic help mode me hoon. Aap order, return, dispatch, ya stock se related sawaal pooch sakte hain.'
    : 'I am currently in basic help mode. You can ask about orders, returns, dispatch, or stock.';
};

export default function HelpChatWindow() {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [messages, setMessages] = useState([INITIAL_MESSAGE]);
  const messagesEndRef = useRef(null);
  const nextMessageIdRef = useRef(2);

  const getNextMessageId = () => {
    const currentId = nextMessageIdRef.current;
    nextMessageIdRef.current += 1;
    return currentId;
  };

  useEffect(() => {
    if (isOpen && !isMinimized) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [isMinimized, isOpen, isTyping, messages]);

  const handleSendMessage = async (textToSend = inputText) => {
    const safeText = textToSend.trim();
    if (!safeText) return;

    const userMessage = {
      id: getNextMessageId(),
      sender: 'user',
      text: safeText,
      time: getCurrentTimeLabel()
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputText('');
    setIsTyping(true);

    const responseText = getFallbackResponse(safeText);

    setTimeout(() => {
      const botMessage = {
        id: getNextMessageId(),
        sender: 'bot',
        text: responseText,
        time: getCurrentTimeLabel()
      };

      setMessages((prev) => [...prev, botMessage]);
      setIsTyping(false);
    }, 800);
  };

  const handleKeyDown = (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <>
      {!isOpen && (
        <button
          onClick={() => { setIsOpen(true); setIsMinimized(false); }}
          className="fixed bottom-6 right-6 z-[90] flex items-center gap-2 px-5 py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-full shadow-xl hover:-translate-y-1 transition-all duration-300 font-bold text-sm border border-slate-700"
        >
          <LifeBuoy size={18} />
          Help & Support
        </button>
      )}

      <div
        className={`fixed right-4 sm:right-12 bottom-0 z-[100] w-[360px] sm:w-[400px] bg-white rounded-t-xl shadow-2xl border border-slate-300 flex flex-col transition-all duration-300 ease-in-out transform origin-bottom ${
          isOpen ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0 pointer-events-none'
        } ${isMinimized ? 'h-[48px]' : 'h-[500px] max-h-[80vh]'}`}
      >
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
              onClick={(event) => { event.stopPropagation(); setIsMinimized(!isMinimized); }}
              className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-600 rounded transition-colors"
            >
              {isMinimized ? <Maximize2 size={14} /> : <Minus size={16} />}
            </button>
            <button
              onClick={(event) => { event.stopPropagation(); setIsOpen(false); setIsMinimized(false); }}
              className="p-1.5 text-slate-300 hover:text-white hover:bg-red-500 rounded transition-colors"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {!isMinimized && (
          <div className="flex flex-col flex-1 overflow-hidden">
            <div className="flex-1 overflow-y-auto p-4 bg-slate-50 space-y-4">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'} items-end gap-2.5`}
                >
                  {message.sender === 'bot' && (
                    <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center flex-shrink-0 mb-1 shadow-sm">
                      <Bot size={14} className="text-slate-600" />
                    </div>
                  )}

                  <div className={`max-w-[85%] flex flex-col ${message.sender === 'user' ? 'items-end' : 'items-start'}`}>
                    <div
                      className={`px-3.5 py-2.5 text-sm shadow-sm whitespace-pre-wrap leading-relaxed ${
                        message.sender === 'user'
                          ? 'bg-slate-800 text-white rounded-2xl rounded-br-sm'
                          : 'bg-white border border-slate-200 text-slate-700 rounded-2xl rounded-bl-sm'
                      }`}
                    >
                      {message.text}
                    </div>
                    <span className="text-[10px] text-slate-400 mt-1 px-1 font-medium">{message.time}</span>
                  </div>
                </div>
              ))}

              {isTyping && (
                <div className="flex justify-start items-end gap-2.5">
                  <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center flex-shrink-0 mb-1 shadow-sm">
                    <Bot size={14} className="text-slate-600" />
                  </div>
                  <div className="bg-white border border-slate-200 px-4 py-3.5 rounded-2xl rounded-bl-sm shadow-sm flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" />
                    <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
                    <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }} />
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} className="h-1" />
            </div>

            {messages.length < 3 && !isTyping && (
              <div className="bg-slate-50 px-3 pb-3 flex overflow-x-auto gap-2 no-scrollbar border-b border-slate-100">
                {QUICK_ACTIONS.map((action) => (
                  <button
                    key={action}
                    onClick={() => handleSendMessage(action)}
                    className="whitespace-nowrap px-3 py-1.5 bg-white border border-slate-200 text-slate-700 rounded-full text-[11px] font-bold shadow-sm hover:bg-slate-100 transition-colors flex items-center gap-1.5"
                  >
                    <Sparkles size={12} className="text-amber-500" /> {action}
                  </button>
                ))}
              </div>
            )}

            <div className="p-3 bg-white border-t border-slate-200">
              <div className="flex items-center gap-2 bg-slate-100 border border-slate-200 rounded-xl p-1.5 focus-within:border-slate-400 focus-within:bg-white transition-all">
                <input
                  type="text"
                  placeholder="Type in English or Hindi..."
                  className="flex-1 bg-transparent border-none outline-none px-2 py-1.5 text-sm text-slate-700 placeholder:text-slate-400"
                  value={inputText}
                  onChange={(event) => setInputText(event.target.value)}
                  onKeyDown={handleKeyDown}
                />
                <button
                  onClick={() => handleSendMessage()}
                  disabled={!inputText.trim() || isTyping}
                  className="p-2 bg-slate-800 text-white rounded-lg hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <Send size={16} className={inputText.trim() ? 'translate-x-0.5 -translate-y-0.5' : ''} />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

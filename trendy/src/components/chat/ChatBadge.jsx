import React, { useState, useEffect, useRef } from 'react';
import { MessageCircle, X, Send, User, ChevronLeft } from 'lucide-react';
import './ChatBadge.css';

const INITIAL_CHATS = [
  {
    id: 1,
    customerName: 'أحمد علي',
    avatar: '',
    product: 'قميص كلاسيكي أزرق',
    messages: [
      { id: 1, text: 'السلام عليكم، هل يتوفر القميص بمقاس XL؟', sender: 'customer', time: '10:30 ص' },
      { id: 2, text: 'وعليكم السلام، نعم متوفر بجميع المقاسات', sender: 'store', time: '10:35 ص' },
    ],
    unread: 0,
    lastTime: '10:35 ص',
  },
  {
    id: 2,
    customerName: 'فاطمة محمد',
    avatar: '',
    product: 'فستان صيفي وردي',
    messages: [
      { id: 1, text: 'مرحبا، ما هو خامة هذا الفستان؟', sender: 'customer', time: '09:15 ص' },
    ],
    unread: 1,
    lastTime: '09:15 ص',
  },
  {
    id: 3,
    customerName: 'خالد محمود',
    avatar: '',
    product: 'بنطلون جينز أسود',
    messages: [
      { id: 1, text: 'هل يوجد خصم على هذا المنتج؟', sender: 'customer', time: 'أمس' },
      { id: 2, text: 'نعم، هناك خصم 15% هذا الأسبوع', sender: 'store', time: 'أمس' },
      { id: 3, text: 'ممتاز، سأطلب واحداً', sender: 'customer', time: 'أمس' },
    ],
    unread: 0,
    lastTime: 'أمس',
  },
];

const STORAGE_KEY = 'trendy_store_chats';

const getInitialChats = () => {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) return JSON.parse(stored);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(INITIAL_CHATS));
  return INITIAL_CHATS;
};

const ChatBadge = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [chats, setChats] = useState(getInitialChats);
  const [activeChat, setActiveChat] = useState(null);
  const [replyText, setReplyText] = useState('');
  const dropdownRef = useRef(null);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(chats));
  }, [chats]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
        setActiveChat(null);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const totalUnread = chats.reduce((sum, c) => sum + c.unread, 0);

  const handleOpenChat = (chat) => {
    setActiveChat(chat);
    setChats(prev => prev.map(c => c.id === chat.id ? { ...c, unread: 0 } : c));
  };

  const handleSendReply = () => {
    if (!replyText.trim() || !activeChat) return;
    const now = new Date();
    const timeStr = `${now.getHours()}:${now.getMinutes().toString().padStart(2, '0')}`;
    const newMessage = {
      id: Date.now(),
      text: replyText.trim(),
      sender: 'store',
      time: timeStr,
    };
    setChats(prev => prev.map(c => {
      if (c.id !== activeChat.id) return c;
      return { ...c, messages: [...c.messages, newMessage], lastTime: timeStr };
    }));
    setActiveChat(prev => ({ ...prev, messages: [...prev.messages, newMessage], lastTime: timeStr }));
    setReplyText('');
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') handleSendReply();
  };

  return (
    <div className="chat-badge-container" ref={dropdownRef}>
      <button
        className={`chat-badge-btn ${isOpen ? 'open' : ''}`}
        onClick={() => setIsOpen(!isOpen)}
        title="شات المتجر"
      >
        <MessageCircle size={20} strokeWidth={2.5} />
        <span className="chat-badge-label">شات الزبائن</span>
        {totalUnread > 0 && <span className="chat-badge-count">{totalUnread}</span>}
      </button>

      {isOpen && (
        <div className="chat-dropdown">
          <div className="chat-dropdown-header">
            <div className="chat-dropdown-title">
              <MessageCircle size={20} />
              <h3>رسائل الزبائن</h3>
              {totalUnread > 0 && <span className="chat-header-badge">{totalUnread} جديد</span>}
            </div>
            <button className="chat-close-btn" onClick={() => { setIsOpen(false); setActiveChat(null); }}>
              <X size={18} />
            </button>
          </div>

          {!activeChat ? (
            <div className="chat-list">
              {chats.length === 0 ? (
                <div className="chat-empty">
                  <MessageCircle size={40} className="chat-empty-icon" />
                  <p>لا توجد رسائل بعد</p>
                </div>
              ) : (
                chats.map(chat => (
                  <div
                    key={chat.id}
                    className={`chat-list-item ${chat.unread > 0 ? 'unread' : ''}`}
                    onClick={() => handleOpenChat(chat)}
                  >
                    <div className="chat-item-avatar">
                      <User size={20} strokeWidth={2} />
                      {chat.unread > 0 && <span className="chat-avatar-dot" />}
                    </div>
                    <div className="chat-item-info">
                      <div className="chat-item-top">
                        <span className="chat-item-name">{chat.customerName}</span>
                        <span className="chat-item-time">{chat.lastTime}</span>
                      </div>
                      <span className="chat-item-product">{chat.product}</span>
                      <p className="chat-item-preview">
                        {chat.messages[chat.messages.length - 1]?.text}
                      </p>
                    </div>
                    <ChevronLeft size={18} className="chat-chevron" />
                  </div>
                ))
              )}
            </div>
          ) : (
            <div className="chat-window">
              <div className="chat-window-header">
                <button className="chat-back-btn" onClick={() => setActiveChat(null)}>
                  <ChevronLeft size={20} />
                </button>
                <div className="chat-window-avatar">
                  <User size={18} />
                </div>
                <div className="chat-window-info">
                  <span className="chat-window-name">{activeChat.customerName}</span>
                  <span className="chat-window-product">{activeChat.product}</span>
                </div>
              </div>
              <div className="chat-messages">
                {activeChat.messages.map(msg => (
                  <div key={msg.id} className={`chat-message ${msg.sender}`}>
                    <div className="chat-bubble">{msg.text}</div>
                    <span className="chat-message-time">{msg.time}</span>
                  </div>
                ))}
              </div>
              <div className="chat-input-row">
                <input
                  type="text"
                  className="chat-input"
                  placeholder="اكتب ردك هنا..."
                  value={replyText}
                  onChange={e => setReplyText(e.target.value)}
                  onKeyDown={handleKeyDown}
                />
                <button className="chat-send-btn" onClick={handleSendReply}>
                  <Send size={16} />
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ChatBadge;

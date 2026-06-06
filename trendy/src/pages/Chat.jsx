import React, { useState, useEffect, useRef } from 'react';
import { Send, User, Search, Trash2, MessageSquare } from 'lucide-react';
import './Chat.css';

const STORAGE_KEY = 'trendy_store_chats';

const INITIAL_CHATS = [
  {
    id: 1,
    customerName: 'أحمد علي',
    phone: '0912345678',
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
    phone: '0923456789',
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
    phone: '0934567890',
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
  {
    id: 4,
    customerName: 'سارة أحمد',
    phone: '0945678901',
    avatar: '',
    product: 'شورت رياضي رمادي',
    messages: [
      { id: 1, text: 'كم مدة التوصيل إلى بنغازي؟', sender: 'customer', time: 'أمس' },
    ],
    unread: 1,
    lastTime: 'أمس',
  },
  {
    id: 5,
    customerName: 'عمر إبراهيم',
    phone: '0956789012',
    avatar: '',
    product: 'قميص رسمي أبيض',
    messages: [
      { id: 1, text: 'السلام عليكم، هل هذا القميص مناسب للمناسبات الرسمية؟', sender: 'customer', time: '23 مايو' },
      { id: 2, text: 'نعم تماماً، هو مصمم خصيصاً للمناسبات الرسمية', sender: 'store', time: '23 مايو' },
    ],
    unread: 0,
    lastTime: '23 مايو',
  },
];

const getInitialChats = () => {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) return JSON.parse(stored);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(INITIAL_CHATS));
  return INITIAL_CHATS;
};

const Chat = () => {
  const [chats, setChats] = useState(getInitialChats);
  const [activeChat, setActiveChat] = useState(null);
  const [replyText, setReplyText] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const messagesEndRef = useRef(null);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(chats));
  }, [chats]);

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [activeChat?.messages]);

  const filteredChats = chats.filter(chat =>
    chat.customerName.includes(searchQuery) ||
    chat.product.includes(searchQuery)
  );

  const handleSelectChat = (chat) => {
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
    const updatedChat = {
      ...activeChat,
      messages: [...activeChat.messages, newMessage],
      lastTime: timeStr,
    };
    setChats(prev => prev.map(c => c.id === activeChat.id ? updatedChat : c));
    setActiveChat(updatedChat);
    setReplyText('');
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') handleSendReply();
  };

  const handleDeleteChat = (id) => {
    setChats(prev => prev.filter(c => c.id !== id));
    if (activeChat?.id === id) setActiveChat(null);
  };

  const totalUnread = chats.reduce((sum, c) => sum + c.unread, 0);

  return (
    <div className="chat-page">
      <header className="page-header">
        <div className="header-title-wrapper">
          <h1 className="page-title">شات المتجر</h1>
          <p className="page-subtitle">تواصل مع زبائنك ورد على استفساراتهم</p>
        </div>
      </header>

      <div className="chat-layout">
        {/* Sidebar Chat List */}
        <div className="chat-sidebar">
          <div className="chat-search-box">
            <Search size={18} className="chat-search-icon" />
            <input
              type="text"
              className="chat-search-input"
              placeholder="ابحث عن زبون أو منتج..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>

          <div className="chat-list-full">
            {filteredChats.length === 0 ? (
              <div className="chat-empty-state">
                <MessageSquare size={48} className="chat-empty-icon" />
                <p>لا توجد محادثات</p>
              </div>
            ) : (
              filteredChats.map(chat => (
                <div
                  key={chat.id}
                  className={`chat-list-row ${activeChat?.id === chat.id ? 'active' : ''} ${chat.unread > 0 ? 'unread' : ''}`}
                  onClick={() => handleSelectChat(chat)}
                >
                  <div className="chat-row-avatar">
                    <User size={20} />
                  </div>
                  <div className="chat-row-body">
                    <div className="chat-row-top">
                      <span className="chat-row-name">{chat.customerName}</span>
                      <span className="chat-row-time">{chat.lastTime}</span>
                    </div>
                    <p className="chat-row-product">{chat.product}</p>
                    <p className="chat-row-preview">
                      {chat.messages[chat.messages.length - 1]?.text}
                    </p>
                  </div>
                  <div className="chat-row-actions">
                    {chat.unread > 0 && <span className="chat-row-badge">{chat.unread}</span>}
                    <button
                      className="chat-delete-btn"
                      onClick={(e) => { e.stopPropagation(); handleDeleteChat(chat.id); }}
                      title="حذف المحادثة"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Chat Window */}
        <div className="chat-main">
          {!activeChat ? (
            <div className="chat-empty-main">
              <MessageSquare size={64} className="chat-empty-main-icon" />
              <h3>اختر محادثة للبدء</h3>
              <p>اختر زبوناً من القائمة لعرض الرسائل والرد عليها</p>
              {totalUnread > 0 && (
                <div className="chat-unread-banner">
                  لديك {totalUnread} رسائل غير مقروءة
                </div>
              )}
            </div>
          ) : (
            <>
              <div className="chat-main-header">
                <div className="chat-main-user">
                  <div className="chat-main-avatar">
                    <User size={22} />
                  </div>
                  <div className="chat-main-info">
                    <span className="chat-main-name">{activeChat.customerName}</span>
                    <span className="chat-main-phone">{activeChat.phone}</span>
                  </div>
                </div>
                <div className="chat-main-product">
                  <span className="product-label">الاستفسار عن:</span>
                  <span className="product-name">{activeChat.product}</span>
                </div>
              </div>

              <div className="chat-main-messages">
                {activeChat.messages.map(msg => (
                  <div key={msg.id} className={`chat-main-message ${msg.sender}`}>
                    <div className="chat-main-bubble">{msg.text}</div>
                    <span className="chat-main-time">{msg.time}</span>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>

              <div className="chat-main-input-area">
                <input
                  type="text"
                  className="chat-main-input"
                  placeholder="اكتب رسالتك هنا..."
                  value={replyText}
                  onChange={e => setReplyText(e.target.value)}
                  onKeyDown={handleKeyDown}
                />
                <button className="chat-main-send" onClick={handleSendReply}>
                  <Send size={18} />
                  <span>إرسال</span>
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default Chat;

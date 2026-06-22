import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Send, User, Search, MessageSquare } from 'lucide-react';
import { fetchChats, fetchChatMessages, sendChatMessage } from '../api/chat';
import { getApiErrorMessage } from '../api/stores';
import { useAuth } from '../context/AuthContext';
import './Chat.css';

const Chat = () => {
  const { storeId } = useAuth();
  const [chats, setChats] = useState([]);
  const [activeChat, setActiveChat] = useState(null);
  const [replyText, setReplyText] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const messagesEndRef = useRef(null);

  const loadChats = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const list = await fetchChats({ storeId });
      setChats(list);
    } catch (err) {
      setError(getApiErrorMessage(err, 'تعذّر تحميل المحادثات'));
      setChats([]);
    } finally {
      setLoading(false);
    }
  }, [storeId]);

  useEffect(() => {
    loadChats();
  }, [loadChats]);

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [activeChat?.messages]);

  const filteredChats = chats.filter(
    (chat) =>
      chat.customerName.includes(searchQuery) ||
      chat.product.includes(searchQuery) ||
      chat.phone.includes(searchQuery),
  );

  const handleSelectChat = async (chat) => {
    setActiveChat({ ...chat, messages: [] });
    setLoadingMessages(true);
    try {
      const messages = await fetchChatMessages(chat.id);
      setActiveChat({ ...chat, messages, unread: 0 });
      setChats((prev) => prev.map((c) => (c.id === chat.id ? { ...c, unread: 0 } : c)));
    } catch (err) {
      setError(getApiErrorMessage(err, 'تعذّر تحميل الرسائل'));
      setActiveChat(null);
    } finally {
      setLoadingMessages(false);
    }
  };

  const handleSendReply = async () => {
    if (!replyText.trim() || !activeChat || sending) return;

    setSending(true);
    try {
      const newMessage = await sendChatMessage(activeChat.id, replyText.trim());
      const updatedChat = {
        ...activeChat,
        messages: [...activeChat.messages, newMessage],
        lastTime: newMessage.time,
        lastPreview: newMessage.text,
      };
      setActiveChat(updatedChat);
      setChats((prev) =>
        prev.map((c) =>
          c.id === activeChat.id
            ? { ...c, lastTime: newMessage.time, lastPreview: newMessage.text }
            : c,
        ),
      );
      setReplyText('');
    } catch (err) {
      setError(getApiErrorMessage(err, 'تعذّر إرسال الرسالة'));
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') handleSendReply();
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

      {error && <div className="chat-error">{error}</div>}

      <div className="chat-layout">
        <div className="chat-sidebar">
          <div className="chat-search-box">
            <Search size={18} className="chat-search-icon" />
            <input
              type="text"
              className="chat-search-input"
              placeholder="ابحث عن زبون أو منتج..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div className="chat-list-full">
            {loading ? (
              <div className="chat-empty-state">
                <p>جاري تحميل المحادثات...</p>
              </div>
            ) : filteredChats.length === 0 ? (
              <div className="chat-empty-state">
                <MessageSquare size={48} className="chat-empty-icon" />
                <p>لا توجد محادثات</p>
              </div>
            ) : (
              filteredChats.map((chat) => (
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
                    <p className="chat-row-preview">{chat.lastPreview}</p>
                  </div>
                  <div className="chat-row-actions">
                    {chat.unread > 0 && <span className="chat-row-badge">{chat.unread}</span>}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="chat-main">
          {!activeChat ? (
            <div className="chat-empty-main">
              <MessageSquare size={64} className="chat-empty-main-icon" />
              <h3>اختر محادثة للبدء</h3>
              <p>اختر زبوناً من القائمة لعرض الرسائل والرد عليها</p>
              {totalUnread > 0 && (
                <div className="chat-unread-banner">لديك {totalUnread} رسائل غير مقروءة</div>
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
                {loadingMessages ? (
                  <div className="chat-messages-loading">جاري تحميل الرسائل...</div>
                ) : (
                  activeChat.messages.map((msg) => (
                    <div key={msg.id} className={`chat-main-message ${msg.sender}`}>
                      <div className="chat-main-bubble">{msg.text}</div>
                      <span className="chat-main-time">{msg.time}</span>
                    </div>
                  ))
                )}
                <div ref={messagesEndRef} />
              </div>

              <div className="chat-main-input-area">
                <input
                  type="text"
                  className="chat-main-input"
                  placeholder="اكتب رسالتك هنا..."
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  onKeyDown={handleKeyDown}
                  disabled={sending || loadingMessages}
                />
                <button
                  className="chat-main-send"
                  onClick={handleSendReply}
                  disabled={sending || loadingMessages || !replyText.trim()}
                >
                  <Send size={18} />
                  <span>{sending ? 'جاري الإرسال...' : 'إرسال'}</span>
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

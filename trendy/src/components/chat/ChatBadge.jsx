import React, { useState, useEffect, useRef, useCallback } from 'react';
import { MessageCircle, X, Send, User, ChevronLeft } from 'lucide-react';
import { fetchChats, fetchChatMessages, sendChatMessage } from '../../api/chat';
import { getApiErrorMessage } from '../../api/stores';
import { useStore } from '../../context/AuthContext';
import './ChatBadge.css';

const ChatBadge = () => {
  const { storeId } = useStore();
  const [isOpen, setIsOpen] = useState(false);
  const [chats, setChats] = useState([]);
  const [activeChat, setActiveChat] = useState(null);
  const [replyText, setReplyText] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const dropdownRef = useRef(null);

  const loadChats = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const list = await fetchChats({ storeId });
      setChats(list);
    } catch {
      setChats([]);
      setError('');
    } finally {
      setLoading(false);
    }
  }, [storeId]);

  useEffect(() => {
    loadChats();
  }, [loadChats]);

  useEffect(() => {
    if (isOpen) {
      loadChats();
    }
  }, [isOpen, loadChats]);

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

  const handleOpenChat = async (chat) => {
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
      const updated = {
        ...activeChat,
        messages: [...activeChat.messages, newMessage],
        lastTime: newMessage.time,
        lastPreview: newMessage.text,
      };
      setActiveChat(updated);
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

  return (
    <div className="chat-badge-container" ref={dropdownRef}>
      <button
        className={`chat-badge-btn ${isOpen ? 'open' : ''}`}
        onClick={() => setIsOpen(!isOpen)}
        title="شات المتجر"
        type="button"
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
            <button
              className="chat-close-btn"
              onClick={() => {
                setIsOpen(false);
                setActiveChat(null);
              }}
              type="button"
            >
              <X size={18} />
            </button>
          </div>

          {error && <div className="chat-dropdown-error">{error}</div>}

          {!activeChat ? (
            <div className="chat-list">
              {loading ? (
                <div className="chat-empty">
                  <p>جاري التحميل...</p>
                </div>
              ) : chats.length === 0 ? (
                <div className="chat-empty">
                  <MessageCircle size={40} className="chat-empty-icon" />
                  <p>لا توجد رسائل بعد</p>
                </div>
              ) : (
                chats.map((chat) => (
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
                      <p className="chat-item-preview">{chat.lastPreview}</p>
                    </div>
                    <ChevronLeft size={18} className="chat-chevron" />
                  </div>
                ))
              )}
            </div>
          ) : (
            <div className="chat-window">
              <div className="chat-window-header">
                <button className="chat-back-btn" onClick={() => setActiveChat(null)} type="button">
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
                {loadingMessages ? (
                  <div className="chat-messages-loading">جاري تحميل الرسائل...</div>
                ) : (
                  activeChat.messages.map((msg) => (
                    <div key={msg.id} className={`chat-message ${msg.sender}`}>
                      <div className="chat-bubble">{msg.text}</div>
                      <span className="chat-message-time">{msg.time}</span>
                    </div>
                  ))
                )}
              </div>
              <div className="chat-input-row">
                <input
                  type="text"
                  className="chat-input"
                  placeholder="اكتب ردك هنا..."
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  onKeyDown={handleKeyDown}
                  disabled={sending || loadingMessages}
                />
                <button
                  className="chat-send-btn"
                  onClick={handleSendReply}
                  disabled={sending || loadingMessages || !replyText.trim()}
                  type="button"
                >
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

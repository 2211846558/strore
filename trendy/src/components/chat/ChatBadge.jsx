import React, { useState, useEffect, useRef, useMemo } from 'react';
import { MessageCircle, X, Send, User, ChevronLeft } from 'lucide-react';
import {
  useChats,
  useChatMessages,
  useSendMessage,
  LIVE_CHATS_INTERVAL,
  CHATS_BACKGROUND_INTERVAL,
} from '../../api/hooks/useChat';
import { getApiErrorMessage } from '../../api/stores';
import { useStore } from '../../context/AuthContext';
import './ChatBadge.css';

const ChatBadge = () => {
  const { storeId } = useStore();
  const [isOpen, setIsOpen] = useState(false);
  const [activeChat, setActiveChat] = useState(null);
  const [replyText, setReplyText] = useState('');
  const [error, setError] = useState('');
  const dropdownRef = useRef(null);
  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const messagesCountRef = useRef(0);

  const {
    data: chatsData = [],
    isLoading: loading,
    error: chatsError,
  } = useChats(
    { storeId },
    { refetchInterval: isOpen ? LIVE_CHATS_INTERVAL : CHATS_BACKGROUND_INTERVAL },
  );

  const chats = useMemo(
    () =>
      chatsData.map((chat) =>
        chat.id === activeChat?.id ? { ...chat, unread: 0 } : chat,
      ),
    [chatsData, activeChat?.id],
  );

  const {
    data: messages = [],
    isLoading: messagesLoading,
    error: messagesError,
  } = useChatMessages(activeChat?.id, { enabled: Boolean(activeChat?.id) });

  const sendMutation = useSendMessage();

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

  useEffect(() => {
    if (!activeChat) {
      messagesCountRef.current = 0;
      return;
    }

    const prevCount = messagesCountRef.current;
    const newCount = messages.length;
    messagesCountRef.current = newCount;

    if (newCount > prevCount && messagesEndRef.current) {
      const lastMsg = messages[newCount - 1];
      const sentByMe = lastMsg?.sender === 'store';
      let isNearBottom = true;
      if (messagesContainerRef.current) {
        const { scrollTop, scrollHeight, clientHeight } = messagesContainerRef.current;
        isNearBottom = scrollHeight - scrollTop - clientHeight < 120;
      }
      if (sentByMe || isNearBottom) {
        messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
      }
    }
  }, [messages, activeChat?.id]);

  const totalUnread = chats.reduce((sum, c) => sum + c.unread, 0);
  const displayError =
    error ||
    (chatsError ? getApiErrorMessage(chatsError, 'تعذّر تحميل المحادثات') : '') ||
    (messagesError ? getApiErrorMessage(messagesError, 'تعذّر تحميل الرسائل') : '');

  const handleOpenChat = (chat) => {
    setActiveChat(chat);
    setError('');
  };

  const handleSendReply = async () => {
    if (!replyText.trim() || !activeChat || sendMutation.isPending) return;

    try {
      await sendMutation.mutateAsync({ orderId: activeChat.id, message: replyText.trim() });
      setReplyText('');
    } catch (err) {
      setError(getApiErrorMessage(err, 'تعذّر إرسال الرسالة'));
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

          {displayError && <div className="chat-dropdown-error">{displayError}</div>}

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
              <div className="chat-messages" ref={messagesContainerRef}>
                {messagesLoading && messages.length === 0 ? (
                  <div className="chat-messages-loading">جاري تحميل الرسائل...</div>
                ) : (
                  messages.map((msg) => (
                    <div key={msg.id} className={`chat-message ${msg.sender}`}>
                      <div className="chat-bubble">{msg.text}</div>
                      <span className="chat-message-time">{msg.time}</span>
                    </div>
                  ))
                )}
                <div ref={messagesEndRef} />
              </div>
              <div className="chat-input-row">
                <input
                  type="text"
                  className="chat-input"
                  placeholder="اكتب ردك هنا..."
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  onKeyDown={handleKeyDown}
                  disabled={sendMutation.isPending}
                />
                <button
                  className="chat-send-btn"
                  onClick={handleSendReply}
                  disabled={sendMutation.isPending || !replyText.trim()}
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

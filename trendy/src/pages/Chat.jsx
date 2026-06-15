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
  const messagesContainerRef = useRef(null);
  const messagesCountRef = useRef(0);
  const activeChatIdRef = useRef(null);

  const loadChats = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    setError('');
    try {
      const list = await fetchChats({ storeId });
      setChats(list);
    } catch {
      setChats([]);
    } finally {
      if (!quiet) setLoading(false);
    }
  }, [storeId]);

  const loadActiveMessages = useCallback(async (chatId, quiet = false) => {
    if (!quiet) setLoadingMessages(true);
    try {
      const messages = await fetchChatMessages(chatId);
      setActiveChat((prev) => {
        if (!prev || prev.id !== chatId) return prev;
        return { ...prev, messages };
      });
    } catch (err) {
      if (!quiet) {
        setError(getApiErrorMessage(err, 'تعذّر تحميل الرسائل'));
        setActiveChat(null);
      }
    } finally {
      if (!quiet) setLoadingMessages(false);
    }
  }, []);

  useEffect(() => {
    loadChats();
  }, [loadChats]);

  useEffect(() => {
    const interval = setInterval(() => {
      loadChats(true);
      if (activeChat?.id) {
        loadActiveMessages(activeChat.id, true);
      }
    }, 30000);

    return () => clearInterval(interval);
  }, [loadChats, loadActiveMessages, activeChat?.id]);

  useEffect(() => {
    if (!activeChat) {
      messagesCountRef.current = 0;
      activeChatIdRef.current = null;
      return;
    }

    const prevCount = messagesCountRef.current;
    const prevChatId = activeChatIdRef.current;
    const newCount = activeChat.messages?.length ?? 0;

    messagesCountRef.current = newCount;
    activeChatIdRef.current = activeChat.id;

    if (newCount > 0) {
      const isNewChat = prevChatId !== activeChat.id;
      const hasNewMessages = newCount > prevCount;
      const lastMsg = activeChat.messages[newCount - 1];
      const sentByMe = lastMsg?.sender === 'store' || lastMsg?.sender === 'employee' || lastMsg?.sender === 'admin';

      let isNearBottom = true;
      if (messagesContainerRef.current) {
        const { scrollTop, scrollHeight, clientHeight } = messagesContainerRef.current;
        isNearBottom = scrollHeight - scrollTop - clientHeight < 200;
      }

      if (isNewChat || (hasNewMessages && (sentByMe || isNearBottom))) {
        if (messagesEndRef.current) {
          messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
      }
    }
  }, [activeChat?.messages, activeChat?.id]);

  const filteredChats = chats.filter(
    (chat) =>
      chat.customerName.includes(searchQuery) ||
      chat.product.includes(searchQuery) ||
      chat.phone.includes(searchQuery),
  );

  const handleSelectChat = async (chat) => {
    setActiveChat({ ...chat, messages: [] });
    await loadActiveMessages(chat.id, false);
    setChats((prev) => prev.map((c) => (c.id === chat.id ? { ...c, unread: 0 } : c)));
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

              <div className="chat-main-messages" ref={messagesContainerRef}>
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

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Send, User, Search, MessageSquare } from 'lucide-react';
import {
  useChats,
  useChatMessages,
  useSendMessage,
  LIVE_CHATS_INTERVAL,
} from '../api/hooks/useChat';
import { getApiErrorMessage } from '../api/stores';
import { useStore } from '../context/AuthContext';
import './Chat.css';

const Chat = () => {
  const { storeId } = useStore();
  const [activeChat, setActiveChat] = useState(null);
  const [replyText, setReplyText] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [error, setError] = useState('');
  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const messagesCountRef = useRef(0);
  const activeChatIdRef = useRef(null);

  const {
    data: chatsData = [],
    isLoading: loading,
    error: chatsError,
  } = useChats(
    { storeId },
    { refetchInterval: LIVE_CHATS_INTERVAL },
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
  } = useChatMessages(activeChat?.id);

  const sendMutation = useSendMessage();

  useEffect(() => {
    if (!activeChat) {
      messagesCountRef.current = 0;
      activeChatIdRef.current = null;
      return;
    }

    const prevCount = messagesCountRef.current;
    const prevChatId = activeChatIdRef.current;
    const newCount = messages.length;

    messagesCountRef.current = newCount;
    activeChatIdRef.current = activeChat.id;

    if (newCount > 0) {
      const isNewChat = prevChatId !== activeChat.id;
      const hasNewMessages = newCount > prevCount;
      const lastMsg = messages[newCount - 1];
      const sentByMe =
        lastMsg?.sender === 'store' ||
        lastMsg?.sender === 'employee' ||
        lastMsg?.sender === 'admin';

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
  }, [messages, activeChat?.id]);

  const filteredChats = chats.filter(
    (chat) =>
      chat.customerName.includes(searchQuery) ||
      chat.product.includes(searchQuery) ||
      chat.phone.includes(searchQuery),
  );

  const handleSelectChat = (chat) => {
    setActiveChat(chat);
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

  const totalUnread = chats.reduce((sum, c) => sum + c.unread, 0);
  const displayError =
    error ||
    (chatsError ? getApiErrorMessage(chatsError, 'تعذّر تحميل المحادثات') : '') ||
    (messagesError ? getApiErrorMessage(messagesError, 'تعذّر تحميل الرسائل') : '');

  return (
    <div className="chat-page">
      <header className="page-header">
        <div className="header-title-wrapper">
          <h1 className="page-title">شات المتجر</h1>
          <p className="page-subtitle">تواصل مع زبائنك ورد على استفساراتهم — مباشر</p>
        </div>
      </header>

      {displayError && <div className="chat-error">{displayError}</div>}

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
                {messagesLoading && messages.length === 0 ? (
                  <div className="chat-messages-loading">جاري تحميل الرسائل...</div>
                ) : (
                  messages.map((msg) => (
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
                  disabled={sendMutation.isPending}
                />
                <button
                  className="chat-main-send"
                  onClick={handleSendReply}
                  disabled={sendMutation.isPending || !replyText.trim()}
                >
                  <Send size={18} />
                  <span>{sendMutation.isPending ? 'جاري الإرسال...' : 'إرسال'}</span>
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

import React, { useState, useEffect, useRef } from 'react';
import { Headphones, X, Phone, MessageCircle } from 'lucide-react';
import './SupportBadge.css';

const SUPPORT_NUMBER = '0912345678';

const SupportBadge = () => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const whatsappLink = `https://wa.me/${SUPPORT_NUMBER.replace(/^0/, '218')}`;

  return (
    <div className="support-badge-container" ref={dropdownRef}>
      <button
        className={`support-badge-btn ${isOpen ? 'open' : ''}`}
        onClick={() => setIsOpen(!isOpen)}
        title="الدعم والمساعدة"
      >
        <Headphones size={20} strokeWidth={2.5} />
        <span className="support-badge-label">الدعم</span>
      </button>

      {isOpen && (
        <div className="support-dropdown">
          <div className="support-dropdown-header">
            <div className="support-dropdown-title">
              <Headphones size={20} />
              <h3>الدعم الفني</h3>
            </div>
            <button className="support-close-btn" onClick={() => setIsOpen(false)}>
              <X size={18} />
            </button>
          </div>

          <div className="support-body">
            <div className="support-icon-wrap">
              <Headphones size={48} strokeWidth={1.5} />
            </div>
            <p className="support-text">
              للاستفسارات والمشاكل الفنية، يمكنك التواصل مع الإدارة العليا مباشرة عبر واتساب
            </p>

            <div className="support-number-card">
              <Phone size={18} />
              <span className="support-number">{SUPPORT_NUMBER}</span>
            </div>

            <a
              href={whatsappLink}
              target="_blank"
              rel="noopener noreferrer"
              className="support-whatsapp-btn"
            >
              <MessageCircle size={20} />
              <span>تواصل عبر واتساب</span>
            </a>
          </div>
        </div>
      )}
    </div>
  );
};

export default SupportBadge;

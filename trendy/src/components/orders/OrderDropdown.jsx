import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';
import './OrderDropdown.css';

const OrderDropdown = ({ value, options, onChange, className = '' }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  const selected = options.find((o) => o.value === value) || options[0];

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (ref.current && !ref.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className={`order-dropdown ${className}`.trim()} ref={ref}>
      <button
        type="button"
        className={`order-dropdown-trigger${open ? ' open' : ''}`}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        <span>{selected.label}</span>
        <ChevronDown size={18} className="order-dropdown-chevron" />
      </button>

      {open && (
        <ul className="order-dropdown-menu" role="listbox">
          {options.map((opt) => (
            <li key={opt.value}>
              <button
                type="button"
                role="option"
                aria-selected={value === opt.value}
                className={`order-dropdown-option${value === opt.value ? ' selected' : ''}`}
                onClick={() => {
                  onChange(opt.value);
                  setOpen(false);
                }}
              >
                <span>{opt.label}</span>
                {value === opt.value && <Check size={16} className="order-dropdown-check" />}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default OrderDropdown;

import React, { useState, useEffect } from 'react';
import { X, Plus, Trash2 } from 'lucide-react';
import './AddShipmentModal.css';

const AVAILABLE_PRODUCTS = [
  { id: 1, name: 'بنطلون جينز', category: 'بنطلون', colors: ['أزرق داكن'], sizes: ['L', 'M'] },
  { id: 2, name: 'شورت رياضي', category: 'شورت', colors: ['أسود', 'رمادي'], sizes: ['XL', 'L'] },
  { id: 3, name: 'فستان صيفي', category: 'فستان', colors: ['أحمر', 'وردي', 'بني'], sizes: ['L', 'M', 'S'] },
  { id: 4, name: 'قميص قطني أزرق', category: 'قميص', colors: ['أبيض', 'أزرق داكن'], sizes: ['XL', 'L', 'M'] },
];

const ALL_COLORS = ['أبيض', 'أسود', 'أزرق داكن', 'أخضر', 'أحمر', 'وردي', 'أصفر', 'رمادي', 'بني'];
const ALL_SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];

const AddShipmentModal = ({ isOpen, onClose, onSave, initialData = null }) => {
  const isEditMode = !!initialData;
  const [selectedProductId, setSelectedProductId] = useState('');
  const [selectedColors, setSelectedColors] = useState([]);
  const [selectedSizes, setSelectedSizes] = useState([]);
  const [quantity, setQuantity] = useState('');
  const [items, setItems] = useState([]);

  // Load initial data when in edit mode
  useEffect(() => {
    if (isOpen && initialData) {
      setItems(initialData.items || []);
    } else if (isOpen && !initialData) {
      setItems([]);
      setSelectedProductId('');
      setSelectedColors([]);
      setSelectedSizes([]);
      setQuantity('');
    }
  }, [isOpen, initialData]);

  const selectedProduct = AVAILABLE_PRODUCTS.find((p) => p.id === Number(selectedProductId));

  const toggleColor = (color) => {
    setSelectedColors((prev) =>
      prev.includes(color) ? prev.filter((c) => c !== color) : [...prev, color]
    );
  };

  const toggleSize = (size) => {
    setSelectedSizes((prev) =>
      prev.includes(size) ? prev.filter((s) => s !== size) : [...prev, size]
    );
  };

  const handleAddItem = () => {
    if (!selectedProduct || selectedColors.length === 0 || selectedSizes.length === 0 || !quantity) return;

    const newItems = [];
    selectedColors.forEach((color) => {
      selectedSizes.forEach((size) => {
        newItems.push({
          id: Date.now() + Math.random(),
          name: selectedProduct.name,
          category: selectedProduct.category,
          color,
          size,
          quantity: Number(quantity),
        });
      });
    });

    setItems((prev) => [...prev, ...newItems]);
    setSelectedProductId('');
    setSelectedColors([]);
    setSelectedSizes([]);
    setQuantity('');
  };

  const handleDeleteItem = (itemId) => {
    setItems((prev) => prev.filter((item) => item.id !== itemId));
  };

  const totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0);
  const totalVariants = items.length;
  const uniqueColors = [...new Set(items.map((i) => i.color))].length;
  const uniqueSizes = [...new Set(items.map((i) => i.size))].length;

  const handleSubmit = () => {
    if (items.length === 0) return;
    if (isEditMode && initialData) {
      onSave({ ...initialData, items });
    } else {
      onSave({ items });
    }
    setItems([]);
    setSelectedProductId('');
    setSelectedColors([]);
    setSelectedSizes([]);
    setQuantity('');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content add-shipment-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">{isEditMode ? 'تعديل الشحنة' : 'إضافة شحنة جديدة'}</h2>
          <button className="close-button" onClick={onClose}>
            <X size={24} />
          </button>
        </div>

        <div className="shipment-form">
          <div className="add-products-section">
            <h3 className="section-title">إضافة منتجات للشحنة</h3>

            <div className="form-row">
              <div className="form-group">
                <label>اسم المنتج</label>
                <select
                  value={selectedProductId}
                  onChange={(e) => {
                    setSelectedProductId(e.target.value);
                    setSelectedColors([]);
                    setSelectedSizes([]);
                  }}
                >
                  <option value="">اختر المنتج</option>
                  {AVAILABLE_PRODUCTS.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>التصنيف</label>
                <input type="text" value={selectedProduct?.category || ''} readOnly />
              </div>
            </div>

            <div className="form-group">
              <label>الألوان المتاحة (اختر واحد أو أكثر)</label>
              <div className="checkbox-grid colors-grid">
                {ALL_COLORS.map((color) => (
                  <label key={color} className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={selectedColors.includes(color)}
                      onChange={() => toggleColor(color)}
                    />
                    <span>{color}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="form-group">
              <label>المقاسات المتاحة (اختر واحد أو أكثر)</label>
              <div className="checkbox-grid sizes-grid">
                {ALL_SIZES.map((size) => (
                  <label key={size} className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={selectedSizes.includes(size)}
                      onChange={() => toggleSize(size)}
                    />
                    <span>{size}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="form-group">
              <label>الكمية لكل متغير</label>
              <input
                type="number"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                placeholder="الكمية"
              />
            </div>

            <p className="variants-hint">
              سيتم إضافة {totalVariants} متغير ({uniqueColors} لون × {uniqueSizes} مقاس)
            </p>

            <button
              className="add-item-btn"
              onClick={handleAddItem}
              disabled={!selectedProductId || selectedColors.length === 0 || selectedSizes.length === 0 || !quantity}
            >
              <Plus size={18} />
              إضافة المنتج للشحنة
            </button>
          </div>

          {items.length > 0 && (
            <div className="shipment-items-section">
              <h3 className="section-title">المنتجات في الشحنة ({items.length})</h3>
              <div className="shipment-items-list">
                {items.map((item) => (
                  <div key={item.id} className="shipment-item-row">
                    <div className="item-info">
                      <span className="item-name">{item.name}</span>
                      <span className="item-details">
                        التصنيف: {item.category} | اللون: {item.color} | المقاس: {item.size}
                      </span>
                    </div>
                    <div className="item-qty">{item.quantity} قطعة</div>
                    <button className="item-delete-btn" onClick={() => handleDeleteItem(item.id)}>
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
              </div>

              <div className="shipment-total">
                <span className="total-label">إجمالي الكميات:</span>
                <span className="total-value">{totalQuantity} قطعة</span>
              </div>
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button className="cancel-button" onClick={onClose}>
            إلغاء
          </button>
          <button
            className="save-button"
            onClick={handleSubmit}
            disabled={items.length === 0}
          >
            {isEditMode ? 'حفظ التعديلات' : 'إنشاء الشحنة'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AddShipmentModal;

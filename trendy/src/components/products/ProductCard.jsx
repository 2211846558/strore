import React from 'react';
import { Palette, Archive, ArchiveRestore, Edit2 } from 'lucide-react';
import './ProductCard.css';

const ProductCard = ({ product, onEdit, onArchive }) => {
  const isArchived = product.status === 'مؤرشف';

  return (
    <div className={`product-card ${isArchived ? 'archived' : ''}`}>
      {isArchived && <span className="archive-badge">مؤرشف</span>}

      <div className="product-image">
        <img src={product.image} alt={product.name} loading="lazy" />
      </div>

      <div className="product-info">
        <h3 className="product-name">{product.name}</h3>
        <span className="product-category">{product.category}</span>
      </div>

      <p className="product-description">{product.description}</p>

      {product.colors?.length > 0 && (
        <div className="product-colors">
          {product.colors.map((color) => (
            <span key={color} className="color-tag">
              <Palette size={12} className="tag-icon" aria-hidden="true" />
              {color}
            </span>
          ))}
        </div>
      )}

      {product.sizes?.length > 0 && (
        <div className="product-sizes">
          {product.sizes.map((size) => (
            <span key={size} className="size-tag">
              {size}
            </span>
          ))}
        </div>
      )}

      <div className="product-footer">
        <div className="product-price">
          <span className="amount">{product.price}</span>
          <span className="currency">د.ل</span>
        </div>
        <span className="product-stock">{product.stock} متوفر</span>
      </div>

      <div className="product-actions">
        <button
          type="button"
          className={`product-btn archive-action-btn ${isArchived ? 'restore' : 'archive'}`}
          onClick={() => onArchive(product)}
          title={isArchived ? 'إلغاء الأرشفة' : 'أرشفة المنتج'}
          aria-label={isArchived ? 'إلغاء أرشفة المنتج' : 'أرشفة المنتج'}
        >
          {isArchived ? <ArchiveRestore size={18} /> : <Archive size={18} />}
          <span>{isArchived ? 'استعادة' : 'أرشفة'}</span>
        </button>
        <button
          type="button"
          className="product-btn edit-btn"
          onClick={() => onEdit(product)}
          title="تعديل"
          aria-label="تعديل المنتج"
        >
          <Edit2 size={18} />
          <span>تعديل</span>
        </button>
      </div>
    </div>
  );
};

export default ProductCard;

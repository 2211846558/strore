import './TrendyBrandLogo.css';

const TrendyBrandLogo = ({ className = '' }) => (
  <img
    src="/trendy-logo.png"
    alt="Trendy"
    className={['trendy-brand-image', className].filter(Boolean).join(' ')}
  />
);

export default TrendyBrandLogo;

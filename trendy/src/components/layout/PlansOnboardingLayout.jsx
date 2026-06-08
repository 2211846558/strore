import { LogOut } from 'lucide-react';
import './PlansOnboardingLayout.css';

const PlansOnboardingLayout = ({ onLogout, children }) => (
  <div className="plans-onboarding-layout">
    <header className="plans-onboarding-header">
      <div className="plans-onboarding-brand">
        <span className="brand-title">Trendy</span>
        <span className="brand-dot">.</span>
      </div>
      <button type="button" className="plans-onboarding-logout" onClick={onLogout}>
        <LogOut size={18} />
        <span>تسجيل الخروج</span>
      </button>
    </header>
    <main className="plans-onboarding-main">{children}</main>
  </div>
);

export default PlansOnboardingLayout;

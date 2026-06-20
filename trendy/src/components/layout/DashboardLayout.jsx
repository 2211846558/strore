import { Navigate, Outlet } from 'react-router-dom';
import { useStore } from '../../context/AuthContext';
import Sidebar from './Sidebar';
import './DashboardLayout.css';

const DashboardLayout = ({ onLogout }) => {
  const { hasActivePlan, planChecking } = useStore();

  if (planChecking) {
    return (
      <div className="app-plan-check" role="status" aria-live="polite">
        <span className="loader" />
        <p>جاري التحقق من حالة الاشتراك...</p>
      </div>
    );
  }

  if (!hasActivePlan) {
    return <Navigate to="/plans" replace />;
  }

  return (
    <div className="dashboard-layout">
      <Sidebar onLogout={onLogout} />
      <main className="main-content">
        <Outlet />
      </main>
    </div>
  );
};

export default DashboardLayout;

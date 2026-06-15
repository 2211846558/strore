import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth, useStore, useAuthActions } from './context/AuthContext';
import { WalletProvider } from './context/WalletContext';
import { StripeProvider } from './providers/StripeProvider';
import DashboardLayout from './components/layout/DashboardLayout';
import PlansOnboardingLayout from './components/layout/PlansOnboardingLayout';
import Dashboard from './pages/Dashboard';
import Login from './pages/Login';
import Join from './pages/Join';
import ForgotPassword from './pages/ForgotPassword';
import Plans from './pages/Plans';
import Marketing from './pages/Marketing';
import Products from './pages/Products';
import Inventory from './pages/Inventory';
import Finance from './pages/Finance';
import Offers from './pages/Offers';
import Sales from './pages/Sales';
import Staff from './pages/Staff';
import Orders from './pages/Orders';
import Notifications from './pages/Notifications';
import Chat from './pages/Chat';
import Attributes from './pages/Attributes';
import { setCacheKeyPrefix } from './api/cache';
import './App.css';

function AppRoutes() {
  const { isAuthenticated } = useAuth();
  const { hasActivePlan, storeId } = useStore();
  const { logout } = useAuthActions();

  useEffect(() => {
    if (storeId) setCacheKeyPrefix(`s${storeId}`);
    else setCacheKeyPrefix('');
  }, [storeId]);

  const handleLogout = async () => {
    await logout();
  };

  const authHome = hasActivePlan ? '/' : '/plans';

  if (isAuthenticated && !hasActivePlan) {
    return (
      <Routes>
        <Route
          path="/plans"
          element={
            <WalletProvider>
              <PlansOnboardingLayout onLogout={handleLogout}>
                <Plans onboarding />
              </PlansOnboardingLayout>
            </WalletProvider>
          }
        />
        <Route path="*" element={<Navigate to="/plans" replace />} />
      </Routes>
    );
  }

  return (
    <Routes>
      <Route
        path="/login"
        element={
          !isAuthenticated ? (
            <Login />
          ) : (
            <Navigate to={authHome} replace />
          )
        }
      />
      <Route
        path="/join"
        element={
          !isAuthenticated ? (
            <Join />
          ) : (
            <Navigate to={authHome} replace />
          )
        }
      />
      <Route
        path="/forgot-password"
        element={
          !isAuthenticated ? (
            <ForgotPassword />
          ) : (
            <Navigate to={authHome} replace />
          )
        }
      />

      <Route
        path="/"
        element={
          isAuthenticated ? (
            <WalletProvider>
              <DashboardLayout onLogout={handleLogout} />
            </WalletProvider>
          ) : (
            <Navigate to="/login" replace />
          )
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="marketing" element={<Marketing />} />
        <Route path="products" element={<Products />} />
        <Route path="inventory" element={<Inventory />} />
        <Route path="finance" element={<Finance />} />
        <Route path="offers" element={<Offers />} />
        <Route path="sales" element={<Sales />} />
        <Route path="staff" element={<Staff />} />
        <Route path="orders" element={<Orders />} />
        <Route path="notifications" element={<Notifications />} />
        <Route path="chat" element={<Chat />} />
        <Route path="plans" element={<Plans />} />
        <Route path="attributes" element={<Attributes />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}

function App() {
  return (
    <AuthProvider>
      <StripeProvider>
        <BrowserRouter>
          <div className="app-container">
            <AppRoutes />
          </div>
        </BrowserRouter>
      </StripeProvider>
    </AuthProvider>
  );
}

export default App;

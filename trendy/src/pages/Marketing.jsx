import React, { useState, useEffect, useCallback } from 'react';
import CampaignCard from '../components/marketing/CampaignCard';
import SubscribedCampaignCard from '../components/marketing/SubscribedCampaignCard';
import CampaignPaymentModal from '../components/marketing/CampaignPaymentModal';
import ProductSelectionModal from '../components/marketing/ProductSelectionModal';
import {
  fetchAvailableCampaigns,
  fetchMyCampaigns,
  saveMyCampaign,
  subscribeToCampaign,
  buildSubscriptionEntry,
  resolveCampaignBanner,
  isStoreSubscribedToCampaign,
} from '../api/campaigns';
import { getApiErrorMessage } from '../api/stores';
import { useAuth } from '../context/AuthContext';
import { useWallet } from '../context/WalletContext';
import './Marketing.css';

const Marketing = () => {
  const { storeId } = useAuth();
  const { balance, refreshWallet } = useWallet();
  const [activeTab, setActiveTab] = useState('available');
  const [availableCampaigns, setAvailableCampaigns] = useState([]);
  const [myCampaigns, setMyCampaigns] = useState([]);
  const [loadingCampaigns, setLoadingCampaigns] = useState(true);
  const [loadingMyCampaigns, setLoadingMyCampaigns] = useState(false);
  const [campaignsError, setCampaignsError] = useState('');
  const [toast, setToast] = useState('');

  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [selectedCampaign, setSelectedCampaign] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const showToast = (message) => {
    setToast(message);
    setTimeout(() => setToast(null), 3000);
  };

  const loadCampaigns = useCallback(async () => {
    setLoadingCampaigns(true);
    setCampaignsError('');
    try {
      const campaigns = await fetchAvailableCampaigns();
      setAvailableCampaigns(campaigns);
    } catch (err) {
      setCampaignsError(getApiErrorMessage(err, 'تعذّر تحميل الحملات المتاحة'));
    } finally {
      setLoadingCampaigns(false);
    }
  }, []);

  useEffect(() => {
    loadCampaigns();
  }, [loadCampaigns]);

  const loadMyCampaigns = useCallback(async () => {
    if (!storeId) {
      setMyCampaigns([]);
      return;
    }
    setLoadingMyCampaigns(true);
    try {
      const list = await fetchMyCampaigns(storeId, availableCampaigns);
      setMyCampaigns(list);
    } catch {
      setMyCampaigns([]);
    } finally {
      setLoadingMyCampaigns(false);
    }
  }, [storeId, availableCampaigns]);

  useEffect(() => {
    if (activeTab === 'my-campaigns') {
      loadMyCampaigns();
    }
  }, [activeTab, loadMyCampaigns]);

  const getCampaignBanner = (campaign) =>
    resolveCampaignBanner(campaign, availableCampaigns);

  const visibleCampaigns = availableCampaigns.filter(
    (campaign) => !isStoreSubscribedToCampaign(campaign, storeId),
  );

  const handleSubscribeClick = (campaign) => {
    setSelectedCampaign(campaign);
    setIsPaymentModalOpen(true);
  };

  const handlePaymentConfirm = () => {
    setIsPaymentModalOpen(false);
    setIsProductModalOpen(true);
  };

  const handleCampaignActivate = async (campaign, selectedProducts, discountPercentage) => {
    if (!storeId) {
      showToast('لم يتم تحديد المتجر. يرجى تسجيل الدخول مرة أخرى.');
      return;
    }

    setIsSubmitting(true);
    try {
      const apiRes = await subscribeToCampaign({
        storeId,
        megaCampaignId: campaign.megaCampaignId ?? campaign.id,
        productIds: selectedProducts.map((p) => p.id),
        discountPercentage,
      });

      const entry = buildSubscriptionEntry(
        { ...campaign, bannerImage: getCampaignBanner(campaign) ?? campaign.bannerImage },
        selectedProducts,
        discountPercentage,
        apiRes,
      );
      saveMyCampaign(storeId, entry);
      const campaigns = await fetchAvailableCampaigns();
      setAvailableCampaigns(campaigns);
      setMyCampaigns(await fetchMyCampaigns(storeId, campaigns));
      await refreshWallet();

      setIsProductModalOpen(false);
      setSelectedCampaign(null);
      setActiveTab('my-campaigns');
      showToast('تم الاشتراك في الحملة وخصم الرسوم من المحفظة بنجاح');
    } catch (err) {
      showToast(getApiErrorMessage(err, 'تعذّر إتمام الاشتراك في الحملة'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="plans-page marketing-page">
      <header className="page-header plans-header">
        <div className="header-title-wrapper">
          <h1 className="page-title">إدارة التسويق والمحتوى</h1>
          <p className="page-subtitle">اشترك في الحملات الإعلانية المتوفرة لزيادة مبيعات متجرك</p>
        </div>
      </header>

      {toast && <div className="marketing-toast" role="status">{toast}</div>}

      <div className="plans-controls">
        <div className="tabs-container">
          <button
            type="button"
            className={`tab-btn ${activeTab === 'available' ? 'active' : ''}`}
            onClick={() => setActiveTab('available')}
          >
            الحملات المتاحة
          </button>
          <button
            type="button"
            className={`tab-btn ${activeTab === 'my-campaigns' ? 'active' : ''}`}
            onClick={() => setActiveTab('my-campaigns')}
          >
            حملاتي المشتركة
          </button>
        </div>
      </div>

      <div className="plans-content">
        {activeTab === 'available' && (
          <>
            {loadingCampaigns && <p className="no-results">جاري تحميل الحملات...</p>}
            {campaignsError && <p className="form-error-banner">{campaignsError}</p>}
            {!loadingCampaigns && !campaignsError && visibleCampaigns.length === 0 && (
              <p className="no-results">لا توجد حملات متاحة حالياً.</p>
            )}
            <div className="plans-grid">
              {visibleCampaigns.map((campaign) => (
                <CampaignCard
                  key={campaign.id}
                  title={campaign.title}
                  type={campaign.type}
                  description={campaign.description}
                  duration={campaign.duration}
                  productsCount={campaign.productsCount}
                  price={campaign.price}
                  bannerImage={getCampaignBanner(campaign)}
                  status={campaign.status}
                  onSubscribe={() => handleSubscribeClick(campaign)}
                />
              ))}
            </div>
          </>
        )}

        {activeTab === 'my-campaigns' && (
          <div className="plans-grid">
            {loadingMyCampaigns && <p className="no-results">جاري تحميل حملاتك المشتركة...</p>}
            {!loadingMyCampaigns && myCampaigns.length > 0 ? (
              myCampaigns.map((campaign) => (
                <SubscribedCampaignCard
                  key={campaign.megaCampaignId ?? campaign.id}
                  title={campaign.title}
                  description={campaign.description}
                  price={campaign.price}
                  duration={campaign.duration}
                  productsCount={campaign.productsCount}
                  dateRange={campaign.dateRange}
                  status={campaign.status}
                  bannerImage={getCampaignBanner(campaign)}
                  selectedProducts={campaign.selectedProducts}
                />
              ))
            ) : !loadingMyCampaigns ? (
              <p className="no-results">لا توجد حملات مشتركة حالياً. اشترك في حملة جديدة!</p>
            ) : null}
          </div>
        )}
      </div>

      <CampaignPaymentModal
        isOpen={isPaymentModalOpen}
        onClose={() => setIsPaymentModalOpen(false)}
        campaign={selectedCampaign}
        walletBalance={balance}
        subscriptionCost={selectedCampaign?.price ?? 50}
        onConfirm={handlePaymentConfirm}
      />

      <ProductSelectionModal
        isOpen={isProductModalOpen}
        onClose={() => !isSubmitting && setIsProductModalOpen(false)}
        campaign={selectedCampaign}
        storeId={storeId}
        isSubmitting={isSubmitting}
        onActivate={handleCampaignActivate}
      />
    </div>
  );
};

export default Marketing;

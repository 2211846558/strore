import React, { useState } from 'react';
import CampaignCard from '../components/marketing/CampaignCard';
import SubscribedCampaignCard from '../components/marketing/SubscribedCampaignCard';
import CampaignPaymentModal from '../components/marketing/CampaignPaymentModal';
import ProductSelectionModal from '../components/marketing/ProductSelectionModal';
import './Marketing.css';

const Marketing = () => {
  const [activeTab, setActiveTab] = useState('available');
  
  // Modals state
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [selectedCampaign, setSelectedCampaign] = useState(null);
  const [myCampaigns, setMyCampaigns] = useState([]);

  const availableCampaigns = [
    {
      id: 1,
      title: 'الباقة البلاتينية المميزة',
      type: 'platinum',
      description: 'أفضل باقة للنمو السريع مع استهداف دقيق وتحليلات يومية لأداء الحملة.',
      duration: '30',
      productsCount: '50',
      price: '900',
    },
    {
      id: 2,
      title: 'الباقة الذهبية المتكاملة',
      type: 'search',
      description: 'حملة إعلانية واسعة النطاق تشمل محركات البحث ومنصات التواصل الاجتماعي.',
      duration: '15',
      productsCount: '15',
      price: '450',
    },
    {
      id: 3,
      title: 'الباقة الفضية للتواصل الاجتماعي',
      type: 'social',
      description: 'ترويج لمنتجاتك على منصات التواصل الاجتماعي لزيادة الوصول والمبيعات.',
      duration: '7',
      productsCount: '5',
      price: '150',
    },
  ];

  const handleSubscribeClick = (campaign) => {
    setSelectedCampaign(campaign);
    setIsPaymentModalOpen(true);
  };

  const handlePaymentConfirm = (campaign) => {
    // Open product selection immediately after payment
    setIsProductModalOpen(true);
  };

  const handleCampaignActivate = (campaign, selectedProducts) => {
    const pad = (n) => n.toString().padStart(2, '0');
    const formatDate = (date) => `${pad(date.getDate())}-${pad(date.getMonth() + 1)}-${date.getFullYear()}`;
    
    const today = new Date();
    const endDate = new Date(today);
    endDate.setDate(today.getDate() + parseInt(campaign.duration || 30));

    setMyCampaigns(prev => [...prev, {
      id: Date.now(),
      title: campaign.title,
      description: campaign.description,
      price: campaign.price,
      duration: campaign.duration,
      productsCount: campaign.productsCount,
      status: 'نشطة',
      dateRange: { start: formatDate(today), end: formatDate(endDate) },
      selectedProducts,
    }]);
    
    setIsProductModalOpen(false);
    setIsPaymentModalOpen(false);
    setSelectedCampaign(null);
    setActiveTab('my-campaigns');
  };

  return (
    <div className="plans-page">
      <header className="page-header plans-header">
        <div className="header-title-wrapper">
          <h1 className="page-title">إدارة التسويق والمحتوى</h1>
          <p className="page-subtitle">اشترك في الحملات الإعلانية المتوفرة لزيادة مبيعات متجرك</p>
        </div>
      </header>

      <div className="plans-controls">
        <div className="tabs-container">
          <button
            className={`tab-btn ${activeTab === 'available' ? 'active' : ''}`}
            onClick={() => setActiveTab('available')}
          >
            الحملات المتاحة
          </button>
          <button
            className={`tab-btn ${activeTab === 'my-campaigns' ? 'active' : ''}`}
            onClick={() => setActiveTab('my-campaigns')}
          >
            حملاتي المشتركة
          </button>
        </div>
      </div>

      <div className="plans-content">
        {activeTab === 'available' && (
          <div className="plans-grid">
            {availableCampaigns.map((campaign) => (
              <CampaignCard
                key={campaign.id}
                title={campaign.title}
                type={campaign.type}
                description={campaign.description}
                duration={campaign.duration}
                productsCount={campaign.productsCount}
                price={campaign.price}
                onSubscribe={() => handleSubscribeClick(campaign)}
              />
            ))}
          </div>
        )}

        {activeTab === 'my-campaigns' && (
          <div className="plans-grid">
            {myCampaigns.length > 0 ? (
              myCampaigns.map((campaign) => (
                <SubscribedCampaignCard
                  key={campaign.id}
                  title={campaign.title}
                  description={campaign.description}
                  price={campaign.price}
                  duration={campaign.duration}
                  productsCount={campaign.productsCount}
                  dateRange={campaign.dateRange}
                  status={campaign.status}
                  selectedProducts={campaign.selectedProducts}
                />
              ))
            ) : (
              <p className="no-results">لا توجد حملات مشتركة حالياً. اشترك في حملة جديدة!</p>
            )}
          </div>
        )}
      </div>

      <CampaignPaymentModal
        isOpen={isPaymentModalOpen}
        onClose={() => setIsPaymentModalOpen(false)}
        campaign={selectedCampaign}
        onConfirm={handlePaymentConfirm}
      />

      <ProductSelectionModal
        isOpen={isProductModalOpen}
        onClose={() => setIsProductModalOpen(false)}
        campaign={selectedCampaign}
        onActivate={handleCampaignActivate}
      />
    </div>
  );
};

export default Marketing;

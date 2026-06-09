import { apiRequest } from './client';
import { API_ENDPOINTS } from './config';
import { fetchStoreProducts as fetchStoreProductsList } from './products';

/** تكلفة الاشتراك في الحملة حسب الباكند (CampaignSubscriptionService) */
export const CAMPAIGN_SUBSCRIPTION_COST = 50;

const MY_CAMPAIGNS_KEY = (storeId) => `trendy_my_campaigns_${storeId}`;

function calcDurationDays(startDate, endDate) {
  if (!startDate || !endDate) return 30;
  const start = new Date(startDate);
  const end = new Date(endDate);
  const days = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
  return Math.max(1, days);
}

function formatDate(date) {
  const d = new Date(date);
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(d.getDate())}-${pad(d.getMonth() + 1)}-${d.getFullYear()}`;
}

export function mapCampaignFromApi(campaign) {
  const durationDays = calcDurationDays(campaign.start_date, campaign.end_date);
  return {
    id: campaign.id,
    megaCampaignId: campaign.id,
    title: campaign.name,
    description: campaign.description || '',
    type: 'default',
    duration: String(durationDays),
    productsCount: '10',
    price: String(CAMPAIGN_SUBSCRIPTION_COST),
    startDate: campaign.start_date,
    endDate: campaign.end_date,
    status: campaign.status,
    bannerImage: campaign.banner_image,
  };
}

function mapStoredSubscription(entry) {
  return {
    id: entry.id,
    megaCampaignId: entry.megaCampaignId,
    title: entry.title,
    description: entry.description,
    price: entry.price,
    duration: entry.duration,
    productsCount: entry.productsCount,
    status: entry.status === 'active' ? 'نشطة' : entry.status,
    dateRange: entry.dateRange,
    selectedProducts: entry.selectedProducts || [],
  };
}

/**
 * GET /api/campaigns — الحملات الإعلانية النشطة
 */
export async function fetchAvailableCampaigns() {
  const res = await apiRequest(API_ENDPOINTS.campaigns, { auth: false });
  const list = res?.data ?? res ?? [];
  return Array.isArray(list) ? list.map(mapCampaignFromApi) : [];
}

/**
 * GET /api/my-store/products — منتجات المتجر لاختيارها في الحملة
 */
export async function fetchStoreProducts({ storeId, perPage = 50 } = {}) {
  const list = await fetchStoreProductsList({ storeId, perPage, status: 'active' });
  return list.map((p) => ({ id: p.id, name: p.name }));
}

/**
 * POST /api/stores/{store}/campaigns/subscribe
 * body: { mega_campaign_id, product_ids, discount_percentage }
 */
export async function subscribeToCampaign({
  storeId,
  megaCampaignId,
  productIds,
  discountPercentage,
}) {
  return apiRequest(API_ENDPOINTS.storeCampaignSubscribe(storeId), {
    method: 'POST',
    body: {
      mega_campaign_id: megaCampaignId,
      product_ids: productIds,
      discount_percentage: Number(discountPercentage),
    },
  });
}

/**
 * حملاتي المشتركة — تُخزَّن محلياً بعد نجاح الاشتراك
 * (لا يوجد GET مخصص في api.md)
 */
export function loadMyCampaigns(storeId) {
  if (!storeId) return [];
  try {
    const raw = localStorage.getItem(MY_CAMPAIGNS_KEY(storeId));
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.map(mapStoredSubscription) : [];
  } catch {
    return [];
  }
}

export function saveMyCampaign(storeId, entry) {
  if (!storeId) return;
  const current = loadMyCampaigns(storeId);
  const normalized = {
    id: entry.id ?? Date.now(),
    megaCampaignId: entry.megaCampaignId,
    title: entry.title,
    description: entry.description,
    price: entry.price,
    duration: entry.duration,
    productsCount: entry.productsCount,
    status: 'active',
    dateRange: entry.dateRange,
    selectedProducts: entry.selectedProducts,
  };
  const next = [
    normalized,
    ...current.filter((c) => c.megaCampaignId !== normalized.megaCampaignId),
  ];
  localStorage.setItem(MY_CAMPAIGNS_KEY(storeId), JSON.stringify(next));
  return next.map(mapStoredSubscription);
}

export function buildSubscriptionEntry(campaign, selectedProducts, discountPercentage) {
  const today = new Date();
  const end = campaign.endDate ? new Date(campaign.endDate) : new Date(today);
  if (!campaign.endDate) {
    end.setDate(today.getDate() + Number(campaign.duration || 30));
  }

  return {
    megaCampaignId: campaign.megaCampaignId ?? campaign.id,
    title: campaign.title,
    description: campaign.description,
    price: campaign.price,
    duration: campaign.duration,
    productsCount: String(selectedProducts.length),
    dateRange: {
      start: formatDate(campaign.startDate || today),
      end: formatDate(end),
    },
    selectedProducts,
    discountPercentage,
  };
}

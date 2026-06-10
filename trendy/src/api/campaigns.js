import { apiRequest } from './client';
import { API_ENDPOINTS } from './config';
import { fetchStoreProducts as fetchStoreProductsList } from './products';
import { resolveCampaignBannerUrl } from './media';

/** تكلفة الاشتراك في الحملة حسب الباكند (CampaignSubscriptionService) */
export const CAMPAIGN_SUBSCRIPTION_COST = 50;

const MY_CAMPAIGNS_KEY = (storeId) => `trendy_my_campaigns_${storeId}`;

function readRawMyCampaigns(storeId) {
  if (!storeId) return [];
  try {
    const raw = localStorage.getItem(MY_CAMPAIGNS_KEY(storeId));
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function findCampaignMatch(campaigns, entry) {
  return campaigns.find(
    (c) =>
      Number(c.megaCampaignId) === Number(entry.megaCampaignId) ||
      Number(c.id) === Number(entry.megaCampaignId) ||
      Number(c.megaCampaignId) === Number(entry.id),
  );
}

export function resolveCampaignBanner(campaign, availableCampaigns = []) {
  const direct = resolveCampaignBannerUrl(
    campaign?.bannerImage ??
      campaign?.banner_image ??
      campaign?.banner ??
      campaign?.image,
  );
  if (direct) return direct;

  const live = findCampaignMatch(availableCampaigns, campaign ?? {});
  return live?.bannerImage ?? null;
}

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
    productsCount: String(
      campaign.max_products ?? campaign.products_count ?? campaign.products_limit ?? 10,
    ),
    price: String(
      campaign.subscription_cost ?? campaign.subscription_price ?? campaign.price ?? CAMPAIGN_SUBSCRIPTION_COST,
    ),
    startDate: campaign.start_date,
    endDate: campaign.end_date,
    status: campaign.status,
    stores: Array.isArray(campaign.stores) ? campaign.stores : [],
    bannerImage: resolveCampaignBannerUrl(
      campaign.banner_image ??
        campaign.bannerImage ??
        campaign.media?.[0]?.url ??
        (campaign.media?.[0]?.file_name
          ? `campaigns/${campaign.media[0].file_name}`
          : null),
    ),
  };
}

/** هل المتجر مشترك في الحملة؟ — GET /api/campaigns يُرجع stores[] */
export function isStoreSubscribedToCampaign(campaign, storeId) {
  if (!storeId || !campaign) return false;
  const stores = campaign.stores ?? [];
  return stores.some((store) => Number(store.id) === Number(storeId));
}

function findLocalCampaignEntry(storeId, megaCampaignId) {
  return readRawMyCampaigns(storeId).find(
    (entry) => Number(entry.megaCampaignId) === Number(megaCampaignId),
  );
}

function mapApiSubscriptionToMyCampaign(campaign, storeId, localEntry = null) {
  const storeSub = (campaign.stores ?? []).find(
    (store) => Number(store.id) === Number(storeId),
  );

  return {
    id: localEntry?.id ?? storeSub?.subscription_id ?? `sub-${campaign.megaCampaignId ?? campaign.id}`,
    megaCampaignId: campaign.megaCampaignId ?? campaign.id,
    title: campaign.title,
    description: campaign.description,
    price: campaign.price,
    duration: campaign.duration,
    productsCount: localEntry?.productsCount ?? campaign.productsCount,
    status: campaign.status === 'active' ? 'نشطة' : 'منتهية',
    dateRange:
      localEntry?.dateRange ??
      (campaign.startDate && campaign.endDate
        ? {
            start: formatDate(campaign.startDate),
            end: formatDate(campaign.endDate),
          }
        : { start: '—', end: '—' }),
    selectedProducts: localEntry?.selectedProducts ?? [],
    discountPercentage:
      storeSub?.discount_percentage ?? localEntry?.discountPercentage ?? null,
    bannerImage: resolveCampaignBanner(campaign),
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
    bannerImage: resolveCampaignBannerUrl(entry.bannerImage ?? entry.banner_image),
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
  return readRawMyCampaigns(storeId).map(mapStoredSubscription);
}

function mapSubscriptionFromApiResponse(res, campaign, selectedProducts) {
  const data = res?.data ?? res ?? {};
  const subscription = data.subscription ?? data.campaign_subscription ?? data;
  const megaCampaignId =
    subscription.mega_campaign_id ??
    subscription.megaCampaignId ??
    campaign.megaCampaignId ??
    campaign.id;

  return {
    id: subscription.id ?? Date.now(),
    megaCampaignId,
    title: subscription.campaign_name ?? subscription.name ?? campaign.title,
    description: subscription.description ?? campaign.description,
    price: String(
      subscription.subscription_cost ??
        subscription.price ??
        campaign.price ??
        CAMPAIGN_SUBSCRIPTION_COST,
    ),
    duration: String(
      subscription.duration_days ??
        campaign.duration ??
        calcDurationDays(campaign.startDate, campaign.endDate),
    ),
    productsCount: String(
      subscription.products_count ??
        selectedProducts.length ??
        campaign.productsCount,
    ),
    status: subscription.status === 'inactive' ? 'منتهية' : 'نشطة',
    dateRange: {
      start: formatDate(subscription.start_date ?? campaign.startDate ?? new Date()),
      end: formatDate(subscription.end_date ?? campaign.endDate ?? new Date()),
    },
    selectedProducts,
    discountPercentage: subscription.discount_percentage ?? null,
    bannerImage: resolveCampaignBannerUrl(
      subscription.banner_image ??
        subscription.bannerImage ??
        campaign.bannerImage ??
        campaign.banner_image,
    ),
  };
}

export function saveMyCampaign(storeId, entry) {
  if (!storeId) return [];
  const current = readRawMyCampaigns(storeId);
  const normalized = {
    id: entry.id ?? Date.now(),
    megaCampaignId: entry.megaCampaignId,
    title: entry.title,
    description: entry.description,
    price: entry.price,
    duration: entry.duration,
    productsCount: entry.productsCount,
    status: entry.status === 'inactive' ? 'منتهية' : entry.status ?? 'نشطة',
    dateRange: entry.dateRange,
    selectedProducts: entry.selectedProducts,
    bannerImage: entry.bannerImage ?? entry.banner_image ?? null,
  };
  const next = [
    normalized,
    ...current.filter((c) => Number(c.megaCampaignId) !== Number(normalized.megaCampaignId)),
  ];
  localStorage.setItem(MY_CAMPAIGNS_KEY(storeId), JSON.stringify(next));
  return next.map(mapStoredSubscription);
}

/**
 * GET /api/campaigns — حملاتي المشتركة (من stores[] لكل حملة)
 * POST /api/stores/{store}/campaigns/subscribe — الاشتراك
 */
export async function fetchMyCampaigns(storeId, availableCampaigns = null) {
  if (!storeId) return [];

  try {
    const available = availableCampaigns ?? (await fetchAvailableCampaigns());
    const subscribed = available.filter((campaign) =>
      isStoreSubscribedToCampaign(campaign, storeId),
    );

    return subscribed.map((campaign) => {
      const localEntry = findLocalCampaignEntry(
        storeId,
        campaign.megaCampaignId ?? campaign.id,
      );
      return mapApiSubscriptionToMyCampaign(campaign, storeId, localEntry);
    });
  } catch {
    return loadMyCampaigns(storeId);
  }
}

/** @deprecated استخدم fetchMyCampaigns — تبقى للتوافق */
export async function enrichMyCampaigns(storeId, availableCampaigns = null) {
  return fetchMyCampaigns(storeId, availableCampaigns);
}

export function buildSubscriptionEntry(campaign, selectedProducts, discountPercentage, apiResponse = null) {
  if (apiResponse) {
    return mapSubscriptionFromApiResponse(apiResponse, campaign, selectedProducts);
  }

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
    bannerImage: campaign.bannerImage ?? null,
  };
}

import { apiRequest } from './client';
import { API_ENDPOINTS } from './config';
import { fetchStoreProducts as fetchStoreProductsList } from './products';
import { resolveCampaignBannerUrl } from './media';

/** تكلفة الاشتراك في الحملة حسب الباكند (CampaignSubscriptionService) */
export const CAMPAIGN_SUBSCRIPTION_COST = 50;

const MY_CAMPAIGNS_KEY = (storeId) => `trendy_my_campaigns_${storeId}`;

function extractList(res) {
  const payload = res?.data ?? res;
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  return [];
}

function unwrapEntity(res) {
  const payload = res?.data ?? res;
  if (payload?.id != null) return payload;
  if (payload?.data?.id != null) return payload.data;
  return payload;
}

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

function parseApiDate(value) {
  if (!value) return null;
  const normalized = String(value).includes('T') ? value : String(value).replace(' ', 'T');
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date;
}

function calcDurationDays(startDate, endDate) {
  const start = parseApiDate(startDate);
  const end = parseApiDate(endDate);
  if (!end) return 30;

  const now = new Date();
  const from = start && start > now ? start : now;
  const days = Math.ceil((end.getTime() - from.getTime()) / (1000 * 60 * 60 * 24));
  if (days > 0) return days;

  if (start && end) {
    return Math.max(
      1,
      Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)),
    );
  }

  return 30;
}

function formatDate(date) {
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return '—';
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(d.getDate())}-${pad(d.getMonth() + 1)}-${d.getFullYear()}`;
}

function mapCampaignStatus(status) {
  const key = String(status ?? '').toLowerCase();
  if (key === 'active') return 'active';
  if (key === 'scheduled') return 'scheduled';
  if (key === 'inactive' || key === 'ended' || key === 'expired') return 'inactive';
  return key || 'active';
}

export function mapCampaignFromApi(campaign) {
  const durationDays = calcDurationDays(campaign.start_date, campaign.end_date);
  const status = mapCampaignStatus(campaign.status);
  const startDate = parseApiDate(campaign.start_date);
  const endDate = parseApiDate(campaign.end_date);

  return {
    id: campaign.id,
    megaCampaignId: campaign.id,
    title: campaign.name,
    description: campaign.description || '',
    type: campaign.type ?? 'default',
    duration: String(durationDays),
    productsCount: String(
      campaign.max_products ?? campaign.products_count ?? campaign.products_limit ?? 10,
    ),
    price: String(
      campaign.subscription_cost ??
        campaign.subscription_price ??
        campaign.price ??
        CAMPAIGN_SUBSCRIPTION_COST,
    ),
    startDate: campaign.start_date,
    endDate: campaign.end_date,
    status,
    stores: Array.isArray(campaign.stores) ? campaign.stores : [],
    bannerImage: resolveCampaignBannerUrl(
      campaign.banner_image ??
        campaign.bannerImage ??
        campaign.media?.[0]?.url ??
        (campaign.media?.[0]?.file_name
          ? `campaigns/${campaign.media[0].file_name}`
          : null),
    ),
    dateRange:
      startDate && endDate
        ? {
            start: formatDate(startDate),
            end: formatDate(endDate),
          }
        : { start: '—', end: '—' },
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

function normalizeSelectedProducts(source) {
  if (!source) return [];
  const list = Array.isArray(source) ? source : [];
  return list
    .map((product) => {
      if (product == null) return null;
      if (typeof product === 'number' || typeof product === 'string') {
        const id = Number(product);
        return Number.isFinite(id) ? { id, name: `منتج #${id}` } : null;
      }
      const id = product.id ?? product.product_id;
      if (id == null) return null;
      return {
        id,
        name: product.name ?? product.product_name ?? product.title ?? `منتج #${id}`,
      };
    })
    .filter(Boolean);
}

function extractStoreSubscriptionProducts(storeSub) {
  if (!storeSub) return [];
  return normalizeSelectedProducts(
    storeSub.products ??
      storeSub.selected_products ??
      storeSub.selectedProducts ??
      storeSub.product_ids,
  );
}

function mapApiSubscriptionToMyCampaign(campaign, storeId, localEntry = null) {
  const storeSub = (campaign.stores ?? []).find(
    (store) => Number(store.id) === Number(storeId),
  );

  const startDate = parseApiDate(campaign.startDate ?? campaign.start_date);
  const endDate = parseApiDate(campaign.endDate ?? campaign.end_date);
  const isActive =
    campaign.status === 'active' &&
    (!endDate || endDate.getTime() >= Date.now());

  const apiProducts = extractStoreSubscriptionProducts(storeSub);
  const localProducts = normalizeSelectedProducts(localEntry?.selectedProducts);

  return {
    id: localEntry?.id ?? storeSub?.subscription_id ?? `sub-${campaign.megaCampaignId ?? campaign.id}`,
    megaCampaignId: campaign.megaCampaignId ?? campaign.id,
    title: campaign.title,
    description: campaign.description,
    price: String(storeSub?.price_paid ?? campaign.price ?? CAMPAIGN_SUBSCRIPTION_COST),
    duration: campaign.duration,
    productsCount: localEntry?.productsCount ?? campaign.productsCount,
    status: isActive ? 'نشطة' : 'منتهية',
    dateRange:
      localEntry?.dateRange ??
      (startDate && endDate
        ? {
            start: formatDate(startDate),
            end: formatDate(endDate),
          }
        : { start: '—', end: '—' }),
    selectedProducts: apiProducts.length > 0 ? apiProducts : localProducts,
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
    discountPercentage: entry.discountPercentage ?? null,
    bannerImage: resolveCampaignBannerUrl(entry.bannerImage ?? entry.banner_image),
  };
}

/**
 * GET /api/campaigns — الحملات الإعلانية النشطة
 */
export async function fetchAvailableCampaigns() {
  const res = await apiRequest(API_ENDPOINTS.campaigns, { auth: false });
  return extractList(res).map(mapCampaignFromApi);
}

/**
 * GET /api/campaigns/{id} — تفاصيل حملة مع المتاجر المشتركة
 */
export async function fetchCampaignById(campaignId) {
  const res = await apiRequest(API_ENDPOINTS.campaign(campaignId), { auth: false });
  return mapCampaignFromApi(unwrapEntity(res));
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
}) {
  return apiRequest(API_ENDPOINTS.storeCampaignSubscribe(storeId), {
    method: 'POST',
    body: {
      mega_campaign_id: Number(megaCampaignId),
      product_ids: productIds.map((id) => Number(id)),
      discount_percentage: 1,
    },
  });
}

/**
 * حملاتي المشتركة المحفوظة محلياً (احتياط عند غياب stores[] في الاستجابة)
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

  const startDate =
    parseApiDate(subscription.start_date ?? subscription.starts_at) ??
    parseApiDate(campaign.startDate) ??
    new Date();
  const endDate =
    parseApiDate(subscription.end_date ?? subscription.ends_at) ??
    parseApiDate(campaign.endDate) ??
    new Date();

  return {
    id: subscription.id ?? Date.now(),
    megaCampaignId,
    title: subscription.campaign_name ?? subscription.name ?? campaign.title,
    description: subscription.description ?? campaign.description,
    price: String(
      subscription.price_paid ??
        subscription.subscription_cost ??
        subscription.price ??
        campaign.price ??
        CAMPAIGN_SUBSCRIPTION_COST,
    ),
    duration: String(
      subscription.duration_days ??
        campaign.duration ??
        calcDurationDays(startDate, endDate),
    ),
    productsCount: String(
      subscription.products_count ??
        selectedProducts.length ??
        campaign.productsCount,
    ),
    status: subscription.status === 'inactive' ? 'منتهية' : 'نشطة',
    dateRange: {
      start: formatDate(startDate),
      end: formatDate(endDate),
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
    discountPercentage: entry.discountPercentage ?? null,
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
 */
export async function fetchMyCampaigns(storeId, availableCampaigns = null) {
  if (!storeId) return [];

  try {
    const available = availableCampaigns ?? (await fetchAvailableCampaigns());
    const subscribed = available.filter((campaign) =>
      isStoreSubscribedToCampaign(campaign, storeId),
    );

    const enrichedList = await Promise.allSettled(
      subscribed.map(async (campaign) => {
        try {
          return await fetchCampaignById(campaign.megaCampaignId ?? campaign.id);
        } catch {
          return campaign;
        }
      }),
    );

    const apiSubscribed = enrichedList.map((result, index) => {
      const campaign = subscribed[index];
      const enriched = result.status === 'fulfilled' ? result.value : campaign;
      const localEntry = findLocalCampaignEntry(
        storeId,
        enriched.megaCampaignId ?? enriched.id,
      );
      return mapApiSubscriptionToMyCampaign(enriched, storeId, localEntry);
    });

    const localOnly = readRawMyCampaigns(storeId)
      .filter(
        (entry) =>
          !apiSubscribed.some(
            (campaign) => Number(campaign.megaCampaignId) === Number(entry.megaCampaignId),
          ),
      )
      .map(mapStoredSubscription);

    let merged = [...apiSubscribed, ...localOnly];

    const needsProductNames = merged.some((campaign) =>
      (campaign.selectedProducts ?? []).some(
        (product) => !product.name || String(product.name).startsWith('منتج #'),
      ),
    );

    if (needsProductNames) {
      try {
        const storeProducts = await fetchStoreProducts({ storeId });
        const namesById = Object.fromEntries(
          storeProducts.map((product) => [Number(product.id), product.name]),
        );
        merged = merged.map((campaign) => ({
          ...campaign,
          selectedProducts: (campaign.selectedProducts ?? []).map((product) => ({
            ...product,
            name: namesById[Number(product.id)] ?? product.name,
          })),
        }));
      } catch {
        // أسماء المنتجات اختيارية — نُبقي المعرفات إن فشل التحميل
      }
    }

    merged.forEach((campaign) => {
      if (!campaign.selectedProducts?.length) return;
      const localEntry = findLocalCampaignEntry(storeId, campaign.megaCampaignId);
      if (localEntry?.selectedProducts?.length) return;
      saveMyCampaign(storeId, {
        ...localEntry,
        ...campaign,
        status: campaign.status === 'منتهية' ? 'منتهية' : 'نشطة',
      });
    });

    return merged;
  } catch {
    return loadMyCampaigns(storeId);
  }
}

/** @deprecated استخدم fetchMyCampaigns */
export async function enrichMyCampaigns(storeId, availableCampaigns = null) {
  return fetchMyCampaigns(storeId, availableCampaigns);
}

export function buildSubscriptionEntry(
  campaign,
  selectedProducts,
  apiResponse = null,
) {
  if (apiResponse?.subscription || apiResponse?.campaign_subscription || apiResponse?.data?.subscription) {
    return mapSubscriptionFromApiResponse(apiResponse, campaign, selectedProducts);
  }

  const startDate = parseApiDate(campaign.startDate) ?? new Date();
  const endDate =
    parseApiDate(campaign.endDate) ??
    (() => {
      const fallback = new Date(startDate);
      fallback.setDate(fallback.getDate() + Number(campaign.duration || 30));
      return fallback;
    })();

  return {
    megaCampaignId: campaign.megaCampaignId ?? campaign.id,
    title: campaign.title,
    description: campaign.description,
    price: String(campaign.price ?? CAMPAIGN_SUBSCRIPTION_COST),
    duration: String(calcDurationDays(startDate, endDate)),
    productsCount: String(selectedProducts.length),
    status: 'نشطة',
    dateRange: {
      start: formatDate(startDate),
      end: formatDate(endDate),
    },
    selectedProducts,
    bannerImage: campaign.bannerImage ?? null,
  };
}

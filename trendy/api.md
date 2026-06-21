<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| API Routes — منصة Trendy للتسوق متعدد المتاجر
|--------------------------------------------------------------------------
|
| هذا الملف هو نقطة دخول جميع طلبات API في المشروع.
| كل المسارات هنا تبدأ بـ /api (مُضاف تلقائياً من bootstrap/app.php).
| المصادقة: Laravel Sanctum (Bearer Token في كل طلب).
|
| هيكلية الأدوار في المنصة:
|   - super_admin      : مدير النظام الكامل
|   - stores_admin     : مسؤول المتاجر (الموافقة/الرفض)
|   - accountant       : المحاسب (التقارير المالية)
|   - operations_admin : مسؤول العمليات (الحملات)
|   - store_manager    : مدير متجر (يملك متجره)
|   - store_staff      : موظف متجر (يعمل لدى متجر)
|   - customer         : زبون مسجَّل
|
| ملاحظة: role Middleware مخصص يتحقق من جدول role_user.
|
*/

// ─────────────────────────────────────────────────────────────────────────────
// مسار الاختبار الافتراضي — يُعيد بيانات المستخدم المسجَّل حالياً
// يُستخدم للتحقق من صحة التوكن أثناء التطوير
// GET /api/user  ← يتطلب auth:sanctum
// ─────────────────────────────────────────────────────────────────────────────
Route::get('/user', function (Request $request) {
    return $request->user();
})->middleware('auth:sanctum');

// ═════════════════════════════════════════════════════════════════════════════
// مسارات المصادقة العامة (Multi-App Login)
// ─────────────────────────────────────────────────────────────────────────────
Route::prefix('v1/auth')->group(function () {
    // 1. الإدارة العليا (Platform Admin)
    Route::post('/admin/login', [\App\Http\Controllers\Api\V1\AuthController::class, 'adminLogin']);

    // 2. تطبيق المتاجر (Store App)
    Route::post('/store/login', [\App\Http\Controllers\Api\V1\AuthController::class, 'storeLogin']);
    Route::post('/store/verify-join', [\App\Http\Controllers\Api\V1\AuthController::class, 'verifyStoreJoin']);

    // 3. تطبيق الشراء (Shopping App)
    Route::post('/customer/login', [\App\Http\Controllers\Api\V1\AuthController::class, 'customerLogin']);
    Route::post('/customer/register', [\App\Http\Controllers\Api\V1\AuthController::class, 'registerCustomer']);
    Route::post('/customer/verify-email', [\App\Http\Controllers\Api\V1\AuthController::class, 'verifyEmail']);
    Route::post('/customer/resend-verification', [\App\Http\Controllers\Api\V1\AuthController::class, 'resendVerification']);

    // 4. تطبيق التوصيل (Delivery App)
    Route::post('/driver/login', [\App\Http\Controllers\Api\V1\AuthController::class, 'driverLogin']);

    // إعادة تعيين كلمة المرور (تحتاج لجلسة Session لمطابقة التوكن المخزن)
    Route::middleware([\Illuminate\Session\Middleware\StartSession::class])->group(function () {
        Route::post('/password/forgot', [\App\Http\Controllers\Api\V1\AuthController::class, 'forgotPassword']);
        Route::post('/password/verify-otp', [\App\Http\Controllers\Api\V1\AuthController::class, 'verifyResetOtp']);
        Route::post('/password/reset', [\App\Http\Controllers\Api\V1\AuthController::class, 'resetPassword']);
    });

    // تسجيل الخروج (يتطلب توكن)
    Route::post('/logout', [\App\Http\Controllers\Api\V1\AuthController::class, 'logout'])->middleware('auth:sanctum');
});


    // =========================================================================
    // [1] إدارة المتاجر — العرض العام
    // =========================================================================
    // هذه المسارات متاحة لأي مستخدم مسجَّل (زبون، مدير متجر، أدمن...).
    // تعرض فقط المتاجر النشطة (status=active).
    // =========================================================================

    // عرض قائمة المتاجر النشطة مع Pagination والفلترة
    // GET /api/v1/stores?name=&type=&per_page=20
    Route::get('/stores', [\App\Http\Controllers\Api\V1\StoreController::class, 'index']);

    // عرض تفاصيل متجر واحد نشط (الاسم، الوصف، المنتجات، ...)
    // GET /api/v1/ststores/{store}
    Route::get('/stores/{store}', [\App\Http\Controllers\Api\V1\StoreController::class, 'show']);

    // عرض قائمة المناطق المدعومة
    // GET /api/zones
    // ─────────────────────────────────────────────────────────────────────────
    // تُستخدم لاختيار منطقة المتجر المحلي، عنوان الشحن، ومنطقة عمل السائق.
    // ربط المناطق مع السائقين والطلبات:
    //   1. المتجر المحلي: zone_id عند الانضمام (POST /api/stores/join) أو التعديل
    //   2. السائق عند الاتصال: POST /api/drivers/toggle-status { is_online, current_zone_id }
    //   3. عند إرسال الطلب للتوصيل (POST /api/orders/{id}/prepare أو PATCH status → out_for_delivery):
    //      - تُحدَّد منطقة الطلب من shipping_address.zone_id أو store.zone_id
    //      - يُعيَّن سائق online في نفس المنطقة → out_for_delivery + Trip
    //   4. السائق يرى طلباته المعيَّنة: GET /api/orders?order_type=current
    //   5. عند اتصال سائق جديد بمنطقة: يُسند له أقدم طلب shipped غير معيَّن في المنطقة
    Route::get('/zones', [\App\Http\Controllers\Api\V1\ZoneController::class, 'index']);

    // -------------------------------------------------------------------------
    // تقديم طلب انضمام لفتح متجر جديد على المنصة
    // ─────────────────────────────────────────────────────────────────────────
    // - لا يُشترط وجود حساب مسبق: يُخزَّن الطلب فقط في store_join_requests (بيانات مقدم الطلب للقبول لاحقاً)
    // - يُسمح بتكرار إيميل مدير المتجر لمالك متجر آخر — يُعاد استخدام الحساب عند القبول
    // - لا اشتراك بخطة عند التقديم — الاشتراك يتم بعد قبول الإدارة عبر POST /api/stores/subscribe
    // - بعد القبول: إنشاء المتجر (أو ربطه بمدير موجود) بحالة inactive حتى أول اشتراك بخطة
    // POST /api/stores/join
    // -------------------------------------------------------------------------
    Route::post('/stores/join', [\App\Http\Controllers\Api\V1\StoreJoinController::class, 'store']);

    // عرض الحملات الترويجية النشطة للزبائن والزوار (تتضمن المتاجر المشتركة)
    // GET /api/campaigns
    Route::get('/campaigns', [\App\Http\Controllers\Api\V1\Public\CampaignController::class, 'index']);

    // تفاصيل حملة نشطة مع المتاجر المشتركة
    // GET /api/campaigns/{id}
    Route::get('/campaigns/{campaign}', [\App\Http\Controllers\Api\V1\Public\CampaignController::class, 'show'])
        ->whereNumber('campaign');


    // =========================================================================
    // [4] إدارة الكتالوج (Catalog Management) — العرض العام والبحث
    // =========================================================================
    // هذه المسارات متاحة للجميع [4.4, 4.8] أو لأدوار محددة [4.9].
    // =========================================================================

    // [4.4] عرض قائمة التصنيفات المتاحة (للجميع)
    // GET /api/v1/catalog/categories
    Route::get('/catalog/categories', [\App\Http\Controllers\Api\V1\CatalogController::class, 'categories']);

    // [4.8] عرض قائمة الخصائص المتاحة (للجميع)
    // GET /api/v1/catalog/attributes
    Route::get('/catalog/attributes', [\App\Http\Controllers\Api\V1\CatalogController::class, 'attributes']);

    // [4.9] البحث في الكتالوج — مخصص للأدوار الإدارية والتجارية
    // يسمح بالبحث السريع عن تصنيف أو خاصية بالاسم لسهولة الإدارة.
    Route::middleware(['role:super_admin,stores_admin,store_manager,store_staff', 'store_plan_active'])->group(function () {
        // GET /api/v1/catalog/search/categories?query=
        Route::get('/catalog/search/categories', [\App\Http\Controllers\Api\V1\CatalogController::class, 'searchCategories']);

        // GET /api/v1/catalog/search/attributes?query=
        Route::get('/catalog/search/attributes', [\App\Http\Controllers\Api\V1\CatalogController::class, 'searchAttributes']);
    });


    // =========================================================================
    // [2] لوحة الإدارة — Admin Panel
    // ─────────────────────────────────────────────────────────────────────────
    // prefix('admin')  : جميع المسارات تبدأ بـ /api/v1/admin/...
    // middleware(role) : يتحقق من أن المستخدم يحمل أحد الأدوار الإدارية.
    //   المسموح لهم بدخول لوحة الإدارة (بصفة عامة):
    //     super_admin | stores_admin | accountant | operations_admin
    // =========================================================================
    Route::prefix('admin')
        ->middleware('role:super_admin,stores_admin,accountant,operations_admin')
        ->group(function () {
    // إدارة البطاقات المصرفية (للمحاسبين والإدارة العليا فقط)
        Route::middleware('role:super_admin,accountant')->group(function () {
            Route::apiResource('bank-cards', \App\Http\Controllers\Api\V1\Admin\ManagementCardController::class)
                ->except(['show']);
            Route::post('bank-cards/{id}/activate', [\App\Http\Controllers\Api\V1\Admin\ManagementCardController::class, 'activate']);
         //أرباح المنصة العليا
        Route::prefix('finance')->group(function () {
            Route::get('/ad-profits', [\App\Http\Controllers\Api\V1\FinanceController::class, 'adProfits']);
            Route::get('/subscription-profits', [\App\Http\Controllers\Api\V1\FinanceController::class, 'subscriptionProfits']);
            Route::get('/delivery-profits', [\App\Http\Controllers\Api\V1\FinanceController::class, 'deliveryProfits']);
            Route::get('/platform-earnings', [\App\Http\Controllers\Api\V1\FinanceController::class, 'platformEarnings']);
        });
});


        // [16.8] إعادة توجيه/تعيين طلبية لسائق آخر
        Route::post('/orders/{id}/reassign', [\App\Http\Controllers\Api\V1\Admin\AdminOrderController::class, 'reassign']);

        // إدارة المناطق المدعومة (الإدارة)
        Route::post('/zones', [\App\Http\Controllers\Api\V1\ZoneController::class, 'store']);
        Route::delete('/zones/{id}', [\App\Http\Controllers\Api\V1\ZoneController::class, 'destroy']);

        // ─────────────────────────────────────────────────────────────────────
        // [2.2] إدارة طلبات انضمام المتاجر وعرض وتعديل بياناتها وطباعتها
        // ─────────────────────────────────────────────────────────────────────
        // هذه العمليات حساسة وتتطلب دوراً أعلى (super_admin أو stores_admin فقط).
        // ─────────────────────────────────────────────────────────────────────
        Route::middleware('role:super_admin,stores_admin')->group(function () {

            // يُعيد قائمة كاملة بالمتاجر بدون Pagination لأغراض الطباعة والتصدير.
            Route::get('/stores/print', [\App\Http\Controllers\Api\V1\Admin\AdminStoreController::class, 'print']);

            // عرض جميع طلبات الانضمام المعلقة (status=pending) مع الفلترة
            Route::get('/stores/requests', [\App\Http\Controllers\Api\V1\Admin\AdminStoreRequestController::class, 'index']);

            // عرض تفاصيل طلب انضمام محدد (بيانات الطلب + مقدم الطلب + الخطة)
            Route::get('/stores/requests/{storeJoinRequest}', [\App\Http\Controllers\Api\V1\Admin\AdminStoreRequestController::class, 'show']);

            // قبول طلب الانضمام: ربط المتجر بمدير موجود (نفس الإيميل) أو إنشاء مستخدم جديد، ثم inactive حتى الاشتراك
            Route::post('/stores/requests/{storeJoinRequest}/accept', [\App\Http\Controllers\Api\V1\Admin\AdminStoreRequestController::class, 'accept']);

            // رفض طلب الانضمام مع ذكر السبب (يبقى السجل في store_join_requests بحالة rejected)
            Route::post('/stores/requests/{storeJoinRequest}/reject', [\App\Http\Controllers\Api\V1\Admin\AdminStoreRequestController::class, 'reject']);

            // تعطيل متجر نشط (إيقاف مؤقت):
            Route::post('/stores/{store}/deactivate', [\App\Http\Controllers\Api\V1\Admin\AdminStoreController::class, 'deactivate']);

            // إعادة تفعيل متجر مُعطَّل:
            Route::post('/stores/{store}/reactivate', [\App\Http\Controllers\Api\V1\Admin\AdminStoreController::class, 'reactivate']);

            // عرض وتعديل بيانات المتاجر (للإدارة)
            Route::get('/stores', [\App\Http\Controllers\Api\V1\Admin\AdminStoreController::class, 'index']);
            Route::get('/stores/{store}', [\App\Http\Controllers\Api\V1\Admin\AdminStoreController::class, 'show']);
            Route::put('/stores/{store}/delivery-prices', [\App\Http\Controllers\Api\V1\Admin\AdminStoreController::class, 'updateDeliveryPrices']);
            Route::post('/stores/{store}/settle-custody', [\App\Http\Controllers\Api\V1\Admin\AdminStoreController::class, 'settleCustody']);
        });



        // ─────────────────────────────────────────────────────────────────────
        // [2.4] إدارة الحملات الترويجية الكبرى (Mega Campaigns)
        // ─────────────────────────────────────────────────────────────────────
        // apiResource يُولِّد 5 مسارات تلقائياً:
        //   GET    /campaigns          → index   (عرض الكل)
        //   POST   /campaigns          → store   (إنشاء جديد)
        //   GET    /campaigns/{id}     → show    (عرض واحد)
        //   PUT    /campaigns/{id}     → update  (تعديل)
        //   DELETE /campaigns/{id}     → destroy (حذف)
        // جميعها تحت /api/v1/admin/campaigns
        // ─────────────────────────────────────────────────────────────────────
        Route::apiResource('/campaigns', \App\Http\Controllers\Api\V1\Admin\CampaignController::class)
            ->middleware('role:super_admin,operations_admin');

        // تفعيل حملة ترويجية (تغيير الحالة إلى active لتظهر للمتاجر)
        // POST /api/v1/admin/campaigns/{campaign}/activate
        Route::post('/campaigns/{campaign}/activate', [\App\Http\Controllers\Api\V1\Admin\CampaignController::class, 'activate'])
            ->middleware('role:super_admin,operations_admin');

        // إيقاف حملة ترويجية (تغيير الحالة إلى inactive)
        // POST /api/v1/admin/campaigns/{campaign}/deactivate
        Route::post('/campaigns/{campaign}/deactivate', [\App\Http\Controllers\Api\V1\Admin\CampaignController::class, 'deactivate'])
            ->middleware('role:super_admin,operations_admin');


        // ─────────────────────────────────────────────────────────────────────
        // [2.5] إدارة خطط الاشتراك (Subscription Plans)
        // ─────────────────────────────────────────────────────────────────────
        // apiResource يُولِّد: index, store, show, update, destroy
        // تحت /api/v1/admin/plans
        //   - index   : عرض جميع الخطط المتاحة
        //   - store   : إنشاء خطة اشتراك جديدة (مدة، سعر، مميزات)
        //   - show    : عرض تفاصيل خطة واحدة
        //   - update  : تعديل خطة موجودة
        //   - destroy : حذف ناعم للخطة (soft delete)
        // ─────────────────────────────────────────────────────────────────────
        Route::apiResource('plans', \App\Http\Controllers\Api\V1\Admin\PlanController::class)
            ->middleware('role:super_admin,stores_admin');

        // ─────────────────────────────────────────────────────────────────────
        // [4.1 – 4.7] إدارة الكتالوج (للمدراء فقط)
        // ─────────────────────────────────────────────────────────────────────
        // هذه المسارات تسمح للمدراء ببناء الهيكل التنظيمي للمنصة (أقسام وخصائص).
        // ─────────────────────────────────────────────────────────────────────
        Route::middleware('role:super_admin,stores_admin')->group(function () {

            // [4.1-4.3] إدارة التصنيفات (فساتين، بناطيل، إلخ)
            // تدعم: الإضافة، التعديل، والحذف (Soft Delete [4.3]).
            Route::apiResource('categories', \App\Http\Controllers\Api\V1\Admin\AdminCategoryController::class);

            // [4.5-4.7] إدارة الخصائص (المقاسات، الألوان، إلخ)
            // تدعم: الإضافة، التعديل (إضافة قيم مثل XXL)، والحذف.
            Route::apiResource('attributes', \App\Http\Controllers\Api\V1\Admin\AdminAttributeController::class);
        });

        // ─────────────────────────────────────────────────────────────────────
        // [2.6] إحصائيات لوحة التحكم — Dashboard Statistics
        // ─────────────────────────────────────────────────────────────────────
        Route::prefix('dashboard')->group(function () {
            Route::get('/total-stores', [\App\Http\Controllers\Api\V1\Admin\AdminDashboardController::class, 'totalStores']);
            Route::get('/total-customers', [\App\Http\Controllers\Api\V1\Admin\AdminDashboardController::class, 'totalCustomers']);
            Route::get('/total-orders', [\App\Http\Controllers\Api\V1\Admin\AdminDashboardController::class, 'totalOrders']);

            Route::middleware('role:super_admin,accountant')->group(function () {
                Route::get('/payment-methods-stats', [\App\Http\Controllers\Api\V1\Admin\AdminDashboardController::class, 'paymentMethodsStats']);
            });

            // صلاحية للمدير العام فقط (super_admin)
            Route::middleware('role:super_admin')->group(function () {
                Route::get('/total-platform-staff', [\App\Http\Controllers\Api\V1\Admin\AdminDashboardController::class, 'totalPlatformStaff']);
            });
        });
    });


    // تعديل بيانات متجر (الاسم، الوصف، ...) من قِبَل مدير المتجر نفسه فقط
    // PUT /api/admin/stores/{store}
    Route::put('/admin/stores/{store}', [\App\Http\Controllers\Api\V1\Admin\AdminStoreController::class, 'update'])
        ->middleware('role:store_manager');




    // =========================================================================
    // [3] خطط الاشتراك — العرض العام للتجار
    // ─────────────────────────────────────────────────────────────────────────
    // يعرض الخطط المتاحة حتى يتمكن مدير المتجر من اختيار الخطة المناسبة.
    // GET /api/v1/plans
    // =========================================================================
    Route::get('/plans', [\App\Http\Controllers\Api\V1\PlanController::class, 'index']);


    // =========================================================================
    // [4] إدارة اشتراكات المتاجر في الخطط والحملات
    // ─────────────────────────────────────────────────────────────────────────
    // هذه المسارات خاصة بمدير المتجر (store_manager) فقط.
    // prefix('stores') : جميع المسارات تبدأ بـ /api/v1/stores/...
    // =========================================================================
    Route::prefix('stores')->middleware('role:store_manager')->group(function () {

        // الاشتراك في خطة — مسموح عندما يكون المتجر بحالة inactive (بعد قبول طلب الانضمام)
        // POST /api/stores/subscribe   ← body: {plan_id, store_id}
        Route::post('/subscribe', [\App\Http\Controllers\Api\V1\Store\PlanSubscriptionController::class, 'subscribe'])
            ->name('store.plan.subscribe');

        // شحن محفظة المتجر
        // POST /api/stores/wallet/charge ← body: {store_id, amount, payment_method_id}
        Route::post('/wallet/charge', [\App\Http\Controllers\Api\V1\Store\StoreWalletController::class, 'charge']);

        // سحب رصيد محفظة المتجر إلى بطاقة مصرفية (مدير المتجر فقط)
        // POST /api/stores/wallet/withdraw ← body: {store_id, amount, card_number}
        Route::post('/wallet/withdraw', [\App\Http\Controllers\Api\V1\Store\StoreWalletController::class, 'withdraw']);
    });

    Route::prefix('stores')->group(function () {
        Route::prefix('dashboard')->group(function () {
            Route::middleware('role:store_manager,store_staff')->group(function () {
                Route::get('/total-new-orders', [\App\Http\Controllers\Api\V1\Store\StoreDashboardController::class, 'totalNewOrders']);
            });

            Route::middleware('role:store_manager')->group(function () {
                Route::get('/total-employees', [\App\Http\Controllers\Api\V1\Store\StoreDashboardController::class, 'totalEmployees']);
            });
        });

        Route::middleware('role:store_manager,store_staff,super_admin,accountant')->group(function () {
            // عرض ملخص العهدة للمتجر
            // GET /api/v1/stores/custody/summary
            Route::get('/custody/summary', [\App\Http\Controllers\Api\V1\Store\StoreCustodyController::class, 'summary']);

            // عرض سجل العهدة التفصيلي للمتجر
            // GET /api/v1/stores/custody/logs
            Route::get('/custody/logs', [\App\Http\Controllers\Api\V1\Store\StoreCustodyController::class, 'logs']);
        });
    });

    Route::prefix('stores')->middleware('store_plan_active')->group(function () {
        Route::middleware('role:store_manager')->group(function () {
            // POST /api/stores/{store}/renew
            Route::post('/{store}/renew', [\App\Http\Controllers\Api\V1\Store\PlanSubscriptionController::class, 'renew']);

            // POST /api/stores/{store}/change-plan/{plan}
            Route::post('/{store}/change-plan/{plan}', [\App\Http\Controllers\Api\V1\Store\PlanSubscriptionController::class, 'change']);
        });

        Route::middleware('role:store_manager,store_staff')->group(function () {
            // POST /api/stores/{store}/campaigns/subscribe
            Route::post('/{store}/campaigns/subscribe', [\App\Http\Controllers\Api\V1\Store\CampaignSubscriptionController::class, 'subscribe']);

            // POST /api/stores/{store}/campaign-subscribe
            Route::post('/{store}/campaign-subscribe', [\App\Http\Controllers\Api\V1\Store\CampaignSubscriptionController::class, 'subscribe']);
        });
    });


    // =========================================================================
    // [5] إدارة المنتجات (Products Management)
    // ─────────────────────────────────────────────────────────────────────────
    // تنقسم إلى ثلاث فئات بحسب الصلاحية:
    //   أ) العرض العام  → الجميع (بعد تسجيل الدخول)
    //   ب) الإدارة      → store_manager + store_staff فقط
    //   ج) التقييم      → customer فقط
    // =========================================================================

    // ─── أ) المسارات العامة — متاحة لجميع المستخدمين المسجَّلين ────────────

    // [5.6] البحث بالاسم عبر جميع المتاجر:
    // يبحث في المنتجات النشطة فقط (status=active)
    // يدعم Pagination عبر per_page
    // ⚠️ يجب أن يأتي قبل /products/{id} لتجنب تفسير "search" كـ {id}
    // GET /api/v1/products/search?q=كلمة_البحث&per_page=20
    Route::get('/products/search', [\App\Http\Controllers\Api\V1\ProductController::class, 'search']);

    // [5.3] عرض تفاصيل منتج واحد كامل:
    // يشمل: الوصف التفصيلي، الصور، المتغيرات (مقاس/لون)،
    //        التقييمات، متوسط النجوم، واسم المتجر البائع.
    // يعرض فقط المنتجات النشطة — المؤرشف يُعيد 404
    // GET /api/v1/products/{id}
    Route::get('/products/{id}', [\App\Http\Controllers\Api\V1\ProductController::class, 'show']);

    // عرض التنوعات المرتبطة بكل منتج
    // GET /api/products/{id}/variants
    Route::get('/products/{id}/variants', [\App\Http\Controllers\Api\V1\ProductController::class, 'variants']);

    // [5.2] + [5.7] عرض منتجات متجر معين مع الفلترة والـ Pagination:
    // يعرض فقط المنتجات النشطة للمتجر المحدد.
    // معاملات الفلترة المدعومة [5.7]:
    //   ?name=        → البحث بالاسم داخل منتجات هذا المتجر [5.6 المقيَّد]
    //   ?category_id= → تصفية حسب التصنيف
    //   ?min_price=   → الحد الأدنى للسعر بالدينار الليبي
    //   ?max_price=   → الحد الأقصى للسعر بالدينار الليبي
    //   ?per_page=    → عدد المنتجات في كل صفحة (افتراضي: 20)
    // GET /api/v1/stores/{storeId}/products
    Route::get('/stores/{storeId}/products', [\App\Http\Controllers\Api\V1\ProductController::class, 'index']);


    // ─── ب) مسارات الإدارة — store_manager + store_staff فقط ────────────────
    // مسارات /my-store/ — معرف المتجر يُحدَّد عبر:
    //   store_id في الطلب (إلزامي عند تعدد المتاجر)، أو المتجر النشط بعد تسجيل الدخول.
    // Policy + StoreAccessService يمنعان العمل على متجر غير مخوَّل.
    // ─────────────────────────────────────────────────────────────────────────
    Route::middleware(['role:store_manager,store_staff', 'store_plan_active'])->group(function () {

        // عرض كافة منتجات متجر المستخدم الحالي (نشطة + مؤرشفة):
        // للاستخدام الداخلي — الزبائن لا يرون هذا المسار.
        // معاملات الفلترة المدعومة:
        //   ?name=        → البحث بالاسم
        //   ?status=      → active | archived (لعرض المؤرشفة فقط مثلاً)
        //   ?category_id= → تصفية حسب التصنيف
        //   ?per_page=    → عدد النتائج في كل صفحة
        // GET /api/v1/my-store/products
        Route::get('/my-store/products', [\App\Http\Controllers\Api\V1\ProductController::class, 'storeProducts']);

        // [5.1] إضافة منتج جديد للمتجر:
        // - يُنشأ بحالة "active" فوراً (يظهر للزبائن مباشرة)
        // - يجب رفع صورة واحدة على الأقل (مدعوم: jpeg, png, webp — حد أقصى: 2MB)
        // - يجب ربطه بتصنيف موجود مسبقاً في النظام (category_id)
        // - السعر (base_price) إلزامي — يُرفض الطلب بدونه
        // ⚠️ أرسل الطلب بـ Content-Type: multipart/form-data لرفع الصور
        // POST /api/v1/my-store/products  (+ store_id عند تعدد المتاجر)
        Route::post('/my-store/products', [\App\Http\Controllers\Api\V1\ProductController::class, 'store']);

        // [5.1.v] إضافة تنوع للمنتج بخصائص وقيم معينة
        // POST /api/v1/my-store/products/{productId}/variants
        Route::post('/my-store/products/{productId}/variants', [\App\Http\Controllers\Api\V1\ProductController::class, 'storeVariant']);

        // [5.4] تعديل بيانات منتج موجود:
        // - جميع الحقول اختيارية (PATCH Semantics) — يُعدَّل ما أُرسل فقط
        // - يسجل التعديلات ضمنياً عبر updated_at
        // - Vendor Isolation: لا يمكن تعديل منتج لا ينتمي لمتجرك (→ 404)
        // PUT /api/v1/my-store/products/{id}
        Route::put('/my-store/products/{id}', [\App\Http\Controllers\Api\V1\ProductController::class, 'update']);

        // [5.5] أرشفة منتج (إخفاء دون حذف):
        // - يُغيِّر حالة المنتج من "active" إلى "archived"
        // - يختفي فوراً من واجهة الزبائن لكن سجله يبقى في قاعدة البيانات
        // - الطلبات السابقة التي تحتوي هذا المنتج لا تتأثر
        // - يمكن إعادة تفعيله في أي وقت (مسار restore أدناه)
        // POST /api/v1/my-store/products/{id}/archive
        Route::post('/my-store/products/{id}/archive', [\App\Http\Controllers\Api\V1\ProductController::class, 'archive']);

        // [5.5] إعادة تفعيل منتج مؤرشف:
        // - يُغيِّر حالة المنتج من "archived" إلى "active"
        // - يظهر المنتج فوراً في واجهة الزبائن بعد التفعيل
        // POST /api/v1/my-store/products/{id}/restore
        Route::post('/my-store/products/{id}/restore', [\App\Http\Controllers\Api\V1\ProductController::class, 'restore']);
    });


    // ─── ج) تقييم المنتج — customer فقط ─────────────────────────────────────
    // [5.8] إضافة تقييم (نجوم + تعليق + صورة واقعية اختيارية):
    // القيود المُطبَّقة في RatingService:
    //   1. يجب أن يكون الزبون قد اشترى المنتج فعلياً (التحقق عبر سجل الطلبات للزبون)
    //   2. لا يُسمح بتقييم نفس المنتج أكثر من مرة واحدة
    //   3. صورة واحدة فقط مسموح بها لكل تقييم (حد أقصى: 5MB)
    // النجوم: من 1 (الأقل) إلى 5 (الأعلى)
    // يُحدِّث النظام متوسط التقييم تلقائياً بعد كل تقييم جديد
    // POST /api/products/{productId}/ratings
    Route::post('/products/{productId}/ratings', [\App\Http\Controllers\Api\V1\RatingController::class, 'store'])->middleware('auth:sanctum');
    // GET /api/products/{productId}/ratings
    Route::get('/products/{productId}/ratings', [\App\Http\Controllers\Api\V1\RatingController::class, 'index']);

    // POST /api/stores/{storeId}/ratings
    Route::post('/stores/{storeId}/ratings', [\App\Http\Controllers\Api\V1\RatingController::class, 'storeStoreRating'])->middleware('auth:sanctum');
    // GET /api/stores/{storeId}/ratings
    Route::get('/stores/{storeId}/ratings', [\App\Http\Controllers\Api\V1\RatingController::class, 'storeRatingsIndex']);
    // ─────────────────────────────────────────────────────────────────────────
    // =========================================================================
    // [6] إدارة الشكاوى (Complaints Management)
    // ─────────────────────────────────────────────────────────────────────────
    // تشمل: فتح التذاكر، الردود، الإجراءات المالية والإدارية، والبحث.
    // =========================================================================

    // 1. فتح تذكرة شكوى جديدة (للزبون فقط)
    // POST /api/v1/complaints
    Route::post('/complaints', [\App\Http\Controllers\Api\V1\ComplaintController::class, 'store'])
        ->middleware('role:customer');

    // 2 & 3 & 8 & 9. عرض والبحث والفلترة (للأدمن ومسؤول العمليات)
    // GET /api/v1/complaints
    Route::get('/complaints', [\App\Http\Controllers\Api\V1\ComplaintController::class, 'index'])
        ->middleware('role:super_admin,operations_admin');

    // عرض تفاصيل تذكرة (الأدمن، مسؤول العمليات، وصاحب الشكوى)
    // GET /api/v1/complaints/{id}
    Route::get('/complaints/{id}', [\App\Http\Controllers\Api\V1\ComplaintController::class, 'show'])
        ->middleware('auth:sanctum');

    // 2. تحديث الحالة (الأدمن ومسؤول العمليات)
    // PATCH /api/v1/complaints/{id}/status
    Route::patch('/complaints/{id}/status', [\App\Http\Controllers\Api\V1\ComplaintController::class, 'updateStatus'])
        ->middleware('role:super_admin,operations_admin');

    // 4. إضافة رد (الأدمن، مسؤول العمليات، وصاحب الشكوى)
    // POST /api/v1/complaints/{id}/replies
    Route::post('/complaints/{id}/replies', [\App\Http\Controllers\Api\V1\ComplaintController::class, 'addReply'])
        ->middleware('auth:sanctum');

    // 5. اتخاذ إجراء مالي (الأدمن ومسؤول العمليات)
    // POST /api/v1/complaints/{id}/financial-action
    Route::post('/complaints/{id}/financial-action', [\App\Http\Controllers\Api\V1\ComplaintController::class, 'financialAction'])
        ->middleware('role:super_admin,operations_admin');

    // 6. اتخاذ إجراء إداري (الأدمن ومسؤول العمليات)
    // POST /api/v1/complaints/{id}/admin-action
    Route::post('/complaints/{id}/admin-action', [\App\Http\Controllers\Api\V1\ComplaintController::class, 'adminAction'])
        ->middleware('role:super_admin,operations_admin');

    // 7. إغلاق الشكوى (الأدمن ومسؤول العمليات)
    // POST /api/v1/complaints/{id}/close
    Route::post('/complaints/{id}/close', [\App\Http\Controllers\Api\V1\ComplaintController::class, 'close'])
        ->middleware('role:super_admin,operations_admin');

    // 10. عرض سجل الشكاوى لمستخدم معين (الأدمن ومسؤول العمليات)
    // GET /api/v1/users/{userId}/complaints/history
    Route::get('/users/{userId}/complaints/history', [\App\Http\Controllers\Api\V1\ComplaintController::class, 'history'])
        ->middleware('role:super_admin,operations_admin');

    // =========================================================================
    // [7] إدارة المخزون (Inventory Management)
    // ─────────────────────────────────────────────────────────────────────────
    // تشمل: التوريد، الجرد، التعديل اليدوي، وسجل الحركات.
    // =========================================================================
    Route::prefix('inventory')->middleware(['role:store_manager,store_staff', 'store_plan_active'])->group(function () {

        // 1. إضافة شحنة جديدة (توريد)
        // POST /api/v1/inventory/shipments
        Route::post('/shipments', [\App\Http\Controllers\Api\V1\InventoryController::class, 'store']);

        // عرض قائمة الشحنات مع الفلترة والبحث
        // GET /api/v1/inventory/shipments
        Route::get('/shipments', [\App\Http\Controllers\Api\V1\InventoryController::class, 'listShipments']);

        // 2 & 6 & 7. عرض القائمة والبحث والفلترة
        // GET /api/v1/inventory
        Route::get('/', [\App\Http\Controllers\Api\V1\InventoryController::class, 'index']);

        // 3. عرض كمية وسعر FIFO لتنوع منتج
        // GET /api/v1/inventory/variants/{variantId}
        Route::get('/variants/{variantId}', [\App\Http\Controllers\Api\V1\InventoryController::class, 'showVariant']);

        // 4. عرض سجل الحركات لمنتج/تنوع معين
        // GET /api/v1/inventory/variants/{variantId}/movements
        Route::get('/variants/{variantId}/movements', [\App\Http\Controllers\Api\V1\InventoryController::class, 'movementLog']);

        // 4. تعديل المخزون يدوياً
        // POST /api/v1/inventory/adjust
        Route::post('/adjust', [\App\Http\Controllers\Api\V1\InventoryController::class, 'adjust']);

        // 5. تعديل شحنة
        // PUT /api/v1/inventory/shipments/{id}
        Route::put('/shipments/{id}', [\App\Http\Controllers\Api\V1\InventoryController::class, 'updateShipment']);
    });

    // =========================================================================
    // [8] الإدارة المالية (Finance Management)
    // ─────────────────────────────────────────────────────────────────────────
    // تشمل: الإيرادات، المعاملات، كشف الحساب، والتقارير.
    // =========================================================================
    Route::prefix('finance')
        ->middleware('role:super_admin,accountant,store_manager,store_staff')
        ->group(function () {

        // 1. عرض إجمالي الإيرادات
        // GET /api/v1/finance/revenue-overview
        Route::get('/revenue-overview', [\App\Http\Controllers\Api\V1\FinanceController::class, 'revenueOverview']);

        // 1.b. عرض إجمالي أرباح المتجر
        // GET /api/v1/finance/profit-overview
        Route::get('/profit-overview', [\App\Http\Controllers\Api\V1\FinanceController::class, 'profitOverview']);

        // 2 & 3 & 6. عرض المعاملات والبحث والفلترة
        // GET /api/v1/finance/transactions
        Route::get('/transactions', [\App\Http\Controllers\Api\V1\FinanceController::class, 'transactions']);

        // 4. عرض تفاصيل معاملة
        // GET /api/v1/finance/transactions/{id}
        Route::get('/transactions/{id}', [\App\Http\Controllers\Api\V1\FinanceController::class, 'showTransaction']);

        // 5. عرض كشف حساب (للمتاجر)
        // GET /api/v1/finance/account-statement

        Route::get('/account-statement', [\App\Http\Controllers\Api\V1\FinanceController::class, 'accountStatement']);

        // 7. تصدير التقارير المالية
        // GET /api/v1/finance/export
        Route::get('/export', [\App\Http\Controllers\Api\V1\FinanceController::class, 'export']);

        // 8. إحصائيات ونسب طرق الدفع
        // GET /api/v1/finance/payment-method-percentages
        Route::get('/payment-method-percentages', [\App\Http\Controllers\Api\V1\FinanceController::class, 'paymentMethodStats']);
    });

    // =========================================================================
    // [9] إدارة العروض والخصومات (Promotions & Discounts)
    // ─────────────────────────────────────────────────────────────────────────
    // تشمل: إنشاء الحملات، التعديل، التفعيل/التعطيل، واستعادة الأسعار.
    // =========================================================================
    Route::prefix('promotions')->group(function () {

        // 1. إنشاء حملة تخفيض (للمدراء والموظفين فقط)
        // POST /api/v1/promotions
        Route::post('/', [\App\Http\Controllers\Api\V1\PromotionController::class, 'store'])
            ->middleware(['role:store_manager,store_staff', 'store_plan_active']);

        // 2 & 3. عرض القائمة والتفاصيل (عرض الخصومات لمديري وموظفي المتاجر بالإضافة لمدير النظام ومسؤول المتاجر)
        // GET /api/v1/promotions
        Route::get('/', [\App\Http\Controllers\Api\V1\PromotionController::class, 'index'])
            ->middleware(['role:super_admin,stores_admin,store_manager,store_staff', 'store_plan_active']);

        // GET /api/v1/promotions/{id}
        Route::get('/{id}', [\App\Http\Controllers\Api\V1\PromotionController::class, 'show'])
            ->middleware(['role:super_admin,stores_admin,store_manager,store_staff', 'store_plan_active']);

        // 4. تعديل الخصم (للتجار فقط)
        // PATCH /api/v1/promotions/{id}
        Route::patch('/{id}', [\App\Http\Controllers\Api\V1\PromotionController::class, 'update'])
            ->middleware(['role:store_manager,store_staff', 'store_plan_active']);

        // 5. حذف الخصم (للتجار فقط)
        // DELETE /api/v1/promotions/{id}
        Route::delete('/{id}', [\App\Http\Controllers\Api\V1\PromotionController::class, 'destroy'])
            ->middleware(['role:store_manager,store_staff', 'store_plan_active']);

        // 6 & 7. تبديل الحالة (تفعيل/تعطيل) (للتجار فقط)
        // POST /api/v1/promotions/{id}/toggle
        Route::post('/{id}/toggle', [\App\Http\Controllers\Api\V1\PromotionController::class, 'toggle'])
            ->middleware(['role:store_manager,store_staff', 'store_plan_active']);
    });

    // =========================================================================
    // [10] إدارة الزبائن (Customer Management)
    // ─────────────────────────────────────────────────────────────────────────
    // تشمل: عرض القوائم، التفاصيل، التعطيل/التفعيل، والبحث.
    // =========================================================================
    Route::prefix('customers')->middleware('role:super_admin,operations_admin')->group(function () {

        // 1 & 5 & 6. عرض القائمة والبحث والفلترة
        // GET /api/v1/customers
        Route::get('/', [\App\Http\Controllers\Api\V1\CustomerController::class, 'index']);

        // 2. عرض تفاصيل زبون
        // GET /api/v1/customers/{id}
        Route::get('/{id}', [\App\Http\Controllers\Api\V1\CustomerController::class, 'show']);

        // 3. تعطيل حساب زبون
        // POST /api/v1/customers/{id}/deactivate
        Route::post('/{id}/deactivate', [\App\Http\Controllers\Api\V1\CustomerController::class, 'deactivate']);

        // 4. إعادة تفعيل حساب زبون
        // POST /api/v1/customers/{id}/reactivate
        Route::post('/{id}/reactivate', [\App\Http\Controllers\Api\V1\CustomerController::class, 'reactivate']);

        // 7. طباعة قائمة الزبائن (Export)
        // GET /api/v1/customers/export
        Route::get('/export', [\App\Http\Controllers\Api\V1\CustomerController::class, 'export']);
    });

    // =========================================================================
    // [11] إدارة الموظفين (Employees Management)
    // ─────────────────────────────────────────────────────────────────────────
    // تشمل: إضافة موظفين، تعديل الصلاحيات، التعطيل، والبحث.
    // =========================================================================
    Route::prefix('employees')->middleware(['role:super_admin,store_manager', 'store_plan_active'])->group(function () {

        // 1. إضافة موظف جديد
        // POST /api/v1/employees
        Route::post('/', [\App\Http\Controllers\Api\V1\EmployeeController::class, 'store']);

        // 2 & 7 & 8. عرض القائمة والبحث والفلترة
        // GET /api/v1/employees
        Route::get('/', [\App\Http\Controllers\Api\V1\EmployeeController::class, 'index']);

        // 3. عرض تفاصيل موظف
        // GET /api/v1/employees/{id}
        Route::get('/{id}', [\App\Http\Controllers\Api\V1\EmployeeController::class, 'show']);

        // 4. تعديل بيانات الموظف
        // PATCH /api/v1/employees/{id}
        Route::patch('/{id}', [\App\Http\Controllers\Api\V1\EmployeeController::class, 'update']);

        // 5 & 6. التعطيل والتفعيل
        // POST /api/v1/employees/{id}/toggle
        Route::post('/{id}/toggle', [\App\Http\Controllers\Api\V1\EmployeeController::class, 'toggle']);
    });

    // =========================================================================
    // [12] سلة التسوق (address)
    // ─────────────────────────────────────────────────────────────────────────
    // تشمل: إضافة الأصناف، تعديل الكميات، عرض المحتويات، والحذف.
    // =========================================================================
    Route::prefix('cart')->middleware('role:customer')->group(function () {

        // 1. إضافة منتج للسلة
        // POST /api/v1/cart
        Route::post('/', [\App\Http\Controllers\Api\V1\CartController::class, 'store']);

        // 2. تعديل محتويات السلة
        // PATCH /api/v1/cart/{itemId}
        Route::patch('/{itemId}', [\App\Http\Controllers\Api\V1\CartController::class, 'update']);

        // 3. عرض محتويات السلة
        // GET /api/v1/cart
        Route::get('/', [\App\Http\Controllers\Api\V1\CartController::class, 'index']);

        // حذف صنف من السلة
        // DELETE /api/v1/cart/{itemId}
        Route::delete('/{itemId}', [\App\Http\Controllers\Api\V1\CartController::class, 'destroy']);

        // إتمام الشراء والدفع (يدعم Stripe والكاش)
        // POST /api/v1/cart/checkout
        Route::post('/checkout', [\App\Http\Controllers\Api\V1\CheckoutController::class, 'checkout']);
        Route::post('/checkout-stripe', [\App\Http\Controllers\Api\V1\CheckoutController::class, 'checkout']);
    });

    // =========================================================================
    // [13] إدارة المفضلة (Wishlist)
    // ─────────────────────────────────────────────────────────────────────────
    // تشمل: إضافة للمفضلة، عرض القائمة، الحذف، والنقل للسلة.
    // =========================================================================
    Route::prefix('wishlist')->middleware('role:customer')->group(function () {

        // 1. إضافة منتج للمفضلة
        // POST /api/v1/wishlist
        Route::post('/', [\App\Http\Controllers\Api\V1\WishlistController::class, 'store']);

        // 2. عرض قائمة المفضلة
        // GET /api/v1/wishlist
        Route::get('/', [\App\Http\Controllers\Api\V1\WishlistController::class, 'index']);

        // 4. إزالة منتج من المفضلة
        // DELETE /api/v1/wishlist/{productId}
        Route::delete('/{productId}', [\App\Http\Controllers\Api\V1\WishlistController::class, 'destroy']);

        // 5. نقل المنتج لسلة التسوق
        // POST /api/v1/wishlist/{productId}/move-to-cart
        Route::post('/{productId}/move-to-cart', [\App\Http\Controllers\Api\V1\WishlistController::class, 'moveToCart']);
    });

    // =========================================================================
    // [14.5] الملف الشخصي للزبون (Customer Profile)
    // ─────────────────────────────────────────────────────────────────────────
    Route::prefix('customer')->middleware('role:customer')->group(function () {
        // GET /api/customer/profile
        Route::get('/profile', [\App\Http\Controllers\Api\V1\CustomerProfileController::class, 'show']);

        // PATCH /api/customer/profile — body: name, email, phone, default_address?
        Route::patch('/profile', [\App\Http\Controllers\Api\V1\CustomerProfileController::class, 'update']);
    });

    // =========================================================================
    // [15] إدارة عناوين الشحن (Shipping Addresses)
    // ─────────────────────────────────────────────────────────────────────────
    // تشمل: إضافة عنوان الشحن، عرض قائمة العناوين للزبون.
    // =========================================================================
    Route::prefix('addresses')->middleware('role:customer')->group(function () {
        // 1. إضافة عنوان شحن جديد
        // POST /api/v1/addresses
        Route::post('/', [\App\Http\Controllers\Api\V1\ShippingAddressController::class, 'store']);

        // 2. عرض قائمة العناوين
        // GET /api/v1/addresses
        Route::get('/', [\App\Http\Controllers\Api\V1\ShippingAddressController::class, 'index']);
    });

    // =========================================================================
    // [14] إدارة المحفظة الإلكترونية (Wallet Management)
    // ─────────────────────────────────────────────────────────────────────────
    // تشمل: عرض الرصيد، الشحن، والدفع.
    // =========================================================================
    Route::prefix('wallet')->middleware('auth:sanctum')->group(function () {

        // 1. عرض الرصيد المتاح
        // GET /api/wallet/balance
        Route::get('/balance', [\App\Http\Controllers\Api\V1\WalletController::class, 'balance']);

        // 2. إنشاء payment_method_id من بيانات البطاقة (Stripe) قبل الشحن
        // POST /api/wallet/payment-method
        Route::post('/payment-method', [\App\Http\Controllers\Api\V1\WalletController::class, 'createPaymentMethod'])
            ->middleware('role:customer');

        // 3. شحن المحفظة
        // POST /api/wallet/top-up
        Route::post('/top-up', [\App\Http\Controllers\Api\V1\WalletController::class, 'topUp'])
            ->middleware('role:customer');

        // 4. عرض سجل الحركات المالية
        // GET /api/wallet/logs
        Route::get('/logs', [\App\Http\Controllers\Api\V1\WalletController::class, 'logs']);
    });

    // =========================================================================
    // [15] إدارة المبيعات المباشرة (POS - Point of Sale)
    // ─────────────────────────────────────────────────────────────────────────
    // تشمل: البيع المباشر، الاسترداد، والتبديل داخل المتجر.
    // =========================================================================
    Route::prefix('pos')->middleware(['role:store_manager,store_staff', 'store_plan_active'])->group(function () {

        // 1. إضافة منتج لسلة البيع
        // POST /api/v1/pos/cart
        Route::post('/cart', [\App\Http\Controllers\Api\V1\PosController::class, 'addToCart']);

        // 2. حذف منتج من سلة البيع
        // DELETE /api/v1/pos/cart/{itemId}
        Route::delete('/cart/{itemId}', [\App\Http\Controllers\Api\V1\PosController::class, 'removeFromCart']);

        // 3. عرض محتويات سلة البيع
        // GET /api/v1/pos/cart
        Route::get('/cart', [\App\Http\Controllers\Api\V1\PosController::class, 'index']);

        // 4. استرداد منتج مباع
        // POST /api/v1/pos/refund
        Route::post('/refund', [\App\Http\Controllers\Api\V1\PosController::class, 'refund']);

        // 5. تبديل منتج
        // POST /api/v1/pos/exchange
        Route::post('/exchange', [\App\Http\Controllers\Api\V1\PosController::class, 'exchange']);

        // 6. اتمام الشراء
        // POST /api/pos/checkout
        Route::post('/checkout', [\App\Http\Controllers\Api\V1\PosController::class, 'checkout']);
    });

    // =========================================================================
    // [16] إدارة الطلبات (Orders Management)
    // ─────────────────────────────────────────────────────────────────────────
    // تشمل: عرض القائمة، التفاصيل، تحديث الحالة، الإلغاء، والبحث.
    // =========================================================================
    Route::prefix('orders')->middleware('auth:sanctum')->group(function () {

        // 1 & 5 & 6. عرض القائمة والبحث والفلترة
        // GET /api/orders
        // ─────────────────────────────────────────────────────────────────────
        // للسائق (driver): يُعاد فقط الطلبات المعيَّنة له (driver_id).
        //   ?order_type=current  → processing | shipped | out_for_delivery
        //   ?order_type=past     → delivered | cancelled | completed
        // التعيين التلقائي يتم حسب منطقة عنوان الشحن (أو منطقة المتجر) عبر:
        //   POST /api/orders/{id}/prepare
        //   PATCH /api/orders/{id}/status  { status: "out_for_delivery" }
        Route::get('/', [\App\Http\Controllers\Api\V1\OrderController::class, 'index']);

        // =========================================================================
        // [17] نظام المحادثات (Unified Chat System)
        // ─────────────────────────────────────────────────────────────────────────
        // تشمل: قائمة المحادثات، عرض الرسائل، وإرسال الرسائل.
        // يجب أن تسبق /{id} حتى لا يُفسَّر "chat" كمعرّف طلب.
        // =========================================================================
        Route::prefix('chat')->group(function () {
            // GET /api/orders/chat
            Route::get('/', [\App\Http\Controllers\Api\V1\ChatController::class, 'index']);

            // POST /api/orders/chat/store — بدء محادثة زبون ↔ متجر
            Route::post('/store', [\App\Http\Controllers\Api\V1\ChatController::class, 'startStoreChat']);

            // POST /api/orders/chat/support
            Route::post('/support', [\App\Http\Controllers\Api\V1\ChatController::class, 'startSupportChat']);

            // GET /api/orders/chat/{id}/messages
            Route::get('/{id}/messages', [\App\Http\Controllers\Api\V1\ChatController::class, 'showMessages']);

            // POST /api/orders/chat/{id}/messages
            Route::post('/{id}/messages', [\App\Http\Controllers\Api\V1\ChatController::class, 'storeMessage']);
        });

        // 2. عرض تفاصيل الطلب
        // GET /api/orders/{id}
        Route::get('/{id}', [\App\Http\Controllers\Api\V1\OrderController::class, 'show'])
            ->whereNumber('id');

        // 3. تحديث حالة الطلب
        // PATCH /api/v1/orders/{id}/status
        Route::patch('/{id}/status', [\App\Http\Controllers\Api\V1\OrderController::class, 'updateStatus'])
            ->middleware(['role:store_manager,store_staff,operations_admin', 'store_plan_active']);

        // تجهيز الطلب من قبل المتجر
        // POST /api/v1/orders/{id}/prepare
        // ─────────────────────────────────────────────────────────────────────
        // يغيّر الحالة إلى shipped ثم يُعيّن سائقاً online في منطقة التوصيل
        // (shipping_address.zone_id أو store.zone_id) → out_for_delivery + Trip
        Route::post('/{id}/prepare', [\App\Http\Controllers\Api\V1\OrderController::class, 'prepare'])
            ->middleware(['role:store_manager,store_staff', 'store_plan_active']);

        // 4. إلغاء طلب مع السبب
        // POST /api/v1/orders/{id}/cancel
        Route::post('/{id}/cancel', [\App\Http\Controllers\Api\V1\OrderController::class, 'cancel'])
            ->middleware(['role:store_manager,store_staff,operations_admin', 'store_plan_active']);

        // [16.7] تأكيد وصول الطلبية (للسائق ومدير وموظف المتجر)
        // POST /api/v1/orders/{id}/confirm-delivery
        Route::post('/{id}/confirm-delivery', [\App\Http\Controllers\Api\V1\OrderController::class, 'confirmDelivery'])
            ->middleware('role:driver,super_admin,operations_admin,store_manager,store_staff');
    });

    // =========================================================================
    // [18] إدارة السائقين (Drivers Management)
    // ─────────────────────────────────────────────────────────────────────────
    // تشمل: تسجيل السائقين، المتابعة، التعطيل، التقييم، وحالة الاتصال.
    // =========================================================================
    Route::prefix('drivers')->group(function () {

        // مسارات السائق نفسه الخاصة بأرباحه، مدة عمله، وعرض رصيد العهدة
        Route::middleware('role:driver')->group(function () {
            Route::get('/my/total-earnings', [\App\Http\Controllers\Api\V1\DriverController::class, 'myTotalEarnings']);
            Route::get('/my/earnings-filter', [\App\Http\Controllers\Api\V1\DriverController::class, 'myEarningsFilter']);
            Route::get('/my/work-duration', [\App\Http\Controllers\Api\V1\DriverController::class, 'myWorkDuration']);
        });
        Route::get('/my/custody-balance', [\App\Http\Controllers\Api\V1\DriverController::class, 'myCustodyBalance'])
            ->middleware('role:driver,super_admin,accountant');

        // مسارات أرباح وعهدة السائق المالية المستهدفة في الاختبارات القديمة
        Route::prefix('finance')->group(function () {
            Route::middleware('role:driver')->group(function () {
                Route::get('/total-profits', [\App\Http\Controllers\Api\V1\DriverFinanceController::class, 'totalProfits']);
                Route::get('/filtered-profits', [\App\Http\Controllers\Api\V1\DriverFinanceController::class, 'filteredProfits']);
                Route::get('/work-duration', [\App\Http\Controllers\Api\V1\DriverFinanceController::class, 'workDuration']);
            });
            Route::get('/custody-balance', [\App\Http\Controllers\Api\V1\DriverFinanceController::class, 'custodyBalance'])
                ->middleware('role:driver,super_admin,accountant');
        });

        // مسارات للإدارة (مدير النظام، مسؤول العمليات)
        Route::middleware('role:super_admin,operations_admin')->group(function () {
            // [18.2, 18.6, 18.10] عرض القائمة والفلترة والبحث
            Route::get('/', [\App\Http\Controllers\Api\V1\DriverController::class, 'index']);

            // [18.1] إضافة سائق جديد
            Route::post('/', [\App\Http\Controllers\Api\V1\DriverController::class, 'store']);

            // [18.4] تعطيل حساب سائق
            Route::post('/{id}/deactivate', [\App\Http\Controllers\Api\V1\DriverController::class, 'deactivate']);

            // [18.5] إعادة تفعيل حساب سائق
            Route::post('/{id}/reactivate', [\App\Http\Controllers\Api\V1\DriverController::class, 'reactivate']);

            // تسوية العهدة النقدية للسائق
            Route::post('/{id}/settle-cash', [\App\Http\Controllers\Api\V1\DriverController::class, 'settleCash']);
        });

        // [18.3] عرض تفاصيل السائق (متاح للإدارة وللسائق نفسه)
        Route::get('/{id}', [\App\Http\Controllers\Api\V1\DriverController::class, 'show'])
            ->middleware('role:super_admin,operations_admin,driver');

        // [18.9] تعديل بيانات السائق (للإدارة وللسائق بحدود معينة)
        Route::put('/{id}', [\App\Http\Controllers\Api\V1\DriverController::class, 'update'])
            ->middleware('role:super_admin,operations_admin,driver');

        // [18.7, 18.8] تفعيل/تعطيل حالة الاتصال (للسائق فقط)
        // POST /api/drivers/toggle-status
        // body: { is_online: true, current_zone_id: 1, latitude?, longitude? }
        // ─────────────────────────────────────────────────────────────────────
        // عند الاتصال بمنطقة: يُسند تلقائياً أقدم طلب shipped في نفس المنطقة
        Route::post('/toggle-status', [\App\Http\Controllers\Api\V1\DriverController::class, 'toggleStatus'])
            ->middleware('role:driver,super_admin,operations_admin');

        // [18.11] تقييم السائق (للزبون فقط)
        Route::post('/{id}/reviews', [\App\Http\Controllers\Api\V1\DriverController::class, 'review'])
            ->middleware('role:customer');
    });

    // =========================================================================
    // [19] إدارة الرحلات (Trips Management)
    // ─────────────────────────────────────────────────────────────────────────
    // تشمل: عرض قائمة الرحلات، عرض تفاصيل رحلة، وتعديل حالة رحلة.
    // =========================================================================
    Route::prefix('trips')->middleware('role:driver,super_admin,operations_admin')->group(function () {
        Route::get('/', [\App\Http\Controllers\Api\V1\TripController::class, 'index']);
        Route::get('/{id}', [\App\Http\Controllers\Api\V1\TripController::class, 'show']);
        Route::patch('/{id}/status', [\App\Http\Controllers\Api\V1\TripController::class, 'updateStatus']);
    });

    // =========================================================================
    // [20] إدارة الإشعارات (Notifications Management)
    // ─────────────────────────────────────────────────────────────────────────
    // تشمل: عرض القائمة، التفاصيل، تحديد كمقروء، وتحديد الكل كمقروء.
    // =========================================================================
    Route::middleware('auth:sanctum')->prefix('notifications')->group(function () {
        Route::get('/', [\App\Http\Controllers\Api\V1\NotificationController::class, 'index']);
        Route::post('/read-all', [\App\Http\Controllers\Api\V1\NotificationController::class, 'markAllAsRead']);
        Route::get('/{id}', [\App\Http\Controllers\Api\V1\NotificationController::class, 'show']);
        Route::patch('/{id}/read', [\App\Http\Controllers\Api\V1\NotificationController::class, 'markAsRead']);
    });

    // =========================================================================
    // [21] إدارة توكنات Firebase (FCM)
    // ─────────────────────────────────────────────────────────────────────────
    // هذه المسارات مسؤولة عن تسجيل وإلغاء تسجيل توكنات أجهزة المستخدمين
    // لإرسال الإشعارات (Push Notifications) عبر Firebase Cloud Messaging.
    // =========================================================================
    Route::middleware('auth:sanctum')->prefix('fcm')->group(function () {
        Route::post('/token', [\App\Http\Controllers\Api\V1\FcmTokenController::class, 'register']);
        Route::post('/token/unregister', [\App\Http\Controllers\Api\V1\FcmTokenController::class, 'unregister']);
    });

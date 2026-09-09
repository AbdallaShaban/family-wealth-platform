# دليل التشغيل والعمليات المؤسسية — FAMILY Wealth Intelligence
## Production Operations & Disaster Recovery Runbook (Phase 14)

---

### جدول المحتويات
1. [المعمارية التقنية ومكونات النظام](#1-المعمارية-التقنية-ومكونات-النظام)
2. [متطلبات البيئة والمتغيرات التشغيلية](#2-متطلبات-البيئة-والمتغيرات-التشغيلية)
3. [إجراءات الإطلاق الأولي (Cold Start)](#3-إجراءات-الإطلاق-الأولي-cold-start)
4. [التحديث المستمر والترقية الآمنة (Rolling Deployment)](#4-التحديث-المستمر-والترقية-الآمنة-rolling-deployment)
5. [فحوصات الجاهزية والسلامة والمراقبة (/readyz & /metrics)](#5-فحوصات-الجاهزية-والسلامة-والمراقبة-readyz--metrics)
6. [إجراءات التعافي من الكوارث والنسخ الاحتياطي (Disaster Recovery)](#6-إجراءات-التعافي-من-الكوارث-والنسخ-الاحتياطي-disaster-recovery)
7. [إدارة وصول المدقق المالي المستقل (Auditor Portal Operations)](#7-إدارة-وصول-المدقق-المالي-المستقل-auditor-portal-operations)
8. [تدوير المفاتيح والأسرار الأمنية (Secret Rotation)](#8-تدوير-المفاتيح-والأسرار-الأمنية-secret-rotation)
9. [دليل معالجة الحوادث والأعطال (Incident Triage)](#9-دليل-معالجة-الحوادث-والأعطال-incident-triage)

---

### 1. المعمارية التقنية ومكونات النظام

يعتمد نظام **FAMILY Wealth Intelligence** على بنية سحابية ومحلية متكاملة مصممة للمكاتب العائلية المؤسسية ذات معايير الأمان العالية:

```
+-------------------------------------------------------------------------+
|                              Cloudflare Ingress                         |
|                    (Zero-Trust Tunnel — No Public Ports)                |
+------------------------------------+------------------------------------+
                                     |
                                     v
+-------------------------------------------------------------------------+
|                        Docker Host Environment                          |
|                                                                         |
|  +-------------------------------------------------------------------+  |
|  | ingress_network (Internal Bridge)                                 |  |
|  |                                                                   |  |
|  |   [cloudflared] (Tunnel Daemon)                                   |  |
|  |         |                                                         |  |
|  |         v (HTTP :3000)                                            |  |
|  |   [family_app] (Node 22 LTS Multi-Arch ARM64/AMD64)               |  |
|  |     - Express + tRPC v11                                          |  |
|  |     - Decimal.js (Precision 40)                                   |  |
|  |     - Non-root user: node                                         |  |
|  |     - Healthcheck Probe: /readyz                                  |  |
|  |     - Local Vault Volume: /app/vault_storage                      |  |
|  +---------------------------------+---------------------------------+  |
|                                    |                                    |
|  +---------------------------------v---------------------------------+  |
|  | internal_network (Isolated Internal Network - internal: true)     |  |
|  |                                                                   |  |
|  |   [family_mysql] (MySQL 8.4.4 LTS)                                |  |
|  |     - Port 3306 NOT bound to host                                 |  |
|  |     - Exactly 56 relational tables                                |  |
|  |     - Exactly 35 migrations (0000_... to 0034_...)                |  |
|  |     - Persistent Volume: family_mysql_data                        |  |
|  |     - UTF-8 MB4 Unicode collation                                 |  |
|  +-------------------------------------------------------------------+  |
+-------------------------------------------------------------------------+
```

#### الثوابت غير القابلة للتفاوض (Non-Negotiable Invariants):
1. **قاعدة البيانات**: MySQL فقط (الإصدار 8.4.4 LTS). يُحظر تماماً استخدام أو التحويل إلى PostgreSQL.
2. **جداول النظام**: بالضبط 56 جدولاً معرفاً في `drizzle/schema.ts`.
3. **ملفات الترحيل (Migrations)**: بالضبط 35 ملف ترحيل (من 0000 إلى 0034) في مسار `drizzle/`.
4. **الدقة المالية**: `Decimal.js` بدقة 40 خانة عشرية لجميع حسابات القيود ومطابقة الدفاتر.
5. **معمارية الأستاذ أولاً (Ledger-First)**: قيد اليومية المزدوج هو المصدر الأوحد للحقيقة المالية.
6. **عزل الشبكة**: منفذ قاعدة البيانات 3306 لا يُنشر على شبكة المضيف الخارجية إطلاقاً.

---

### 2. متطلبات البيئة والمتغيرات التشغيلية

يجب إعداد ملف `.env` في جذر المشروع قبل بدء التشغيل، مع استيفاء المتغيرات التالية:

```bash
# ============================================================================
# بيئة التشغيل الأساسية
# ============================================================================
NODE_ENV=production
PORT=3000

# ============================================================================
# قاعدة البيانات (MySQL 8.4.4 LTS)
# ============================================================================
DB_NAME=family_db
DB_USER=family
DB_PASSWORD=YOUR_STRONG_DATABASE_PASSWORD_HERE!
DB_ROOT_PASSWORD=YOUR_STRONG_ROOT_PASSWORD_HERE!
DATABASE_URL=mysql://family:YOUR_STRONG_DATABASE_PASSWORD_HERE!@mysql:3306/family_db

# إعدادات مجمع اتصالات MySQL (Connection Pool)
DB_CONNECTION_LIMIT=20
DB_MAX_IDLE=10
DB_IDLE_TIMEOUT_MS=60000

# ============================================================================
# أسرار التشفير والمصادقة (يجب ألا تقل عن 32 محرفاً عشوائياً)
# ============================================================================
JWT_SECRET=c8f1e9b2a7d4c6e8f0a3b5d7e9f1a3b5c7d9e1f3a5b7c9d1e3f5a7b9c1d3e5f7
AUDITOR_PORTAL_JWT_SECRET=c8f1e9b2a7d4c6e8f0a3b5d7e9f1a3b5c7d9e1f3a5b7c9d1e3f5a7b9c1d3e5f7
VAULT_ENCRYPTION_SECRET=c8f1e9b2a7d4c6e8f0a3b5d7e9f1a3b5c7d9e1f3a5b7c9d1e3f5a7b9c1d3e5f7

# ============================================================================
# الخزنة والتخزين السحابي (S3 Compatible أو Local Fallback)
# ============================================================================
STORAGE_LOCAL_DIR=/app/vault_storage
# اختياري عند الربط مع S3:
# AWS_REGION=eu-central-1
# AWS_ACCESS_KEY_ID=...
# AWS_SECRET_ACCESS_KEY=...
# AWS_S3_BUCKET=family-vault-bucket

# ============================================================================
# نفق Cloudflare Zero-Trust (اختياري عند تفعيل ملف tunnel)
# ============================================================================
CLOUDFLARE_TUNNEL_TOKEN=YOUR_CLOUDFLARE_TUNNEL_TOKEN_HERE
```

---

### 3. إجراءات الإطلاق الأولي (Cold Start)

لتشغيل بيئة الإنتاج لأول مرة على خادم جديد:

```bash
# 1. التأكد من سلامة ملف التكوين .env
ls -la .env

# 2. بناء وتشغيل الحاويات في الخلفية
docker compose up -d mysql

# 3. التحقق من اكتمال صحة قاعدة البيانات (Status: healthy)
docker compose ps mysql

# 4. بناء وتشغيل حاوية التطبيق
docker compose up -d --build app

# 5. متابعة سجلات بدء التشغيل والترحيل الآلي
docker compose logs -f app
```

يقوم السكريبت الداخلي `deploy/docker-entrypoint.sh` تلقائياً بـ:
1. التحقق من اتصال قاعدة البيانات وفحص كلمة المرور.
2. تنفيذ أمر `pnpm exec drizzle-kit migrate` لتطبيق كافة الترحيلات (0000 إلى 0034) بشكل تراكمي آمن.
3. التأكد من قوة المفاتيح السرية `validateProductionJwtSecret()`.
4. بدء تشغيل خادم التطبيق وتفعيل مستمع الجاهزية `/readyz`.

---

### 4. التحديث المستمر والترقية الآمنة (Rolling Deployment)

لترقية التطبيق إلى إصدار جديد دون توقف الخدمة:

```bash
# 1. تجهيز وسم الحاوية الحالي كنسخة احتياطية للرجوع الفوري
docker tag family_app:latest family_app:previous

# 2. بناء الإصدار الجديد
docker compose build app

# 3. استبدال الحاوية بالنسخة المحدثة
docker compose up -d --no-deps app

# 4. مراقبة فحص الجاهزية (Readiness Probe) خلال أول 60 ثانية
for i in {1..12}; do
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:3000/readyz)
  if [ "$STATUS" = "200" ]; then
    echo "Deployment verified: App is READY (HTTP 200)."
    break
  fi
  echo "Waiting for app readiness... attempt $i/12 (received HTTP $STATUS)"
  sleep 5
done

# 5. في حال الفشل، تنفيذ التراجع التلقائي (Automatic Rollback):
# docker compose stop app
# docker tag family_app:previous family_app:latest
# docker compose up -d app
```

---

### 5. فحوصات الجاهزية والسلامة والمراقبة (/readyz & /metrics)

يوفر التطبيق نهايات طرفية متخصصة لمراقبة حالة النظام:

1. **`GET /readyz`**:
   - يتحقق من اتصال قاعدة البيانات الفعلي عبر تنفيذ استعلام فوري `SELECT 1`.
   - يُرجع كود `200 OK` عندما تكون قاعدة البيانات جاهزة لاستقبال المعاملات المالية.
   - يُرجع كود `503 Service Unavailable` في حال انقطاع الاتصال أو بطء المجمع.

2. **`GET /healthz`**:
   - يتحقق من استجابة خادم Node ومستوى زمن التشغيل (Uptime).

3. **`GET /metrics`**:
   - يُصدر إحصائيات الأداء التشغيلي:
     - عدد الطلبات الإجمالي (`requests`).
     - عدد الأخطاء الداخلية (`responses5xx`).
     - متوسط زمن الاستجابة بالمللي ثانية (`averageResponseMs`).

---

### 6. إجراءات التعافي من الكوارث والنسخ الاحتياطي (Disaster Recovery Architecture)

يعتمد النظام على استراتيجية تعافي ثلاثية المستويات (Three-Tier DR Strategy) تفصل بين ثبات البيانات المحلي، والنسخ الاحتياطي الكامل للبنية التحتية، والنسخ المنطقي المحمول لمساحات العمل:

#### مستويات التعافي الثلاثة (The Three DR Tiers):

| المستوى | الآلية والتقنية | النطاق والمحتوى | الهدف وحالة الاستخدام |
|---|---|---|---|
| **المستوى A: استمرارية التخزين المحلي (Local Persistence)** | **Docker Named Volume** (`family_mysql_data` & `family_vault_data`) | كافة ملفات MySQL الخام على مضيف الحاوية (`/var/lib/mysql`) وملفات الخزنة | حماية البيانات من إعادة تشغيل الحاويات أو ترقيتها دورياً على نفس الخادم. |
| **المستوى B: النسخ الفيزيائي الشامل للمنصة (Full Platform Snapshot)** | **`mysqldump` / Physical Snapshot** | قاعدة البيانات بالكامل (كافة الجداول الـ 56) بما فيها جداول المنصة المركزية: `users`, `platform_ownership`, `platform_audit_events`, `platform_admin_invitations`, `workspaces` | التعافي الشامل من انهيار الخادم المادي أو تلف قاعدة البيانات واستعادة البيئة المؤسسية كاملة. |
| **المستوى C: استنساخ ونقل مساحات العمل (Workspace Application DR)** | **`backupRestoreService` (Phase 13 DR Payload)** | الجداول المملوكة للمساحة فقط (**51 جدولاً**)، مع استبعاد صريح لكافة جداول المنصة المركزية | نقل مساحة عمل إلى خادم آخر، استنساخها لأغراض التدقيق، أو استعادة حالة المساحة عند الخطأ البشري. |

#### الجداول المركزية المستثناة صراحة من المستوى C (Excluded Platform Tables):
1. `users` (المستخدمون وحسابات تسجيل الدخول المركزية).
2. `platform_ownership` (سجل ملكية المنصة وتعيين المالك المؤسسي).
3. `platform_audit_events` (سجل التدقيق المركزي لأحداث إدارة المنصة).
4. `platform_admin_invitations` (دعوات مديري المنصة).
5. `workspaces` (تعريف المساحات المركزية وأرقام المعرفات الأساسية).

#### تصدير نسخة احتياطية لمساحة عمل (Tier C Export):
من خلال واجهة إدارة المنصة أو واجهة API عبر الإجراء:
`platformAdmin.backup.exportWorkspace({ workspaceId: 1 })`
تُنتج هذه العملية ملف أرشيف JSON موقّعاً ببصمة `SHA-256` لحمولة البيانات لضمان عدم التلاعب.

#### استعادة نسخة احتياطية (Tier C Restore / Clone):
تتوفر الاستعادة بوضعين:
1. **وضع الاستنساخ (Clone Mode)**:
   - ينشئ مساحة عمل جديدة تماماً بمعرف جديد.
   - يعيد تعيين كافة المفاتيح الأساسية والأجنبية الثانوية (`idMaps`) لضمان عدم تعارض المعرفات.
   - يعيد ربط المفاتيح الثانوية التالية بدقة:
     - `special_asset_valuations.assetId`
     - `special_asset_valuations.financialEventId` (مع الحفاظ على القيمة الفارغة إذا كانت `null`)
     - `special_asset_valuations.profileId`
     - `debt_payments.financialEventId`
     - `insurance_premium_payments.financialEventId`
     - `insurance_claims.receivedEventId`
     - `personal_ious.settlementEventId`
     - `zakat_assessments.paymentEventId`
     - `approval_requests.executedEventId`
     - `bank_statement_rows.matchedEventId`
     - `lot_transfers.transferEventId`
     - `insurance_policies.cashFlowCategoryId`
2. **وضع الاستبدال (Overwrite Mode)**:
   - يحذف كافة سجلات المساحة الحالية بترتيب عكسي صارم للاعتماديات (`reverseDefs`).
   - يعيد إدراج السجلات بالترتيب الصحيح.

---

### 7. إدارة وصول المدقق المالي المستقل (Auditor Portal Operations)

بموجب متطلبات Phase 14، يمتلك المدقق المالي المستقل بوابة قراءة مخصصة خارج صلاحيات الأعضاء العاديين.

#### إصدار رمز وصول المدقق (Auditor Access Token):
يتم الإصدار بواسطة المستشار المالي أو مالك المساحة عبر تحديد النطاقات المسموحة:
- `reports` / `financial_statements`: استعراض حزمة القوائم المالية المعتمدة وميزان المراجعة.
- `reconciliation`: استعراض تقرير مطابقة الأستاذ وتوازن القيود.
- `zakat`: استعراض سجل التقييمات الزكوية.
- `lot_accounting`: استعراض سجل اللوتات وتكلفة الأساس وفق معيار FIFO.

الرمز الناتج يحمل البادئة `faud.` وهو موقع رقمياً بـ HMAC-SHA256 ومحدد بمدة زمنية وتاريخ انتهاء.

#### إلغاء الوصول الفوري (Instant Revocation):
عند انتهاء مهمة التدقيق أو الاشتباه في تسريب الرمز، يقوم مالك المساحة بالضغط على "إلغاء الصلاحية" في لوحة التحكم، مما يسجل حدث تدقيق `auditor_token.revoked`، ويمنع الرمز من تنفيذ أي استعلام فوري.

---

### 8. تدوير المفاتيح والأسرار الأمنية (Secret Rotation)

#### تدوير `JWT_SECRET` و `AUDITOR_PORTAL_JWT_SECRET`:
1. توليد مفتاح عشوائي مشفر جديد (طوله 64 محرفاً هيداسيديمال):
   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```
2. تحديث المتغير في ملف `.env`.
3. إعادة تشغيل حاوية التطبيق: `docker compose up -d app`.
4. ملاحظة: الرموز الصادرة بالمفتاح القديم ستصبح غير صالحة فوراً، ويتعين إعادة إصدار رموز المدققين النشطين.

#### تدوير `VAULT_ENCRYPTION_SECRET`:
- الخزنة تستخدم تشفير AES-256-GCM. عند الرغبة في تدوير مفتاح الخزنة، يجب تشغيل أداة إعادة التشفير للملفات المخزنة قبل اعتماد المفتاح الجديد.

---

### 9. دليل معالجة الحوادث والأعطال (Incident Triage)

| العَرَض | السبب المحتمل | إجراء المعالجة |
|---|---|---|
| `GET /readyz` يُرجع 503 | مجمع اتصالات MySQL ممتلئ أو قاعدة البيانات غير مستجيبة | التحقق من سجلات `docker compose logs mysql` وزيادة `DB_CONNECTION_LIMIT` في `.env` |
| فشل إغلاق الفترة المالية وظهور خطأ في الخزنة | فشل حفظ ملف الأرشيف أو تعذر الاتصال بـ S3 | التحقق من تنفيذ آلية التنظيف التعويضي `storageDelete` ومراجعة أذونات مسار الخزنة |
| رفض تشغيل الخادم مع رسالة `[FATAL] JWT_SECRET` | المفتاح السري غير محدد أو طوله أقل من 32 محرفاً | تعيين مفتاح عشوائي آمن بطول 32 محرفاً على الأقل في `.env` وإعادة التشغيل |
| خطأ تضارب المفاتيح الأجنبية عند استعادة المساحة | وجود سجلات غير محذوفة في وضع الاستبدال | تشغيل الاستعادة بوضع الاستنساخ `clone` لعزل المساحة المستعادة تماماً |

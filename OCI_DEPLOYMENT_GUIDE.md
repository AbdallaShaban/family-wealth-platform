# دليل النشر والتشغيل على Oracle Cloud Infrastructure (OCI) Free Tier
## منصة FAMILY Wealth Intelligence

يقدم هذا الدليل خطوات نشر المنصة بالكامل داخل بيئة **Oracle Cloud Always Free Tier** باستخدام **Docker** و**Docker Compose** مع تأمين كامل لقاعدة البيانات والاتصالات.

---

## 1. مواصفات الخادم الموصى بها في OCI Free Tier
- **نوع المعالج (Shape):** `VM.Standard.A1.Flex` (معالجات Ampere ARM64)
- **الموارد:** 2 إلى 4 OCPUs | 12 إلى 24 GB RAM (متاحة مجاناً دائماً في حساب OCI Free Tier)
- **نظام التشغيل:** Ubuntu 22.04 LTS أو Ubuntu 24.04 LTS (Minimal AArch64)
- **سعة القرص:** 50 إلى 100 GB Boot Volume

---

## 2. الإعداد الأولي للخادم وتثبيت Docker
اتصل بالخادم عبر SSH، ثم قم بتحديث الحزم وتثبيت Docker و Docker Compose:

```bash
# 1. تحديث النظام
sudo apt update && sudo apt upgrade -y

# 2. تثبيت الحزم الأساسية و Docker
sudo apt install -y curl git ufw fail2ban

# تثبيت محرك Docker الرسمي
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# إضافة المستخدم الحالي لمجموعة Docker
sudo usermod -aG docker $USER
newgrp docker

# التحقق من الإصدار
docker --version
docker compose version
```

---

## 3. ضبط الجدار الناري (Firewall & OCI Security List)
في لوحة تحكم OCI (Virtual Cloud Network -> Security Lists -> Ingress Rules)، تأكد من فتح المنافذ المطلوبة:
- منفذ SSH: `22` (TCP)
- منفذ HTTP: `80` (TCP)
- منفذ HTTPS: `443` (TCP)

وعلى نظام Ubuntu داخل الخادم:
```bash
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

---

## 4. سحب المشروع وإعداد المتغيرات البيئية

```bash
# استنساخ المستودع
git clone https://github.com/AbdallaShaban/family-wealth-platform.git
cd family-wealth-platform

# إنشاء ملف البيئة من النموذج
cp .env.example .env

# تعديل كلمات المرور ومفاتيح التشفير
nano .env
```

> **ملاحظة أمنية هامة:**
> تأكد من تغيير قيم `DB_ROOT_PASSWORD` و `DB_PASSWORD` و `JWT_SECRET` (يجب أن يكون أطول من 32 حرفاً عشوائياً).
> يمكنك توليد مفاتيح عشوائية فائقة الأمان عبر:
> ```bash
> openssl rand -base64 32
> ```

---

## 5. تشغيل المنصة عبر Docker Compose

لبناء الحزم وتشغيل الخدمات (MySQL + App Engine) في الخلفية:

```bash
# بناء وتشغيل الحاويات
docker compose up -d --build

# متابعة السجلات والتأكد من نجاح التهيئة وترحيل قاعدة البيانات
docker compose logs -f
```

ستقوم حاوية `family_app` بتنفيذ التالي تلقائياً عند الإقلاع:
1. فحص الاتصال بقاعدة بيانات MySQL وانتظار اكتمال جاهزيتها.
2. تطبيق كافة ترحيلات قواعد البيانات (`drizzle-kit migrate` لـ 36 ملف ترحيل).
3. فحص مجسات الجاهزية (`/readyz`).
4. بدء استقبال الطلبات على المنفذ `3000`.

---

## 6. التحقق من جاهزية الخدمة
```bash
# فحص حالة الحاويات
docker compose ps

# اختبار نقطة فحص الجاهزية
curl -i http://localhost:3000/readyz
```

الاستجابة الصحيحة: `HTTP/1.1 200 OK` مع حالة جاهزية الاتصال بقاعدة البيانات.

---

## 7. الربط بنطاق خارجي وشهادة SSL مجانية (خياران)

### الخيار (أ): عبر Cloudflare Zero-Trust Tunnel (الأسهل والأكثر أماناً - بدون فتح منافذ)
1. أنشئ Tunnel في حساب Cloudflare.
2. أضف `CLOUDFLARE_TUNNEL_TOKEN` في ملف `.env`.
3. شغّل البروفايل الخاص بالنفق:
```bash
docker compose --profile tunnel up -d
```

### الخيار (ب): عبر Nginx Reverse Proxy و Let's Encrypt
```bash
sudo apt install -y nginx certbot python3-certbot-nginx
```
قم بتهيئة Nginx لتوجيه حركة المرور من المنفذ 80/443 إلى `http://127.0.0.1:3000` واستخراج شهادة SSL بضغطة زر:
```bash
sudo certbot --nginx -d your-domain.com
```

---

## 8. النسخ الاحتياطي الدوري التلقائي (Cron Job)
لجدولة أخذ نسخة احتياطية يومية من قاعدة بيانات MySQL:
```bash
# فتح جدول المهام
crontab -e

# أضف السطر التالي لأخذ نسخة احتياطية يومياً في الساعة 3 فجراً
0 3 * * * docker exec family_mysql mysqldump -u family -p$(grep DB_PASSWORD /home/ubuntu/family-wealth-platform/.env | cut -d '=' -f2) family_db | gzip > /home/ubuntu/backups/family_db_$(date +\%F).sql.gz
```

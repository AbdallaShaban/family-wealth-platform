# دليل GitHub السريع لمنصة FAMILY

## قبل أول رفع

أنشئ مستودعًا فارغًا على GitHub من دون إضافة README أو `.gitignore` أو License إذا كان المصدر المحلي يحتوي على هذه الملفات. لا تضع كلمات مرور SMTP أو مفاتيح OAuth أو أي ملف `.env` في المستودع. راجع `.gitignore` قبل كل رفع، واحتفظ بالأسرار في إعدادات البيئة الخاصة بالاستضافة أو في مدير أسرار منفصل.

## إذا كانت لديك نسخة ZIP فقط

بعد فك الأرشيف والدخول إلى مجلد المشروع، نفّذ:

```bash
git init
git branch -M main
git remote add origin https://github.com/USERNAME/REPOSITORY.git
git add .
git commit -m "Import FAMILY source"
git push -u origin main
```

استبدل `USERNAME/REPOSITORY` بعنوان مستودعك. عند طلب GitHub للتفويض، استخدم GitHub CLI أو مدير بيانات اعتماد موثوقًا؛ لا تضع Personal Access Token داخل أمر محفوظ في سجل الطرفية أو داخل ملفات المشروع.

## تحديثات لاحقة

بعد تعديل الكود أو إضافة ميزة وتشغيل الفحوص، نفّذ:

```bash
git status
git add .
git commit -m "Describe the change"
git pull --rebase origin main
git push origin main
```

إذا كان المستودع يعمل عليه أكثر من شخص، راجع `git status` ونتيجة `git pull --rebase` قبل الدفع. لا تستخدم `git add -f` لملفات البيئة أو ملفات الأسرار. للفروع والميزات الأكبر، أنشئ فرعًا ثم افتح Pull Request بدل الدفع المباشر إلى `main`.

## فحوص محلية قبل Push

```bash
pnpm install
pnpm check
pnpm test
pnpm build
```

يجب إدخال قيم الإنتاج مثل Gmail App Password عبر مدير الأسرار في بيئة التشغيل فقط. في FAMILY يبقى `SMTP_SEND_ENABLED` غير مفعّل افتراضيًا، ولا ينبغي تغييره إلى `yes` إلا بعد اختبار اتصال SMTP والموافقة على إرسال رسالة اختبار.

## بديل آمن باستخدام GitHub CLI

إذا كان `gh auth login` مهيأً على جهازك، يمكن إنشاء المستودع ورفعه عبر:

```bash
gh repo create USERNAME/REPOSITORY --private --source=. --remote=origin --push
```

اختر `--private` إذا كان المصدر يتضمن بنية تشغيلية أو وثائق داخلية، وراجع صلاحيات المستودع بعد الإنشاء. لا أُدرج أي Token أو سر في هذا الملف.

## التحقق بعد Push

بعد اكتمال الدفع إلى GitHub، نفّذ الأوامر التالية من مجلد المشروع:

```bash
git branch --show-current
git log -1 --stat
git remote -v
git status
```

يجب أن يظهر الفرع `main`، وأن يعرض آخر commit الملفات المتوقعة، وأن يشير Remote إلى مستودعك. افتح تبويب **Code** في GitHub وراجع أن `package.json` و`drizzle/` و`server/` و`client/` وملفات الوثائق موجودة، وأن `node_modules/` و`dist/` و`.env` غير موجودة.

للفحص المحلي الإضافي قبل أو بعد الدفع، استخدم:

```bash
git ls-files | grep -E '(^|/)(\.env($|\.)|node_modules/|dist/)' && echo "راجع الملفات المستثناة" || echo "لا توجد مسارات مستثناة متتبعة"
git grep -nE 'BEGIN (RSA|OPENSSH|PRIVATE) KEY|SMTP_PASS=|RESEND_API_KEY=' -- . ':!GITHUB_PUSH_QUICKSTART.md' || true
```

إذا ظهر سر حقيقي أو ملف بيئة، أوقف الدفع، أزل الملف من التتبع، ودوّر السر فورًا من مزود الخدمة. لا تعتبر ظهور اسم المتغير `SMTP_PASS` في كود قراءة البيئة تسريبًا؛ الممنوع هو قيمة كلمة المرور نفسها.

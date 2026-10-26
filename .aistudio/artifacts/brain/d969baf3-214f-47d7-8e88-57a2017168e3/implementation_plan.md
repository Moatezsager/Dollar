# خطة تحسين وترتيب سجل اتصالات الزوار (Visitor Log Sorting & Enhancements)

تحدد هذه الخطة الخطوات البرمجية لتحسين طريقة فرز وترتيب سجل اتصالات الزوار وفق تفضيلات المستخدم المعتمدة، مع إضافة عناصر تحكم تفاعلية أنيقة وتأمين استقرار بيئة النشر.

---

## 1. أهداف التطوير (User Intent & Objectives)

1. **الترتيب الذكي الافتراضي لسجل الزوار**:
   - تثبيت الزوار المتصلين حاليًا (`isOnline === true`) في أعلى القائمة بشكل دائم لسهولة متابعة النشاط الحي.
   - ترتيب باقي السجلات تنازليًا حسب توقيت أحدث اتصال أو نشاط (`last_active || timestamp`) بدقة.

2. **أزرار فرز تفاعلية (Interactive Sorting Controls)**:
   - إضافة شريط تحكم فرز مرن وسريع الاستجابة يحتوي على خيارات:
     - **الترتيب الذكي (الافتراضي)**: المتصلون الآن أولاً ثم الأحدث نشاطًا.
     - **الأحدث نشاطًا**: ترتيب زمني صارم من الأحدث إلى الأقدم.
     - **الأكثر اتصالاً**: ترتيب تنازلي حسب عدد مرات الاتصال والزيارات (`visits`).
   - تصميم الأزرار وفق معايير `frontend-design` (Segmented control نظيف، بدون إطارات كبسولية فوضوية، وبارتفاع لمسي مريح $\ge 44\text{px}$).

3. **معالجة استقرار بيئة النشر (Deployment Stability)**:
   - معالجة تحقق `server/db.ts` لضمان عدم تعطل السيرفر عند غياب مفتاح `SUPABASE_SERVICE_ROLE_KEY` في بيئات الحاويات السحابية، والاعتماد السلس على المفتاح المتاح مع تسجيل تحذير بدلاً من إيقاف الخدمة بالكامل.

---

## 2. الهندسة والتصميم (Architecture & UI Design)

### أ. منطق الفرز في واجهة المستخدم (`src/components/AdminTracking.tsx`)
- تعريف حالة الفرز: `const [sortBy, setSortBy] = useState<'smart' | 'recent' | 'visits'>('smart');`.
- دالة الفرز المطبقة على قائمة `filtered`:
  ```ts
  const sortedLogs = [...filtered].sort((a, b) => {
    const timeA = new Date(a.last_active || a.timestamp || 0).getTime();
    const timeB = new Date(b.last_active || b.timestamp || 0).getTime();
    if (sortBy === 'visits') {
      const visitsA = Number(a.visits) || 1;
      const visitsB = Number(b.visits) || 1;
      if (visitsB !== visitsA) return visitsB - visitsA;
      return timeB - timeA;
    }
    if (sortBy === 'recent') {
      return timeB - timeA;
    }
    // smart: المتصلون أولاً ثم الأحدث
    if (Boolean(a.isOnline) !== Boolean(b.isOnline)) {
      return a.isOnline ? -1 : 1;
    }
    return timeB - timeA;
  });
  ```

### ب. شريط التحكم بالتنسيقات المتجاوبة (`src/styles/admin-analytics.css`)
- إضافة أزرار فرز مدمجة (`.visitor-sort-bar`) تندمج بسلاسة بجانب حقل البحث وفلاتر الأجهزة.
- دعم كامل للهواتف الذكية بحيث تلتف عناصر الفرز وتتسع أفقياً دون تشويه شريط التمرير أو تقليص مساحة حقول البحث.

---

## 3. خطوات التنفيذ (Step-by-Step Implementation)

1. **الخطوة الأولى**: تحديث `src/components/AdminTracking.tsx` لإضافة منطق الفرز التفاعلي وأزرار التحكم.
2. **الخطوة الثانية**: تحديث `src/styles/admin-analytics.css` لتنسيق شريط الفرز ودعم شاشات الحواسيب والهواتف.
3. **الخطوة الثالثة**: ضبط شرط فحص مفاتيح Supabase في `server/db.ts` لضمان استقرار إقلاع السيرفر في بيئة السحاب.
4. **الخطوة الرابعة**: تشغيل اختبارات النظام (`tests/visitor-details.cjs` و`tests/analytics.cjs`) وفحص البناء عبر `compile_applet`.

---

## 4. معايير القبول (Acceptance Criteria)

- [ ] ظهور المتصلين حاليًا تلقائيًا في أعلى القائمة مع استمرار التحديث الحي.
- [ ] إمكانية التبديل الفوري بين (الذكي، الأحدث، الأكثر زيارة) بنقرة واحدة ودون إعادة طلب البيانات.
- [ ] توافق شريط الفرز وأزراره مع شاشات الهواتف والحواسيب بدون تجاوز لحجم الشاشة.
- [ ] اجتياز كافة الاختبارات الآلية والتحقق من سلامة البناء.

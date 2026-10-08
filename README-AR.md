# مهارات Codex لمشروع Dollar Price

## الخيار الموصى به: مهارات عامة مشتركة
انسخ المجلدات الثلاثة الموجودة داخل `.agents/skills/` إلى:

- Windows: `%USERPROFILE%\.agents\skills\`
- macOS/Linux: `~/.agents/skills/`

ليصبح مثلًا: `~/.agents/skills/dollar-rates-diagnostics/SKILL.md`.

هذا يسمح باستخدام المهارات من أي مشروع دون خلط المجلدين.

## تعليمات خاصة بكل مشروع
انسخ `Dollar-main/AGENTS.md` إلى جذر مشروع Web الخاص بك.
انسخ `worker_server-main/AGENTS.md` إلى جذر مشروع Worker الخاص بك.
لا تضع مجلد مشروع داخل المشروع الآخر.

## بديل: تثبيت المهارات داخل كل مشروع
انسخ `.agents/skills/` إلى جذر كل مشروع بشكل مستقل، أي:
`Dollar-main/.agents/skills/` و `worker_server-main/.agents/skills/`.
في هذه الحالة لا تحتاج إلى تثبيت عام أيضًا.

## الاستعمال
في Codex اطلب مثلًا:
- `$dollar-rates-diagnostics افحص سبب ثبات الدولار واليورو دون تعديل الملفات أولًا.`
- `$safe-project-refactor أصلح الخلل المحدد بأقل تغيير ممكن وشغّل الاختبارات.`
- `$render-resource-optimizer راجع استهلاك RAM وCPU دون تعطيل تحديث الأسعار.`

## ملاحظات
- لا تضع كلمات المرور أو مفاتيح Supabase أو Render داخل SKILL.md أو AGENTS.md.
- ملفات AGENTS.md تعليمات للمشروع، وليست ملفات تشغيل ولا تغير الكود تلقائيًا.
- إذا كانت المجلدات مفتوحة في جلسات Codex مختلفة، افتح كل جلسة في جذر المشروع الصحيح.

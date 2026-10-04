# تجربة مِيزان على نموذج محلي (2 أكتوبر 2026، فجرًا)

**الغرض:** التحقق من أن المحرك يعمل فعلًا على نموذج يُشغَّل داخل جهاز (أو مصرف)، لا قياس الجودة.

**أين ومتى:**
- **الجهاز:** جهاز مازن (Apple M5، ذاكرة 24 GB).
- **الخادم:** Ollama 0.35.0، مثبّت بـ`brew install ollama`، على `http://localhost:11434/v1`.
- **النموذج:** `qwen3:14b`، المقابل لـ`Qwen/Qwen3-14B` على Hugging Face برخصة Apache-2.0.
- **الإعداد:** سياق 16384 رمزًا، والنموذج كله على GPU (`offloaded 41/41 layers to GPU`).
- **الوقت:** بين 02:20 و02:35 بتوقيت الرياض.
- **الإنترنت:** نداءات النموذج كلها إلى `127.0.0.1`، أي لا إنترنت فيها.

**الأداة:** `mizan-web.nosync/tools/local-model-trial.ts`.
- تشغّل خطوات المحرك نفسها: الاستعلام، ثم البحث، ثم الحكم، ثم بوابة الكود `verifyJudgement`.
- ومهلتها طويلة تناسب حاسوبًا محمولًا.
- لإعادتها:
```bash
OLLAMA_CONTEXT_LENGTH=16384 ollama serve &
MIZAN_LLM_BASE_URL=http://localhost:11434/v1 MIZAN_LLM_MODEL=qwen3:14b npx tsx tools/local-model-trial.ts 5 1 4 10
```

**المخرجات الخام (كما طبعتها الأداة):**
```
{"n":5,"expected":"nonCompliant","model":"nonCompliant","afterGate":"nonCompliant","citations":["الإنماء/ق7/ثالثاً/2"],"droppedByGate":[],"verbatim":true,"secs":190}
{"n":1,"expected":"nonCompliant","model":"compliant","afterGate":"compliant","citations":["الإنماء/ق88/ثانياً/1"],"droppedByGate":[],"verbatim":true,"secs":177}
{"n":4,"expected":"compliant","model":"compliant","afterGate":"compliant","citations":["الإنماء/ق7/ثالثاً/4"],"droppedByGate":[],"verbatim":true,"secs":207}
{"n":10,"expected":"abstain","model":"abstain","afterGate":"abstain","citations":[],"droppedByGate":[],"verbatim":false,"secs":136}
```

**سجل خادم Ollama:** 8 نداءات، أي نداءان لكل بند (الاستعلام ثم الحكم):
```
[GIN] 2026/10/02 - 02:24:12 | 200 |         1m40s |       127.0.0.1 | POST     "/v1/chat/completions"
[GIN] 2026/10/02 - 02:25:42 | 200 |         1m29s |       127.0.0.1 | POST     "/v1/chat/completions"
[GIN] 2026/10/02 - 02:27:15 | 200 |         1m17s |       127.0.0.1 | POST     "/v1/chat/completions"
[GIN] 2026/10/02 - 02:28:55 | 200 |         1m40s |       127.0.0.1 | POST     "/v1/chat/completions"
[GIN] 2026/10/02 - 02:30:04 | 200 |          1m9s |       127.0.0.1 | POST     "/v1/chat/completions"
[GIN] 2026/10/02 - 02:32:22 | 200 |         2m17s |       127.0.0.1 | POST     "/v1/chat/completions"
[GIN] 2026/10/02 - 02:33:19 | 200 | 57.168744208s |       127.0.0.1 | POST     "/v1/chat/completions"
[GIN] 2026/10/02 - 02:34:37 | 200 |         1m18s |       127.0.0.1 | POST     "/v1/chat/completions"
```

**الخلاصة:**
- وافق المتوقع في 3 من 4: البند 5 مخالف (عينة)، والبند 4 مطابق، والبند 10 امتناع.
- وخالفه في البند 1:
  - حكم «مطابق» مستشهدًا بـ`ق88/ثانياً/1`.
  - والمتوقع «مخالف» بـ`ق7/ثالثاً/1`، لأن البند فيه وعد ملزم.
- كل الاقتباسات حرفية، ومرّت من البوابة.
- **الدرس:** البوابة تضمن أن السند حقيقي، لا أن الحكم صحيح. فيُقاس النموذج الذي يختاره المصرف قبل التشغيل.

**ما لم ينجح:**
- `qwen3.8:27b` لا يتسع على GPU في جهاز 24 GB، فجزء منه على المعالج (18%) وسرعته نحو 3 رموز في الثانية.
- وسياق Ollama الافتراضي (4096) يقصّ طلب الحكم، فأُوقفت التجربة عليه.
- **فلا يُقال إن مِيزان شُغّل على Qwen3.8.**

**الحدود:** 4 بنود فقط، وتشغيل واحد. تجربة توصيل، لا قياس.

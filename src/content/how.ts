// Copy for /how. Every claim here maps to code (src/server/engine/*) or to a recorded result:
// the walkthrough data is src/content/how-trace.json (a real run, held to the code by
// how-trace.test.ts); the general-model experiment is الوثائق/02_بحث_المنافسين.md §4 (2026-10-01);
// the measured numbers are HANDOFF §5. No competitor names, no "hallucinates", no "more accurate than".
import type { L } from "@/lib/review-types";

type Station = { key: string; name: L; what: L; why: L };

export const HOW = {
  meta: {
    title: { ar: "كيف يعمل مِيزان", en: "How Mizan works" },
    description: {
      ar: "رحلة بند واحد داخل محرك مِيزان، خطوة بخطوة، من تشغيل حقيقي.",
      en: "One clause through Mizan's engine, step by step, from a real run.",
    },
  },
  title: { ar: "رحلة بند حقيقي، خطوة بخطوة", en: "One real clause, step by step" },
  diagramTitle: { ar: "كيف يعمل مِيزان", en: "How Mizan works" },
  diagramLead: {
    ar: "ثلاثة مسارات: الكود، والنموذج، والإنسان. البند يمر بينها، فيظهر أن النموذج لا يعمل وحده: كل ما يخرج منه يراجعه الكود، والإنسان في النهاية فقط. اضغط أي محطة لتفاصيلها، وتحت المخطط الرحلة نفسها خطوة بخطوة على بند حقيقي.",
    en: "Three lanes: code, model and people. The clause moves between them, so you can see the model never works alone: code checks whatever it returns, and people come in only at the end. Tap any station for its details; below, the same path step by step on a real clause.",
  },
  lead: {
    ar: "تابع بندًا واحدًا من العقد التوضيحي في رحلته داخل المحرك. كل ما تراه في هذه الرحلة من تشغيل حقيقي للكود المنشور على الموقع، لا رسم توضيحي.",
    en: "Follow one clause of the demonstration contract through the engine. Everything on this journey comes from a real run of the code deployed on this site, not an illustration.",
  },
  automated: {
    ar: "آلي بالكامل من الرفع إلى ملف المراجعة. لا إنسان داخل الفحص.",
    en: "Fully automated from upload to review file. No human inside the review.",
  },
  controls: {
    play: { ar: "تشغيل تلقائي", en: "Play" },
    pause: { ar: "إيقاف", en: "Pause" },
    next: { ar: "الخطوة التالية", en: "Next step" },
    prev: { ar: "السابقة", en: "Previous" },
    step: { ar: "الخطوة", en: "Step" },
    of: { ar: "من", en: "of" },
    keys: { ar: "الأسهم تنقل بين الخطوات", en: "Arrow keys move between steps" },
  },
  whatLabel: { ar: "ما يحدث", en: "What happens" },
  whyLabel: { ar: "لماذا يهم", en: "Why it matters" },
  stations: [
    {
      key: "mask",
      name: { ar: "يُخفي", en: "Masks" },
      what: {
        ar: "قبل أي إرسال للنموذج، يستبدل الكود أرقام الهوية والآيبان والجوال والبطاقات وغيرها بوسوم.",
        en: "Before anything reaches the model, code replaces ID, IBAN, phone, card and other numbers with tags.",
      },
      why: {
        ar: "النموذج لا يحتاج بيانات العميل ليحكم على صياغة البند. ما لا يُرسل لا يُسرَّب.",
        en: "The model does not need customer data to judge a clause's wording. What is never sent cannot leak.",
      },
    },
    {
      key: "split",
      name: { ar: "يقطّع", en: "Chunks" },
      what: {
        ar: "يقسم العقد إلى أجزاء. العقد المرقّم يُقطَّع بالكود وحده، وغيره بالنموذج، ثم يتحقق الكود أن كل جزء منسوخ من العقد حرفيًا.",
        en: "Splits the contract into parts. A numbered contract is split by code alone, others by the model, and code checks every part is copied verbatim.",
      },
      why: {
        ar: "كل بند يُحكم عليه وحده بسنده. ولا يضيع سطر: أي سطر جوهري يسقطه النموذج يُعاد.",
        en: "Each clause is judged on its own evidence. No line is lost: any substantive line the model drops is put back.",
      },
    },
    {
      key: "sort",
      name: { ar: "يفرز", en: "Classifies" },
      what: {
        ar: "ليس كل سطر في العقد بندًا. النموذج يصنّف كل جزء: بند يُفحص، أو تمهيد لبنود تالية يُفحص من خلالها، أو ليس بندًا (عنوان، مصدر، فاصل، تعريف أطراف، توقيع) فلا يُفحص. والكود يفرض فحص أي جزء فيه التزام مهما صنّفه النموذج.",
        en: "Not every line of a contract is a clause. The model labels each part: a clause to review, an intro reviewed through the items after it, or not a clause (title, source, separator, party details, signature), which is skipped. Code forces a review of any part with obligation language, whatever the model says.",
      },
      why: {
        ar: "العقود المنشورة على الإنترنت فيها عناوين ومصادر وفواصل. بلا فرز تظهر هذه «بنودًا» بلا سند، فيضيع وقت المدقق.",
        en: "Contracts published online carry titles, source notes and separators. Without sorting they show up as «clauses» with no evidence, and waste the auditor's time.",
      },
    },
    {
      key: "retrieve",
      name: { ar: "يسترجع", en: "Retrieves" },
      what: {
        ar: "يضيف النموذج إلى ألفاظ البند التجارية مصطلحاتها الفقهية، ثم يبحث الكود بالكلمات (BM25) في ٢٧١٩ وحدة من قرارات اللجنة، في نصها وفي نسخة مضاف إليها جمل بلغة العقود، ويختار المرشحين.",
        en: "The model adds fiqh terms to the clause's commercial wording; code then runs a BM25 keyword search over the committee's 2,719 decision units, in their own text and in a copy enriched with contract-style sentences, and picks the candidates.",
      },
      why: {
        ar: "العقد لا يقول «عينة»، والقرار يقولها. ربط اللغتين هو ما يجعل البحث يجد القرار الحاكم.",
        en: "The contract never says ʿīna; the decision does. Bridging the two vocabularies is what finds the governing decision.",
      },
    },
    {
      key: "judge",
      name: { ar: "يحكم", en: "Judges" },
      what: {
        ar: "يقرأ النموذج البند والمرشحين فقط، ويعيد حكمًا منظّمًا: الحكم، والاستشهاد بنصه، ودور كل استشهاد، وهل نطاق القرار يشمل البند.",
        en: "The model reads only the clause and the candidates, and returns a structured verdict: the ruling, each citation with its text and role, and whether the decision's scope covers the clause.",
      },
      why: {
        ar: "التعليمات تمنعه من معرفته الفقهية العامة: قرار اللجنة هو الحاكم، لا رأي النموذج.",
        en: "Its instructions bar its general fiqh knowledge: the committee's decision governs, not the model's opinion.",
      },
    },
    {
      key: "gate",
      name: { ar: "يتحقق", en: "Verifies" },
      what: {
        ar: "الكود، لا النموذج، يقرر ما يُعرض: يُسقط أي استشهاد ليس من المرشحين أو ليس حرفيًا في نص القرار، ولا يقبل «مخالف» إلا بوحدة فيها منع أو شرط صريح، ولا «مطابق» إلا بمثلها أو بإجازة صريحة للفعل نفسه.",
        en: "Code, not the model, decides what is shown: it drops any citation that is not a candidate or not verbatim in the decision text, and accepts «non-compliant» only on a unit with an explicit prohibition or condition, and «compliant» only on such a unit or an explicit permission of the same act.",
      },
      why: {
        ar: "لا نتّكل على أن النموذج «غالبًا» يقتبس صحيحًا. ما لا يمر من البوابة لا يصل المدقق.",
        en: "We do not rely on the model quoting correctly «most of the time». What fails the gate never reaches the auditor.",
      },
    },
    {
      key: "file",
      name: { ar: "يسلّم", en: "Delivers" },
      what: {
        ar: "يرتّب البنود بالأولوية في ملف مراجعة: المخالف أولًا، ثم ما يحتاج مراجعة، ثم ما لا سند له، ثم المطابق. لكل بند سنده وسببه.",
        en: "Orders the clauses by priority in a review file: non-compliant first, then needs review, then no evidence, then compliant. Each clause carries its evidence and reason.",
      },
      why: {
        ar: "هنا ينتهي الآلي ويبدأ دور اللجنة: تعتمد الملاحظة أو ترفضها أو تحيلها للدراسة، على ملف جاهز بأدلته.",
        en: "This is where automation ends and the committee begins: it approves, rejects or refers each finding, on a finished file with its evidence.",
      },
    },
  ] satisfies Station[],
  data: {
    before: { ar: "قبل", en: "Before" },
    after: { ar: "بعد", en: "After" },
    maskNote: { ar: "سطر توضيحي مرّ على دالة الإخفاء نفسها التي يمر بها كل عقد.", en: "An illustrative line, run through the same masking function every contract goes through." },
    splitCount: { ar: "العقد التوضيحي مرقّم: {n} بنود، بالكود وحده بلا نموذج.", en: "The demonstration contract is numbered: {n} clauses, by code alone, no model." },
    sortNote: {
      ar: "أضفنا للعقد التوضيحي ما يأتي عادة في رأس العقود المنشورة (عنوان، وسطر مصدر، وفاصل)، ومررناه على خطوة الفرز الحقيقية: {s} ثوانٍ، و{usd} دولار.",
      en: "We gave the demonstration contract the header lines published contracts usually carry (a title, a source line, a separator) and ran it through the real sorting step: {s} s, ${usd}.",
    },
    sortKeep: { ar: "بنود تُفحص", en: "Clauses to review" },
    sortOut: { ar: "ليس بندًا", en: "Not a clause" },
    sortTypes: {
      ar: { title: "عنوان", source: "مصدر النص", separator: "فاصل", parties: "أطراف", definition: "تعريف", signature: "توقيع", fragment: "سطر مقطوع", note: "ملاحظة" },
      en: { title: "Title", source: "Source", separator: "Separator", parties: "Parties", definition: "Definition", signature: "Signature", fragment: "Fragment", note: "Note" },
    },
    sortReplay: { ar: "أعد الفرز", en: "Sort again" },
    thisClause: { ar: "البند الذي نتابعه", en: "The clause we follow" },
    noTerm: { ar: "لا يرد في البند لفظ «عينة».", en: "The word ʿīna does not appear in the clause." },
    added: { ar: "مصطلحات أضافها النموذج للبحث", en: "Terms the model added to the search" },
    candidates: { ar: "{c} مرشحًا من {u} وحدة. القرار الحاكم في المرتبة {r}.", en: "{c} candidates from {u} units. The governing decision ranks {r}." },
    keywordNote: {
      ar: "البحث بألفاظ البند وحدها وجد القرار هنا أيضًا. وفي قياسنا لبنود فجوة المصطلح (١٠ بنود فقط) وجد البحث بالكلمة ٨٠٪، ومِيزان بين ٨٠٪ و١٠٠٪ عبر التشغيلات. والفرق الأوضح في الدقة: ٩٦٪ لمِيزان مقابل ٤٨٪.",
      en: "Searching with the clause's own words found the decision here too. On our term-gap clauses (only 10) keyword search found 80%, and Mizan between 80% and 100% across runs. The clearer difference is precision: 96% for Mizan against 48%.",
    },
    verdict: { ar: "الحكم", en: "Verdict" },
    scope: { ar: "النطاق يشمل البند", en: "Scope covers the clause" },
    yes: { ar: "نعم", en: "yes" },
    reason: { ar: "السبب", en: "Reason" },
    roles: { governs: { ar: "يحكم", en: "governs" }, supports: { ar: "يدعم", en: "supports" }, related: { ar: "قريب", en: "related" } },
    checkCandidate: { ar: "من المرشحين", en: "Among the candidates" },
    checkLiteral: { ar: "الاقتباس حرفي في نص القرار", en: "Quote is verbatim in the decision" },
    checkRule: { ar: "الوحدة فيها منع أو شرط، فيصح أن يُبنى عليها الحكم", en: "Unit states a prohibition or condition, so a verdict may rest on it" },
    checkShown: { ar: "سند داعم يُعرض للمدقق، ولا يُبنى عليه الحكم", en: "Supporting evidence, shown to the auditor; the verdict does not rest on it" },
    passed: { ar: "مرّ من البوابة: الحكم يبقى كما هو.", en: "Passed the gate: the verdict stands." },
    tamperOn: { ar: "جرّب: نموذج يقتبس نصًا غير موجود في القرار", en: "Try it: a model quotes text that is not in the decision" },
    tamperOff: { ar: "أعد الاقتباس الحقيقي", en: "Restore the real quote" },
    tamperQuote: { ar: "الاقتباس المزيّف", en: "The fake quote" },
    tamperResult: {
      ar: "الكود لم يجد هذا النص في القرار، فأسقط الاستشهاد. ولم تبقَ وحدة حاكمة، فتحوّل الحكم إلى «{v}».",
      en: "Code did not find this text in the decision, so it dropped the citation. With no governing unit left, the verdict became «{v}».",
    },
    tamperProof: { ar: "هذه نتيجة دالة التحقق نفسها على هذا المدخل، ويثبتها اختبار في المستودع.", en: "This is the verification function's own output for this input, pinned by a test in the repository." },
    fileNote: { ar: "نتائج العقد التوضيحي العشرة، مرتبة بالأولوية.", en: "The demonstration contract's ten results, ordered by priority." },
    committee: { ar: "قرار اللجنة", en: "Committee decision" },
    approve: { ar: "اعتماد الملاحظة", en: "Approve finding" },
    reject: { ar: "رفضها", en: "Reject" },
    refer: { ar: "إحالة للدراسة", en: "Refer for study" },
    committeeNote: { ar: "هذه الأزرار في لوحتك على كل فحص تحفظه، وتُسجَّل مع وقتها.", en: "These actions sit on every saved review in your dashboard, and are logged with their time." },
  },
  loop: {
    title: { ar: "آلي بالكامل، والقرار للجنة", en: "Fully automated, and the committee decides" },
    lead: {
      ar: "لا ينتظر الفحص أحدًا: من الرفع إلى ملف المراجعة يعمل المحرك وحده، بنفس الخطوات في كل مرة. والإنسان في نهايته فقط: اللجنة تقرر على ملف جاهز، بدل أن تقرأ العقد من الصفر.",
      en: "The review waits for no one: from upload to review file the engine runs alone, the same steps every time. People come in only at the end: the committee decides on a finished file instead of reading the contract from scratch.",
    },
    machine: { ar: "مِيزان، بلا إنسان", en: "Mizan, no human" },
    handoff: { ar: "ملف مراجعة بأدلته", en: "Review file with evidence" },
    handoffSub: { ar: "مرتّب بالأولوية، ولكل بند نص قراره وسببه.", en: "Ordered by priority; each clause with its decision text and reason." },
    human: { ar: "اللجنة الشرعية", en: "Sharia committee" },
    humanActs: { ar: "تعتمد، أو ترفض، أو تحيل", en: "Approves, rejects or refers" },
    never: { ar: "مِيزان لا يفتي ولا يعتمد. يختصر الطريق إلى القرار.", en: "Mizan never issues a fatwa or an approval. It shortens the road to the decision." },
  },
  trust: {
    title: { ar: "لماذا نثق بالنتيجة؟", en: "Why trust the result?" },
    items: [
      {
        h: { ar: "لا يستشهد إلا بما استرجعه", en: "It cites only what it retrieved" },
        p: { ar: "استشهاد بوحدة خارج قائمة المرشحين يسقط في الكود، فلا يستطيع النموذج أن يأتي بقرار من ذاكرته.", en: "A citation to a unit outside the candidate list is dropped in code, so the model cannot bring a decision from memory." },
      },
      {
        h: { ar: "الاقتباس حرفي، أو يسقط", en: "The quote is verbatim, or it is dropped" },
        p: { ar: "يطابق الكود الاقتباس مع نص القرار بعد توحيد التشكيل والتطويل والهمزات، ثم يعرض للقارئ نص القرار نفسه، لا نسخة النموذج.", en: "Code matches the quote against the decision text after normalising diacritics, tatweel and hamza, then shows the reader the decision's own text, not the model's copy." },
      },
      {
        h: { ar: "لا حكم بلا ضابط", en: "No verdict without a rule" },
        p: { ar: "«مخالف» يحتاج وحدة فيها منع أو شرط صريح، و«مطابق» يحتاج مثلها أو إجازة صريحة، ونطاقًا يشمل البند. وإلا فالبند يُرفع للمراجعة، أو يمتنع مِيزان إن لم يجد سندًا.", en: "«Non-compliant» needs a unit with an explicit prohibition or condition, «compliant» needs one or an explicit permission, and the scope must cover the clause. Otherwise the clause is escalated, or Mizan abstains when it finds no basis." },
      },
      {
        h: { ar: "القرار المعدَّل يُرصد", en: "Amended decisions are caught" },
        p: { ar: "إذا عدّل قرار لاحق القرار المستشهد به، يُنبَّه عليه ويُرفع البند للمراجعة بدل الحكم.", en: "If a later decision amended the cited one, the clause is flagged and escalated instead of judged." },
      },
      {
        h: { ar: "ويُقاس", en: "And it is measured" },
        p: { ar: "على ٧٠ بندًا اصطناعيًا: التقط ٩٣٪ من المخالف بدقة ٩٦٪، مقابل ٦٨٪ و٤٨٪ للبحث بالكلمة. وعلى ٤ عقود حقيقية كاملة (٢١ بندًا): ٧١٪ تطابقًا مع المفتاح. التحفظات في الصفحة الرئيسية.", en: "On 70 synthetic clauses: 93% of non-compliant caught at 96% precision, against 68% and 48% for keyword search. On 4 whole real contracts (21 clauses): 71% agreement with the key. Caveats on the main page." },
      },
    ],
  },
  tech: {
    title: { ar: "التقنية باختصار", en: "The technology, briefly" },
    qa: [
      {
        q: { ar: "أين القرارات؟", en: "Where are the decisions?" },
        a: { ar: "١٢١٧ قرارًا، مقسّمة إلى ٢٧١٩ وحدة، في ملفات على الخادم (١٣ ميجابايت). تُحمَّل في الذاكرة عند التشغيل، فلا حاجة لقاعدة بيانات.", en: "1,217 decisions, split into 2,719 units, in files on the server (13 MB). They load into memory at start-up, so no database is needed." },
      },
      {
        q: { ar: "كيف يجد القرار؟", en: "How does it find the decision?" },
        a: { ar: "بحث بالكلمات (BM25) في نسختين من القرارات: النص كما هو، والنص مع جمل بلغة العقود أضفناها لكل قرار. وقبل البحث يضيف النموذج للبند مصطلحاته الفقهية. فيخرج نحو ١٧ قرارًا مرشحًا.", en: "Keyword search (BM25) over two copies of the decisions: the text as is, and the text with contract-style sentences we added to each decision. Before searching, the model adds the clause's fiqh terms. About 17 candidate decisions come out." },
      },
      {
        q: { ar: "هل هو RAG؟", en: "Is it RAG?" },
        a: { ar: "نعم: نسترجع القرارات، ثم يحكم النموذج منها فقط. ونضيف بعده بوابة كود تتحقق أن كل اقتباس حرفي، وإلا تُسقطه وترفع البند للمراجعة.", en: "Yes: we retrieve decisions, then the model judges from them alone. After it comes a code gate that checks every quote is verbatim, or drops it and sends the clause to review." },
      },
      {
        q: { ar: "هل درّبتم نموذجًا؟", en: "Did you train a model?" },
        a: { ar: "لا. المعرفة في القرارات وقواعد الكود، فيتغيّر النموذج بإعداد واحد.", en: "No. The knowledge lives in the decisions and the code rules, so the model changes with one setting." },
      },
    ],
    compareTitle: { ar: "قارنّا طرق البحث: كم بندًا من ٩٠ لم يصل قراره الحاكم إلى المرشحين؟", en: "We compared search methods: of 90 clauses, how many lost their governing decision?" },
    compareLess: { ar: "الأقل أفضل", en: "Lower is better" },
    compareNote: {
      ar: "٩٠ بندًا من مجموعة الاختبار، و١٧ مرشحًا لكل بند في كل الطرق. شُغّلت النماذج على جهازنا، فلم يخرج نص القرارات.",
      en: "90 clauses from the test set, 17 candidates per clause for every method. The models ran on our own machine, so no decision text left it.",
    },
    rows: [
      { name: { ar: "البحث بالكلمات (المستخدم الآن)", en: "Keyword search (in use now)" }, model: null, missed: 6, now: true },
      { name: { ar: "البحث الدلالي وحده", en: "Semantic search alone" }, model: "Qwen3 Embedding", missed: 9 },
      { name: { ar: "البحث الدلالي وحده", en: "Semantic search alone" }, model: "BGE-M3", missed: 20 },
      { name: { ar: "الكلمات مع الدلالي", en: "Keyword + semantic" }, model: "hybrid", missed: 4 },
      { name: { ar: "الكلمات مع إعادة الترتيب", en: "Keyword + reranking" }, model: "BGE reranker", missed: 8 },
    ],
    verdict: {
      ar: "النتيجة: الدلالي وحده أضعف، وإعادة الترتيب أسوأ من البحث الحالي (٨ مقابل ٦)، ونرجّح أن السبب أن النموذج الحاكم يقرأ المرشحين كلهم ويختار منها بنفسه. والجمع بين الكلمات والدلالي أفضل ببندين من ٩٠، فنضيفه في نسخة المصرف بنموذج محلي.",
      en: "The result: semantic search alone is weaker, and reranking did worse than today's search (8 against 6); we think that is because the judging model already reads every candidate and picks for itself. Keyword plus semantic is better by two clauses out of 90, so it goes into the bank version with a local model.",
    },
  },
  general: {
    title: { ar: "ألا يكفي نموذج محادثة عام؟", en: "Isn't a general chat model enough?" },
    lead: {
      ar: "سؤال في محله، فجرّبناه. أعطينا البنود العشرة نفسها لنماذج عامة (Claude Sonnet 5.5 وOpus 5.5 وGPT-6 Astra) عبر الواجهة البرمجية، في ٣٣ تشغيلًا.",
      en: "A fair question, so we tested it. We gave the same ten clauses to general models (Claude Sonnet 5.5, Opus 5.5 and GPT-6 Astra) through their APIs, in 33 runs.",
    },
    cases: [
      {
        h: { ar: "بلا قرارات اللجنة", en: "Without the committee's decisions" },
        p: {
          ar: "حين طُلب منها الامتناع إن لم تجد سندًا، امتنعت في ١٥٠ جوابًا من ١٥٠. وبلا هذا الطلب أصدرت ٥٦ حكمًا بلا أي استشهاد، وبعضها خالف قرار اللجنة: حكم أحدها بالمطابقة على بند يمنعه القرار ق٧/ثالثاً/٣، في تشغيلين من خمسة.",
          en: "Asked to abstain without a basis, they abstained in 150 of 150 answers. Without that request they gave 56 verdicts with no citation at all, some against the committee's decision: one judged «compliant» a clause that decision ق7/ثالثاً/3 forbids, in two runs of five.",
        },
      },
      {
        h: { ar: "مع القرارات كاملة في سياقه", en: "With all decisions in its context" },
        p: {
          ar: "اقترب كثيرًا: ٨ أحكام صحيحة من ١٠ في المتوسط، و٣٢ استشهادًا كلها حرفية، ولم يخترع شيئًا في عيّنتنا. لكنه أعطى البند نفسه حكمين مختلفين بين تشغيل وآخر.",
          en: "It came close: 8 correct verdicts out of 10 on average, 32 citations all verbatim, nothing invented in our sample. But it gave the same clause different verdicts from one run to the next.",
        },
      },
    ],
    diff: {
      ar: "فالفرق ليس أن النموذج العام «لا يعرف». الفرق هو الضمان: بوابة كود ترفض كل اقتباس غير حرفي، وحكم مشروط بضابط صريح، ونفس الخطوات في كل مرة، وسجل لكل بند، وأرقام مقاسة مقابل خط أساس. والتدقيق الشرعي لا يكفيه «غالبًا».",
      en: "So the difference is not that a general model «doesn't know». The difference is the guarantee: a code gate that rejects any non-verbatim quote, a verdict conditioned on an explicit rule, the same steps every time, a record per clause, and numbers measured against a baseline. Sharia review cannot settle for «usually».",
    },
    caveat: {
      ar: "تجربة صغيرة: ١٠ بنود، و٣٣ تشغيلًا، في ١ أكتوبر ٢٠٢٦، عبر الواجهات البرمجية لا تطبيقات المحادثة.",
      en: "A small experiment: 10 clauses, 33 runs, on 1 October 2026, through the APIs rather than the chat apps.",
    },
  },
  local: {
    title: { ar: "قبل الإطلاق: نموذج محلي داخل المصرف", en: "Before launch: a local model inside the bank" },
    lead: {
      ar: "قبل أن يصل مِيزان إلى أي مصرف، ننقله إلى نموذج مفتوح المصدر يعمل على خوادم المصرف نفسه. فيبقى نص العقد داخل شبكة المصرف، ولا يُرسل إلى أي جهة خارجية.",
      en: "Before Mizan reaches any bank, we move it to an open-source model running on the bank's own servers. The contract text then stays inside the bank's network and is not sent to any outside party.",
    },
    steps: [
      {
        when: { ar: "اليوم", en: "Today" },
        h: { ar: "نسخة تجريبية", en: "A working demo" },
        p: { ar: "تعمل بنموذج سحابي، لنثبت الفكرة ونقيسها على مجموعة الاختبار.", en: "Runs on a cloud model, to prove the idea and measure it on the test set." },
      },
      {
        when: { ar: "قبل الإطلاق", en: "Before launch" },
        h: { ar: "نموذج محلي داخل المصرف", en: "A local model inside the bank" },
        p: { ar: "نموذج مفتوح المصدر يختاره المصرف، على خوادمه. ونص العقد يبقى داخل شبكته.", en: "An open-source model chosen by the bank, on its own servers. The contract text stays inside its network." },
      },
      {
        when: { ar: "قبل التشغيل", en: "Before go-live" },
        h: { ar: "نقيسه أولًا", en: "Measured first" },
        p: { ar: "نشغّل مجموعة الاختبار نفسها على النموذج المختار، ونعرض أرقامه قبل أي استخدام فعلي.", en: "We run the same test set on the chosen model and show its numbers before any real use." },
      },
    ],
    why: {
      ar: "لماذا هذا سهل؟ لأن النموذج في مِيزان إعداد واحد، لا جزء من الكود. والبوابة والامتناع يعملان كما هما مع أي نموذج.",
      en: "Why is this easy? Because the model is a single setting in Mizan, not part of its code. The gate and abstention work the same with any model.",
    },
    examples: { ar: "أمثلة لنماذج مفتوحة المصدر يمكن تشغيلها داخل المصرف", en: "Examples of open-source models that can run inside the bank" },
    trial: {
      ar: "وجرّبنا ذلك فعلًا: شغّلنا مِيزان على حاسوب محمول بنموذج Qwen3-14B بلا إنترنت. على ٤ بنود وافق المتوقع في ٣، وكل اقتباساته حرفية. ولهذا نقيس النموذج المختار قبل التشغيل.",
      en: "And we tried it: Mizan ran on a laptop with Qwen3-14B and no internet. On 4 clauses it matched the expected verdict on 3, and every quote was verbatim. That is why the chosen model is measured before go-live.",
    },
  },
  cta: { ar: "جرّبه على العقد التوضيحي", en: "Try it on the demonstration contract" },
};

/** Open-weight model ids, checked against the Hugging Face API on 2026-10-02 (سجل_العمل_التحول.md). */
export const LOCAL_MODELS = [
  { id: "Qwen/Qwen3.8-27B", license: "Apache-2.0" },
  { id: "zai-org/GLM-5.3-Flash", license: "MIT" },
  { id: "humain-ai/ALLaM-7B-Instruct-preview", license: null },
];

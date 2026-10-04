// The two approved views of Mizan's workflow (Mazen, 2026-10-02, from the concepts artifact):
// TEAM — seven robots, one per automated step, then the human committee (landing page);
// SYSTEM — three lanes (code, model, human) with each station's input, output and guarantee (/how).
// Every statement maps to the engine (src/server/engine/*) or to the recorded /how trace.
import type { L } from "@/lib/review-types";

export type Doer = "code" | "model" | "human";
export type Token = "doc" | "slips" | "sorted" | "card" | "draft" | "stamped" | "folder";

export const DOER: Record<Doer, L> = {
  code: { ar: "الكود", en: "Code" },
  model: { ar: "النموذج", en: "Model" },
  human: { ar: "الإنسان", en: "Human" },
};

/** Steps shared by both: the model does the work and code checks it (split, sort), or code does
 *  the work after a short model call (retrieve). The label names the main doer first. */
export const SHARED = {
  modelCode: { ar: "النموذج + الكود", en: "Model + code" },
  codeModel: { ar: "الكود + النموذج", en: "Code + model" },
} satisfies Record<string, L>;

export const TEAM: { img: string; name: L; role: L; doer: Doer; shared?: L; says: L; token: Token; tokenLabel: L }[] = [
  {
    img: "masker",
    name: { ar: "المُخفي", en: "The Masker" },
    role: { ar: "يطمس الأرقام الشخصية", en: "Masks personal numbers" },
    doer: "code",
    says: { ar: "طمستُ رقم الهوية والآيبان قبل أن يرى النموذج شيئًا.", en: "I masked the ID and IBAN before the model saw anything." },
    token: "doc",
    tokenLabel: { ar: "العقد بعد الإخفاء", en: "Masked contract" },
  },
  {
    img: "splitter",
    name: { ar: "المقطّع", en: "The Splitter" },
    role: { ar: "يقسم العقد أجزاءً حرفية", en: "Chunks it into verbatim parts" },
    doer: "model",
    shared: SHARED.modelCode,
    says: { ar: "قسمتُ العقد إلى أجزاء، كل جزء منسوخ حرفيًا من الأصل.", en: "I split the contract into parts, each copied verbatim." },
    token: "slips",
    tokenLabel: { ar: "أجزاء حرفية", en: "Verbatim parts" },
  },
  {
    img: "sorter",
    name: { ar: "الفرّاز", en: "The Sorter" },
    role: { ar: "يفصل البند عن غيره", en: "Tells clauses from other text" },
    doer: "model",
    shared: SHARED.modelCode,
    says: { ar: "العنوان والفاصل ليسا بندين، فلا يُفحصان. البند الخامس بند.", en: "The title and the separator are not clauses, so they are not reviewed. Clause 5 is." },
    token: "sorted",
    tokenLabel: { ar: "بند للفحص", en: "A clause to review" },
  },
  {
    img: "archivist",
    name: { ar: "أمين الأرشيف", en: "The Archivist" },
    role: { ar: "يجد القرار الحاكم", en: "Finds the governing decision" },
    doer: "code",
    shared: SHARED.codeModel,
    says: { ar: "من ٢٧١٩ وحدة أخرجتُ ١٧ مرشحًا، أولها ق٧/ثالثاً/٢.", en: "From 2,719 units I pulled 17 candidates; the first is ق7/ثالثاً/2." },
    token: "card",
    tokenLabel: { ar: "البند وقراره", en: "Clause and decision" },
  },
  {
    img: "analyst",
    name: { ar: "المحلّل", en: "The Analyst" },
    role: { ar: "يقترح حكمًا مع اقتباسه", en: "Proposes a verdict and quote" },
    doer: "model",
    says: { ar: "البند صورة بيع العينة. أقترح: يُرجَّح عدم مطابقته، والاقتباس من ق٧/ثالثاً/٢.", en: "This is the ʿīna arrangement. I propose: likely non-compliant, quoting ق7/ثالثاً/2." },
    token: "draft",
    tokenLabel: { ar: "حكم مقترح", en: "Proposed verdict" },
  },
  {
    img: "gate",
    name: { ar: "المدقق", en: "The Inspector" },
    role: { ar: "يطابق الاقتباس ويختم", en: "Checks the quote, then stamps" },
    doer: "code",
    says: { ar: "الاقتباس حرفي، ومن المرشحين، وفيه منع صريح. أختم.", en: "The quote is verbatim, from the candidates, and states a prohibition. Stamped." },
    token: "stamped",
    tokenLabel: { ar: "حكم مختوم", en: "Stamped verdict" },
  },
  {
    img: "orderer",
    name: { ar: "المنسّق", en: "The Organiser" },
    role: { ar: "يرتّب ملف المراجعة", en: "Orders the review file" },
    doer: "code",
    says: { ar: "المخالف أولًا، ثم ما يحتاج مراجعة، ثم ما لا سند له، ثم المطابق.", en: "Non-compliant first, then review, then no evidence, then compliant." },
    token: "folder",
    tokenLabel: { ar: "ملف المراجعة", en: "Review file" },
  },
];

export const TEAM_COPY = {
  title: { ar: "سبع خطوات آلية، ثم اللجنة", en: "Seven automated steps, then the committee" },
  lead: {
    ar: "الشخصيات رمز لخطوات برنامج واحد ثابت الترتيب، لا سبعة وكلاء. المربّعة خطوات كود عادي، والمستديرة خطوات يُستدعى فيها نموذج واحد بتعليمات مختلفة. تحتها شكل الوثيقة بعد كل خطوة. اضغط أي خطوة لتقرأ ما تفعله.",
    en: "The figures stand for the steps of one program that runs in a fixed order, not seven agents. The boxy ones are plain code; the round ones are steps that call one model with different instructions. Below them, the document as each step leaves it. Tap a step to read what it does.",
  },
  stamp: { ar: "مخالف", en: "Non-compliant" },
  humanTitle: { ar: "اللجنة الشرعية تقرر، على ملف جاهز", en: "The Sharia committee decides, on a finished file" },
  humanBody: {
    ar: "كل الخطوات السابقة آلية، ولا ينتظر الفحص أحدًا. الإنسان في النهاية فقط: يعتمد الملاحظة أو يرفضها أو يحيلها للدراسة، ويُسجَّل قراره مع وقته.",
    en: "Every step before this point is automated, and the review waits for no one. People come in only at the end: they approve, reject or refer each finding, and the decision is logged with its time.",
  },
  humanActs: [
    { ar: "اعتماد الملاحظة", en: "Approve finding" },
    { ar: "رفضها", en: "Reject" },
    { ar: "إحالة للدراسة", en: "Refer for study" },
  ],
  committeeAlt: { ar: "ثلاثة أعضاء من اللجنة الشرعية يراجعون ملف المراجعة", en: "Three Sharia committee members reviewing the review file" },
  play: { ar: "تشغيل", en: "Play" },
  pause: { ar: "إيقاف", en: "Pause" },
  art: { ar: "الرسوم مولّدة لمِيزان بألوانه.", en: "Illustrations generated for Mizan in its own palette." },
};

/** `y` places a shared step between the code and model lanes (code lane centre 200, model 350):
 *  a box on the boundary is done by both, and its lean shows who does more. */
export type SystemNode = { k: string; x: number; lane: Doer; y?: number; shared?: L; title: L; sub: L; input: L; output: L; guarantee: L };

export const SYSTEM: SystemNode[] = [
  {
    k: "in", x: 1010, lane: "code",
    title: { ar: "العقد", en: "Contract" }, sub: { ar: "ملف أو نص ملصق", en: "File or pasted text" },
    input: { ar: "ملف نص أو نص ملصق", en: "A text file or pasted text" }, output: { ar: "نص العقد كما هو", en: "The contract text as is" },
    guarantee: { ar: "لا يُحفظ الملف ولا نصه الكامل.", en: "Neither the file nor its full text is stored." },
  },
  {
    k: "mask", x: 885, lane: "code",
    title: { ar: "يُخفي", en: "Masks" }, sub: { ar: "١٠ أنواع أرقام", en: "10 kinds of numbers" },
    input: { ar: "نص العقد", en: "The contract text" }, output: { ar: "النص بعد إخفاء الهوية والآيبان والجوال والبطاقة وغيرها", en: "The text with ID, IBAN, phone, card and more masked" },
    guarantee: { ar: "لا يُرسل للنموذج إلا النص بعد الإخفاء. الأسماء لا تُخفى، فيُنبَّه عليها.", en: "Only masked text reaches the model. Names are not masked, so the user is warned." },
  },
  {
    k: "split", x: 760, lane: "model", y: 276, shared: SHARED.modelCode,
    title: { ar: "يقطّع", en: "Chunks" }, sub: { ar: "أجزاء حرفية", en: "Verbatim parts" },
    input: { ar: "النص بعد الإخفاء", en: "The masked text" }, output: { ar: "أجزاء منسوخة حرفيًا", en: "Parts copied verbatim" },
    guarantee: { ar: "الكود يرفض أي جزء ليس حرفيًا، ويعيد كل سطر جوهري أسقطه النموذج. والعقد المرقّم يقطّعه الكود وحده.", en: "Code rejects any part that is not verbatim and restores any substantive line the model dropped. A numbered contract is split by code alone." },
  },
  {
    k: "sort", x: 635, lane: "model", y: 292, shared: SHARED.modelCode,
    title: { ar: "يفرز", en: "Classifies" }, sub: { ar: "بند أو ليس بندًا", en: "Clause or not" },
    input: { ar: "الأجزاء", en: "The parts" }, output: { ar: "بنود، وتمهيدات مع بنودها، وما ليس بندًا", en: "Clauses, intros with their items, and text that is not a clause" },
    guarantee: { ar: "أي جزء فيه التزام يُفحص مهما صنّفه النموذج. والتمهيد يُفحص من خلال بنوده.", en: "Any part with obligation language is reviewed whatever the model says. An intro is reviewed through its items." },
  },
  {
    k: "find", x: 510, lane: "code", y: 236, shared: SHARED.codeModel,
    title: { ar: "يسترجع", en: "Retrieves" }, sub: { ar: "بحث BM25 بالكلمات", en: "BM25 keyword search" },
    input: { ar: "البند ومصطلحات فقهية يقترحها النموذج", en: "The clause and fiqh terms the model suggests" }, output: { ar: "نحو ١٢ مرشحًا من كل نسخة من الفهرس", en: "About 12 candidates from each copy of the index" },
    guarantee: { ar: "النموذج لا يأتي بقرار من ذاكرته: لا يرى إلا ما استرجعه الكود.", en: "The model cannot bring a decision from memory: it sees only what code retrieved." },
  },
  {
    k: "judge", x: 385, lane: "model",
    title: { ar: "يحكم", en: "Judges" }, sub: { ar: "حكم واقتباس ودور", en: "Verdict, quote, role" },
    input: { ar: "البند والمرشحون والبنود المرتبطة", en: "The clause, the candidates and linked clauses" }, output: { ar: "حكم مقترح، واقتباسات، ودور كل قرار", en: "A proposed verdict, quotes, and each decision's role" },
    guarantee: { ar: "تعليماته تمنعه من معرفته العامة: قرار اللجنة هو الحاكم.", en: "Its instructions bar its general knowledge: the committee's decision governs." },
  },
  {
    k: "gate", x: 260, lane: "code",
    title: { ar: "يتحقق", en: "Verifies" }, sub: { ar: "بوابة الكود", en: "The code gate" },
    input: { ar: "الحكم المقترح", en: "The proposed verdict" }, output: { ar: "حكم مقبول، أو مخفَّض إلى مراجعة أو امتناع", en: "An accepted verdict, or one lowered to review or abstain" },
    guarantee: {
      ar: "يُسقط كل اقتباس ليس حرفيًا أو ليس من المرشحين. ولا «مخالف» بلا منع أو شرط صريح. والقرار المعدَّل لاحقًا يرفع البند للمراجعة.",
      en: "Drops any quote that is not verbatim or not a candidate. No «non-compliant» without an explicit prohibition or condition. An amended decision sends the clause to review.",
    },
  },
  {
    k: "file", x: 135, lane: "code",
    title: { ar: "يرتّب", en: "Orders" }, sub: { ar: "ملف المراجعة", en: "The review file" },
    input: { ar: "أحكام البنود", en: "The clause verdicts" }, output: { ar: "ملف بالأولوية برقم العقد ورقم العملية، يُصدَّر PDF وExcel", en: "A priority file with contract and run IDs, exportable to PDF and Excel" },
    guarantee: { ar: "لكل بند سنده وسببه، والنتيجة قابلة للتدقيق.", en: "Each clause carries its evidence and reason; the result can be audited." },
  },
  {
    k: "human", x: 135, lane: "human",
    title: { ar: "اللجنة تقرر", en: "Committee" }, sub: { ar: "اعتماد · رفض · إحالة", en: "Approve, reject, refer" },
    input: { ar: "ملف المراجعة", en: "The review file" }, output: { ar: "قرار اللجنة على كل ملاحظة، مسجّل بوقته", en: "The committee's decision on each finding, logged with its time" },
    guarantee: { ar: "مِيزان لا يفتي ولا يعتمد. الإنسان في النهاية فقط.", en: "Mizan never issues a fatwa or an approval. People come in only at the end." },
  },
];

export const SYSTEM_COPY = {
  title: { ar: "مسار مِيزان عبر الكود والنموذج والإنسان", en: "Mizan's path through code, model and people" },
  store: { ar: "قرارات اللجنة: ٢٧١٩ وحدة", en: "2,719 decision units" },
  notClause: { ar: "ليس بندًا: لا يُفحص", en: "Not a clause: skipped" },
  gateFail: { ar: "اقتباس غير حرفي: يُسقط ← مراجعة", en: "Quote not verbatim: dropped, review" },
  privacy: { ar: "لا يُحفظ ملف العقد ولا نصه؛ تُرسل الأجزاء بعد الإخفاء فقط.", en: "Neither the file nor its text is stored; only masked parts are sent." },
  input: { ar: "يدخل", en: "In" },
  output: { ar: "يخرج", en: "Out" },
  guarantee: { ar: "الضمان", en: "Guarantee" },
  play: { ar: "تشغيل الحركة", en: "Play" },
  pause: { ar: "إيقاف الحركة", en: "Pause" },
  hint: { ar: "المحطة المضيئة هي مكان البند الآن. اضغط أي محطة لتفاصيلها.", en: "The lit station is where the clause is now. Tap any station for its details." },
  legend: {
    ar: "المحطة بين مسارين يؤديها الاثنان، وميلها يبيّن من يؤدي أكثر: النموذج يقطّع ويفرز والكود يتحقق، والكود يبحث بعد نداء قصير للنموذج.",
    en: "A station between two lanes is done by both, and its lean shows who does more: the model chunks and classifies while code checks, and code searches after a short model call.",
  },
};

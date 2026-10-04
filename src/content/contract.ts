// The demonstration contract for the review app: an authored murabaha agreement (عقد توضيحي).
// Each result is what the engine is expected to return for that clause, and each one must
// stay true to the cited unit in `units.ts`. These results are the mock engine's answers until
// the Python engine is connected; they are not measured outputs.
import type { ClauseResult, L } from "@/lib/review-types";

export const DEMO_CONTRACT: { serial: string; title: L; file: string; clauses: ClauseResult[] } = {
  serial: "0930-0001",
  title: { ar: "اتفاقية بيع بالمرابحة — عقد توضيحي", en: "Murabaha sale agreement — demonstration contract" },
  file: "murabaha-demo.txt",
  clauses: [
    {
      n: 1,
      text: {
        ar: "يلتزم العميل بشراء السلعة من المصرف بعد تملك المصرف لها، ويعوّض المصرف عن أي ضرر إن نكل عن الشراء.",
        en: "The client undertakes to buy the goods from the bank once the bank owns them, and compensates the bank for any loss if the client backs out.",
      },
      verdict: "nonCompliant",
      citations: ["الإنماء/ق7/ثالثاً/1"],
      marks: {"الإنماء/ق7/ثالثاً/1": ["مواعدة ملزمة لهما أو وعد ملزم لأحدهما بإتمام البيع", "تعهد من العميل بالتعويض عند نكوله عن الشراء"]},
      reason: {
        ar: "البند يجعل الوعد بالشراء ملزمًا للعميل ويرتب عليه تعويضًا عند النكول، والضابط يمنع الوعد الملزم والتعهد بالتعويض.",
        en: "The clause makes the purchase promise binding and attaches compensation on withdrawal; the rule forbids a binding promise and a compensation undertaking.",
      },
      suggestion: {
        ar: "يقدّم العميل طلب شراء غير ملزم، ولا يترتب على عدوله عن الشراء أي تعويض.",
        en: "The client submits a non-binding purchase request, and withdrawing from the purchase carries no compensation.",
      },
    },
    {
      n: 2,
      text: {
        ar: "إذا كان العميل قد وقّع مع المورد فاتورة مبدئية بشراء السلعة، يشتريها المصرف من المورد ثم يبيعها على العميل.",
        en: "If the client has already signed a pro-forma invoice with the supplier for the goods, the bank buys them from the supplier and then sells them to the client.",
      },
      verdict: "nonCompliant",
      citations: ["الإنماء/ق7/ثالثاً/3"],
      marks: {"الإنماء/ق7/ثالثاً/3": ["إذا سبق ذلك إبرام عقد بيع بين العميل ومالك السلعة", "فاتورة مبدئية موقعة من العميل والمورد"]},
      reason: {
        ar: "الفاتورة المبدئية الموقعة من العميل والمورد عقد سابق، والضابط يمنع شراء المصرف للسلعة إذا سبق ذلك عقد بين العميل ومالكها.",
        en: "A pro-forma invoice signed by the client and the supplier is a prior contract; the rule forbids the bank from buying goods the client has already contracted for.",
      },
      suggestion: {
        ar: "لا يشتري المصرف السلعة إذا سبق أن أبرم العميل عقد شرائها مع مالكها، ويكفي التفاهم غير الملزم بينهما.",
        en: "The bank does not buy goods the client has already contracted to buy from their owner; a non-binding understanding between them is enough.",
      },
    },
    {
      n: 3,
      text: {
        ar: "يبيع المصرف السلعة على العميل فور توقيع طلب الشراء، ويتولى المورد تسليمها للعميل لاحقًا.",
        en: "The bank sells the goods to the client as soon as the purchase request is signed, and the supplier delivers them to the client later.",
      },
      verdict: "nonCompliant",
      citations: ["الإنماء/ق7/ثالثاً/4"],
      marks: {"الإنماء/ق7/ثالثاً/4": ["ألا يبيع المصـرف السلعة على العميل قبل تملكه لها وقبضها قبضاً حقيقياً أو حكمياً"]},
      reason: {
        ar: "البيع يقع قبل أن يتملك المصرف السلعة ويقبضها، والضابط يشترط التملك والقبض الحقيقي أو الحكمي قبل البيع.",
        en: "The sale happens before the bank owns and takes possession of the goods; the rule requires ownership and actual or constructive possession first.",
      },
      suggestion: {
        ar: "لا يبيع المصرف السلعة على العميل إلا بعد تملكها وقبضها قبضًا حقيقيًا أو حكميًا بتعيينها له وتمكينه من قبضها.",
        en: "The bank sells the goods to the client only after owning them and taking actual or constructive possession, by identifying them and being able to take them.",
      },
    },
    {
      n: 4,
      text: {
        ar: "لا يبيع المصرف السلعة على العميل إلا بعد تملكها وقبضها قبضًا حقيقيًا أو حكميًا بتعيينها له وتمكينه من قبضها.",
        en: "The bank sells the goods to the client only after owning them and taking actual or constructive possession, by identifying them and being able to take them.",
      },
      verdict: "compliant",
      citations: ["الإنماء/ق7/ثالثاً/4"],
      marks: {"الإنماء/ق7/ثالثاً/4": ["ألا يبيع المصـرف السلعة على العميل قبل تملكه لها وقبضها قبضاً حقيقياً أو حكمياً", "بتعين السلعة له وتمكينه من قبضها"]},
      reason: {
        ar: "البند يشترط التملك والقبض قبل البيع كما في الضابط.",
        en: "The clause requires ownership and possession before the sale, as the rule does.",
      },
    },
    {
      n: 5,
      text: {
        ar: "يشتري المصرف من العميل السلعة المملوكة له بثمن حال، ثم يبيعها عليه بالأجل بثمن أعلى.",
        en: "The bank buys from the client goods the client owns, for cash, then sells them back to the client on deferred terms at a higher price.",
      },
      verdict: "nonCompliant",
      citations: ["الإنماء/ق7/ثالثاً/2"],
      marks: {"الإنماء/ق7/ثالثاً/2": ["يشتري المصـرف من العميل سلعة يملكها", "بثمن حال", "ثم يبيعها على ذلك العميل إلى أجل", "بثمن أكثر", "بيوع العينة"]},
      reason: {
        ar: "البند يصف شراء المصرف من العميل نقدًا ثم البيع عليه بالأجل بأكثر، وهي الصورة التي يسميها الضابط «بيوع العينة».",
        en: "The clause describes the bank buying from the client for cash and selling back on deferred terms for more: the arrangement the rule names ʿīna.",
      },
      suggestion: {
        ar: "يشتري المصرف السلعة من طرف غير العميل، ولا يشتري من العميل سلعة يملكها أو يملك أكثر من ثلثها ثم يبيعها عليه بالأجل.",
        en: "The bank buys the goods from a party other than the client, and never buys goods the client owns (or owns over a third of) to sell back on deferred terms.",
      },
    },
    {
      n: 6,
      text: {
        ar: "تسقط الآجال وتصبح جميع الأقساط مستحقة فورًا إذا تأخر العميل عن سداد أي قسط.",
        en: "All terms lapse and every installment falls due at once if the client is late on any installment.",
      },
      verdict: "nonCompliant",
      citations: ["الإنماء/ق15/أولاً"],
      marks: {"الإنماء/ق15/أولاً": ["ليس للمصـرف اشتراط حلول جميع الأقساط بتخلف العميل عن السداد"]},
      reason: {
        ar: "البند يشترط حلول جميع الأقساط عند التأخر، والقرار ينص على أنه ليس للمصرف ذلك.",
        en: "The clause makes every installment due on default; the decision states the bank may not stipulate that.",
      },
      suggestion: {
        ar: "إذا تأخر العميل عن سداد قسط، حلّ عليه من الأقساط المؤجلة بعدد ما تأخر عن سداده.",
        en: "If the client is late on an installment, only as many deferred installments fall due as the client has missed.",
      },
    },
    {
      n: 7,
      text: {
        ar: "إذا تأخر العميل عن سداد قسط، حلّ عليه من الأقساط المؤجلة بعدد ما تأخر عن سداده.",
        en: "If the client is late on an installment, only as many deferred installments fall due as the client has missed.",
      },
      verdict: "compliant",
      citations: ["الإنماء/ق15/أولاً"],
      marks: {"الإنماء/ق15/أولاً": ["يحل على العميل من الأقساط المؤجلة بعدد ما تأخر عن سداده"]},
      reason: {
        ar: "البند يطابق ما قرره القرار: يحل من الأقساط بعدد ما تأخر العميل عن سداده.",
        en: "The clause matches the decision: installments fall due in the number the client has missed.",
      },
    },
    {
      n: 8,
      text: {
        ar: "يلتزم العميل بالتأمين على السلعة لدى جهة يحددها المصرف.",
        en: "The client insures the goods with a provider the bank selects.",
      },
      verdict: "review",
      citations: ["الإنماء/ق209/أولاً"],
      marks: {"الإنماء/ق209/أولاً": ["العين المؤجرة", "من ضمان المؤجر؛ فيتحمل التأمين عليها"]},
      reason: {
        ar: "أقرب قرار يجعل التأمين على المؤجِّر في الإجارة. هذا العقد مرابحة، فلا يكفي القرار للحكم على البند، ويُرفع للمراجعة البشرية.",
        en: "The closest decision puts insurance on the lessor in an ijara. This is a murabaha, so the decision is not enough to judge the clause; it is escalated for human review.",
      },
    },
    {
      n: 9,
      text: {
        ar: "يدفع العميل غرامة تأخير قدرها ٢٪ من القسط المتأخر عن كل شهر تأخير.",
        en: "The client pays a late fee of 2% of the overdue installment for each month of delay.",
      },
      verdict: "review",
      citations: ["الإنماء/ق13/أولاً/1", "الإنماء/ق186/أولاً/2", "الإنماء/ق987/ثالثاً"],
      marks: {"الإنماء/ق13/أولاً/1": ["غرامةً عن التأخر في السداد"], "الإنماء/ق186/أولاً/2": ["غرامة التأخير"], "الإنماء/ق987/ثالثاً": ["ساترا لغرامات التأخير"]},
      reason: {
        ar: "في المدونة منع لغرامة التأخير في القرض الحسن وفي عقود إجارة محددة. وفي المرابحة مع الالتزام بالحسم يمنع القرار أن يكون الربح ساترًا لغرامات التأخير، لكنه لا يحكم بند غرامة صريحًا. لا قرار يحكم البند مباشرة، فيُرفع للمراجعة البشرية مع القرارات الثلاثة.",
        en: "The corpus forbids late fees in a benevolent loan and in specific lease contracts. For murabaha with a rebate commitment, a decision forbids profit that hides late fees, but it does not rule on an explicit late-fee clause. No decision governs the clause directly, so it is escalated for human review with all three decisions.",
      },
    },
    {
      n: 10,
      text: {
        ar: "يحق للعميل سداد الأقساط بالعملات الرقمية.",
        en: "The client may pay installments in digital currencies.",
      },
      verdict: "abstain",
      citations: [],
      reason: {
        ar: "لا وحدة في المدونة (٢٧١٩ وحدة) تتناول العملات الرقمية. مِيزان لا يخمّن، ويرفع البند للمراجعة.",
        en: "No unit in the corpus (2,719 units) addresses digital currencies. Mizan does not guess; it escalates the clause.",
      },
    },
  ],
};

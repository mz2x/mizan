import { test } from "node:test";
import assert from "node:assert/strict";
import { redact } from "./redact";

test("masks a Saudi national ID or iqama number, in Latin or Arabic-Indic digits", () => {
  const r = redact("هوية رقم 1023456789 وإقامة رقم ٢٠١٢٣٤٥٦٧٨.");
  assert.equal(r.text, "هوية رقم [هوية] وإقامة رقم [هوية].");
  assert.equal(r.counts.id, 2);
});

test("masks a Saudi IBAN with or without spaces", () => {
  const r = redact("الحساب SA03 8000 0000 6080 1016 7519 والآخر SA0380000000608010167519.");
  assert.equal(r.text, "الحساب [آيبان] والآخر [آيبان].");
  assert.equal(r.counts.iban, 2);
});

test("masks Saudi mobile numbers in local and international forms", () => {
  const r = redact("جوال 0551234567 أو +966 55 123 4567 أو 00966551234567");
  assert.equal(r.text, "جوال [جوال] أو [جوال] أو [جوال]");
  assert.equal(r.counts.phone, 3);
});

test("masks email addresses and card numbers", () => {
  const r = redact("البريد client.name@example.com والبطاقة 4111 1111 1111 1111");
  assert.equal(r.text, "البريد [بريد] والبطاقة [بطاقة]");
  assert.equal(r.counts.email, 1);
  assert.equal(r.counts.card, 1);
});

test("leaves contract amounts, dates, percentages and article numbers alone", () => {
  const s = "يدفع العميل 1,500,000 ريال على 60 قسطًا بنسبة ٢٪ بتاريخ 2026/10/01 وفق المادة (17) والبند 2-17.";
  const r = redact(s);
  assert.equal(r.text, s);
  assert.equal(r.total, 0);
});

test("a ten-digit run inside a longer number is not an ID", () => {
  const s = "رقم المرجع 912345678901234";
  assert.equal(redact(s).text, s);
});

// Privacy report (الوثائق/04_الخصوصية_والأمن.md, §2.4 and requirement 1): the samples it found unmasked.
test("masks an ID written with spaces or dashes", () => {
  assert.equal(redact("هوية 1 0 2 3 4 5 6 7 8 9 و1023-456-789").text, "هوية [هوية] و[هوية]");
});

test("masks a 15-digit card and a non-Saudi mobile number", () => {
  const r = redact("بطاقة 3782 822463 10005 وجوال +971 50 123 4567");
  assert.equal(r.text, "بطاقة [بطاقة] وجوال [جوال]");
});

test("masks a foreign IBAN whole, with the IBAN label", () => {
  assert.equal(redact("الحساب AE07 0331 2345 6789 0123 456 لدى البنك").text, "الحساب [آيبان] لدى البنك");
});

test("masks an account number, a passport, a deed number and a birth date when their label precedes them", () => {
  const r = redact("رقم الحساب 6080101675190012، جواز السفر رقم A12345678، صك رقم 310123456789، تاريخ الميلاد 1985/03/14.");
  assert.equal(r.text, "رقم الحساب [حساب]، جواز السفر رقم [جواز]، صك رقم [صك]، تاريخ الميلاد [تاريخ الميلاد].");
});

test("masks a national address", () => {
  assert.equal(redact("العنوان: 8228 طريق الملك فهد، حي العليا، الرياض 12611").text, "العنوان: [عنوان]");
});

test("flags likely person names without masking them", () => {
  const r = redact("يلتزم العميل محمد بن عبدالله الشهري بالسداد، ويكفله السيد خالد آل سعود.");
  assert.equal(r.text, "يلتزم العميل محمد بن عبدالله الشهري بالسداد، ويكفله السيد خالد آل سعود.");
  assert.equal(r.nameHints, 2);
});

test("still leaves amounts, rates, contract dates and clause numbers alone", () => {
  const s = "يبلغ الثمن 450,000 ريال بربح 4.5٪ يسدد على 60 قسطًا تبدأ في 2026/10/01 وفق المادة 17 والبند 2-17 والقرار 1083.";
  assert.equal(redact(s).text, s);
});

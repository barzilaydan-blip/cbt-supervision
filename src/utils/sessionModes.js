// Two kinds of meeting live in the app. Supervision is the default; the therapist
// record of Dan Barzilay holds his own therapy sessions with clients, so for him
// the rubrics, the recording analysis and the wording are those of a therapy session.
//
// Both use the same session document: notes.report / notes.issues and so on, with
// the follow-up rubric saved as the session's supervisorRecs.

export function isOwnPractice(therapist) {
  const name = (therapist?.name || '').replace(/["'״׳.]/g, ' ');
  return /(^|\s)דן(\s|$)/.test(name) && name.includes('ברזילי');
}

export const SUPERVISION_FIELDS = [
  { key: 'report',          label: 'דיווח המודרך',        placeholder: 'מה דיווח המטפל על המפגש עם המטופל' },
  { key: 'issues',          label: 'סוגיות ודילמות',       placeholder: 'דיון מקצועי, המשגה, שאלות שעלו' },
  { key: 'recommendations', label: 'המלצות וצעדים הבאים',  placeholder: 'ההמלצות וההכוונה שלך, ומה סוכם שהמודרך יעשה' },
  // Saved as the session's supervisorRecs; shown next meeting under "לעקוב היום"
  { key: 'followUp',        label: 'נקודות להמשך מעקב',    placeholder: 'מה לבדוק במפגש הבא' },
];

export const THERAPY_FIELDS = [
  { key: 'report',       label: 'מה שיתף המטופל',                  placeholder: 'אירועים, מחשבות, רגשות והתנהגויות שהמטופל הביא' },
  { key: 'issues',       label: 'ניתוח פסיכולוגי',                 placeholder: 'ההבנה שלך במפגש: מחשבות, רגשות והתנהגות, אמונות, הימנעות' },
  { key: 'intervention', label: 'ההתערבות ברוח ACT ו-CBT',          placeholder: 'מה עשית במפגש ואיך המטופל הגיב' },
  // Saved as the session's supervisorRecs; shown next session under "לעקוב היום"
  { key: 'followUp',     label: 'המלצות למפגש הבא',                placeholder: 'מה סוכם, משימות בית, למה לחזור' },
  { key: 'aiFeedback',   label: 'הבנת הקשיים ומשוב למטפל (בינה מלאכותית)', placeholder: 'השערות CBT לגבי הקשיים, ומשוב על המפגש' },
];

// Every rubric key a session's notes can hold, across both modes
export const NOTE_KEYS = ['report', 'issues', 'recommendations', 'intervention', 'aiFeedback'];

export function sessionTerms(own) {
  return own ? {
    fields: THERAPY_FIELDS,
    session: 'מפגש',
    sessions: 'מפגשים',
    meeting: 'מפגש טיפולי',
    person: 'המטופל',
    followLabel: 'המלצות למפגש הבא',
  } : {
    fields: SUPERVISION_FIELDS,
    session: 'הדרכה',
    sessions: 'הדרכות',
    meeting: 'מפגש הדרכה',
    person: 'המודרך',
    followLabel: 'נקודות להמשך מעקב',
  };
}

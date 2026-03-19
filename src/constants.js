export const CONCEPTUALIZATION_SECTIONS = [
  {
    section: 'פרטים כלליים וסיבת פנייה',
    fields: [
      { key: 'initials', label: 'פרטי המטופל/ת (ראשי תיבות)', type: 'text' },
      { key: 'age', label: 'גיל', type: 'text' },
      { key: 'familyStatus', label: 'מצב משפחתי ותעסוקתי', type: 'textarea' },
      { key: 'referralReason', label: 'סיבת הפנייה (התלונה העיקרית)', description: 'מה הביא את המטופל/ת לקליניקה כרגע? תיאור הקושי במונחים התנהגותיים.', type: 'textarea' },
    ],
  },
  {
    section: 'רקע רלוונטי וגורמים מקדימים (Predisposing Factors)',
    fields: [
      { key: 'lifeEvents', label: 'אירועי חיים משמעותיים', description: 'בילדות או בבגרות, שתרמו להתפתחות הבעיה.', type: 'textarea' },
      { key: 'familyContext', label: 'הקשר משפחתי/חברתי', description: 'השפעות סביבתיות ודמויות משמעותיות.', type: 'textarea' },
    ],
  },
  {
    section: 'אמונות יסוד ואמונות ביניים',
    fields: [
      { key: 'coreBeliefs', label: 'אמונות ליבה (Core Beliefs)', description: 'תפיסות עמוקות ונוקשות לגבי העצמי, העולם והעתיד. למשל: "אני לא ראוי", "העולם מסוכן".', type: 'textarea' },
      { key: 'intermediateBeliefs', label: 'אמונות ביניים (Intermediate Beliefs)', description: 'כללים, הנחות וציוויים. למשל: "אם לא אצטיין, כולם יזלזלו בי", "אסור לי להראות חולשה".', type: 'textarea' },
    ],
  },
  {
    section: 'הניתוח התפקודי – המודל המרובע (Cross-Sectional Analysis)',
    fields: [
      { key: 'situation', label: 'הסיטואציה (Trigger)', description: 'איפה, מתי, עם מי ומה קרה?', type: 'textarea' },
      { key: 'automaticThoughts', label: 'מחשבות אוטומטיות', description: 'מה עבר למטופל/ת בראש באותו רגע? דימויים, מילים, פרשנות.', type: 'textarea' },
      { key: 'emotions', label: 'רגשות', description: 'במילה אחת: פחד, עצב, כעס, אשמה וכו\'. מה הייתה עוצמתם (1-100)?', type: 'textarea' },
      { key: 'bodySensations', label: 'תחושות גופניות', description: 'דופק מהיר, מחנק, רעד, מתח בשרירים וכדומה.', type: 'textarea' },
      { key: 'behavior', label: 'התנהגות', description: 'מה המטופל/ת עשה/תה בפועל? כולל תגובות גלויות, הימנעות, או "התנהגויות ביטחון".', type: 'textarea' },
    ],
  },
  {
    section: 'מנגנונים משמרים (Perpetuating Factors)',
    fields: [
      { key: 'perpetuatingFactors', label: 'מנגנונים משמרים', description: 'איך ההתנהגות (או ההימנעות) משמרת את הבעיה בטווח הארוך?', type: 'textarea' },
    ],
  },
  {
    section: 'כוחות ומשאבים',
    fields: [
      { key: 'strengths', label: 'כוחות ומשאבים', description: 'מהן החוזקות של המטופל/ת? תמיכה חברתית, יכולת רפלקטיבית, תחביבים, הצלחות עבר.', type: 'textarea' },
    ],
  },
];

export const FOCUS_AREAS = [
  { key: 'informationGathering', label: 'איסוף מידע' },
  { key: 'therapeuticAlliance', label: 'קשר טיפולי' },
  { key: 'conceptualization', label: 'המשגה' },
  { key: 'motivation', label: 'מוטיבציה' },
  { key: 'interventionTechniques', label: 'טכניקות התערבות' },
  { key: 'riskAssessment', label: 'הערכת סיכון' },
  { key: 'treatmentPlanning', label: 'תכנון טיפול' },
  { key: 'homework', label: 'שיעורי בית ומשימות' },
  { key: 'sessionManagement', label: 'ניהול הסשן' },
  { key: 'ethicalIssues', label: 'סוגיות אתיות' },
  { key: 'therapistWellbeing', label: 'רווחת המטפל' },
];

// In-memory stand-in for the Firebase modules the app imports.
// All data below is synthetic. No real patient or therapist appears here.
const stamp = iso => ({ toDate: () => new Date(iso) });

const data = {
  therapists: {
    t1: { name: 'נועה לוי (הדגמה)', profession: 'פסיכולוגית', email: 'demo@example.com', createdAt: stamp('2026-05-01') },
    t2: { name: 'יואב שחר (הדגמה)', profession: 'עובד סוציאלי', email: 'demo2@example.com', createdAt: stamp('2026-06-01') },
  },
  patients: {
    p1: { therapistId: 't1', name: 'ר.מ.', createdAt: stamp('2026-06-10'), background: 'בן 34, חרדה חברתית. מטרות: השתתפות בישיבות צוות, יוזמת שיחה עם עמיתים. טיפול שבועי.' },
    p2: { therapistId: 't1', name: 'ד.ק.', createdAt: stamp('2026-08-20'), background: 'בת 27, דיכאון מז\'ורי, אפיזודה שנייה.' },
    p3: { therapistId: 't1', name: 'א.ש.', createdAt: stamp('2026-03-02'), background: 'בן 41, OCD עם טקסי בדיקה.' },
    p4: { therapistId: 't1', name: 'ת.ב.', createdAt: stamp('2026-10-01'), background: '' },
  },
  sessions: {
    s1: { patientId: 'p1', therapistId: 't1', date: '2026-08-17', notes: { report: 'ברית טיפולית טובה. המטופל חושש מביקורת מצד המטפלת.', issues: 'כיצד לדבר על החשש בתוך הקשר.', recommendations: 'לשקף את החשש ולנרמל.' } },
    s2: { patientId: 'p1', therapistId: 't1', date: '2026-08-31', notes: { report: 'קושי בהגדרת מטרות מדידות.', issues: '', recommendations: 'לנסח מטרות התנהגותיות יחד עם המטופל.' }, summary: 'המודרכת התקשתה לנסח עם המטופל מטרות מדידות. נעשה תרגול של ניסוח מטרה התנהגותית אחת.' },
    s3: { patientId: 'p1', therapistId: 't1', date: '2026-09-14', notes: {}, summary: 'הוצגה למטופל המשגה מעודכנת. אמונת ליבה מרכזית: "אני משעמם". המטופל הזדהה עם ההמשגה.', supervisorRecs: '- לבדוק שנבנה סולם חשיפות יחד עם המטופל' },
    s4: { patientId: 'p1', therapistId: 't1', date: '2026-09-28', notes: {}, summary: 'נבנה סולם חשיפות בן שמונה שלבים. המטופל מתקשה בשלבים שכוללים פנייה לדמות סמכות. סוכם להתחיל בחשיפה מדורגת 3 מתוך 10.', supervisorRecs: '- האם בוצעה חשיפה ראשונה ומה היו הדירוגים\n- לעבור יחד על רישום המחשבות\n- קצב הפגישות של המודרכת' },
    s5: { patientId: 'p2', therapistId: 't1', date: '2026-09-28', notes: { danger: true, dangerNote: 'מחשבות אובדניות פסיביות, ללא תוכנית.' }, summary: 'עלו מחשבות אובדניות פסיביות ללא תוכנית או כוונה. נבנתה תוכנית ביטחון. המשך הפעלה התנהגותית.', supervisorRecs: '- לוודא שבוצעה הערכת סיכון חוזרת\n- לבדוק שתוכנית הביטחון בידי המטופלת' },
    s6: { patientId: 'p3', therapistId: 't1', date: '2026-09-28', notes: { report: 'ירידה בזמן הטקסים מ-90 ל-40 דקות ביום.', issues: 'בני המשפחה משתפים פעולה עם הטקסים.', recommendations: 'לשלב פגישת הדרכה לבני המשפחה.' } },
  },
  supervisionSessions: {
    m1: { therapistId: 't1', date: '2026-09-28', summary: 'המודרכת שיתפה בתחושה שהיא ממהרת בפגישות. סוכם שתקליט פגישה אחת.', supervisorRecs: '- לבדוק שהוקלטה פגישה ולהאזין יחד לקטע ממנה' },
  },
  conceptualizations: {
    c1: { patientId: 'p1', therapistId: 't1', submittedAt: stamp('2026-09-10'), fields: { initials: 'ר.מ.', age: '34', referralReason: 'הימנעות מישיבות צוות ומשיחות עם עמיתים.', coreBeliefs: '"אני משעמם", "יצחקו עליי".', behavior: 'הימנעות, שתיקה בישיבות.' } },
  },
  materials: {
    m1: { name: 'שאלון חרדה חברתית LSAS (הדגמה)', url: 'https://example.com/lsas', category: 'שאלונים', description: 'שאלון לדיווח עצמי, 24 פריטים.', tags: ['חרדה', 'שאלון'], createdAt: stamp('2026-07-01') },
    m2: { name: 'דף עבודה: רישום מחשבות (הדגמה)', url: 'https://example.com/thought-record', category: 'שאלונים', description: '', tags: ['CBT'], createdAt: stamp('2026-08-01') },
  },
};

let nextId = 1;
const snapOf = (name, id) => {
  const value = data[name]?.[id];
  return { id, exists: () => value !== undefined, data: () => value };
};
function run(q) {
  let rows = Object.keys(data[q.name] || {}).map(id => snapOf(q.name, id));
  for (const c of q.constraints || []) {
    if (c.kind === 'where') rows = rows.filter(r => { const v = r.data()[c.field]; return c.op === '==' ? v === c.value : true; });
    if (c.kind === 'orderBy') rows.sort((a, b) => {
      const key = x => { const v = x.data()[c.field]; return v?.toDate ? v.toDate().getTime() : v ?? ''; };
      return (key(a) > key(b) ? 1 : key(a) < key(b) ? -1 : 0) * (c.dir === 'desc' ? -1 : 1);
    });
  }
  return { docs: rows, empty: rows.length === 0, size: rows.length, forEach: fn => rows.forEach(fn) };
}

// firebase/app
export const initializeApp = () => ({});
// firebase/auth
export const getAuth = () => ({});
export class GoogleAuthProvider {}
export const onAuthStateChanged = (auth, cb) => { cb({ email: 'demo@example.com' }); return () => {}; };
export const signInWithPopup = async () => ({ user: { email: 'demo@example.com' } });
export const signOut = async () => {};
// firebase/firestore
export const getFirestore = () => ({});
export const collection = (db, name) => ({ name, constraints: [] });
export const doc = (db, name, id) => ({ name, id });
export const query = (col, ...constraints) => ({ name: col.name, constraints });
export const where = (field, op, value) => ({ kind: 'where', field, op, value });
export const orderBy = (field, dir = 'asc') => ({ kind: 'orderBy', field, dir });
export const serverTimestamp = () => stamp(new Date().toISOString());
export const getDocs = async q => run(q);
export const getDoc = async ref => snapOf(ref.name, ref.id);
export const onSnapshot = (ref, next) => { queueMicrotask(() => next(ref.id ? snapOf(ref.name, ref.id) : run(ref))); return () => {}; };
export const addDoc = async (col, value) => { const id = `new${nextId++}`; (data[col.name] ||= {})[id] = value; return { id }; };
export const updateDoc = async (ref, patch) => { Object.assign(data[ref.name][ref.id], patch); };
export const deleteDoc = async ref => { delete data[ref.name][ref.id]; };

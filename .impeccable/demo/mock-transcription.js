// Demo stand-in for the transcription service: returns a fixed, synthetic
// Hebrew transcript so the review flow can be exercised without OpenAI.
export const isTranscriptionConfigured = () => true;
export async function transcribeSegment() {
  return [
    'A: נתחיל עם ר.מ. מה קרה השבוע?',
    'B: הוא עשה את החשיפה הראשונה, דיבר עם מוכר בחנות. החרדה ירדה משמונה לחמש. את רישום המחשבות הוא לא מילא.',
    'A: מה לדעתך עצר אותו?',
    'B: נראה לי שלא הבין את הטופס. אולי הסברתי מהר מדי.',
    'C: אולי כדאי למלא איתו דוגמה בפגישה עצמה?',
    'A: רעיון טוב. תמלאי איתו דוגמה אחת בפגישה, ובפעם הבאה תביאי את סולם החשיפות.',
    'A: ומה עם ד.ק.?',
    'B: היא סיפרה שחזרו מחשבות על מוות, בלי תוכנית. עדכנו את תוכנית הביטחון.',
    'A: חשוב. בשבוע הבא נבדוק שוב את הסיכון ונוודא שהתוכנית אצלה.',
  ].join('\n');
}

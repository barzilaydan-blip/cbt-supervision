import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({
  apiKey: import.meta.env.VITE_ANTHROPIC_API_KEY,
  dangerouslyAllowBrowser: true,
});

/**
 * Rephrase a given text in professional clinical Hebrew.
 */
export async function rephraseText(text) {
  const response = await client.messages.create({
    model: 'claude-opus-4-6',
    max_tokens: 1024,
    messages: [
      {
        role: 'user',
        content: `אתה מסייע לפסיכולוג קליני לנסח מחדש הערות סופרוויזיה בשפה מקצועית, בהירה ותמציתית.

נסח מחדש את הטקסט הבא בעברית מקצועית. שמור על המשמעות המקורית, אך שפר את הניסוח, הבהירות והמקצועיות. החזר רק את הטקסט המנוסח מחדש, ללא הסברים.

טקסט מקורי:
${text}`,
      },
    ],
  });
  return response.content[0].text.trim();
}

/**
 * Generate a session summary based on all filled notes.
 */
export async function generateSessionSummary({ patientName, therapistName, date, notes }) {
  const response = await client.messages.create({
    model: 'claude-opus-4-6',
    max_tokens: 1024,
    messages: [
      {
        role: 'user',
        content: `אתה מדריך CBT המסייע בכתיבת סיכומי הדרכה. כתוב סיכום קצר ומקצועי של הדרכה זו בעברית.

מטופל: ${patientName || 'לא צוין'}
מטפל: ${therapistName || 'לא צוין'}
תאריך: ${date || 'לא צוין'}

תכני ההדרכה לפי נושאים:
${notes}

כתוב סיכום בעברית מקצועית הכולל: הנושאים המרכזיים שעלו, התקדמות המטופל, ונקודות להמשך. הסיכום יהיה קצר (3-5 משפטים).`,
      },
    ],
  });
  return response.content[0].text.trim();
}

/**
 * Generate therapeutic recommendations based on session notes.
 */
export async function getTherapeuticRecommendations({ patientName, focusAreaLabel, notes, therapistProfession }) {
  const response = await client.messages.create({
    model: 'claude-opus-4-6',
    max_tokens: 1024,
    messages: [
      {
        role: 'user',
        content: `אתה מדריך CBT מנוסח המסייע בסופרוויזיה. בהתבסס על הערות ההדרכה שלהלן, הצע 3-5 המלצות טיפוליות קצרות ומעשיות.

מטופל: ${patientName || 'לא צוין'}
תחום התמקדות: ${focusAreaLabel}
${therapistProfession ? `מקצוע המטפל: ${therapistProfession}` : ''}

הערות ההדרכה:
${notes}

הצג את ההמלצות כרשימה ממוספרת בעברית. כל המלצה — משפט אחד או שניים. התמקד בצעדים מעשיים ל-CBT.`,
      },
    ],
  });
  return response.content[0].text.trim();
}

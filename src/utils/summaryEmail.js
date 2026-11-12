// A supervision summary for the therapist, opened as a Gmail draft for the supervisor
// to read and send. The supervisor's own follow-up points (supervisorRecs) are not
// included, the same as in the PDF.

export function buildSummaryEmail({ therapistName, date, items }) {
  const blocks = items.map(it => [
    it.patientName,
    it.summary?.trim(),
    it.issues?.trim() && `סוגיות שעלו:\n${it.issues.trim()}`,
    it.recommendations?.trim() && `המלצות:\n${it.recommendations.trim()}`,
  ].filter(Boolean).join('\n\n'));
  const body = [
    `שלום ${therapistName || ''},`.replace(' ,', ','),
    `להלן סיכום מפגש ההדרכה מתאריך ${date}.`,
    blocks.join('\n\n————————\n\n'),
    'בברכה,',
  ].join('\n\n');
  return { subject: `סיכום מפגש הדרכה, ${date}`, body };
}

// Gmail refuses very long addresses, so a long summary goes through the clipboard
const MAX_URL = 7500;

function composeUrl(to, subject, body) {
  const params = new URLSearchParams({ view: 'cm', fs: '1', to: to || '', su: subject, body });
  return `https://mail.google.com/mail/?${params}`;
}

// Opens the draft in a new tab. Must be called straight from a click.
// Returns 'opened', or 'clipboard' when the body was too long and has to be pasted.
export function openGmailDraft({ to, subject, body }) {
  let url = composeUrl(to, subject, body);
  let result = 'opened';
  if (url.length > MAX_URL) {
    navigator.clipboard?.writeText(body).catch(() => {});
    url = composeUrl(to, subject, 'הסיכום הועתק. הדבק אותו כאן (Ctrl+V).');
    result = 'clipboard';
  }
  window.open(url, '_blank', 'noopener');
  return result;
}

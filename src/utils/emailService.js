import emailjs from '@emailjs/browser';

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Builds an HTML list of materials where each item with a URL is a clickable
 * link (name as the link text) instead of showing the raw URL.
 * Requires the EmailJS template's materials_list variable to be rendered as
 * raw HTML (triple braces `{{{materials_list}}}`), not escaped text.
 */
export function formatMaterialsListHtml(materials) {
  const items = materials.map((m) => {
    const name = escapeHtml(m.name || 'ללא שם');
    const body = m.url ? `<a href="${escapeHtml(m.url)}" style="color:#14353d;font-weight:bold;">${name}</a>` : name;
    return `<li style="margin:0 0 8px;">${body}</li>`;
  });
  return `<ul style="margin:0;padding:0 18px 0 0;">${items.join('')}</ul>`;
}

export async function sendFormEmail({ therapistEmail, therapistName, patientName, formLink }) {
  const serviceId = import.meta.env.VITE_EMAILJS_SERVICE_ID;
  const templateId = import.meta.env.VITE_EMAILJS_TEMPLATE_ID;
  const publicKey = import.meta.env.VITE_EMAILJS_PUBLIC_KEY;

  await emailjs.send(
    serviceId,
    templateId,
    {
      to_email: therapistEmail,
      to_name: therapistName,
      patient_name: patientName,
      form_link: formLink,
    },
    publicKey
  );
}

export async function sendSessionSummaryEmail({ therapistEmail, therapistName, patientName, date, summary }) {
  const serviceId = import.meta.env.VITE_EMAILJS_SERVICE_ID;
  const templateId = import.meta.env.VITE_EMAILJS_SUMMARY_TEMPLATE_ID;
  const publicKey = import.meta.env.VITE_EMAILJS_PUBLIC_KEY;

  await emailjs.send(
    serviceId,
    templateId,
    {
      to_email: therapistEmail,
      to_name: therapistName,
      patient_name: patientName,
      session_date: date,
      summary_text: summary,
    },
    publicKey
  );
}

export async function sendMaterialsEmail({ therapistEmail, therapistName, materialsList }) {
  const serviceId = import.meta.env.VITE_EMAILJS_SERVICE_ID;
  const templateId = import.meta.env.VITE_EMAILJS_MATERIALS_TEMPLATE_ID;
  const publicKey = import.meta.env.VITE_EMAILJS_PUBLIC_KEY;

  await emailjs.send(
    serviceId,
    templateId,
    {
      to_email: therapistEmail,
      to_name: therapistName,
      materials_list: materialsList,
    },
    publicKey
  );
}

import emailjs from '@emailjs/browser';

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

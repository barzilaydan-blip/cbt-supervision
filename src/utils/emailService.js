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

# תבניות מייל

שלוש תבניות HTML למיילים שהאפליקציה שולחת דרך EmailJS, באותה שפה עיצובית של האפליקציה
ושל קובצי ה-PDF: כותרת עם הלוגו, השם והתואר, וקו תכלת מתחתיה.

התבניות עצמן שמורות בחשבון EmailJS ולא בקוד, ולכן הקבצים כאן אינם בשימוש עד שמדביקים אותם שם.

| קובץ | התבנית ב-EmailJS | משתנים |
| --- | --- | --- |
| `form-link.html` | `VITE_EMAILJS_TEMPLATE_ID` | `to_name`, `patient_name`, `form_link` |
| `materials.html` | `VITE_EMAILJS_MATERIALS_TEMPLATE_ID` | `to_name`, `materials_list` |
| `session-summary.html` | `VITE_EMAILJS_SUMMARY_TEMPLATE_ID` | `to_name`, `patient_name`, `session_date`, `summary_text` |

ב-`materials.html` המשתנה `materials_list` חייב להישאר בשלושה סוגריים מסולסלים, כי הוא מכיל HTML.
הלוגו נטען מהאתר החי: `https://barzilaydan-blip.github.io/cbt-supervision/logo.png`.

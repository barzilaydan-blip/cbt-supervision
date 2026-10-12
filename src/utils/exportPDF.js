import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { FOCUS_AREAS } from '../constants.js';

// The documents share the app's palette, written out because they render
// off-screen and are then rasterised.
const INK = '#132a30';
const INK_2 = '#44595f';
const RULE = '#9cc9ea';
const RULE_SOFT = '#d9eaf6';
const RISK = '#c2362b';
const PAGE_WIDTH_PX = 750;

const TAG_LABELS = {
  motivation: 'מוטיבציה', treatmentGoals: 'מטרות טיפול',
  interventionTech: 'טכניקות התערבות', theoreticalKnow: 'ידע תיאורטי',
  treatmentPlanning: 'תכנון טיפול', homework: 'שיעורי בית', conceptualization: 'המשגה',
};

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// 'YYYY-MM-DD' → 'DD.MM.YYYY'
function shortDate(dateStr) {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-');
  return `${d}.${m}.${y}`;
}

function todayLabel() {
  return new Date().toLocaleDateString('he-IL', { year: 'numeric', month: 'long', day: 'numeric' });
}

function safeFileName(name) {
  return name.replace(/[^a-zA-Z֐-׿\s]/g, '').trim().replace(/\s+/g, '_');
}

/**
 * The page every exported document starts from: letterhead, title and a line
 * of facts. Blocks appended to it carry `data-block`, so page breaks fall
 * between blocks instead of through a line of text.
 */
function buildDocument({ title, facts }) {
  const container = document.createElement('div');
  container.style.cssText = [
    'direction: rtl',
    "font-family: 'Heebo Variable', Heebo, Arial, sans-serif",
    'font-size: 15px',
    'line-height: 1.6',
    `color: ${INK}`,
    'background: #ffffff',
    'padding: 28px 40px 32px',
    `width: ${PAGE_WIDTH_PX}px`,
    'box-sizing: border-box',
  ].join('; ');

  container.innerHTML = `
    <div data-block style="display:flex;align-items:center;gap:14px;padding-bottom:14px;border-bottom:2px solid ${RULE};">
      <img src="${import.meta.env.BASE_URL}logo.png" alt="" style="height:54px;" />
      <div>
        <div style="font-size:17px;font-weight:700;">דן ברזילי, פסיכולוג חינוכי</div>
        <div style="font-size:13px;color:${INK_2};">מומחה ומדריך בטיפול ב- CBT</div>
      </div>
    </div>
    <div data-block style="padding:22px 0 14px;">
      <h1 style="margin:0;font-size:22px;font-weight:700;line-height:1.3;">${escapeHtml(title)}</h1>
      <div style="font-size:13px;color:${INK_2};margin-top:2px;">${facts.filter(Boolean).map(escapeHtml).join(' · ')}</div>
    </div>
  `;
  return container;
}

function addBlock(container, html, style = '') {
  const block = document.createElement('div');
  block.setAttribute('data-block', '');
  block.style.cssText = style;
  block.innerHTML = html;
  container.appendChild(block);
  return block;
}

function labelled(label, text, color = INK) {
  return `
    ${label ? `<div style="font-size:13px;font-weight:700;color:${color};margin-top:8px;">${escapeHtml(label)}</div>` : ''}
    <div style="white-space:pre-wrap;">${escapeHtml(text.trim())}</div>
  `;
}

/**
 * Rasterise a built document and save it as an A4 PDF, breaking pages at
 * block boundaries.
 */
async function savePdf(container, fileName) {
  container.style.position = 'fixed';
  container.style.top = '-9999px';
  container.style.left = '-9999px';
  container.style.zIndex = '-1';
  document.body.appendChild(container);

  try {
    await Promise.all([...container.querySelectorAll('img')].map(img =>
      img.complete ? null : new Promise(resolve => { img.onload = img.onerror = resolve; })
    ));
    await document.fonts?.ready;

    const scale = 2;
    const canvas = await html2canvas(container, {
      scale,
      useCORS: true,
      backgroundColor: '#ffffff',
      width: PAGE_WIDTH_PX,
      windowWidth: PAGE_WIDTH_PX,
      logging: false,
    });

    const pageWidth = 210;
    const pageHeight = 297;
    const margin = 12;
    const contentWidth = pageWidth - margin * 2;
    const pxPerMm = canvas.width / contentWidth;
    const pageHeightPx = Math.floor((pageHeight - margin * 2 - 6) * pxPerMm);

    // Where a page may end: the top edge of every block, in canvas pixels
    const top = container.getBoundingClientRect().top;
    const breaks = [...container.querySelectorAll('[data-block]')]
      .map(el => Math.round((el.getBoundingClientRect().top - top) * scale))
      .filter(y => y > 0);

    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    let start = 0;
    let first = true;
    while (start < canvas.height) {
      const limit = start + pageHeightPx;
      let end = canvas.height;
      if (limit < canvas.height) {
        // The last block boundary that still fits; a block taller than a page is cut
        end = breaks.filter(y => y > start && y <= limit).pop() || limit;
      }
      const slice = document.createElement('canvas');
      slice.width = canvas.width;
      slice.height = end - start;
      slice.getContext('2d').drawImage(canvas, 0, start, canvas.width, slice.height, 0, 0, canvas.width, slice.height);
      if (!first) doc.addPage();
      // JPEG keeps a multi-page export to a size that can be emailed
      doc.addImage(slice.toDataURL('image/jpeg', 0.92), 'JPEG', margin, margin, contentWidth, slice.height / pxPerMm);
      first = false;
      start = end;
    }

    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(9);
      doc.setTextColor(68, 89, 95);
      doc.text(`${i} / ${pageCount}`, pageWidth / 2, pageHeight - 7, { align: 'center' });
    }
    doc.save(fileName);
  } finally {
    document.body.removeChild(container);
  }
}

/**
 * Export a patient's supervisions as a PDF.
 * @param {object} params
 * @param {string} params.patientName
 * @param {string} params.therapistName
 * @param {Array}  params.sessions - sorted ascending by date
 */
export async function exportPatientPDF({ patientName, therapistName, sessions }) {
  const container = buildDocument({
    title: `מעקב הדרכות: ${patientName}`,
    facts: [
      `מטפל: ${therapistName}`,
      sessions.length === 1 ? 'הדרכה אחת' : `${sessions.length} הדרכות`,
      `הופק ב-${todayLabel()}`,
    ],
  });

  if (sessions.length === 0) {
    addBlock(container, 'אין הדרכות לייצוא.', `color:${INK_2};padding:24px 0;`);
  }

  sessions.forEach((session, index) => {
    const n = session.notes || {};
    const tags = Object.entries(n.tags || {}).filter(([, on]) => on).map(([key]) => TAG_LABELS[key] || key);
    const parts = [
      n.danger && n.dangerNote?.trim() && labelled('הערת מסוכנות', n.dangerNote, RISK),
      n.report?.trim() && labelled('דיווח המודרך', n.report),
      n.issues?.trim() && labelled('סוגיות ודילמות', n.issues),
      n.recommendations?.trim() && labelled('המלצות וצעדים הבאים', n.recommendations),
      // Notes written before the three-field structure existed
      ...FOCUS_AREAS
        .filter(fa => typeof n[fa.key] === 'string' && n[fa.key].trim())
        .map(fa => labelled(fa.label, n[fa.key])),
      session.summary?.trim() && labelled('סיכום', session.summary),
      // The supervisor's own follow-up notes (supervisorRecs) stay out of the export:
      // this document may be handed to the therapist.
    ].filter(Boolean);

    addBlock(container, `
      <div style="flex:none;width:92px;">
        <div style="font-size:17px;font-weight:700;">${escapeHtml(shortDate(session.date))}</div>
        <div style="font-size:13px;color:${INK_2};">הדרכה ${index + 1}</div>
        ${n.danger ? `<div style="font-size:13px;font-weight:700;color:${RISK};">מסוכנות</div>` : ''}
      </div>
      <div style="flex:1;min-width:0;border-right:2px solid ${RULE};padding-right:16px;">
        ${tags.length ? `<div style="font-size:13px;color:${INK_2};">${tags.map(escapeHtml).join(' · ')}</div>` : ''}
        ${parts.length ? parts.join('') : `<div style="color:${INK_2};">לא נשמר תוכן להדרכה זו.</div>`}
      </div>
    `, `display:flex;gap:16px;padding:14px 0;border-top:1px solid ${RULE_SOFT};`);
  });

  await savePdf(container, `הדרכות_${safeFileName(patientName)}.pdf`);
}

/**
 * Export the supervision hours summary of a therapist as a PDF.
 * `patientRows` items: { name, count, sessionDetails: [{ date, tags }] }
 */
export async function exportSummaryPDF({ therapist, patientRows, uniqueDates, totalHours }) {
  const therapistName = therapist?.name || '';
  const hoursPerSession = parseFloat(therapist?.hoursPerSession) || 0;

  const container = buildDocument({
    title: 'סיכום שעות הדרכה',
    facts: [therapistName, therapist?.profession, `הופק ב-${todayLabel()}`],
  });

  const totals = [
    ['מפגשי הדרכה', uniqueDates.length],
    ...(hoursPerSession > 0 ? [['שעות למפגש', hoursPerSession], ['סה"כ שעות', totalHours]] : []),
  ];
  addBlock(container, totals.map(([label, value]) => `
    <div style="flex:1;">
      <div style="font-size:13px;color:${INK_2};">${label}</div>
      <div style="font-size:22px;font-weight:700;">${escapeHtml(value)}</div>
    </div>
  `).join(''), `display:flex;gap:24px;padding:12px 0 16px;border-top:1px solid ${RULE_SOFT};border-bottom:2px solid ${RULE};`);

  addBlock(container, `
    <div style="flex:none;width:150px;">מטופל</div>
    <div style="flex:none;width:80px;">הדרכות</div>
    <div style="flex:1;">תאריכים</div>
  `, `display:flex;gap:16px;padding:14px 0 6px;font-size:13px;font-weight:700;color:${INK_2};`);

  patientRows.forEach(row => {
    addBlock(container, `
      <div style="flex:none;width:150px;font-weight:700;">${escapeHtml(row.name)}</div>
      <div style="flex:none;width:80px;">${row.count}</div>
      <div style="flex:1;color:${INK_2};">${row.sessionDetails.map(s => escapeHtml(shortDate(s.date))).join(' · ')}</div>
    `, `display:flex;gap:16px;padding:8px 0;border-top:1px solid ${RULE_SOFT};`);
  });

  if (patientRows.length === 0) {
    addBlock(container, 'עדיין לא תועדו הדרכות.', `color:${INK_2};padding:12px 0;border-top:1px solid ${RULE_SOFT};`);
  }

  await savePdf(container, `סיכום_הדרכות_${safeFileName(therapistName)}.pdf`);
}

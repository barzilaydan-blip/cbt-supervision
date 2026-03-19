import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { FOCUS_AREAS } from '../constants.js';

/**
 * Format a YYYY-MM-DD date string to a Hebrew locale date string.
 */
function formatDate(dateStr) {
  if (!dateStr) return '';
  try {
    const [y, m, d] = dateStr.split('-');
    return new Date(Number(y), Number(m) - 1, Number(d)).toLocaleDateString('he-IL', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

/**
 * Build an HTML element containing all session data, styled for PDF export.
 * Returns a DOM element (not appended to document).
 */
function buildPDFElement({ patientName, therapistName, sessions }) {
  const container = document.createElement('div');
  container.style.cssText = [
    'direction: rtl',
    'font-family: Arial, Helvetica, sans-serif',
    'font-size: 13px',
    'line-height: 1.7',
    'color: #1a202c',
    'background: #ffffff',
    'padding: 32px 40px',
    'width: 750px',
    'box-sizing: border-box',
  ].join('; ');

  // Header
  const header = document.createElement('div');
  header.style.cssText = [
    'background: linear-gradient(135deg, #234e52 0%, #2c7a7b 100%)',
    'color: white',
    'padding: 24px 28px',
    'border-radius: 10px',
    'margin-bottom: 28px',
  ].join('; ');

  const title = document.createElement('h1');
  title.style.cssText = 'margin: 0 0 6px 0; font-size: 20px; font-weight: 700;';
  title.textContent = `מעקב הדרכות CBT – ${patientName}`;

  const sub = document.createElement('p');
  sub.style.cssText = 'margin: 0; font-size: 14px; opacity: 0.88;';
  sub.textContent = `מטפל: ${therapistName}  |  מספר הדרכות: ${sessions.length}`;

  header.appendChild(title);
  header.appendChild(sub);
  container.appendChild(header);

  if (sessions.length === 0) {
    const empty = document.createElement('p');
    empty.style.cssText = 'color: #718096; text-align: center; padding: 40px;';
    empty.textContent = 'אין הדרכות לייצוא.';
    container.appendChild(empty);
    return container;
  }

  sessions.forEach((session, sIdx) => {
    const filledAreas = FOCUS_AREAS.filter(
      (fa) => session.notes && session.notes[fa.key] && session.notes[fa.key].trim()
    );

    const sessionBlock = document.createElement('div');
    sessionBlock.style.cssText = [
      'margin-bottom: 28px',
      'page-break-inside: avoid',
      'background: #f8fffe',
      'border: 1px solid #b2f5ea',
      'border-radius: 8px',
      'overflow: hidden',
    ].join('; ');

    // Session header
    const sessionHeader = document.createElement('div');
    sessionHeader.style.cssText = [
      'background: #e6fffa',
      'border-bottom: 1px solid #b2f5ea',
      'padding: 12px 18px',
      'display: flex',
      'align-items: center',
      'gap: 12px',
    ].join('; ');

    const sessionNum = document.createElement('span');
    sessionNum.style.cssText = [
      'background: #2c7a7b',
      'color: white',
      'border-radius: 50%',
      'width: 26px',
      'height: 26px',
      'display: inline-flex',
      'align-items: center',
      'justify-content: center',
      'font-size: 12px',
      'font-weight: 700',
      'flex-shrink: 0',
    ].join('; ');
    sessionNum.textContent = String(sIdx + 1);

    const sessionTitle = document.createElement('h2');
    sessionTitle.style.cssText = [
      'margin: 0',
      'font-size: 15px',
      'font-weight: 700',
      'color: #234e52',
      'flex: 1',
    ].join('; ');
    sessionTitle.textContent = `הדרכה ${sIdx + 1} – ${formatDate(session.date)}`;

    sessionHeader.appendChild(sessionNum);
    sessionHeader.appendChild(sessionTitle);
    sessionBlock.appendChild(sessionHeader);

    if (filledAreas.length === 0) {
      const noContent = document.createElement('p');
      noContent.style.cssText = 'padding: 12px 18px; color: #718096; font-style: italic; margin: 0;';
      noContent.textContent = 'אין תוכן בהדרכה זו.';
      sessionBlock.appendChild(noContent);
    } else {
      const areasContainer = document.createElement('div');
      areasContainer.style.padding = '16px 18px';

      filledAreas.forEach((fa, faIdx) => {
        const areaBlock = document.createElement('div');
        areaBlock.style.cssText = [
          'margin-bottom: 14px',
          faIdx < filledAreas.length - 1 ? 'padding-bottom: 14px; border-bottom: 1px dashed #bee3f8' : '',
        ].join('; ');

        const areaTitle = document.createElement('h3');
        areaTitle.style.cssText = [
          'margin: 0 0 5px 0',
          'font-size: 13px',
          'font-weight: 700',
          'color: #2c7a7b',
          'display: flex',
          'align-items: center',
          'gap: 6px',
        ].join('; ');
        areaTitle.textContent = `▪ ${fa.label}`;

        const areaContent = document.createElement('p');
        areaContent.style.cssText = [
          'margin: 0',
          'font-size: 13px',
          'color: #2d3748',
          'white-space: pre-wrap',
          'line-height: 1.7',
          'padding-right: 14px',
        ].join('; ');
        areaContent.textContent = session.notes[fa.key].trim();

        areaBlock.appendChild(areaTitle);
        areaBlock.appendChild(areaContent);
        areasContainer.appendChild(areaBlock);
      });

      sessionBlock.appendChild(areasContainer);
    }

    container.appendChild(sessionBlock);
  });

  // Footer
  const footer = document.createElement('div');
  footer.style.cssText = [
    'margin-top: 24px',
    'padding-top: 16px',
    'border-top: 1px solid #e2e8f0',
    'font-size: 11px',
    'color: #a0aec0',
    'text-align: center',
  ].join('; ');
  const exportDate = new Date().toLocaleDateString('he-IL', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
  footer.textContent = `הופק ב-${exportDate} | מעקב הדרכות CBT`;
  container.appendChild(footer);

  return container;
}

/**
 * Export patient supervision sessions as a PDF using html2canvas + jsPDF.
 * @param {object} params
 * @param {string} params.patientName
 * @param {string} params.therapistName
 * @param {Array}  params.sessions - sorted ascending by date
 */
export async function exportPatientPDF({ patientName, therapistName, sessions }) {
  // Build the HTML element
  const element = buildPDFElement({ patientName, therapistName, sessions });

  // Attach to document temporarily (off-screen) so it renders properly
  element.style.position = 'fixed';
  element.style.top = '-9999px';
  element.style.left = '-9999px';
  element.style.zIndex = '-1';
  document.body.appendChild(element);

  try {
    // Render to canvas using html2canvas
    const canvas = await html2canvas(element, {
      scale: 2,
      useCORS: true,
      allowTaint: true,
      backgroundColor: '#ffffff',
      width: 750,
      windowWidth: 750,
      logging: false,
    });

    const imgData = canvas.toDataURL('image/png');

    // A4 dimensions in mm
    const pageWidth = 210;
    const pageHeight = 297;
    const margin = 10; // mm
    const contentWidth = pageWidth - margin * 2;

    // Calculate image dimensions
    const imgWidthPx = canvas.width;
    const imgHeightPx = canvas.height;
    const ratio = imgHeightPx / imgWidthPx;
    const imgWidthMm = contentWidth;
    const imgHeightMm = contentWidth * ratio;

    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    });

    // How many pages do we need?
    const contentHeightPerPage = pageHeight - margin * 2;
    const totalPages = Math.ceil(imgHeightMm / contentHeightPerPage);

    for (let page = 0; page < totalPages; page++) {
      if (page > 0) doc.addPage();

      // Calculate the portion of the image to show on this page
      const srcY = page * contentHeightPerPage;
      const remainingHeight = imgHeightMm - srcY;
      const sliceHeightMm = Math.min(contentHeightPerPage, remainingHeight);

      // In pixels
      const pxPerMm = imgWidthPx / imgWidthMm;
      const srcYPx = Math.round(srcY * pxPerMm);
      const sliceHeightPx = Math.round(sliceHeightMm * pxPerMm);

      // Create a slice canvas
      const sliceCanvas = document.createElement('canvas');
      sliceCanvas.width = imgWidthPx;
      sliceCanvas.height = sliceHeightPx;
      const ctx = sliceCanvas.getContext('2d');
      ctx.drawImage(canvas, 0, srcYPx, imgWidthPx, sliceHeightPx, 0, 0, imgWidthPx, sliceHeightPx);

      const sliceData = sliceCanvas.toDataURL('image/png');
      doc.addImage(sliceData, 'PNG', margin, margin, imgWidthMm, sliceHeightMm);
    }

    // Add page numbers
    const totalPagesCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= totalPagesCount; i++) {
      doc.setPage(i);
      doc.setFontSize(9);
      doc.setTextColor(160, 174, 192);
      doc.text(`${i} / ${totalPagesCount}`, pageWidth / 2, pageHeight - 5, { align: 'center' });
    }

    const safeName = patientName.replace(/[^a-zA-Z\u0590-\u05FF\s]/g, '').trim().replace(/\s+/g, '_');
    doc.save(`הדרכות_${safeName}.pdf`);
  } finally {
    document.body.removeChild(element);
  }
}

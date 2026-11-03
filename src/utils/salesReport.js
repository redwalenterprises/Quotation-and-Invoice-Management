import { rowCalc } from './calculations.js';

// Invoice print (InvoicePrint.jsx) wale hi naam/logo
const BUSINESS_NAME = 'SALON CHAIR WALA';
const BUSINESS_LOGO = '/logo.webp';

// image ke charo taraf ki khali (safed/transparent) jagah ka box nikalta hai
export function findContentBox(rgba, w, h) {
  let minX = w, minY = h, maxX = -1, maxY = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const a = rgba[i + 3];
      const isBlank = a < 20 || (rgba[i] > 245 && rgba[i + 1] > 245 && rgba[i + 2] > 245);
      if (!isBlank) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) return { x: 0, y: 0, w, h }; // poori image khali
  return { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 };
}

// jsPDF webp support nahi karta, isliye canvas se JPEG bana ke deta hu
async function loadLogo(url = BUSINESS_LOGO) {
  try {
    if (typeof document === 'undefined') return null;
    const img = new Image();
    img.src = url;
    await img.decode();
    const c = document.createElement('canvas');
    c.width = img.naturalWidth;
    c.height = img.naturalHeight;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.drawImage(img, 0, 0);

    // khali kinare crop karo, taaki logo sahi size me dikhe
    const box = findContentBox(ctx.getImageData(0, 0, c.width, c.height).data, c.width, c.height);
    const c2 = document.createElement('canvas');
    c2.width = box.w;
    c2.height = box.h;
    const ctx2 = c2.getContext('2d');
    ctx2.fillStyle = '#fff';
    ctx2.fillRect(0, 0, box.w, box.h);
    ctx2.drawImage(c, box.x, box.y, box.w, box.h, 0, 0, box.w, box.h);
    return { data: c2.toDataURL('image/jpeg', 0.92), w: box.w, h: box.h };
  } catch (e) {
    console.warn('Logo load nahi hua, bina logo ke report ban rahi hai', e);
    return null;
  }
}

// jsPDF ke default font me ₹ nahi hota, isliye PDF me "Rs." use kiya hai
const money = (n) =>
  'Rs. ' + Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const num = (n) =>
  Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const dmy = (s) => (s ? s.split('-').reverse().join('/') : '');

// head/foot cells ko bhi numbers ke saath align karne ke liye
const alignCols = (right, center = []) => (data) => {
  if (data.section === 'body') return;
  if (right.includes(data.column.index)) data.cell.styles.halign = 'right';
  if (center.includes(data.column.index)) data.cell.styles.halign = 'center';
};

const sum = (list, k) => list.reduce((s, i) => s + Number(i[k] || 0), 0);

// invoices: filtered list (jo table me dikh rahi hai)
// detailed=false -> sirf day-wise summary
// detailed=true  -> din ke andar har bill + uske saare items (qty, price, disc, tax, amount)
export async function generateSalesReportPDF({ invoices, fromDate, toDate, businessName = BUSINESS_NAME, detailed = false, logo }) {
  // lazy load: jspdf tabhi load hoga jab report banani ho
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
  ]);

  // 1) din ke hisaab se group
  const byDay = {};
  invoices.forEach((inv) => {
    const d = inv.date || 'Unknown';
    (byDay[d] = byDay[d] || []).push(inv);
  });
  const days = Object.keys(byDay).sort();

  const grand = { bills: invoices.length, total: sum(invoices, 'total'), paid: sum(invoices, 'paidAmount') };
  grand.due = grand.total - grand.paid;

  const doc = new jsPDF('p', 'mm', 'a4');
  const pageW = doc.internal.pageSize.getWidth();

  // 2) header: logo + naam + ek line me period
  const logoImg = logo === undefined ? await loadLogo() : logo;
  if (logoImg) {
    const h = 15;
    const w = (h * logoImg.w) / logoImg.h;
    doc.addImage(logoImg.data, 'JPEG', 14, 7, w, h);
  }
  doc.setFont('helvetica', 'bold').setFontSize(16).setTextColor(20);
  doc.text(businessName, pageW / 2, 14, { align: 'center' });
  doc.setFont('helvetica', 'normal').setFontSize(9.5).setTextColor(90);
  doc.text(`${dmy(fromDate)} to ${dmy(toDate)}`, pageW / 2, 20.5, { align: 'center' });
  doc.setTextColor(0);

  const BLUE = [45, 156, 219];
  const headStyles = { fillColor: BLUE, textColor: 255, fontStyle: 'bold' };

  if (!detailed) {
    // ---- Summary: din ki ek row ----
    autoTable(doc, {
      startY: 30,
      head: [['Date', 'Bills', 'Total Sales', 'Received', 'Due']],
      body: days.map((d) => {
        const list = byDay[d];
        const total = sum(list, 'total');
        const paid = sum(list, 'paidAmount');
        return [dmy(d), list.length, money(total), money(paid), money(total - paid)];
      }),
      foot: [['Grand Total', grand.bills, money(grand.total), money(grand.paid), money(grand.due)]],
      headStyles,
      footStyles: { fillColor: [240, 240, 240], textColor: 20, fontStyle: 'bold' },
      showFoot: 'lastPage',
      styles: { fontSize: 9.5, cellPadding: 2.2 },
      columnStyles: { 1: { halign: 'center' }, 2: { halign: 'right' }, 3: { halign: 'right' }, 4: { halign: 'right' } },
      didParseCell: alignCols([2, 3, 4], [1]),
    });
  } else {
    // ---- Detail: din -> bill -> items ----
    const W = 182; // A4 width 210 - 14 - 14
    const LIMIT = 282; // isse neeche content nahi jayega (footer ke liye jagah)
    const GREY_BG = [240, 242, 245];
    const BILL_BG = [232, 241, 250];
    const STATUS_COLOR = { Paid: [22, 128, 60], Partial: [200, 120, 0], Unpaid: [200, 40, 40] };

    // Discount / Tax column tabhi dikhao jab report me kisi item pe laga ho
    const allItems = invoices.flatMap((i) => i.items || []);
    const hasDisc = allItems.some((r) => rowCalc(r).discountAmount > 0);
    const hasTax = allItems.some((r) => rowCalc(r).taxAmount > 0);
    const keys = ['item', 'qty', 'price', hasDisc && 'disc', hasTax && 'tax', 'amount'].filter(Boolean);
    const n = keys.length;

    const SPEC = {
      item: { label: 'Item', align: 'left' },
      qty: { label: 'Qty', align: 'center', w: 18 },
      price: { label: 'Price/Unit', align: 'right', w: 28 },
      disc: { label: 'Discount', align: 'right', w: 32 },
      tax: { label: 'Tax', align: 'right', w: 32 },
      amount: { label: 'Amount', align: 'right', w: 32 },
    };
    const itemW = W - keys.reduce((t, k) => t + (SPEC[k].w || 0), 0);
    const columnStyles = {};
    keys.forEach((k, idx) => {
      columnStyles[idx] = { halign: SPEC[k].align, cellWidth: SPEC[k].w || itemW };
    });
    // item rows thode andar se shuru (bill header ke neeche indent)
    columnStyles[0].cellPadding = { top: 2, bottom: 2, left: 7, right: 2 };

    const baseStyles = {
      fontSize: 9,
      cellPadding: { top: 2, bottom: 2, left: 3, right: 3 },
      textColor: [60, 60, 60],
      lineColor: [228, 228, 228],
      lineWidth: { bottom: 0.1 },
      overflow: 'linebreak',
    };

    // ek bill ki lagbhag height (mm) -> taaki bill do pages me na tute
    // (asli PDF se napa hua: ek line wali row ~7.5mm, bill header ~8.5mm)
    const ROW = 7.5;
    function estimateBill(inv) {
      const items = inv.items || [];
      const total = Number(inv.total || 0);
      let h = 8.5; // bill header
      if (items.length === 0) h += ROW;
      let itemsSum = 0;
      items.forEach((r) => {
        itemsSum += rowCalc(r).amount;
        h += ROW + (r.itemDescription ? 3.7 : 0);
      });
      if (items.length > 0 && Math.abs(total - itemsSum) >= 0.005) h += ROW; // round off
      h += ROW * 2; // bill total + received
      if (total - Number(inv.paidAmount || 0) > 0.005) h += ROW; // balance due
      return h + 4 + 1; // gap + thoda safety
    }

    function drawDayHead(d, list, dayTotal, dayDue, continued) {
      // blue bar seedha draw karte hain (autotable colSpan se columns khisak jate the)
      const barH = 8;
      doc.setFillColor(...BLUE);
      doc.rect(14, y, W, barH, 'F');
      doc.setFont('helvetica', 'bold').setFontSize(9.5).setTextColor(255);
      doc.text(
        `${dmy(d)}${continued ? ' (continued)' : ''}   -   ${list.length} bill${list.length > 1 ? 's' : ''}`,
        17,
        y + 5.4
      );
      doc.text(`Total ${money(dayTotal)}     Due ${money(dayDue)}`, 14 + W - 3, y + 5.4, { align: 'right' });
      doc.setTextColor(0).setFont('helvetica', 'normal');
      y += barH;

      // neeche column names ki line (bill tables jaisi hi widths se)
      const labH = 7;
      doc.setFillColor(...GREY_BG);
      doc.rect(14, y, W, labH, 'F');
      doc.setFont('helvetica', 'bold').setFontSize(8).setTextColor(90, 90, 90);
      let x = 14;
      keys.forEach((k) => {
        const w = columnStyles[keys.indexOf(k)].cellWidth;
        const al = SPEC[k].align;
        const tx = al === 'left' ? x + 3 : al === 'center' ? x + w / 2 : x + w - 3;
        doc.text(SPEC[k].label, tx, y + 4.7, { align: al });
        x += w;
      });
      doc.setTextColor(0).setFont('helvetica', 'normal');
      y += labH;
    }

    function drawBill(inv) {
      const items = inv.items || [];
      const total = Number(inv.total || 0);
      const paid = Number(inv.paidAmount || 0);
      const bal = total - paid;
      const status = paid >= total && total > 0 ? 'Paid' : paid > 0 ? 'Partial' : 'Unpaid';
      const body = [];

      // bill header
      body.push([
        {
          content: `#${inv.invoiceNo}     ${inv.partyName || '-'}`,
          colSpan: n - 2,
          styles: { fillColor: BILL_BG, fontStyle: 'bold', fontSize: 10, textColor: 20 },
        },
        {
          content: `${inv.paymentType || '-'}   -   ${status}`,
          colSpan: 2,
          styles: { fillColor: BILL_BG, fontStyle: 'bold', halign: 'right', textColor: STATUS_COLOR[status] },
        },
      ]);

      // items
      let itemsSum = 0;
      if (items.length === 0) {
        body.push([{ content: '(item details available nahi hain)', colSpan: n, styles: { fontStyle: 'italic', textColor: 140 } }]);
      }
      items.forEach((row) => {
        const c = rowCalc(row);
        itemsSum += c.amount;
        const pct = row.discountAmount === '' || row.discountAmount == null ? Number(row.discountPercent) || 0 : 0;
        const unit = !row.unit || row.unit === 'NONE' ? '' : ` ${row.unit}`;
        const cell = {
          item: row.item + (row.itemDescription ? `\n${row.itemDescription}` : ''),
          qty: `${row.qty}${unit}`,
          price: num(row.price),
          disc: c.discountAmount > 0 ? num(c.discountAmount) + (pct ? ` (${pct}%)` : '') : '-',
          tax: c.taxAmount > 0 ? num(c.taxAmount) + ` (${c.taxPercent}%)` : '-',
          amount: num(c.amount),
        };
        body.push(keys.map((k) => cell[k]));
      });

      // round off, total, balance
      const lab = (t, extra = {}) => ({ content: t, colSpan: n - 1, styles: { halign: 'right', ...extra } });
      const val = (t, extra = {}) => ({ content: t, styles: { halign: 'right', ...extra } });
      const ro = total - itemsSum;
      if (items.length > 0 && Math.abs(ro) >= 0.005) {
        const g = { fontStyle: 'italic', textColor: 130 };
        body.push([lab('Round off', g), val((ro > 0 ? '+' : '') + num(ro), g)]);
      }
      body.push([lab('Bill Total', { fontStyle: 'bold', textColor: 20 }), val(money(total), { fontStyle: 'bold', textColor: 20 })]);
      body.push([lab('Received', { textColor: STATUS_COLOR.Paid }), val(money(paid), { textColor: STATUS_COLOR.Paid })]);
      if (bal > 0.005) {
        const r = { fontStyle: 'bold', textColor: STATUS_COLOR.Unpaid };
        body.push([lab('Balance Due', r), val(money(bal), r)]);
      }

      autoTable(doc, {
        startY: y,
        theme: 'plain',
        body,
        styles: baseStyles,
        columnStyles,
        tableWidth: W,
        rowPageBreak: 'avoid',
      });
      y = doc.lastAutoTable.finalY + 4;
    }

    let y = 30;
    days.forEach((d) => {
      const list = byDay[d].slice().sort((a, b) => Number(a.invoiceNo) - Number(b.invoiceNo));
      const dayTotal = sum(list, 'total');
      const dayDue = dayTotal - sum(list, 'paidAmount');
      let headDrawn = false;
      let anyDrawn = false;

      list.forEach((inv) => {
        const need = estimateBill(inv) + (headDrawn ? 0 : 15);
        if (y + need > LIMIT && y > 30) {
          doc.addPage();
          y = 14;
          headDrawn = false;
        }
        if (!headDrawn) {
          drawDayHead(d, list, dayTotal, dayDue, anyDrawn);
          headDrawn = true;
        }
        drawBill(inv);
        anyDrawn = true;
      });
      y += 3;
    });

    // Grand total
    if (y + 28 > LIMIT) {
      doc.addPage();
      y = 14;
    }
    autoTable(doc, {
      startY: y,
      theme: 'plain',
      head: [['Grand Total', 'Bills', 'Total Sales', 'Received', 'Due']],
      body: [['', grand.bills, money(grand.total), money(grand.paid), money(grand.due)]],
      styles: { fontSize: 10, cellPadding: 2.6, fontStyle: 'bold', textColor: 20 },
      headStyles: { fillColor: GREY_BG, textColor: [90, 90, 90], fontSize: 8.5 },
      columnStyles: { 1: { halign: 'center' }, 2: { halign: 'right' }, 3: { halign: 'right' }, 4: { halign: 'right' } },
      didParseCell: alignCols([2, 3, 4], [1]),
      tableWidth: W,
    });
  }

  // 3) har page pe footer
  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    doc.setFontSize(8).setTextColor(120);
    doc.text(`Page ${p} of ${pages}`, pageW - 14, 290, { align: 'right' });
  }

  // download nahi, sirf blob wapas dete hain (View / Share ke liye)
  const fileName = `Sales-Report-${detailed ? 'Detail' : 'Summary'}-${fromDate}_to_${toDate}.pdf`;
  return { blob: doc.output('blob'), fileName };
}



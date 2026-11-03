import { rowCalc } from '../utils/calculations';
import { amountToWords } from '../utils/numberToWords';
import './InvoicePrint.css'; 
import React, { useRef, useState } from 'react';

const BUSINESS_NAME = 'SALON CHAIR WALA';
const BUSINESS_LOGO = '/logo.webp';
const BUSINESS_PHONE = '9403890310';
const BUSINESS_EMAIL = 'redwalenterprises@gmail.com';

function formatCurrency(n) {
  return `₹${Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function InvoicePrint({ invoice, onBack, mode = 'invoice' }) {
  const isEstimate = mode === 'quotation';
  const docLabel = isEstimate ? 'Estimate' : 'Invoice';
  const docNo = isEstimate
    ? (invoice.refNo || '-')
    : (invoice.invoiceNo || invoice.invoiceNumber || '-');
  const items = invoice.items || [];

  // Optimized single-pass calculation
  const totals = items.reduce(
    (acc, r) => {
      const c = rowCalc(r);
      return {
        base: acc.base + (c.base || 0),
        discount: acc.discount + (c.discountAmount || 0),
        tax: acc.tax + (c.taxAmount || 0),
        amount: acc.amount + (c.amount || 0),
        qtyTotal: acc.qtyTotal + (Number(r.qty) || 0),
      };
    },
    { base: 0, discount: 0, tax: 0, amount: 0, qtyTotal: 0 }
  );

  const paid = Number(invoice.paidAmount || 0);
  const balance = Number(invoice.total || 0) - paid;

  const sheetRef = useRef(null);
const [sharing, setSharing] = useState(false);

async function buildPdfBlob() {
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
    import('html2canvas'),
    import('jspdf'),
  ]);

  const canvas = await html2canvas(sheetRef.current, {
    scale: 2,
    backgroundColor: '#ffffff',
    useCORS: true,
  });

  const pdf = new jsPDF('p', 'mm', 'a4');
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  const imgH = (canvas.height * pageW) / canvas.width;
  const img = canvas.toDataURL('image/jpeg', 0.95);

  let left = imgH;
  let pos = 0;
  pdf.addImage(img, 'JPEG', 0, pos, pageW, imgH);
  left -= pageH;
  while (left > 0) {
    pos -= pageH;
    pdf.addPage();
    pdf.addImage(img, 'JPEG', 0, pos, pageW, imgH);
    left -= pageH;
  }
  return pdf.output('blob');
}

async function handleShare() {
  try {
    setSharing(true);
    const no = docNo === '-' ? docLabel.toLowerCase() : docNo;
    const fileName = `${docLabel}-${no}.pdf`;
    const blob = await buildPdfBlob();
    const file = new File([blob], fileName, { type: 'application/pdf' });

    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({
        files: [file],
        title: `${docLabel} ${no}`,
        text: `${docLabel} ${no} - ${invoice.partyName} - ${formatCurrency(invoice.total)}`,
      });
    } else {
      // Desktop fallback: PDF download
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      a.click();
      URL.revokeObjectURL(url);
      alert('PDF download ho gaya. Ise WhatsApp ya kisi bhi app se bhej sakte hain.');
    }
  } catch (err) {
    if (err?.name !== 'AbortError') {
      console.error(err);
      alert('Share nahi ho paya. Dobara try karein.');
    }
  } finally {
    setSharing(false);
  }
}

  // setTimeout ensures React updates the DOM before the print dialog opens
  const handlePrint = () => {
    setTimeout(() => {
      window.print();
    }, 300);
  };

  return (
    <div className="invoice-page">
      {/* Non-printable Toolbar */}
      <div className="print-toolbar no-print">
        <button className="btn btn-secondary" onClick={onBack}>
          &larr; Back
        </button>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-secondary" onClick={handleShare} disabled={sharing}>
            {sharing ? 'Preparing...' : '📤 Share'}
          </button>
          <button className="btn btn-primary" onClick={handlePrint}>
            🖨 Print / Save as PDF
          </button>
        </div>
      </div>

      {/* Printable Invoice Sheet */}
      <div className="invoice-sheet" ref={sheetRef}>
        
        {/* Header Section */}
        <header className="invoice-header">
          <div className="invoice-brand">
            <h2 className="invoice-business-name">{BUSINESS_NAME}</h2>
            <p className="invoice-meta">Phone no.: {BUSINESS_PHONE}</p>
            <p className="invoice-meta">Email: {BUSINESS_EMAIL}</p>
          </div>
          {BUSINESS_LOGO && (
            <div className="invoice-logo-wrap">
              <img src={BUSINESS_LOGO} alt="logo" className="invoice-logo" />
            </div>
          )}
        </header>

        <div className="invoice-title-bar">
          <h1 className="invoice-title">{isEstimate ? 'Estimate' : 'Tax Invoice'}</h1>
        </div>

        {/* Parties Details */}
        <div className="invoice-parties">
          <div className="party-box">
            <span className="party-label">Bill To</span>
            <p className="party-name">
              {(invoice.partyName || 'Cash Client').toUpperCase()}
              {invoice.partyPhone ? ` ${invoice.partyPhone}` : ''}
            </p>
            {invoice.partyPhone && <p className="invoice-meta">Contact No.: {invoice.partyPhone}</p>}
          </div>
          <div className="party-box align-right">
            <span className="party-label">{docLabel} Details</span>
            <p className="invoice-meta"><strong>{docLabel} No.:</strong> {docNo}</p>
            <p className="invoice-meta"><strong>Date:</strong> {invoice.date || new Date().toLocaleDateString()}</p>
          </div>
        </div>

        {/* Items Table */}
        <div className="table-container">
          <table className="invoice-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Item Description</th>
                <th>HSN/SAC</th>
                <th className="text-right">Qty</th>
                <th className="text-right">Rate</th>
                <th className="text-right">Discount</th>
                <th className="text-right">GST</th>
                <th className="text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {items.map((row, i) => {
                const c = rowCalc(row);
                return (
                  <tr key={i}>
                    <td>{i + 1}</td>
                    <td className="item-name">{row.item}</td>
                    <td>{row.hsn || '-'}</td>
                    <td className="text-right">{row.qty}</td>
                    <td className="text-right">{formatCurrency(row.price)}</td>
                    <td className="text-right">{formatCurrency(c.discountAmount)}</td>
                    <td className="text-right">
                      {c.taxPercent > 0 ? `${c.taxPercent}% (${formatCurrency(c.taxAmount)})` : '-'}
                    </td>
                    <td className="text-right amount-col">{formatCurrency(c.amount)}</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="invoice-total-row">
                <td colSpan={3} className="text-right"><strong>Total Qty:</strong></td>
                <td className="text-right"><strong>{totals.qtyTotal}</strong></td>
                <td></td>
                <td className="text-right">{formatCurrency(totals.discount)}</td>
                <td className="text-right">{formatCurrency(totals.tax)}</td>
                <td className="text-right amount-col">{formatCurrency(totals.amount)}</td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Footer & Calculation Section */}
        <div className="invoice-footer">
          <div className="amount-words">
            <span className="party-label">Amount In Words:</span>
            <p>{amountToWords(invoice.total)}</p>
          </div>

          <div className="invoice-summary">
            <div className="summary-row">
              <span>Sub Total</span>
              <span>{formatCurrency(totals.base - totals.discount)}</span>
            </div>
            <div className="summary-row">
              <span>Total GST</span>
              <span>{formatCurrency(totals.tax)}</span>
            </div>
            <div className="summary-row grand-total">
              <span>Grand Total</span>
              <span>{formatCurrency(invoice.total)}</span>
            </div>
            {!isEstimate && paid > 0 && (
              <div className="summary-row text-success">
                <span>Amount Paid</span>
                <span>-{formatCurrency(paid)}</span>
              </div>
            )}
            {!isEstimate && (
              <div className="summary-row balance-due">
                <span>Balance Due</span>
                <span>{formatCurrency(balance)}</span>
              </div>
            )}
          </div>
        </div>

        {/* Bottom Section: Terms & Signatures */}
        <div className="invoice-bottom-section">
          {/* Updated 10 Points Terms & Conditions */}
          <div className="invoice-terms">
            <span className="party-label" style={{ marginBottom: '8px' }}>Terms & Conditions:</span>
            <ol className="terms-list" style={{ fontSize: '11px', lineHeight: '1.4', paddingLeft: '14px', margin: 0, color: '#4b5563' }}>
              <li><strong>Advance Payment:</strong> All advance payments made for salon chairs are non-refundable. By making an advance payment, the buyer acknowledges and agrees to this condition.</li>
              <li><strong>Sale Finality:</strong> Once sold, goods will not be taken back or exchanged. The buyer confirms their purchase based on personal judgment and any information provided by the seller.</li>
              <li><strong>Warranty & Guarantee:</strong> Salon chairs are sold "as is", with no warranty or guarantee, expressed or implied. The seller is not responsible for any future performance issues, maintenance, or defects.</li>
              <li><strong>Product Inspection:</strong> The buyer agrees to inspect the salon chairs at the time of purchase or delivery. Any defects or discrepancies must be reported immediately. Failure to do so waives any claims against the seller.</li>
              <li><strong>Service Location:</strong> All servicing and repairs are done only at our factory. No home service available.</li>
              <li><strong>Governing Law:</strong> These terms and conditions are governed by the laws of Maharashtra, India. Any disputes will fall under the exclusive jurisdiction of Maharashtra courts.</li>
              <li><strong>Discount Policy:</strong> Any discount applied to the purchase will result in the exclusion of warranty and guarantee provisions.</li>
              <li><strong>Order Collection & Payment:</strong> If an order is not collected within 30 days, full payment must be made. A 1-month extension may be granted to complete the previous order, subject to adjusted pricing at current rates.</li>
              <li><strong>Hydraulic Pump Replacement:</strong> We offer a one-time hydraulic pump replacement within 2 years for ₹1800. Applicable only for manufacturing defects under normal use. Original invoice is required. Exclusions: Damage due to misuse, accidental breakage, unauthorized repairs, or external factors.</li>
              <li><strong>Service Policy:</strong> All servicing and repairs will be conducted exclusively at our factory. No on-site or home service is provided.</li>
            </ol>
          </div>

          {/* Signatures */}
          <div className="invoice-signatures" style={{ flexShrink: 0, marginLeft: '20px' }}>
            <div className="signature-box">
              <p className="sign-for">For {BUSINESS_NAME}</p>
              <div className="sign-line"></div>
              <p className="sign-label">Authorized Signatory</p>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
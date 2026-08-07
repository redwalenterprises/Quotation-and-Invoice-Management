import React from 'react';
import { rowCalc } from '../utils/calculations';
import { amountToWords } from '../utils/numberToWords';
import './InvoicePrint.css'; 

const BUSINESS_NAME = 'Salon Chair Wala';
const BUSINESS_LOGO = '/logo.webp'; 
const BUSINESS_ADDRESS = '206, F4 Building, Bhumi World, Bhiwandi Bypass, Maharashtra';

function formatCurrency(n) {
  return `₹${Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// Date ko YYYY-MM-DD format me lane ke liye helper
function formatDate(dateString) {
  if (!dateString) return new Date().toISOString().split('T')[0];
  const d = new Date(dateString);
  if (isNaN(d.getTime())) return dateString;
  return d.toISOString().split('T')[0];
}

export default function InvoicePrint({ invoice, onBack }) {
  const items = invoice.items || [];

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

  const handlePrint = () => {
    setTimeout(() => {
      window.print();
    }, 300);
  };

  // Name ke sath phone attach karne ke liye format
  const customerName = invoice.partyName || 'Cash Client';
  const customerPhone = invoice.partyPhone ? ` ${invoice.partyPhone}` : '';

  return (
    <div className="invoice-page">
      {/* Non-printable Toolbar */}
      <div className="print-toolbar no-print">
        <button className="btn btn-secondary" onClick={onBack}>
          &larr; Back
        </button>
        <button className="btn btn-primary" onClick={handlePrint}>
          🖨 Print / Save as PDF
        </button>
      </div>

      {/* Printable Invoice Sheet */}
      <div className="invoice-sheet">
        
        {/* Header Section */}
        <header className="invoice-header">
          <div className="invoice-brand">
            {BUSINESS_LOGO && <img src={BUSINESS_LOGO} alt="logo" className="invoice-logo" />}
            <div className="invoice-brand-info">
              <h2 className="invoice-business-name">{BUSINESS_NAME}</h2>
              <p className="invoice-address">{BUSINESS_ADDRESS}</p>
            </div>
          </div>
          <div className="invoice-title-wrapper">
            <h1 className="invoice-title">TAX INVOICE</h1>
          </div>
        </header>

        {/* Parties Details */}
        <div className="invoice-parties">
          <div className="party-box">
            <span className="party-label">BILLED TO:</span>
            <p className="party-name">{customerName}{customerPhone}</p>
          </div>
          <div className="party-box align-right">
            <span className="party-label">INVOICE DETAILS:</span>
            <p className="invoice-meta">
              <strong>Date:</strong> {formatDate(invoice.date)}
            </p>
            {invoice.invoiceNumber && (
              <p className="invoice-meta">
                <strong>Inv No:</strong> {invoice.invoiceNumber}
              </p>
            )}
          </div>
        </div>

        {/* Items Table */}
        <div className="table-container">
          <table className="invoice-table">
            <thead>
              <tr>
                <th className="col-num">#</th>
                <th className="col-desc">ITEM DESCRIPTION</th>
                <th className="col-hsn">HSN/SAC</th>
                <th className="text-right col-qty">QTY</th>
                <th className="text-right col-rate">RATE</th>
                <th className="text-right col-disc">DISCOUNT</th>
                <th className="text-right col-gst">GST</th>
                <th className="text-right col-amt">AMOUNT</th>
              </tr>
            </thead>
            <tbody>
              {items.map((row, i) => {
                const c = rowCalc(row);
                return (
                  <tr key={i}>
                    <td className="col-num">{i + 1}</td>
                    <td className="item-name col-desc">{row.item}</td>
                    <td className="col-hsn">{row.hsn || '-'}</td>
                    <td className="text-right col-qty">{row.qty}</td>
                    <td className="text-right col-rate">{formatCurrency(row.price)}</td>
                    <td className="text-right col-disc">{formatCurrency(c.discountAmount)}</td>
                    <td className="text-right col-gst">
                      {c.taxPercent > 0 ? `${c.taxPercent}% (${formatCurrency(c.taxAmount)})` : '-'}
                    </td>
                    <td className="text-right amount-col col-amt">{formatCurrency(c.amount)}</td>
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
            {paid > 0 && (
              <div className="summary-row text-success">
                <span>Amount Paid</span>
                <span>-{formatCurrency(paid)}</span>
              </div>
            )}
            <div className="summary-row balance-due">
              <span>Balance Due</span>
              <span>{formatCurrency(balance)}</span>
            </div>
          </div>
        </div>

        {/* Bottom Section: Terms & Signatures */}
        <div className="invoice-bottom-section">
          <div className="invoice-terms">
            <span className="party-label" style={{ marginBottom: '8px' }}>Terms & Conditions:</span>
            <ol className="terms-list">
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

          <div className="invoice-signatures">
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
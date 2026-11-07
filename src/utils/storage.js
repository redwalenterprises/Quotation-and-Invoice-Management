import { supabase } from './supabaseClient';

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

export const Store = {
  // ============ BACKUP / RESTORE ============
  async exportAllData() {
    const [parties, items, quotations, invoices, business] = await Promise.all([
      supabase.from('parties').select('data'),
      supabase.from('items').select('data'),
      supabase.from('quotations').select('data'),
      supabase.from('invoices').select('data'),
      supabase.from('business_settings').select('data').eq('id', 1).maybeSingle(),
    ]);

    const payload = {
      parties: (parties.data || []).map(r => r.data),
      items: (items.data || []).map(r => r.data),
      quotations: (quotations.data || []).map(r => r.data),
      invoices: (invoices.data || []).map(r => r.data),
      business: business.data?.data || null,
    };

    return JSON.stringify(payload, null, 2);
  },

  async importAllData(jsonString) {
    const data = JSON.parse(jsonString);

    if (data.parties) {
      for (const p of data.parties) {
        await supabase.from('parties').upsert({ id: p.id, name: p.name, data: p });
      }
    }
    if (data.items) {
      for (const i of data.items) {
        await supabase.from('items').upsert({ id: i.id, name: i.name, data: i });
      }
    }
    if (data.quotations) {
      for (const q of data.quotations) {
        const { error } = await supabase.from('quotations').upsert({
          id: q.id, ref_no: q.refNo, status: q.status, party_name: q.partyName,
          date: q.date, total: q.total, data: q,
        });
        if (error) throw error;
      }
    }
    if (data.invoices) {
      for (const inv of data.invoices) {
        const { error } = await supabase.from('invoices').upsert({
          id: inv.id, invoice_no: inv.invoiceNo, quotation_id: inv.quotationId,
          party_name: inv.partyName, date: inv.date, total: inv.total,
          payment_status: inv.paymentStatus, paid_amount: inv.paidAmount, data: inv,
        });
        if (error) throw error;
      }
    }
    if (data.business) {
      await supabase.from('business_settings').upsert({ id: 1, data: data.business });
    }
  },

  // ============ QUOTATIONS ============
  async getQuotations(includeCancelled = false) {
    const { data, error } = await supabase
      .from('quotations')
      .select('data')
      .order('created_at', { ascending: false });
    if (error) { console.error(error); return []; }
    const all = data.map(r => r.data);
    return includeCancelled ? all : all.filter(q => !q.cancelled);
  },

  async getQuotation(id) {
    const { data, error } = await supabase
      .from('quotations')
      .select('data')
      .eq('id', id)
      .maybeSingle();
    if (error || !data) return null;
    return data.data;
  },

  async saveQuotation(quotation) {
    if (quotation.id) {
      const { data: existing } = await supabase
        .from('quotations')
        .select('data')
        .eq('id', quotation.id)
        .maybeSingle();
      const merged = { ...existing?.data, ...quotation };
      const { error: updateError } = await supabase.from('quotations').update({
        ref_no: merged.refNo, status: merged.status, party_name: merged.partyName,
        date: merged.date, total: merged.total, data: merged,
      }).eq('id', quotation.id);
      if (updateError) throw updateError;
      return merged;
    } else {
      const { data: refRows } = await supabase.from('quotations').select('ref_no');
      const maxRef = (refRows || []).reduce((m, r) => Math.max(m, Number(r.ref_no) || 0), 0);
      quotation.id = generateId();
      quotation.refNo = maxRef + 1;
      quotation.status = 'Open';
      const { error: insertError } = await supabase.from('quotations').insert({
        id: quotation.id, ref_no: quotation.refNo, status: quotation.status,
        party_name: quotation.partyName, date: quotation.date, total: quotation.total,
        data: quotation,
      });
      if (insertError) throw insertError;
      return quotation;
    }
  },

  async convertToInvoice(quotationId) {
    const { data: qRow } = await supabase
      .from('quotations')
      .select('data')
      .eq('id', quotationId)
      .maybeSingle();
    if (!qRow) return null;

    const quotationData = { ...qRow.data, status: 'Converted' };
    const { error: qError } = await supabase.from('quotations').update({
      status: 'Converted', data: quotationData,
    }).eq('id', quotationId);
    if (qError) {
      console.error('Failed to mark quotation as converted:', qError);
      throw qError;
    }

    // Use the highest existing invoice_no (not row count) so we never collide
    // with historical invoice numbers imported from the old system.
    const { data: maxRow, error: maxError } = await supabase
      .from('invoices')
      .select('invoice_no')
      .order('invoice_no', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (maxError) {
      console.error('Failed to fetch max invoice number:', maxError);
      throw maxError;
    }
    const nextInvoiceNo = (maxRow?.invoice_no || 0) + 1;

    const invoice = {
      ...qRow.data,
      id: generateId(),
      invoiceNo: nextInvoiceNo,
      quotationId,
      date: new Date().toISOString().slice(0, 10),
      paymentStatus: 'Unpaid',
      paidAmount: 0,
    };
    delete invoice.refNo;
    delete invoice.status;

    const { error: insertError } = await supabase.from('invoices').insert({
      id: invoice.id, invoice_no: invoice.invoiceNo, quotation_id: invoice.quotationId,
      party_name: invoice.partyName, date: invoice.date, total: invoice.total,
      payment_status: invoice.paymentStatus, paid_amount: invoice.paidAmount,
      data: invoice,
    });
    if (insertError) {
      console.error('Failed to insert new invoice:', insertError);
      throw insertError;
    }

    return invoice;
  },

  async deleteQuotation(id) {
    await supabase.from('quotations').delete().eq('id', id);
  },

  // ============ INVOICES ============
  async getInvoices(includeCancelled = false) {
    const { data, error } = await supabase
      .from('invoices')
      .select('data')
      .order('created_at', { ascending: false });
    if (error) { console.error(error); return []; }
    const all = data.map(r => r.data);
    return includeCancelled ? all : all.filter(i => !i.cancelled);
  },

  async getInvoice(id) {
    const { data, error } = await supabase
      .from('invoices')
      .select('data')
      .eq('id', id)
      .maybeSingle();
    if (error || !data) return null;
    return data.data;
  },

  async saveInvoice(invoice) {
    if (invoice.id) {
      const { data: existing } = await supabase
        .from('invoices')
        .select('data')
        .eq('id', invoice.id)
        .maybeSingle();
      const merged = { ...existing?.data, ...invoice };
      merged.invoiceNo = Number(merged.invoiceNo); 
      await supabase.from('invoices').update({
        invoice_no: merged.invoiceNo, quotation_id: merged.quotationId,
        party_name: merged.partyName, date: merged.date, total: merged.total,
        payment_status: merged.paymentStatus, paid_amount: merged.paidAmount,
        data: merged,
      }).eq('id', invoice.id);
      return merged; 
    } else {
      invoice.id = generateId();
      invoice.invoiceNo = Number(invoice.invoiceNo);
      if (!Number.isFinite(invoice.invoiceNo) || invoice.invoiceNo <= 0) {
        throw new Error('Invoice number required');
      }
      invoice.paymentStatus = invoice.paymentStatus || 'Unpaid';
      invoice.paidAmount = invoice.paidAmount || 0;
      const { error } = await supabase.from('invoices').insert({
        id: invoice.id, invoice_no: invoice.invoiceNo, quotation_id: invoice.quotationId,
        party_name: invoice.partyName, date: invoice.date, total: invoice.total,
        payment_status: invoice.paymentStatus, paid_amount: invoice.paidAmount,
        data: invoice,
      });
      if (error) throw error;
      return invoice;
    }
  },

  async recordPayment(id, amount) {
    const { data: existing } = await supabase
      .from('invoices')
      .select('data')
      .eq('id', id)
      .maybeSingle();
    if (!existing) return;

    const updated = { ...existing.data };
    updated.paidAmount = (updated.paidAmount || 0) + Number(amount || 0);
    updated.paymentStatus = updated.paidAmount >= updated.total ? 'Paid' : 'Partial';

    await supabase.from('invoices').update({
      paid_amount: updated.paidAmount, payment_status: updated.paymentStatus, data: updated,
    }).eq('id', id);
  },

  async deleteInvoice(id) {
    await supabase.from('invoices').delete().eq('id', id);
  },

    // ============ CANCEL / RESTORE ============
  async cancelInvoice(id, reason = '') {
    const { data: existing } = await supabase.from('invoices').select('data').eq('id', id).maybeSingle();
    if (!existing) return;
    const updated = { ...existing.data, cancelled: true, cancelReason: reason, cancelledAt: new Date().toISOString() };
    const { error } = await supabase.from('invoices').update({ data: updated }).eq('id', id);
    if (error) throw error;
  },

  async restoreInvoice(id) {
    const { data: existing } = await supabase.from('invoices').select('data').eq('id', id).maybeSingle();
    if (!existing) return;
    const updated = { ...existing.data };
    delete updated.cancelled;
    delete updated.cancelReason;
    delete updated.cancelledAt;
    const { error } = await supabase.from('invoices').update({ data: updated }).eq('id', id);
    if (error) throw error;
  },

  async cancelQuotation(id, reason = '') {
    const { data: existing } = await supabase.from('quotations').select('data').eq('id', id).maybeSingle();
    if (!existing) return;
    const updated = { ...existing.data, cancelled: true, cancelReason: reason, cancelledAt: new Date().toISOString() };
    const { error } = await supabase.from('quotations').update({ data: updated }).eq('id', id);
    if (error) throw error;
  },

  async restoreQuotation(id) {
    const { data: existing } = await supabase.from('quotations').select('data').eq('id', id).maybeSingle();
    if (!existing) return;
    const updated = { ...existing.data };
    delete updated.cancelled;
    delete updated.cancelReason;
    delete updated.cancelledAt;
    const { error } = await supabase.from('quotations').update({ data: updated }).eq('id', id);
    if (error) throw error;
  },

  // ============ PARTIES ============
  async getParties() {
    const { data, error } = await supabase
      .from('parties')
      .select('data')
      .order('created_at', { ascending: false });
    if (error) { console.error(error); return []; }
    return data.map(r => r.data);
  },

  async getParty(id) {
    const { data, error } = await supabase
      .from('parties')
      .select('data')
      .eq('id', id)
      .maybeSingle();
    if (error || !data) return null;
    return data.data;
  },

  async saveParty(party) {
    if (party.id) {
      const { data: existing } = await supabase
        .from('parties')
        .select('data')
        .eq('id', party.id)
        .maybeSingle();
      const merged = { ...existing?.data, ...party };
      await supabase.from('parties').update({
        name: merged.name, data: merged,
      }).eq('id', party.id);
      return merged;
    } else {
      party.id = generateId();
      await supabase.from('parties').insert({
        id: party.id, name: party.name, data: party,
      });
      return party;
    }
  },

  async deleteParty(id) {
    await supabase.from('parties').delete().eq('id', id);
  },

  async getPartyBalance(partyName) {
    const { data, error } = await supabase
      .from('invoices')
      .select('total, paid_amount')
      .eq('party_name', partyName);
    if (error || !data) return 0;
    return data.reduce(
      (sum, i) => sum + (Number(i.total || 0) - Number(i.paid_amount || 0)),
      0
    );
  },

  // ============ ITEMS ============
  async getItems() {
    const { data, error } = await supabase
      .from('items')
      .select('data')
      .order('created_at', { ascending: false });
    if (error) { console.error(error); return []; }
    return data.map(r => r.data);
  },

  async getItem(id) {
    const { data, error } = await supabase
      .from('items')
      .select('data')
      .eq('id', id)
      .maybeSingle();
    if (error || !data) return null;
    return data.data;
  },

  async saveItem(item) {
    if (item.id) {
      const { data: existing } = await supabase
        .from('items')
        .select('data')
        .eq('id', item.id)
        .maybeSingle();
      const merged = { ...existing?.data, ...item };
      await supabase.from('items').update({
        name: merged.name, data: merged,
      }).eq('id', item.id);
      return merged;
    } else {
      item.id = generateId();
      await supabase.from('items').insert({
        id: item.id, name: item.name, data: item,
      });
      return item;
    }
  },

  async deleteItem(id) {
    await supabase.from('items').delete().eq('id', id);
  },

  // ============ BUSINESS SETTINGS ============
  async getBusinessSettings() {
    const { data, error } = await supabase
      .from('business_settings')
      .select('data')
      .eq('id', 1)
      .maybeSingle();
    if (error || !data) return { name: 'My Company', phone: '', logo: '' };
    return data.data;
  },

  async saveBusinessSettings(settings) {
    await supabase.from('business_settings').upsert({ id: 1, data: settings });
  },
};
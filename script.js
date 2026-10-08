/* ============================================================
   SOA CRM — Calculation + PDF Generation
   ============================================================ */

const $ = (id) => document.getElementById(id);

// Set default statement date to today
window.addEventListener('DOMContentLoaded', () => {
  $('statementDate').valueAsDate = new Date();
});

// ---------- Utilities ----------
function inr(num) {
  const n = Number(num);
  const sign = n < 0 ? '-' : '';
  return sign + '₹' + Math.abs(n).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

function fmtDate(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

function daysBetween(d1, d2) {
  if (!d1 || !d2) return 0;
  const oneDay = 24 * 60 * 60 * 1000;
  return Math.round(Math.abs((new Date(d2) - new Date(d1)) / oneDay));
}

function addDays(dateStr, days) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

// ============================================================
//  MAIN CALCULATION
// ============================================================
function calculateSOA() {
  const principal    = parseFloat($('principal').value) || 0;
  const disbDate     = $('disbursalDate').value;
  const stmtDate     = $('statementDate').value;
  const rateFirst    = parseFloat($('interestRate').value) || 4;
  const defaultRate  = parseFloat($('defaultRate').value) || 3;
  const penalBase    = parseFloat($('penalBase').value) || 1500;
  const finalOverdue = parseFloat($('finalOverdue').value) || 0;

  const first7Days   = 7;
  const totalDays    = daysBetween(disbDate, stmtDate);
  const postDueDays  = totalDays > 7 ? (totalDays - first7Days) : 0;

  const first7Interest  = principal * (rateFirst / 100) * (first7Days / 30);
  const postDueInterest = principal * (rateFirst / 100) * (postDueDays / 30);
  const total4Interest  = first7Interest + postDueInterest;
  const defaultInterest = principal * (defaultRate / 100) * (postDueDays / 30);

  const completedYears = Math.floor(totalDays / 365);
  const penalCharges   = penalBase * completedYears;

  const totalOutstanding = principal + total4Interest + defaultInterest + penalCharges;

  // Waiver = Outstanding − FinalOverdue
  let waiver = totalOutstanding - finalOverdue;
  if (waiver < 0) waiver = 0;

  const netPayable = totalOutstanding - waiver;

  return {
    principal, disbDate, stmtDate, rateFirst, defaultRate, penalBase,
    first7Days, totalDays, postDueDays,
    first7Interest, postDueInterest, total4Interest,
    defaultInterest, penalCharges, completedYears,
    totalOutstanding, waiver, netPayable, finalOverdue
  };
}

// ============================================================
//  RENDER SOA
// ============================================================
function renderSOA() {
  // ✅ SAFE VALIDATION — sirf itna check karo ki dates aur amounts ho
  if (!$('disbursalDate').value) {
    alert('Please select Date of Disbursal');
    $('disbursalDate').focus();
    return;
  }
  if (!$('statementDate').value) {
    alert('Please select Statement Date');
    $('statementDate').focus();
    return;
  }
  if (!$('principal').value || parseFloat($('principal').value) <= 0) {
    alert('Please enter Principal Disbursed Amount');
    $('principal').focus();
    return;
  }
  if (!$('finalOverdue').value || parseFloat($('finalOverdue').value) <= 0) {
    alert('Please enter Customer Final Overdue Amount');
    $('finalOverdue').focus();
    return;
  }

  const data = calculateSOA();

  // ---------- Customer Details (safe fallback with —) ----------
  $('outName').textContent     = $('customerName').value.trim() || '—';
  $('outPan').textContent      = $('panNumber').value.trim().toUpperCase() || '—';
  $('outStatus').textContent   = $('accountStatus').value.trim() || '—';
  $('outDisbDate').textContent = fmtDate(data.disbDate);

  const disbFmt = fmtDate(data.disbDate);
  const stmtFmt = fmtDate(data.stmtDate);

  // ---------- ACCOUNT BREAKDOWN ----------
  const breakdown = [
    {
      comp: 'Principal',
      calc: 'Disbursed Amount',
      amt: data.principal
    },
    {
      comp: `First 7 Days Interest @ ${data.rateFirst}% p.m. SI`,
      calc: `${data.principal.toFixed(2)} × ${data.rateFirst}% × 7/30`,
      amt: data.first7Interest
    },
    {
      comp: `Post-Due Interest @ ${data.rateFirst}% p.m. SI`,
      calc: `${data.principal.toFixed(2)} × ${data.rateFirst}% × ${data.postDueDays}/30`,
      amt: data.postDueInterest
    },
    {
      comp: `Total ${data.rateFirst}% Interest`,
      calc: `${inr(data.first7Interest)} + ${inr(data.postDueInterest)}`,
      amt: data.total4Interest,
      bold: true
    },
    {
      comp: `Default Interest @ ${data.defaultRate}% p.m. SI`,
      calc: `${data.principal.toFixed(2)} × ${data.defaultRate}% × ${data.postDueDays}/30`,
      amt: data.defaultInterest
    },
    {
      comp: 'Penal Charges',
      calc: `${inr(data.penalBase)} × ${data.completedYears} completed years`,
      amt: data.penalCharges
    },
    {
      comp: 'Total Outstanding Calculated',
      calc: `${inr(data.principal)} + ${inr(data.total4Interest)} + ${inr(data.defaultInterest)} + ${inr(data.penalCharges)}`,
      amt: data.totalOutstanding,
      bold: true
    },
    {
      comp: 'Concessionary Waiver / Adjustment',
      calc: 'Special Account Settlement Discount',
      amt: -data.waiver,
      discount: true
    },
    {
      comp: 'Net Outstanding Overdue Payable',
      calc: 'Final Payable Balance',
      amt: data.netPayable,
      final: true
    }
  ];

  let html = '';
  breakdown.forEach(row => {
    let cls = '';
    if (row.final) cls = 'final-row';
    else if (row.discount) cls = 'discount-row';
    else if (row.bold) cls = 'total-row';
    html += `<tr class="${cls}">
      <td>${row.comp}</td>
      <td>${row.calc}</td>
      <td class="right">${inr(row.amt)}</td>
    </tr>`;
  });
  $('breakdownBody').innerHTML = html;

  // ---------- TRANSACTION LEDGER ----------
  const ledger = [
    {
      date: disbFmt,
      desc: 'Loan Disbursal Principal',
      amt: data.principal,
      bal: data.principal
    },
    {
      date: addDays(data.disbDate, 7),
      desc: 'Contractual Interest (First 7 Days)',
      amt: data.first7Interest,
      bal: data.principal + data.first7Interest
    },
    {
      date: `${addDays(data.disbDate, 7)} – ${stmtFmt}`,
      desc: `Overdue Interest @ ${data.rateFirst}% p.m.`,
      amt: data.postDueInterest,
      bal: data.principal + data.first7Interest + data.postDueInterest
    },
    {
      date: `${addDays(data.disbDate, 7)} – ${stmtFmt}`,
      desc: `Default Interest @ ${data.defaultRate}% p.m.`,
      amt: data.defaultInterest,
      bal: data.principal + data.total4Interest + data.defaultInterest
    },
    {
      date: stmtFmt,
      desc: `Penal Charges (${data.completedYears} Completed Years)`,
      amt: data.penalCharges,
      bal: data.totalOutstanding
    },
    {
      date: stmtFmt,
      desc: 'Concessionary Waiver Adjustment',
      amt: -data.waiver,
      bal: data.netPayable
    }
  ];

  let lhtml = '';
  ledger.forEach(row => {
    lhtml += `<tr>
      <td>${row.date}</td>
      <td>${row.desc}</td>
      <td class="right">${inr(row.amt)}</td>
      <td class="right">${inr(row.bal)}</td>
    </tr>`;
  });

  const status = $('accountStatus').value.trim() || 'DEFAULT';

  lhtml += `<tr class="final-row">
    <td colspan="3">Net Outstanding Balance</td>
    <td class="right">${inr(data.netPayable)} (${status})</td>
  </tr>`;

  $('ledgerBody').innerHTML = lhtml;

  $('soaPreview').classList.remove('hidden');
  $('soaPreview').scrollIntoView({ behavior: 'smooth' });
}

// ============================================================
//  PDF DOWNLOAD
// ============================================================
async function downloadPDF() {
  const { jsPDF } = window.jspdf;
  const element = $('soaContent');

  await new Promise(r => setTimeout(r, 250));

  const canvas = await html2canvas(element, {
    scale: 2.5,
    useCORS: true,
    backgroundColor: '#ffffff',
    logging: false,
    windowWidth: element.scrollWidth,
    windowHeight: element.scrollHeight
  });

  const imgData = canvas.toDataURL('image/png');
  const pdf = new jsPDF('p', 'mm', 'a4');

  const pageWidth  = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin     = 8;
  const imgWidth   = pageWidth - margin * 2;
  const imgHeight  = (canvas.height * imgWidth) / canvas.width;

  let heightLeft = imgHeight;
  let position   = margin;

  pdf.addImage(imgData, 'PNG', margin, position, imgWidth, imgHeight);
  heightLeft -= (pageHeight - margin * 2);

  while (heightLeft > 0) {
    position = margin - (imgHeight - heightLeft);
    pdf.addPage();
    pdf.addImage(imgData, 'PNG', margin, position, imgWidth, imgHeight);
    heightLeft -= (pageHeight - margin * 2);
  }

  const name = ($('customerName').value.trim() || 'Customer').replace(/\s+/g, '_');
  const pan  = ($('panNumber').value.trim() || 'PAN').toUpperCase();
  const date = new Date().toISOString().slice(0, 10);

  pdf.save(`SOA_${name}_${pan}_${date}.pdf`);
}

// ============================================================
//  EVENT LISTENERS
// ============================================================
$('generateBtn').addEventListener('click', renderSOA);
$('downloadPdfBtn').addEventListener('click', downloadPDF);
$('editBtn').addEventListener('click', () => {
  $('soaPreview').classList.add('hidden');
  window.scrollTo({ top: 0, behavior: 'smooth' });
});
$('printBtn').addEventListener('click', () => window.print());

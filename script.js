// =====================================================
//  SOA CRM - Calculation + PDF Generation
// =====================================================

const $ = (id) => document.getElementById(id);

// Set default dates
window.addEventListener('DOMContentLoaded', () => {
  $('statementDate').valueAsDate = new Date();
  $('disbursalDate').valueAsDate = new Date('2020-02-11');
});

// Utility: format currency in Indian style
function inr(num) {
  return '₹' + Number(num).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

// Utility: format date as DD/MM/YYYY
function fmtDate(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

// Utility: days between two dates
function daysBetween(d1, d2) {
  const oneDay = 24 * 60 * 60 * 1000;
  return Math.round(Math.abs((new Date(d2) - new Date(d1)) / oneDay));
}

// =====================================================
//  MAIN CALCULATION
// =====================================================
function calculateSOA() {
  const principal      = parseFloat($('principal').value) || 0;
  const disbDate       = $('disbursalDate').value;
  const stmtDate       = $('statementDate').value;
  const rateFirst      = parseFloat($('interestRate').value) || 4;
  const defaultRate    = parseFloat($('defaultRate').value) || 3;
  const penalBase      = parseFloat($('penalBase').value) || 1500;
  const waiver         = parseFloat($('waiver').value) || 0;

  // Days calculation
  const first7Days     = 7;
  const totalDays      = daysBetween(disbDate, stmtDate);
  const postDueDays    = totalDays - first7Days;

  // Interest calculations
  const first7Interest = principal * (rateFirst / 100) * (first7Days / 30);
  const postDueInterest = principal * (rateFirst / 100) * (postDueDays / 30);
  const total4Interest = first7Interest + postDueInterest;
  const defaultInterest = principal * (defaultRate / 100) * (postDueDays / 30);

  // Penal charges: ₹1500 × completed years
  const completedYears = Math.floor(totalDays / 365);
  const penalCharges   = penalBase * completedYears;

  // Total outstanding
  const totalOutstanding = principal + total4Interest + defaultInterest + penalCharges;

  // Net payable
  const netPayable = totalOutstanding - waiver;

  return {
    principal, disbDate, stmtDate, rateFirst, defaultRate,
    first7Days, totalDays, postDueDays,
    first7Interest, postDueInterest, total4Interest,
    defaultInterest, penalCharges, completedYears,
    totalOutstanding, waiver, netPayable
  };
}

// =====================================================
//  RENDER SOA
// =====================================================
function renderSOA() {
  const data = calculateSOA();

  // Customer details
  $('outName').textContent     = $('customerName').value || '—';
  $('outPan').textContent      = $('panNumber').value || '—';
  $('outStatus').textContent   = $('accountStatus').value || '—';
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
      calc: `${data.principal} × ${data.rateFirst}% × 7/30`,
      amt: data.first7Interest
    },
    {
      comp: `Post-Due Interest @ ${data.rateFirst}% p.m. SI`,
      calc: `${data.principal} × ${data.rateFirst}% × ${data.postDueDays}/30`,
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
      calc: `${data.principal} × ${data.defaultRate}% × ${data.postDueDays}/30`,
      amt: data.defaultInterest
    },
    {
      comp: 'Penal Charges',
      calc: `${inr(parseFloat($('penalBase').value))} × ${data.completedYears} completed years`,
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
      amt: -data.waiver
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

  // Final net balance row
  lhtml += `<tr class="final-row">
    <td colspan="3">Net Outstanding Balance</td>
    <td class="right">${inr(data.netPayable)} (${$('accountStatus').value || 'DEFAULT'})</td>
  </tr>`;

  $('ledgerBody').innerHTML = lhtml;

  // Show preview
  $('soaPreview').classList.remove('hidden');
  $('soaPreview').scrollIntoView({ behavior: 'smooth' });
}

// Helper: add days to date string → DD/MM/YYYY
function addDays(dateStr, days) {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

// =====================================================
//  PDF DOWNLOAD (Exact SOA format)
// =====================================================
async function downloadPDF() {
  const { jsPDF } = window.jspdf;
  const element = $('soaContent');

  // Wait a tick to ensure rendering
  await new Promise(r => setTimeout(r, 200));

  const canvas = await html2canvas(element, {
    scale: 2,
    useCORS: true,
    backgroundColor: '#ffffff',
    logging: false
  });

  const imgData = canvas.toDataURL('image/png');
  const pdf = new jsPDF('p', 'mm', 'a4');

  const pageWidth  = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 8;
  const imgWidth  = pageWidth - margin * 2;
  const imgHeight = (canvas.height * imgWidth) / canvas.width;

  let heightLeft = imgHeight;
  let position = margin;

  pdf.addImage(imgData, 'PNG', margin, position, imgWidth, imgHeight);
  heightLeft -= (pageHeight - margin * 2);

  while (heightLeft > 0) {
    position = heightLeft - imgHeight + margin;
    pdf.addPage();
    pdf.addImage(imgData, 'PNG', margin, position, imgWidth, imgHeight);
    heightLeft -= (pageHeight - margin * 2);
  }

  const name = ($('customerName').value || 'Customer').replace(/\s+/g, '_');
  const pan  = ($('panNumber').value || 'PAN').toUpperCase();
  pdf.save(`Statement_of_Account_${name}_${pan}.pdf`);
}

// =====================================================
//  EVENT LISTENERS
// =====================================================
$('generateBtn').addEventListener('click', renderSOA);
$('downloadPdfBtn').addEventListener('click', downloadPDF);
$('editBtn').addEventListener('click', () => {
  $('soaPreview').classList.add('hidden');
  window.scrollTo({ top: 0, behavior: 'smooth' });
});
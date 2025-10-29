/* Personal Finance Dashboard – LocalStorage + Chart.js */
(function(){
  const CURRENCY = '₹';

  // Elements
  const els = {
    totalBalance: document.getElementById('total-balance'),
    monthlyIncome: document.getElementById('monthly-income'),
    monthlyExpense: document.getElementById('monthly-expense'),
    investmentSum: document.getElementById('investment-sum'),
    form: document.getElementById('tx-form'),
    type: document.getElementById('type'),
    category: document.getElementById('category'),
    amount: document.getElementById('amount'),
    date: document.getElementById('date'),
    note: document.getElementById('note'),
    error: document.getElementById('form-error'),
    tbody: document.getElementById('tx-body'),
    filterCategory: document.getElementById('filter-category'),
    filterSearch: document.getElementById('filter-search'),
    charts: {}
  };

  // Defaults
  if(!els.date.value){
    const today = new Date().toISOString().slice(0,10);
    els.date.value = today;
  }

  // Storage helpers
  const store = {
    key: 'finance.transactions.v1',
    get(){
      try{
        const raw = localStorage.getItem(this.key);
        return raw ? JSON.parse(raw) : [];
      }catch(e){
        console.warn('Storage read failed', e);
        return [];
      }
    },
    set(list){
      try{
        localStorage.setItem(this.key, JSON.stringify(list));
      }catch(e){
        console.warn('Storage write failed', e);
      }
    }
  };

  // Utilities
  const fmt = (n)=> CURRENCY + Number(n||0).toLocaleString(undefined,{maximumFractionDigits:2});
  const monthKey = (d)=>{
    const dt = new Date(d);
    return dt.getFullYear()+'-'+String(dt.getMonth()+1).padStart(2,'0');
  };

  // State
  let tx = store.get(); // {id, type, category, amount, date, note}

  // Animation for counters
  function animateValue(el, from, to, duration=600){
    const start = performance.now();
    function frame(now){
      const p = Math.min(1, (now - start)/duration);
      const current = from + (to-from)*p;
      el.textContent = fmt(current);
      if(p<1) requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }

  // Renderers
  function renderSummary(){
    const total = tx.reduce((s,t)=> t.type==='expense' ? s - Number(t.amount) : s + Number(t.amount), 0);
    const nowKey = monthKey(new Date());
    const monthIncome = tx.filter(t=> monthKey(t.date)===nowKey && t.type==='income')
                          .reduce((s,t)=> s+Number(t.amount), 0);
    const monthExpense = tx.filter(t=> monthKey(t.date)===nowKey && t.type==='expense')
                          .reduce((s,t)=> s+Number(t.amount), 0);
    const invest = tx.filter(t=> t.type==='investment').reduce((s,t)=> s+Number(t.amount), 0);

    animateValue(els.totalBalance, parseFloat((els.totalBalance.dataset.prev||0)), total);
    els.totalBalance.dataset.prev = total;
    els.monthlyIncome.textContent = fmt(monthIncome);
    els.monthlyExpense.textContent = fmt(monthExpense);
    els.investmentSum.textContent = fmt(invest);
  }

  function rowTemplate(t){
    const sign = t.type==='expense' ? '-' : '+';
    const cls = t.type==='expense' ? 'neg' : (t.type==='income' ? 'pos' : 'neu');
    return `<tr data-id="${t.id}">
      <td>${new Date(t.date).toLocaleDateString()}</td>
      <td><span class="pill ${cls}">${t.type}</span></td>
      <td>${t.category}</td>
      <td class="right">${fmt(sign==='-'? -t.amount : t.amount)}</td>
      <td>${t.note||''}</td>
      <td><button class="btn small danger" data-action="del">Delete</button></td>
    </tr>`;
  }

  function applyFilters(list){
    const cat = els.filterCategory.value;
    const q = els.filterSearch.value.toLowerCase().trim();
    return list.filter(t => 
      (cat==='all' || t.category===cat) &&
      (!q || (t.note||'').toLowerCase().includes(q) || t.category.toLowerCase().includes(q))
    );
  }

  function renderTable(){
    const filtered = applyFilters(tx);
    els.tbody.innerHTML = filtered.sort((a,b)=> new Date(b.date) - new Date(a.date))
                                  .map(rowTemplate).join('') || 
                          `<tr><td colspan="6" style="text-align:center;color:#9fb5ac">No transactions yet</td></tr>`;
  }

  // Charts
  let pieChart, lineChart, barChart;

  function renderCharts(){
    // Pie: expense by category
    const expenses = tx.filter(t=> t.type==='expense');
    const categories = [...new Set(expenses.map(e=> e.category))];
    const pieData = categories.map(c => expenses.filter(e=> e.category===c).reduce((s,t)=> s+Number(t.amount), 0));

    // Line: monthly spending trend (expenses only for last 6 months)
    const months = [];
    const now = new Date();
    for(let i=5;i>=0;i--){
      const d = new Date(now.getFullYear(), now.getMonth()-i, 1);
      months.push(d.toLocaleString(undefined,{month:'short', year:'2-digit'}));
    }
    const monthKeys = months.map((_,i)=> monthKey(new Date(now.getFullYear(), now.getMonth()-(5-i), 1)));
    const lineData = monthKeys.map(k => tx.filter(t=> t.type==='expense' && monthKey(t.date)===k)
                                          .reduce((s,t)=> s+Number(t.amount), 0));

    // Bar: income vs expenses current month
    const mk = monthKey(new Date());
    const incomeM = tx.filter(t=> t.type==='income' && monthKey(t.date)===mk)
                      .reduce((s,t)=> s+Number(t.amount), 0);
    const expenseM = tx.filter(t=> t.type==='expense' && monthKey(t.date)===mk)
                       .reduce((s,t)=> s+Number(t.amount), 0);

    // Create or update charts
    const pieCtx = document.getElementById('pieChart');
    const lineCtx = document.getElementById('lineChart');
    const barCtx = document.getElementById('barChart');

    if(pieChart) pieChart.destroy();
    if(lineChart) lineChart.destroy();
    if(barChart) barChart.destroy();

    pieChart = new Chart(pieCtx, {
      type: 'pie',
      data: {
        labels: categories,
        datasets: [{ data: pieData }]
      },
      options: {
        plugins: {
          legend: { position: 'bottom', labels: { color: '#e7f3ed' } }
        }
      }
    });

    lineChart = new Chart(lineCtx, {
      type: 'line',
      data: {
        labels: months,
        datasets: [{ label: 'Expenses', data: lineData, tension: .3, fill:false }]
      },
      options:{
        plugins:{ legend:{labels:{color:'#e7f3ed'}}},
        scales:{
          x:{ ticks:{color:'#9fb5ac'} },
          y:{ ticks:{color:'#9fb5ac'} }
        }
      }
    });

    barChart = new Chart(barCtx, {
      type: 'bar',
      data: {
        labels: ['Income','Expenses'],
        datasets: [{ data: [incomeM, expenseM] }]
      },
      options:{
        plugins:{ legend:{display:false}},
        scales:{
          x:{ ticks:{color:'#9fb5ac'} },
          y:{ ticks:{color:'#9fb5ac'} }
        }
      }
    });
  }

  function refresh(){
    renderSummary();
    renderTable();
    renderCharts();
  }

  // Form handling
  els.form.addEventListener('submit', (e)=>{
    e.preventDefault();
    els.error.textContent = '';
    const amount = parseFloat(els.amount.value);
    if(isNaN(amount) || amount <= 0){
      els.error.textContent = 'Please enter a valid positive amount.';
      return;
    }
    if(!els.date.value){
      els.error.textContent = 'Please select a date.';
      return;
    }
    const item = {
      id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
      type: els.type.value,
      category: els.category.value,
      amount,
      date: els.date.value,
      note: els.note.value.trim()
    };
    tx.push(item);
    store.set(tx);
    els.form.reset();
    els.date.value = new Date().toISOString().slice(0,10);
    refresh();
  });

  // Delete
  els.tbody.addEventListener('click', (e)=>{
    const btn = e.target.closest('button[data-action="del"]');
    if(!btn) return;
    const tr = btn.closest('tr');
    const id = tr?.dataset?.id;
    if(!id) return;
    tx = tx.filter(t=> t.id !== id);
    store.set(tx);
    refresh();
  });

  // Filters
  els.filterCategory.addEventListener('change', renderTable);
  els.filterSearch.addEventListener('input', renderTable);

  // Initial data (optional sample on first load)
  if(tx.length === 0){
    const today = new Date();
    const sample = [
      {type:'income', category:'salary', amount: 80000, date: new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0,10), note:'Monthly salary'},
      {type:'expense', category:'rent', amount: 25000, date: new Date(today.getFullYear(), today.getMonth(), 2).toISOString().slice(0,10), note:'Apartment rent'},
      {type:'expense', category:'food', amount: 6000, date: new Date(today.getFullYear(), today.getMonth(), 5).toISOString().slice(0,10), note:'Groceries'},
      {type:'expense', category:'utilities', amount: 3000, date: new Date(today.getFullYear(), today.getMonth(), 7).toISOString().slice(0,10), note:'Electricity + Internet'},
      {type:'investment', category:'investment', amount: 10000, date: new Date(today.getFullYear(), today.getMonth(), 10).toISOString().slice(0,10), note:'Mutual fund SIP'},
      {type:'income', category:'freelance', amount: 12000, date: new Date(today.getFullYear(), today.getMonth(), 12).toISOString().slice(0,10), note:'Design gig'},
      {type:'expense', category:'travel', amount: 4500, date: new Date(today.getFullYear(), today.getMonth(), 15).toISOString().slice(0,10), note:'Cab & Metro'}
    ];
    tx = sample.map((s,i)=> ({id:String(Date.now()+i), ...s}));
    store.set(tx);
  }

  refresh();

  // Small styles for table pills via JS-injected CSS for portability
  const style = document.createElement('style');
  style.textContent = `.pill{padding:.2rem .5rem;border-radius:999px;font-size:.8rem;text-transform:capitalize}
  .pill.pos{background:#102b20;color:#20c997;border:1px solid rgba(32,201,151,.35)}
  .pill.neg{background:#2a1111;color:#ff6b6b;border:1px solid rgba(255,107,107,.35)}
  .pill.neu{background:#0e1b2a;color:#3fb3ff;border:1px solid rgba(63,179,255,.35)}
  .btn.small{padding:.35rem .55rem;border-radius:8px;font-size:.85rem}
  .btn.danger{background:#2a1111;color:#ffb3b3;border:1px solid rgba(255,107,107,.35)}`;
  document.head.appendChild(style);

})();
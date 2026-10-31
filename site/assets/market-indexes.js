// Values are illustrative, not market data. Shares are in millions.
export const PRESETS = [
  { id: 'aapl', name: 'Apple', ticker: 'AAPL', price: 200, shares: 15 },
  { id: 'msft', name: 'Microsoft', ticker: 'MSFT', price: 400, shares: 7 },
  { id: 'ko', name: 'Coca-Cola', ticker: 'KO', price: 60, shares: 43 },
  { id: 'nvda', name: 'NVIDIA', ticker: 'NVDA', price: 120, shares: 25 },
  { id: 'amzn', name: 'Amazon', ticker: 'AMZN', price: 180, shares: 11 },
];
export const numerator = (stocks, type) => stocks.reduce((sum, stock) => sum + stock.price * (type === 'cap' ? stock.shares : 1), 0);
export const level = (stocks, type, divisors) => numerator(stocks, type) / divisors[type];
export function scaleDivisor(divisors, referenceDivisors, type, percent) {
  if (!['price', 'cap'].includes(type) || !Number.isFinite(percent) || percent < 25 || percent > 200) {
    throw new RangeError('Choose an index type and a divisor percentage from 25 to 200.');
  }
  return { ...divisors, [type]: referenceDivisors[type] * percent / 100 };
}
export function addStock(stocks, stock, divisors) {
  const next = [...stocks, { ...stock }];
  const updated = Object.fromEntries(['price', 'cap'].map((type) => [type, numerator(next, type) / level(stocks, type, divisors)]));
  return { stocks: next, divisors: updated };
}

if (typeof document !== 'undefined') {
  const lab = document.getElementById('index-lab');
  if (lab) {
    let stocks, divisors, referenceDivisors, type = 'price';
    const list = document.getElementById('index-stocks');
    const select = document.getElementById('add-stock');
    const add = document.getElementById('add-stock-button');
    const divisorSlider = document.getElementById('index-divisor');
    const format = (number) => number.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    function reset() {
      stocks = PRESETS.slice(0, 2).map((stock) => ({ ...stock }));
      divisors = Object.fromEntries(['price', 'cap'].map((method) => [method, numerator(stocks, method) / 100]));
      referenceDivisors = { ...divisors };
      type = 'price';
      render();
    }
    function updateValues() {
      const total = numerator(stocks, type);
      const percent = divisors[type] / referenceDivisors[type] * 100;
      divisorSlider.value = String(Math.round(percent));
      divisorSlider.setAttribute('aria-valuetext', `${format(divisors[type])}, ${Math.round(percent)}% of automatic divisor`);
      document.getElementById('index-divisor-value').textContent = `${format(divisors[type])} (${Math.round(percent)}%)`;
      document.getElementById('index-level').textContent = format(level(stocks, type, divisors));
      document.getElementById('index-description').textContent = type === 'price' ? 'Higher share price → more influence.' : 'Price × eligible shares → more influence.';
      document.getElementById('index-formula').textContent = `${type === 'price' ? 'Sum of prices' : 'Total eligible market value'} ${format(total)} ÷ divisor ${format(divisors[type])} = ${format(total / divisors[type])} points. Divisor shown rounded; calculation uses full precision.`;
      lab.querySelectorAll('[data-index-type]').forEach((button) => button.setAttribute('aria-pressed', String(button.dataset.indexType === type)));
      stocks.forEach((stock) => {
        const weight = stock.price * (type === 'cap' ? stock.shares : 1) / total * 100;
        const row = document.getElementById(`stock-${stock.id}`);
        row.querySelector('[data-price]').textContent = `$${format(stock.price)}`;
        row.querySelector('[data-weight]').textContent = `${format(weight)}% index weight`;
        row.querySelector('[data-bar]').style.width = `${weight}%`;
        row.querySelector('input').setAttribute('aria-valuetext', `$${format(stock.price)}`);
      });
    }
    function render() {
      list.innerHTML = stocks.map((stock) => `<div class="index-stock" id="stock-${stock.id}"><div class="stock-heading"><strong>${stock.name} <span>${stock.ticker}</span></strong><strong data-price></strong></div><label for="price-${stock.id}">Share price</label><input id="price-${stock.id}" data-stock="${stock.id}" type="range" min="10" max="500" step="1" value="${stock.price}"><div class="stock-meta"><span>${stock.shares}m eligible shares</span><span data-weight></span></div><div class="weight-track" aria-hidden="true"><span data-bar></span></div></div>`).join('');
      list.querySelectorAll('[data-stock]').forEach((slider) => slider.addEventListener('input', () => { stocks.find((stock) => stock.id === slider.dataset.stock).price = Number(slider.value); updateValues(); }));
      const available = PRESETS.filter((stock) => !stocks.some((item) => item.id === stock.id));
      select.innerHTML = available.map((stock) => `<option value="${stock.id}">${stock.name} (${stock.ticker})</option>`).join('');
      select.disabled = add.disabled = available.length === 0;
      updateValues();
    }
    lab.querySelectorAll('[data-index-type]').forEach((button) => button.addEventListener('click', () => { type = button.dataset.indexType; updateValues(); }));
    add.addEventListener('click', () => {
      const stock = PRESETS.find((item) => item.id === select.value && !stocks.some((current) => current.id === item.id));
      if (stock) {
        const next = addStock(stocks, stock, divisors);
        // Apply the same continuity adjustment to the automatic reference so
        // each method retains its manual scaling percentage after an addition.
        for (const method of ['price', 'cap']) referenceDivisors[method] *= next.divisors[method] / divisors[method];
        ({ stocks, divisors } = next);
      }
      render();
    });
    divisorSlider.addEventListener('input', () => {
      divisors = scaleDivisor(divisors, referenceDivisors, type, Number(divisorSlider.value));
      updateValues();
    });
    document.getElementById('restore-divisor').addEventListener('click', () => {
      divisors = scaleDivisor(divisors, referenceDivisors, type, 100);
      updateValues();
    });
    document.getElementById('reset-index').addEventListener('click', reset);
    reset();
  }
}

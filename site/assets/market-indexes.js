(() => {
  const ids = ['price-a', 'shares-a', 'price-b', 'shares-b'];
  const inputs = ids.map((id) => document.getElementById(id));
  const results = document.getElementById('index-results');
  const error = document.getElementById('index-error');
  const format = (n) => n.toLocaleString('en-US', { maximumFractionDigits: 2 });
  function update() {
    const [a, sa, b, sb] = inputs.map((input) => input.valueAsNumber);
    const valid = [a, sa, b, sb].every((n) => Number.isFinite(n) && n > 0 && n <= 10000);
    error.hidden = valid;
    results.hidden = !valid;
    if (!valid) return;
    const sum = a + b, cap = a * sa + b * sb;
    results.textContent = `Price weighted: (${format(a)} + ${format(b)}) ÷ 2 = ${format(sum / 2)} points. Weights: A ${format(a / sum * 100)}%, B ${format(b / sum * 100)}%. Capitalization weighted: (${format(a)} × ${format(sa)} + ${format(b)} × ${format(sb)}) ÷ 6 = ${format(cap / 6)} points. Weights: A ${format(a * sa / cap * 100)}%, B ${format(b * sb / cap * 100)}%.`;
  }
  inputs.forEach((input) => input.addEventListener('input', update));
  document.getElementById('reset-index').addEventListener('click', () => {
    [100, 1, 50, 10].forEach((value, index) => { inputs[index].value = value; });
    update();
  });
  update();
})();

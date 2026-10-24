'use strict';

const NF10 = new Intl.NumberFormat('en-US', { maximumFractionDigits: 10 });
const ENTRY_DIGIT_CAP = 14;

const initial = () => ({ tokens: [], entry: '', sealed: false, error: false, sealedExpr: '' });

const hasDigit = (e) => /\d/.test(e);
const digitCount = (e) => (String(e).match(/\d/g) || []).length;
const lastOf = (ts) => (ts.length ? ts[ts.length - 1] : null);

function fmtEntry(e) {
  const neg = e.startsWith('-');
  const body = neg ? e.slice(1) : e;
  const parts = body.split('.');
  return (
    (neg ? '-' : '') +
    (parts[0] || '').replace(/\B(?=(\d{3})+(?!\d))/g, ',') +
    (parts.length > 1 ? '.' + parts[1] : '')
  );
}

function fmtNumber(n) {
  let r = Number(n.toPrecision(10));
  if (r === 0) r = 0;
  const s = NF10.format(r);
  return s === '-0' ? '0' : s;
}

function fmtTokenNum(t) {
  const base = /e/i.test(t.v) ? fmtNumber(parseFloat(t.v)) : fmtEntry(t.v);
  return t.pct ? base + '%' : base;
}

function fmtExpr(tokens) {
  return tokens
    .map((t) => {
      if (t.type === 'num') return fmtTokenNum(t);
      if (t.type === 'op') return t.v;
      if (t.type === 'lp') return '(';
      return ')';
    })
    .join(' ');
}

const PREC = { '+': 1, '−': 1, '×': 2, '÷': 2 };

function toRPN(tokens) {
  const out = [];
  const stack = [];
  for (const t of tokens) {
    if (t.type === 'num') {
      out.push(t);
    } else if (t.type === 'lp') {
      stack.push(t);
    } else if (t.type === 'rp') {
      while (stack.length && stack[stack.length - 1].type !== 'lp') out.push(stack.pop());
      if (!stack.length) throw new Error('unbalanced');
      stack.pop();
    } else if (t.type === 'op') {
      while (stack.length) {
        const top = stack[stack.length - 1];
        if (top.type === 'op' && PREC[top.v] >= PREC[t.v]) out.push(stack.pop());
        else break;
      }
      stack.push(t);
    } else {
      throw new Error('bad token');
    }
  }
  while (stack.length) {
    const t = stack.pop();
    if (t.type !== 'op') throw new Error('unbalanced');
    out.push(t);
  }
  return out;
}

function evalRPN(rpn) {
  const st = [];
  for (const t of rpn) {
    if (t.type === 'num') {
      const v = parseFloat(t.v);
      if (!Number.isFinite(v)) throw new Error('bad number');
      st.push(t.pct ? v / 100 : v);
      continue;
    }
    const b = st.pop();
    const a = st.pop();
    if (a === undefined || b === undefined) throw new Error('bad expr');
    let r;
    if (t.v === '+') r = a + b;
    else if (t.v === '−') r = a - b;
    else if (t.v === '×') r = a * b;
    else if (t.v === '÷') {
      if (b === 0) throw new Error('divide by zero');
      r = a / b;
    } else {
      throw new Error('bad op');
    }
    if (!Number.isFinite(r)) throw new Error('overflow');
    st.push(r);
  }
  if (st.length !== 1) throw new Error('bad expr');
  return st[0];
}

function reopenNum(s) {
  const last = lastOf(s.tokens);
  if (s.entry === '' && last && last.type === 'num' && !last.pct && !/e/i.test(last.v)) {
    return { ...s, tokens: s.tokens.slice(0, -1), entry: last.v };
  }
  return null;
}

function equals(s) {
  if (s.error || s.sealed) return s;
  const st = hasDigit(s.entry)
    ? { ...s, tokens: s.tokens.concat({ type: 'num', v: s.entry }), entry: '' }
    : s;
  let et = st.tokens;
  while (et.length && (et[et.length - 1].type === 'op' || et[et.length - 1].type === 'lp')) {
    et = et.slice(0, -1);
  }
  const open = et.reduce((n, t) => n + (t.type === 'lp' ? 1 : t.type === 'rp' ? -1 : 0), 0);
  for (let i = 0; i < open; i++) et = et.concat({ type: 'rp' });
  if (!et.length) return s;
  const label = fmtExpr(et) + ' =';
  try {
    const v = evalRPN(toRPN(et));
    return {
      tokens: [],
      entry: String(Number(v.toPrecision(10))),
      sealed: true,
      error: false,
      sealedExpr: label,
    };
  } catch {
    return { tokens: [], entry: '', sealed: true, error: true, sealedExpr: label };
  }
}

function press(s, act) {
  switch (act.type) {
    case 'clear':
      return initial();

    case 'back': {
      if (s.error || s.sealed) return initial();
      if (s.entry) return { ...s, entry: s.entry.slice(0, -1) };
      if (s.tokens.length) return { ...s, tokens: s.tokens.slice(0, -1) };
      return s;
    }

    case 'digit': {
      if (s.error || s.sealed) return { ...initial(), entry: act.d };
      const r = reopenNum(s);
      const st = r || s;
      const e = st.entry;
      const last = lastOf(st.tokens);
      if (last && (last.type === 'rp' || last.type === 'num')) return s;
      if (digitCount(e) >= ENTRY_DIGIT_CAP) return s;
      if (e === '0' || e === '-0') return { ...st, entry: (e.startsWith('-') ? '-' : '') + act.d };
      if (hasDigit(e)) return { ...st, entry: e + act.d };
      return { ...st, entry: (e === '-' ? '-' : '') + act.d };
    }

    case 'dot': {
      if (s.error || s.sealed) return { ...initial(), entry: '0.' };
      const r = reopenNum(s);
      const st = r || s;
      const e = st.entry;
      if (hasDigit(e)) return e.includes('.') ? s : { ...st, entry: e + '.' };
      const last = lastOf(st.tokens);
      if (last && (last.type === 'rp' || last.type === 'num')) return s;
      return e === '-' ? { ...st, entry: '-0.' } : { ...st, entry: '0.' };
    }

    case 'op': {
      if (s.error) return s;
      const o = act.o;
      if (s.sealed) {
        return { ...initial(), tokens: [{ type: 'num', v: s.entry }, { type: 'op', v: o }] };
      }
      const e = s.entry;
      if (hasDigit(e)) {
        return {
          ...s,
          tokens: s.tokens.concat({ type: 'num', v: e }, { type: 'op', v: o }),
          entry: '',
        };
      }
      const last = lastOf(s.tokens);
      if (e === '-') {
        return o === '−' && (!last || last.type === 'op' || last.type === 'lp')
          ? { ...s, entry: '' }
          : s;
      }
      if (!last || last.type === 'lp') return o === '−' ? { ...s, entry: '-' } : s;
      if (last.type === 'op') {
        return o === '−'
          ? { ...s, entry: '-' }
          : { ...s, tokens: s.tokens.slice(0, -1).concat({ type: 'op', v: o }) };
      }
      return { ...s, tokens: s.tokens.concat({ type: 'op', v: o }) };
    }

    case 'negate': {
      if (s.error) return s;
      const e = s.entry;
      if (s.sealed) {
        const flipped = e.startsWith('-') ? e.slice(1) : '-' + e;
        return { ...s, entry: flipped, sealedExpr: fmtTokenNum({ type: 'num', v: flipped }) + ' =' };
      }
      if (e.startsWith('-')) return { ...s, entry: e.slice(1) };
      if (e) return { ...s, entry: '-' + e };
      const r = reopenNum(s);
      if (r) return { ...r, entry: '-' + r.entry };
      const last = lastOf(s.tokens);
      if (!last || last.type === 'op' || last.type === 'lp') return { ...s, entry: '-' };
      return s;
    }

    case 'pct': {
      if (s.error || s.sealed) return s;
      if (hasDigit(s.entry)) {
        return { ...s, tokens: s.tokens.concat({ type: 'num', v: s.entry, pct: true }), entry: '' };
      }
      const last = lastOf(s.tokens);
      if (s.entry === '' && last && last.type === 'num' && !last.pct) {
        return { ...s, tokens: s.tokens.slice(0, -1).concat({ type: 'num', v: last.v, pct: true }) };
      }
      return s;
    }

    case 'lp': {
      if (s.error || s.sealed) return s;
      if (hasDigit(s.entry)) return s;
      const last = lastOf(s.tokens);
      if (last && last.type !== 'op' && last.type !== 'lp') return s;
      return { ...s, tokens: s.tokens.concat({ type: 'lp' }) };
    }

    case 'rp': {
      if (s.error || s.sealed) return s;
      let open = 0;
      for (const t of s.tokens) open += t.type === 'lp' ? 1 : t.type === 'rp' ? -1 : 0;
      if (open <= 0) return s;
      if (hasDigit(s.entry)) {
        return {
          ...s,
          tokens: s.tokens.concat({ type: 'num', v: s.entry }, { type: 'rp' }),
          entry: '',
        };
      }
      const last = lastOf(s.tokens);
      if (last && (last.type === 'num' || last.type === 'rp')) {
        return { ...s, tokens: s.tokens.concat({ type: 'rp' }) };
      }
      return s;
    }

    case 'equals':
      return equals(s);

    default:
      return s;
  }
}

function mainText(s) {
  if (s.error) return 'ERROR';
  if (s.entry) {
    if (/e/i.test(s.entry)) return fmtNumber(parseFloat(s.entry));
    return fmtEntry(s.entry);
  }
  for (let i = s.tokens.length - 1; i >= 0; i--) {
    if (s.tokens[i].type === 'num') return fmtTokenNum(s.tokens[i]);
  }
  return '0';
}

if (typeof document !== 'undefined') {
  const exprEl = document.getElementById('expr');
  const valueEl = document.getElementById('value');
  let state = initial();

  function render() {
    const label = state.error || state.sealed ? state.sealedExpr : fmtExpr(state.tokens);
    exprEl.textContent = label;
    valueEl.textContent = mainText(state);
    valueEl.classList.toggle('is-error', state.error);
    exprEl.scrollLeft = exprEl.scrollWidth;
    valueEl.scrollLeft = valueEl.scrollWidth;
  }

  function btnFor(act) {
    if (act.d !== undefined) return document.querySelector(`[data-k="digit"][data-v="${act.d}"]`);
    if (act.o !== undefined) return document.querySelector(`[data-k="op"][data-v="${act.o}"]`);
    return document.querySelector(`[data-k="${act.type}"]`);
  }

  function flash(b) {
    if (!b) return;
    b.classList.add('is-pressed');
    setTimeout(() => b.classList.remove('is-pressed'), 130);
  }

  document.querySelector('.calc').addEventListener('click', (ev) => {
    const b = ev.target.closest('button[data-k]');
    if (!b) return;
    const k = b.dataset.k;
    let act;
    if (k === 'digit') act = { type: 'digit', d: b.dataset.v };
    else if (k === 'op') act = { type: 'op', o: b.dataset.v };
    else act = { type: k };
    state = press(state, act);
    render();
  });

  function keyMap(key) {
    if (/^[0-9]$/.test(key)) return { type: 'digit', d: key };
    switch (key) {
      case '.':
      case ',':
        return { type: 'dot' };
      case '+':
        return { type: 'op', o: '+' };
      case '-':
        return { type: 'op', o: '−' };
      case '*':
      case 'x':
      case 'X':
        return { type: 'op', o: '×' };
      case '/':
        return { type: 'op', o: '÷' };
      case '(':
        return { type: 'lp' };
      case ')':
        return { type: 'rp' };
      case '%':
        return { type: 'pct' };
      case '=':
      case 'Enter':
        return { type: 'equals' };
      case 'Backspace':
        return { type: 'back' };
      case 'Escape':
      case 'c':
      case 'C':
        return { type: 'clear' };
      default:
        return null;
    }
  }

  window.addEventListener('keydown', (ev) => {
    if (ev.ctrlKey || ev.metaKey || ev.altKey) return;
    const act = keyMap(ev.key);
    if (!act) return;
    ev.preventDefault();
    state = press(state, act);
    render();
    flash(btnFor(act));
  });

  render();
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { initial, press, toRPN, evalRPN, fmtEntry, fmtNumber, fmtExpr, mainText, digitCount };
}

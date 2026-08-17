/* levels.js
   grade bands, the four tiers inside each one, and the question generator
   for every tier. keeping this out of app.js just so it's easier to find
   and tweak numbers without wading through UI code.
   no word problems anywhere in here on purpose.
*/

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
function choice(arr) {
  return arr[randInt(0, arr.length - 1)];
}
function fmt(n) {
  // trims floating point noise like 2.9999999 -> 3
  return Math.round(n * 1000) / 1000;
}

/* ---------- shared question builders ---------- */

function qAddSub(min, max, allowNeg) {
  const a = randInt(min, max);
  const b = randInt(min, max);
  if (Math.random() < 0.5) {
    return { expr: `${a} + ${b}`, answer: a + b };
  }
  let x = a, y = b;
  if (!allowNeg && y > x) [x, y] = [y, x];
  return { expr: `${x} − ${y}`, answer: x - y };
}

function qMulDiv(min, max, includeDiv) {
  if (includeDiv && Math.random() < 0.5) {
    const b = randInt(min, max);
    const answer = randInt(min, max);
    const a = b * answer;
    return { expr: `${a} ÷ ${b}`, answer };
  }
  const a = randInt(min, max);
  const b = randInt(min, max);
  return { expr: `${a} × ${b}`, answer: a * b };
}

function qBigMulti(digitsA, digitsB) {
  const min1 = Math.pow(10, digitsA - 1), max1 = Math.pow(10, digitsA) - 1;
  const min2 = Math.pow(10, digitsB - 1), max2 = Math.pow(10, digitsB) - 1;
  const a = randInt(min1, max1);
  const b = randInt(min2, max2);
  return { expr: `${a} × ${b}`, answer: a * b };
}

function qNegatives(min, max) {
  const a = randInt(min, max) * choice([1, -1]);
  const b = randInt(min, max) * choice([1, -1]);
  const op = choice(['+', '−']);
  if (op === '+') return { expr: `${a} + (${b})`, answer: a + b };
  return { expr: `${a} − (${b})`, answer: a - b };
}

function qFraction(maxDenom) {
  const d1 = randInt(2, maxDenom), d2 = randInt(2, maxDenom);
  const n1 = randInt(1, d1 - 1), n2 = randInt(1, d2 - 1);
  const op = choice(['+', '×']);
  if (op === '×') {
    const num = n1 * n2, den = d1 * d2;
    const g = gcd(num, den);
    return { expr: `${n1}/${d1} × ${n2}/${d2}  (as a decimal, 2dp)`, answer: fmt(num / den) , decimals: 2};
  }
  const num = n1 * d2 + n2 * d1, den = d1 * d2;
  return { expr: `${n1}/${d1} + ${n2}/${d2}  (as a decimal, 2dp)`, answer: fmt(num / den), decimals: 2 };
}

function gcd(a, b) { return b === 0 ? a : gcd(b, a % b); }

function qPercent(kind) {
  const base = randInt(20, 400);
  const pct = choice([5, 10, 15, 20, 25, 30, 40, 50, 75]);
  return { expr: `${pct}% of ${base}`, answer: fmt((pct / 100) * base) };
}

function qDecimal(places) {
  const a = fmt(randInt(10, 999) / 10);
  const b = fmt(randInt(10, 999) / 10);
  const op = choice(['+', '−']);
  if (op === '+') return { expr: `${a} + ${b}`, answer: fmt(a + b), decimals: 1 };
  const [x, y] = a >= b ? [a, b] : [b, a];
  return { expr: `${x} − ${y}`, answer: fmt(x - y), decimals: 1 };
}

function qOrderOfOps(depth) {
  // builds a small 3-4 term expression respecting PEMDAS, integer-friendly
  const a = randInt(2, 12), b = randInt(2, 12), c = randInt(2, 12);
  const forms = [
    () => ({ expr: `${a} + ${b} × ${c}`, answer: a + b * c }),
    () => ({ expr: `(${a} + ${b}) × ${c}`, answer: (a + b) * c }),
    () => ({ expr: `${a} × ${b} − ${c}`, answer: a * b - c }),
    () => ({ expr: `${a}² − ${b}`, answer: a * a - b }),
    () => ({ expr: `${a} × (${b} − ${c})`, answer: a * (b - c) }),
  ];
  return choice(forms)();
}

function qExponent(maxBase, maxPow) {
  const base = randInt(2, maxBase);
  const pow = randInt(2, maxPow);
  return { expr: `${base}^${pow}`, answer: Math.pow(base, pow) };
}

function qSquareRoot(maxRoot) {
  const r = randInt(2, maxRoot);
  return { expr: `√${r * r}`, answer: r };
}

function qAlgebraEval(complexity) {
  const x = randInt(-6, 6);
  const a = randInt(2, 9), b = randInt(-8, 8);
  if (complexity === 1) {
    return { expr: `${a}x + ${b}, where x = ${x}`, answer: a * x + b };
  }
  const c = randInt(2, 6);
  return { expr: `${a}x² − ${c}, where x = ${x}`, answer: a * x * x - c };
}

const TRIG_TABLE = {
  0:   { sin: 0, cos: 1, tan: 0 },
  30:  { sin: 0.5, cos: 0.866, tan: 0.577 },
  45:  { sin: 0.707, cos: 0.707, tan: 1 },
  60:  { sin: 0.866, cos: 0.5, tan: 1.732 },
  90:  { sin: 1, cos: 0, tan: null },
};
function qTrig() {
  const angle = choice([0, 30, 45, 60, 90]);
  let fn = choice(['sin', 'cos', 'tan']);
  while (angle === 90 && fn === 'tan') fn = choice(['sin', 'cos']);
  return { expr: `${fn}(${angle}°)`, answer: TRIG_TABLE[angle][fn], decimals: 3 };
}

function qLog() {
  const base = choice([2, 10]);
  const pow = randInt(1, base === 2 ? 8 : 4);
  const val = Math.pow(base, pow);
  return { expr: `log${base === 10 ? '' : '₂'}(${val})`, answer: pow };
}

function qCubeRoot(maxRoot) {
  const r = randInt(2, maxRoot);
  return { expr: `∛${r * r * r}`, answer: r };
}

/* ---- SAT prep builders (no calculator round style, still no word problems) ---- */

function qLinearSolve(maxA, maxX) {
  const a = randInt(2, maxA);
  const x = randInt(-maxX, maxX);
  const b = randInt(-20, 20);
  const c = a * x + b;
  const bStr = b >= 0 ? `+ ${b}` : `− ${Math.abs(b)}`;
  return { expr: `${a}x ${bStr} = ${c}, solve for x`, answer: x };
}

function qExponentRule() {
  const a = randInt(2, 9), b = randInt(2, 9);
  if (Math.random() < 0.5) {
    return { expr: `x^${a} · x^${b}, exponent of the result`, answer: a + b };
  }
  return { expr: `(x^${a})^${b}, exponent of the result`, answer: a * b };
}

function qQuadRoots() {
  let p = randInt(-9, 9), q = randInt(-9, 9);
  if (p === q) q += 1;
  const sum = p + q, prod = p * q;
  const larger = Math.max(p, q);
  const b = -sum;
  const bStr = b >= 0 ? `+ ${b}x` : `− ${Math.abs(b)}x`;
  const cStr = prod >= 0 ? `+ ${prod}` : `− ${Math.abs(prod)}`;
  return { expr: `x² ${bStr} ${cStr} = 0, larger root`, answer: larger };
}

const PYTHAG_TRIPLES = [[3, 4, 5], [6, 8, 10], [5, 12, 13], [8, 15, 17], [7, 24, 25], [9, 12, 15], [20, 21, 29]];
function qPythagorean() {
  const t = choice(PYTHAG_TRIPLES);
  const which = choice(['c', 'a', 'b']);
  if (which === 'c') return { expr: `right triangle, legs ${t[0]} and ${t[1]}, hypotenuse = ?`, answer: t[2] };
  if (which === 'a') return { expr: `right triangle, hypotenuse ${t[2]}, one leg ${t[1]}, other leg = ?`, answer: t[0] };
  return { expr: `right triangle, hypotenuse ${t[2]}, one leg ${t[0]}, other leg = ?`, answer: t[1] };
}

/* ---- college-level: intro calculus, direct substitution only ---- */

function qDerivativeEval() {
  const a = randInt(1, 6), n = randInt(2, 4), x = randInt(-3, 3);
  const derivCoef = a * n;
  const val = derivCoef * Math.pow(x, n - 1);
  return { expr: `f(x) = ${a}x^${n}, find f '(${x})`, answer: val };
}

function qLimitEval() {
  const a = randInt(1, 5), b = randInt(-5, 5), x = randInt(-4, 4);
  if (Math.random() < 0.5) {
    return { expr: `lim(x→${x}) of ${a}x ${b >= 0 ? '+' : '−'} ${Math.abs(b)}`, answer: a * x + b };
  }
  return { expr: `lim(x→${x}) of ${a}x² ${b >= 0 ? '+' : '−'} ${Math.abs(b)}`, answer: a * x * x + b };
}

function qIntegralEval() {
  const n = randInt(1, 3);
  const mult = randInt(1, 4);
  const a = mult * (n + 1); // keeps a/(n+1) a clean integer
  const b = randInt(1, 4);
  const antideriv = a / (n + 1);
  const val = antideriv * Math.pow(b, n + 1);
  return { expr: `∫₀^${b} ${a}x^${n} dx`, answer: val };
}

/* ---- advanced: past the classroom ---- */

function qModulo() {
  const n = randInt(3, 12);
  const a = randInt(n + 1, 200);
  return { expr: `${a} mod ${n}`, answer: a % n };
}

function factorial(n) { let r = 1; for (let i = 2; i <= n; i++) r *= i; return r; }
function qCombinatorics() {
  const n = randInt(4, 9);
  const r = randInt(1, n);
  if (Math.random() < 0.5) {
    return { expr: `C(${n}, ${r})`, answer: Math.round(factorial(n) / (factorial(r) * factorial(n - r))) };
  }
  return { expr: `P(${n}, ${r})`, answer: Math.round(factorial(n) / factorial(n - r)) };
}

/* ---------- tier definitions ---------- */

const BANDS = [
  {
    id: 'k2',
    name: 'Elementary · K–2',
    blurb: 'Counting, adding, and subtracting within reach of your fingers.',
    tiers: [
      { id: 'bronze', name: 'Bronze', desc: 'Add/subtract within 10', targetAvg: 8, gen: () => qAddSub(1, 10, false) },
      { id: 'silver', name: 'Silver', desc: 'Add/subtract within 20', targetAvg: 7, gen: () => qAddSub(1, 20, false) },
      { id: 'gold', name: 'Gold', desc: 'Add/subtract within 50, regrouping', targetAvg: 7, gen: () => qAddSub(5, 50, false) },
      { id: 'platinum', name: 'Platinum', desc: 'Add/subtract within 100', targetAvg: 6, gen: () => qAddSub(10, 100, false) },
    ],
  },
  {
    id: 'e35',
    name: 'Elementary · 3–5',
    blurb: 'Times tables, division facts, and bigger sums.',
    tiers: [
      { id: 'bronze', name: 'Bronze', desc: 'Times tables up to 5', targetAvg: 6, gen: () => qMulDiv(1, 5, false) },
      { id: 'silver', name: 'Silver', desc: 'Times tables up to 10, with division', targetAvg: 6, gen: () => qMulDiv(2, 10, true) },
      { id: 'gold', name: 'Gold', desc: 'Times tables up to 12, with division', targetAvg: 5, gen: () => qMulDiv(3, 12, true) },
      { id: 'platinum', name: 'Platinum', desc: '2-digit × 1-digit multiplication', targetAvg: 8, gen: () => qBigMulti(2, 1) },
    ],
  },
  {
    id: 'ms',
    name: 'Middle School · 6–8',
    blurb: 'Negatives, fractions, decimals, percentages, order of operations.',
    tiers: [
      { id: 'bronze', name: 'Bronze', desc: 'Negative number add/subtract', targetAvg: 7, gen: () => qNegatives(1, 15) },
      { id: 'silver', name: 'Silver', desc: 'Decimals to one place', targetAvg: 8, gen: () => qDecimal(1) },
      { id: 'gold', name: 'Gold', desc: 'Percentages of a number', targetAvg: 8, gen: () => qPercent() },
      { id: 'platinum', name: 'Platinum', desc: 'Order of operations (PEMDAS)', targetAvg: 9, gen: () => qOrderOfOps() },
    ],
  },
  {
    id: 'hs',
    name: 'High School',
    blurb: 'Exponents and roots through quadratics, logs, and the trig values you should just know. Grades 9–12, ordered easiest to hardest.',
    tiers: [
      { id: 'bronze-9', rank: 'bronze', name: 'Bronze · 9–10', desc: 'Squares and simple exponents', targetAvg: 7, gen: () => qExponent(9, 2) },
      { id: 'silver-9', rank: 'silver', name: 'Silver · 9–10', desc: 'Perfect square roots', targetAvg: 6, gen: () => qSquareRoot(12) },
      { id: 'gold-9', rank: 'gold', name: 'Gold · 9–10', desc: 'Evaluate a linear expression', targetAvg: 9, gen: () => qAlgebraEval(1) },
      { id: 'platinum-9', rank: 'platinum', name: 'Platinum · 9–10', desc: 'Mixed exponents & order of operations', targetAvg: 10, gen: () => choice([() => qExponent(6, 3), () => qOrderOfOps()])() },
      { id: 'bronze-11', rank: 'bronze', name: 'Bronze · 11–12', desc: 'Evaluate a quadratic expression', targetAvg: 11, gen: () => qAlgebraEval(2) },
      { id: 'silver-11', rank: 'silver', name: 'Silver · 11–12', desc: 'Special-angle trig values', targetAvg: 8, gen: () => qTrig() },
      { id: 'gold-11', rank: 'gold', name: 'Gold · 11–12', desc: 'Base 2 & base 10 logarithms', targetAvg: 9, gen: () => qLog() },
      { id: 'platinum-11', rank: 'platinum', name: 'Platinum · 11–12', desc: 'Mixed: fractions, exponents, roots', targetAvg: 11, gen: () => choice([() => qFraction(8), () => qExponent(10, 3), () => qSquareRoot(15)])() },
    ],
  },
  {
    id: 'sat',
    name: 'SAT Prep · No Calculator',
    blurb: 'The kind of quick, calculator-free math the no-calculator section actually tests — just the numbers, no reading.',
    tiers: [
      { id: 'bronze', rank: 'bronze', name: 'Bronze', desc: 'Heart of Algebra — solve for x', targetAvg: 10, gen: () => qLinearSolve(9, 12) },
      { id: 'silver', rank: 'silver', name: 'Silver', desc: 'Passport to Advanced Math — quadratics', targetAvg: 12, gen: () => qQuadRoots() },
      { id: 'gold', rank: 'gold', name: 'Gold', desc: 'Problem Solving & Data — percentages, exponent rules', targetAvg: 9, gen: () => choice([() => qPercent(), () => qExponentRule()])() },
      { id: 'platinum', rank: 'platinum', name: 'Platinum', desc: 'Additional Topics — right triangles', targetAvg: 9, gen: () => qPythagorean() },
    ],
  },
  {
    id: 'college',
    name: 'College · Intro Calculus',
    blurb: 'Direct-substitution calculus — derivatives, limits, and definite integrals kept clean enough to do without paper.',
    tiers: [
      { id: 'bronze', name: 'Bronze', desc: 'Derivative of a monomial, evaluated', targetAvg: 12, gen: () => qDerivativeEval() },
      { id: 'silver', name: 'Silver', desc: 'Limits by direct substitution', targetAvg: 10, gen: () => qLimitEval() },
      { id: 'gold', name: 'Gold', desc: 'Definite integral of a power function', targetAvg: 14, gen: () => qIntegralEval() },
      { id: 'platinum', name: 'Platinum', desc: 'Mixed: derivatives, limits, integrals', targetAvg: 13, gen: () => choice([qDerivativeEval, qLimitEval, qIntegralEval])() },
    ],
  },
  {
    id: 'advanced',
    name: 'Advanced · Past the Classroom',
    blurb: 'For people who finished the other bands and want it to stay hard: bigger products, modular arithmetic, counting.',
    tiers: [
      { id: 'bronze', name: 'Bronze', desc: '3-digit × 2-digit multiplication', targetAvg: 16, gen: () => qBigMulti(3, 2) },
      { id: 'silver', name: 'Silver', desc: 'Modular arithmetic', targetAvg: 9, gen: () => qModulo() },
      { id: 'gold', name: 'Gold', desc: 'Combinations & permutations', targetAvg: 13, gen: () => qCombinatorics() },
      { id: 'platinum', name: 'Platinum', desc: 'Mixed: logs, cube roots, counting', targetAvg: 12, gen: () => choice([() => qLog(), () => qCubeRoot(10), () => qCombinatorics(), () => qExponent(12, 3)])() },
    ],
  },
];

function findTier(bandId, tierId) {
  const band = BANDS.find(b => b.id === bandId);
  if (!band) return null;
  const tier = band.tiers.find(t => t.id === tierId);
  if (!tier) return null;
  return { band, tier };
}

/* ---------- external resources ---------- */

const RESOURCES = [
  {
    title: 'Khan Academy — Arithmetic',
    body: 'Start here if any of the Elementary tiers gave you trouble. Free, self-paced, no signup required to browse.',
    url: 'https://www.khanacademy.org/math/arithmetic',
  },
  {
    title: 'Khan Academy — Pre-Algebra',
    body: 'Negatives, fractions, ratios, percentages — the Middle School band, explained slowly.',
    url: 'https://www.khanacademy.org/math/pre-algebra',
  },
  {
    title: 'Khan Academy — Algebra 1',
    body: 'For the evaluating-expressions style questions in the High School 9–10 band.',
    url: 'https://www.khanacademy.org/math/algebra',
  },
  {
    title: 'Khan Academy — Trigonometry',
    body: 'If the special-angle sin/cos/tan questions felt like guessing, this is the fix.',
    url: 'https://www.khanacademy.org/math/trigonometry',
  },
  {
    title: 'Khan Academy — SAT Prep',
    body: 'The official practice, straight from College Board\u2019s partnership with Khan Academy. Pairs well with the SAT Prep tier here.',
    url: 'https://www.khanacademy.org/sat',
  },
  {
    title: 'Khan Academy — Calculus 1',
    body: 'For the College band — derivatives, limits, and integrals explained properly instead of just drilled.',
    url: 'https://www.khanacademy.org/math/calculus-1',
  },
  {
    title: 'Desmos Graphing Calculator',
    body: 'A far more capable grapher than the one in the side panel here, for when you need it.',
    url: 'https://www.desmos.com/calculator',
  },
  {
    title: "Paul's Online Math Notes",
    body: 'Dense, no-nonsense reference notes covering algebra through calculus. Good for looking something up fast.',
    url: 'https://tutorial.math.lamar.edu/',
  },
  {
    title: 'Brilliant',
    body: 'Interactive problem-solving courses if drilling arithmetic isn\u2019t scratching the itch anymore.',
    url: 'https://brilliant.org/',
  },
];

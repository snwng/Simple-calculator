# simple_calc

Vanilla calculator UI (HTML/CSS/JS only) — project constraint: no frameworks, no build step, no dependencies.

## Running & tooling

- Static site: open `index.html` directly in a browser. There is no npm, bundler, or dev server — do not bootstrap one.
- No git repo, CI, linter, or formatter configured. Nothing needs installing.

## Style guide is executable truth

- `DESIGN.md` ("Hungry Tiger") is the binding visual spec, not optional docs. Use its CSS custom properties verbatim; every control is a full pill (9999px; 6px radius is reserved for cards only); no box-shadows; gold-on-brown monochrome (no new hues).
- `Salmond`/`Graphikx` fonts are unavailable — use the substitutes listed in DESIGN.md (Antonio/Bebas Neue display, Inter UI) with system fallbacks.

## Verifying

- No test framework. Keep the tokenizer/shunting-yard evaluator as pure functions and sanity-check with `node -e` one-liners.
- Acceptance cases that must keep passing: `2+3×4=14` and `(2+3)×4=20` (true precedence), `200×10%=20`, divide-by-zero → ERROR, full keyboard-only flow (digits `./+-*/()%`, `Enter`/`=`, `Backspace`, `Escape`/`c`), ≤14 digit entry cap, post-`=` chaining.

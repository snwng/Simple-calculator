# simple_calc

A calculator UI with true operator precedence, built entirely in vanilla HTML, CSS, and JavaScript — no frameworks, no build step, no dependencies.

## Overview

The engine is a pure tokenizer plus a shunting-yard evaluator compiled to RPN, so expressions are evaluated correctly rather than via `eval()`:

- `2+3×4 = 14`, `(2+3)×4 = 20`
- `200×10% = 20` (`%` is a postfix divisor)
- Parentheses balance automatically when `=` is pressed
- Divide-by-zero and overflow produce `ERROR`

The interface is a full keyboard workflow (digits, `+-*/%()`, `Enter`/`=`, `Backspace`, `Escape`/`c`) mirrored by on-screen pill keys, alongside negation (`±`), backspace, clear, a 14-digit entry cap, and post-`=` chaining.

The visuals follow the "Hungry Tiger" spec in `DESIGN.md`: a gold-on-brown monochrome poster look with pill-shaped keys, dotted rules, and a huge display face.

## Structure

- `index.html` — page structure
- `styles.css` — styling driven by the design tokens
- `script.js` — pure reducer, evaluator, and DOM wiring
- `DESIGN.md` — the binding visual spec

`script.js` keeps the engine DOM-free, which makes it straightforward to check with plain Node.

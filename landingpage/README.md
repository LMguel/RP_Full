# Landing Page — REGISTRA.PONTO

React · Vite · Tailwind CSS · Framer Motion

Marketing site for the REGISTRA.PONTO SaaS. Dark premium aesthetic with scroll-triggered animations, pricing section, feature showcase, and contact form.

---

## Stack

```
React 18 (JSX, no TypeScript — intentional for rapid content iteration)
Vite 5
Tailwind CSS 3
Framer Motion — whileInView animations; staggered reveals
```

---

## Structure

```
src/
├── components/
│   ├── Hero.jsx            # Full-viewport headline with animated gradient
│   ├── Features.jsx        # Feature grid with icon cards
│   ├── Pricing.jsx         # Tier comparison table
│   ├── Testimonials.jsx    # Social proof carousel
│   ├── ContactForm.jsx     # Form wired to Formspree endpoint
│   └── Footer.jsx
├── App.jsx
└── main.jsx
```

---

## Local Development

```bash
cd landingpage
npm install
npm run dev     # http://localhost:5173
```

---

## Build

```bash
npm run build
npm run preview   # verify before deploy
```

Static output in `dist/` — deploy to any CDN or S3 static hosting.

---
name: dynamic-crypto-mechanik-frontend
description: Create highly dynamic, typography-driven Web3 frontends. Combines the brutalist, repeating, structural mechanics of reference sites like "GT Mechanik" with a high-contrast, confidential Crypto dark-mode aesthetic.
license: Complete terms in LICENSE.txt
---

# Crypto-Mechanik Scroll & Animation Skill

Expert knowledge for building extremely dynamic, text-heavy, and mechanical crypto interfaces. Focuses on typographic grids, infinite data stream marquees, terminal-like text reveals, and structural layouts where "text acts as UI."

## When to Use

Activate this skill when:
- Building Web3, Crypto, or Privacy/Confidential platforms.
- The user wants a highly "dynamic" page driven by typography rather than images.
- Implementing infinite repeating text streams, marquees, or raw "data" blocks.
- Building terminal/typewriter text broadcasts or "decrypting" animations.
- The requested aesthetic is brutalist, mechanical, yet highly refined and tech-forward.

## Aesthetic Foundation: Crypto x Mechanik

This aesthetic relies on absolute constraint. The visual interest comes from *rhythm, repeating patterns, and stark contrast*, not decorative elements.

- **Color Scheme (Confidential Crypto):** 
  - Backgrounds must be pure deep space: `#000000` or `#050505`.
  - Primary text: High-contrast white `#FFFFFF` or pale ash `#EAEAEA`.
  - Accents: Sharp, unapologetic neon. Matrix/Emerald Green (`#00FF41`, `#34d399`) or Electric Blue (`#00FFFF`). Use these for terminal cursors, data highlights, and "Active" statuses.
- **Typography (The Core UI Element):**
  - Rely heavily on **Monospace** fonts (e.g., JetBrains Mono, Space Mono, GT Mechanik Mono, Fira Code). Use them for body text, data points, and structural elements.
  - Mix with a sharp geometric/poly sans-serif for massive, brutalist headers.
  - Use text as texture: repeat words like `[ENCRYPTED]` or `DATA_STREAM` infinitely to create visual borders and backgrounds.
- **Spatial Composition:** Fixed-width constraints. Brutalist grids. Borders made of text or stark 1px solid neon lines. Everything should feel like an electromechanical terminal.

## Core Dynamic Patterns (Framer Motion)

### 1. The "Data Stream" Infinite Marquee
*Inspired by GT Mechanik's repeating footer. A brutalist, unstoppable stream of encrypted text or data points acting as a visual break or background.*

```tsx
import { motion } from 'framer-motion';

export function InfiniteDataStream({ text = "0X9A4F... CONNECTION SECURE — " }) {
  return (
    <div className="w-full overflow-hidden bg-black border-y border-emerald-500/30 py-2 flex whitespace-nowrap">
      <motion.div
        className="font-mono text-emerald-500 text-sm tracking-widest uppercase flex space-x-4"
        animate={{ x: ["0%", "-50%"] }}
        transition={{ ease: "linear", duration: 15, repeat: Infinity }}
      >
        {/* Render text twice to create seamless infinite loop */}
        <span>{text.repeat(10)}</span>
        <span>{text.repeat(10)}</span>
      </motion.div>
    </div>
  );
}
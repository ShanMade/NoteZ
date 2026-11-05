# Public Assets (`public`)

This directory houses static, unbundled assets served directly by Next.js at the root domain path `/`.

---

## 🎨 Asset Inventory

- **`logo.png`**: The master ByNote transparent-background brand logo. Handcrafted to render with vibrant contrast on both light and dark visual themes.
- **`favicon.ico`**: 64×64 multi-resolution browser favicon generated directly from the master brand mark.
- **`favicon.png`**: 32×32 PNG favicon for browser tabs, bookmarks, and mobile device home screens.

---

## 📐 Usage Guidelines

When rendering brand assets in React components, reference them via Next.js `<Image />` or standard root URLs:

```tsx
import Image from "next/image";

<Image 
  src="/logo.png" 
  alt="ByNote Logo" 
  width={32} 
  height={32} 
  priority 
/>
```

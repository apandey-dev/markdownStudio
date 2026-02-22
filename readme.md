# 🖤 Markdown Studio

![Markdown Studio](https://img.shields.io/badge/Status-Live-success?style=for-the-badge)
![Tech Stack](https://img.shields.io/badge/Tech-HTML5%20%7C%20CSS3%20%7C%20Vanilla%20JS-blue?style=for-the-badge)

**Markdown Studio** is a premium, minimal, and fully client-side Real-Time Markdown Editor built entirely with Vanilla Web Technologies. It features a distraction-free pure monochrome dark mode, advanced PDF export with custom page scaling, and a unique "Zero-Backend" sharing capability.

### 🔗 Live Demos
- **Vercel Deployment:** [https://apandey-studio.vercel.app](https://apandey-studio.vercel.app)
- **GitHub Pages:** [https://apandey.github.io/markdownStudio](https://apandey.github.io/markdownStudio)

---

## ✨ Key Features

* **⚡ Ultra-Fast Real-Time Preview:** Type on the left, and see the rendered HTML instantly on the right.
* **🖨️ Advanced Native PDF Export:** * Bypasses third-party canvas bugs to export documents as high-quality, selectable vector text using the browser's native print engine.
  * Supports custom page layouts: **A4 Size**, **A2 Size** (Strictly configured with 0 margin and 5px padding), and a unique **Infinity Page** (dynamically calculates the exact document height for a single continuous page).
* **🔗 Zero-Backend URL Sharing:** Share your entire document via a generated URL link. The app compresses and Base64 encodes your markdown text directly into the URL hash, requiring absolutely no database!
* **🌗 Pure Monochrome Dark Mode:** A meticulously designed dark mode featuring pure black (`#000000`) and subtle greys, completely eliminating blue tints for a professional aesthetic.
* **📐 Draggable Split View:** Freely adjust the width of the editor and preview panels using a smooth, interactive divider.
* **🧮 Math & Syntax Support:** Seamlessly renders LaTeX math formulas (via KaTeX) and code block syntax highlighting (via Highlight.js).
* **💾 Auto-Save:** Automatically saves your progress to your browser's `localStorage` to prevent data loss.
* **🎨 Custom UI Components:** Features beautifully animated, fully custom-built dropdowns and modal dialogs.

---

## 🛠️ Tech Stack

This project is highly optimized, lightweight, and relies strictly on frontend technologies without any heavy frameworks:

* **HTML5** (Structure & Semantics)
* **CSS3** (Styling, Flexbox Layouts, Custom Variables, Native `@print` Media Queries)
* **Vanilla JavaScript (ES6+)** (DOM Manipulation, Event Handling, Debouncing, Base64 Encoding)

**External Libraries (via CDN):**
* [Marked.js](https://marked.js.org/) - Robust Markdown parsing
* [DOMPurify](https://github.com/cure53/DOMPurify) - XSS Sanitization for secure HTML rendering
* [KaTeX](https://katex.org/) - High-performance math typesetting
* [Highlight.js](https://highlightjs.org/) - Developer-friendly code syntax highlighting

---

## 🚀 How to Run Locally

Since this is a client-side only application, no build steps, package managers, or backend servers are required.

1. Clone the repository:
   ```bash
   git clone [https://github.com/apandey/markdownStudio.git](https://github.com/apandey/markdownStudio.git)
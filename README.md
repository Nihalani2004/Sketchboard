# Sketchboard ✏️

> A browser-based, hand-drawn diagramming app — inspired by Excalidraw, built from scratch with vanilla JavaScript.

---

## 📸 Preview

<p align="center">
  <img src="./public/preview.png" alt="Sketchboard App Preview" width="900" />
</p>

<p align="center"><em>Draw shapes, sketch freely, and export diagrams — all with a hand-drawn aesthetic.</em></p>

---

## What is Sketchboard?

**Sketchboard** is a fully local, no-backend diagramming tool that lets you sketch ideas using shapes, freehand strokes, and text — all rendered with a delightful hand-drawn aesthetic. Diagrams can be exported as JSON (for later editing) or PNG (for sharing).

---

## Tech Stack

| Technology | Role |
|---|---|
| **[Vite](https://vitejs.dev/)** | Dev server & bundler (vanilla JS template). Zero-config fast HMR. |
| **[Konva](https://konvajs.org/)** | 2D canvas engine. Manages the stage, layers, drag-and-drop, hit-testing, and `Konva.Transformer` for resize/rotate handles. |
| **[rough.js](https://roughjs.com/)** | Converts geometric shapes (rectangles, ellipses, lines, arrows) into hand-drawn, sketchy-looking strokes via a custom Konva `sceneFunc`. |
| **[perfect-freehand](https://github.com/steveruizok/perfect-freehand)** | Converts raw pointer input (`{x, y, pressure}`) into smooth, pressure-sensitive freehand stroke outlines. |
| **[lucide](https://lucide.dev/)** | Modern SVG icon set used in the toolbar (Select, Shapes, Pen, Text, Laser, Pan, etc.). |
| **[Tailwind CSS v4](https://tailwindcss.com/)** | Utility classes for all DOM/UI chrome (toolbar, style panel, zoom controls). Canvas rendering stays in Konva/rough.js — Tailwind never touches the canvas. |

---

## Features

### 🔷 Shape Tools
Rectangle, Ellipse, Diamond (flowchart decision), Arrow, Line — click-drag to draw. Hold **Shift** to constrain to square/circle/15° increments.

### ✍️ Freehand Pen & 🧹 Eraser
- **Pen**: Natural, pressure-variable strokes powered by `perfect-freehand` with interior background color filling.
- **Eraser**: Drag across canvas elements to erase them instantly.

### 🔤 Text Tool
Click anywhere to place a text label. An inline HTML `<textarea>` opens at the exact canvas position. Blur or press **Escape** to commit. **Double-click** a text label to re-edit it.

### 🏁 Canvas Grid Background
Toggle between **Dots Grid**, **Mesh Grid**, and **Clean Canvas** background modes via the grid button in the bottom-right zoom bar.

### 🎨 Style Panel & Quick Actions
- **Stroke color** — 8 swatches + custom color picker
- **Fill color** — transparent + 7 swatches + custom
- **Fill style** — Solid (default) / Hachure / Cross-hatch
- **Stroke width** — Small / Medium / Large presets
- **Stroke style** — Solid / Dashed / Dotted
- **Roughness** — Clean / Medium / Rough presets + fine-tune slider (0–4)
- **Opacity** — 0–100%
- **Quick actions** — Duplicate, Delete, Bring to Front, Send to Back buttons

### 🖱️ Selection & Grouping
- **Click** any shape to select it (shows resize/rotate handles)
- **Click again** to toggle-deselect
- **Shift+Click** for multi-select
- **Drag** selected shapes to move them anywhere on the canvas
- **Alt + Drag** to duplicate/clone elements on the fly
- **Group / Ungroup (`Ctrl+G` / `Ctrl+Shift+G`)** — group multiple shapes into unified objects
- **Layer Z-Index (`Ctrl+]` / `Ctrl+[`)** — reorder shapes forward or backward
- **Arrow keys** nudge selected shapes by 1px (**Shift+Arrow** = 10px)
- **Rubber-band** drag on empty canvas to marquee-select multiple shapes

### ⚡ Laser Pointer
Renders a glowing, fading red trail **only while the left mouse button is held**. Disappears instantly on release. Never appears in exports.

### 🧲 Snapping
While dragging, the app computes snap targets (edges and centers of other elements) within an 8px threshold and draws temporary indigo alignment guide lines.

### ↩️ Undo / Redo
Full undo/redo via **Ctrl+Z** / **Ctrl+Shift+Z** (or Cmd on Mac). Snapshots are taken on every committed action.

### 📤 Export / Import & Clipboard
| Action | Output |
|---|---|
| **Export JSON** | `.json` file with all elements + app state. Re-importable. |
| **Import JSON** | File picker → parse → replace scene → fit view. |
| **Export PNG** | PNG cropped tightly to content, no UI chrome, 2× pixel ratio. |
| **Copy PNG** | Copy cropped diagram image directly to system clipboard. |

### 🌗 Dark Mode
Toggle via the toolbar moon/sun button. Respects `prefers-color-scheme` on first load.

### 🔭 Pan & Zoom
- **Scroll wheel / Trackpad** — two-finger trackpad pan (without Ctrl) or zoom centred on cursor (with Ctrl)
- **Middle-mouse drag** or **Spacebar + drag** — pan canvas
- **Zoom controls** (bottom-right) — grid toggle, zoom in/out, reset, fit-to-content
- Keyboard shortcut: **F** — fit view to content

---

## Keyboard Shortcuts

| Key | Action |
|---|---|
| `V` | Select tool |
| `R` | Rectangle |
| `O` | Ellipse |
| `D` | Diamond |
| `A` | Arrow |
| `L` | Line |
| `P` | Pen (freehand) |
| `E` | Eraser |
| `T` | Text |
| `Z` | Laser pointer |
| `H` | Hand (pan) |
| `F` | Fit view |
| `Escape` | Back to Select |
| `Delete` / `Backspace` | Delete selected |
| `Ctrl+D` | Duplicate selected |
| `Ctrl+G` | Group selected |
| `Ctrl+Shift+G` | Ungroup selected |
| `Ctrl+]` | Bring to Front |
| `Ctrl+[` | Send to Back |
| `Alt + Drag` | Clone element |
| `↑ ↓ ← →` | Nudge selected shapes 1px |
| `Shift + ↑ ↓ ← →` | Nudge selected shapes 10px |
| `Ctrl+Z` | Undo |
| `Ctrl+Shift+Z` | Redo |
| `Shift` (while drawing) | Constrain shape |

---

## Architecture

### 🏗️ System Architecture Diagram

```mermaid
flowchart TB
    subgraph UI["🖥️ UI Layer"]
        TB["Toolbar"]
        SP["Style Panel"]
        ZC["Zoom Controls"]
        AB["Action Bar"]
    end

    subgraph MAIN["⚡ Orchestrator"]
        MJS["main.js\nBootstrap & Wiring"]
    end

    subgraph CORE["🧠 Core Engine"]
        SCENE["scene.js\nSource of Truth\n(element array)"]
        HISTORY["history.js\nUndo / Redo Stack"]
        STAGE["stage.js\nKonva.Stage\nLayers / Pan / Zoom"]
        SNAP["snapping.js\nEdge & Center Snapping"]
        EXPORT["export.js\nJSON / PNG / Clipboard"]
    end

    subgraph SHAPES["🎨 Shape Renderers"]
        SK["sketchyShape.js\nrough.js Factory\nRect / Ellipse / Diamond\nLine / Arrow"]
        FH["freehand.js\nperfect-freehand\nPen Strokes"]
        TX["text.js\nKonva.Text\nRenderer"]
    end

    subgraph TOOLS["🛠️ Interactive Tools"]
        DT["drawTool.js\nShape Drawing"]
        FHT["freehandTool.js\nPen Capture"]
        TT["textTool.js\nInline Editor"]
        ST["selectionTool.js\nTransformer\nMulti-Select"]
        LT["laserTool.js\nLaser Pointer"]
        ET["eraserTool.js\nDrag-to-Erase"]
    end

    UI --> MJS
    MJS --> CORE
    MJS --> TOOLS
    TOOLS --> SCENE
    TOOLS --> STAGE
    TOOLS --> SHAPES
    SCENE --> HISTORY
    SCENE --> EXPORT
    SHAPES --> STAGE
    SNAP --> STAGE

    style UI fill:#e8f0fe,stroke:#4285f4,stroke-width:2px
    style CORE fill:#fef7e0,stroke:#f9ab00,stroke-width:2px
    style SHAPES fill:#e6f4ea,stroke:#34a853,stroke-width:2px
    style TOOLS fill:#fce8e6,stroke:#ea4335,stroke-width:2px
    style MAIN fill:#f3e8fd,stroke:#7c3aed,stroke-width:2px
```

### 📁 Project Structure

```
sketchboard/
├── index.html              # App shell
├── style.css               # CSS custom properties + dark mode
├── main.js                 # Bootstrap / orchestrator
├── public/
│   └── favicon.svg         # App icon (blue camera/lens)
└── src/
    ├── scene.js            # SOURCE OF TRUTH — plain-JS element array
    ├── history.js          # Undo/redo stack (snapshots of scene.js)
    ├── stage.js            # Konva.Stage, layers, pan, zoom
    ├── snapping.js         # Snap-to-edge/center + guide lines
    ├── export.js           # exportJSON, importJSON, exportPNG, copyPNG
    ├── shapes/
    │   ├── sketchyShape.js # rough.js factory for rect/ellipse/diamond/line/arrow
    │   ├── freehand.js     # perfect-freehand → filled Konva.Shape
    │   └── text.js         # Konva.Text renderer
    ├── tools/
    │   ├── drawTool.js     # Generic draw flow (rect/ellipse/diamond/line/arrow)
    │   ├── freehandTool.js # Freehand capture + commit
    │   ├── textTool.js     # Inline overlay text editing
    │   ├── selectionTool.js# Transformer + rubber-band + group/layer actions
    │   ├── eraserTool.js   # Drag-to-erase canvas elements
    │   └── laserTool.js    # Button-gated laser pointer
    └── ui/
        ├── toolbar.js      # Floating toolbar with Lucide icons
        └── stylePanel.js   # Color/stroke/fill/roughness controls
```

### Data Model (scene element)
```js
{
  id: string,
  type: 'rectangle' | 'ellipse' | 'arrow' | 'line' | 'freedraw' | 'text',
  x: number, y: number, width: number, height: number,
  points: number[],       // for freedraw
  angle: number,
  strokeColor: string,    // default '#1e1e1e'
  backgroundColor: string,
  fillStyle: 'solid' | 'hachure' | 'cross-hatch',
  strokeWidth: number,    // 1 / 2 / 4
  strokeStyle: 'solid' | 'dashed' | 'dotted',
  roughness: number,      // 0–4, default 0 (clean)
  seed: number,           // keeps re-renders visually stable
  opacity: number,        // 0–1
  groupId: string | null,
  text: string,           // text elements only
  fontSize: number,       // text elements only
  fontFamily: string,     // text elements only
}
```

---

## Getting Started

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

---

## Design Notes

- **Source of truth**: `scene.js`'s plain-object array is authoritative. Konva nodes are a *view* layer built from it. Undo/redo and export/import operate exclusively on scene data — never on Konva's internal state.
- **Fonts**: [Inter](https://fonts.google.com/specimen/Inter) for UI chrome; [Caveat](https://fonts.google.com/specimen/Caveat) for canvas text (hand-drawn feel).
- **No backend**: Everything is in-memory. Persistence is manual via JSON export/import.

---

## License

MIT

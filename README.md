# Lighting Kit

A browser workbench for designing rotating, laser-cut acrylic lighting kits for video production. Arrange translucent panels on a slotted base plate, explore their projected colors in a Three.js studio, and export fabrication sheets.

## Run locally

Requires Node.js 20.19+ within the Node 20 release line, or Node.js 22.12+, and npm.

```sh
npm install
npm run dev
```

Open the local URL printed by Vite, normally `http://127.0.0.1:5173`. The application runs entirely in the browser; no account, API key, or backend is required. Fonts use Google Fonts with local system-font fallbacks.

```sh
npm run check    # TypeScript validation
npm test         # Project, undo-history, geometry, and export tests
npm run build    # Type-check and build production files into dist/
npm run preview  # Serve the production build locally
npm run test:e2e # Build, then run desktop/mobile and axe accessibility checks
npm run format:check # Check source formatting
```

Browser checks use Playwright Chromium. If it is not installed, run `npx playwright install chromium` once. The test server uses port 4174 and shuts down after the run.

## Design workflow

1. Choose an arch, circle, rectangle, triangle, wave, or capsule and one of six acrylic colors. Click an empty grid slot, drag a library shape onto the plate, or use **Add to plate**.
2. Select an element in the plate editor or 3D preview. Adjust its dimensions and quarter-turn orientation. Click another empty slot to move it, or drag onto an occupied slot to swap elements.
3. Tune spotlight intensity, beam angle, ambient light, and turntable speed. Pause rotation for a fixed composition. Orbit and zoom the camera, or use the front and top views.
4. Open **Cut plan** to configure acrylic thickness, laser kerf, slot clearance, and stock-sheet dimensions. Select a material sheet and download its SVG or DXF.

The default base is 300 × 300 mm with a 5 × 5 grid. A project supports up to 25 elements. Preset shapes are parameterized by width and height; there is no freehand contour editor. Setting different width and height values on the circle produces an ellipse.

## Shortcuts and accessibility

| Action                                        | Shortcut           |
| --------------------------------------------- | ------------------ |
| Undo                                          | ⌘Z / Ctrl+Z        |
| Redo                                          | ⇧⌘Z / Ctrl+Shift+Z |
| Delete selected element                       | Delete / Backspace |
| Cancel placement or exit focus mode           | Esc                |
| Toggle turntable when the page body has focus | Space              |

All core editing tasks are available through labeled buttons and keyboard-operable controls. Sliders support arrow keys. Dialogs contain keyboard focus and close with Escape. New projects start with rotation paused when the system requests reduced motion. The grid editor and camera buttons provide alternatives to interacting directly with the WebGL canvas.

## Project files and local storage

Edits autosave after a short debounce to this browser's `localStorage`, under `lighting-kit-project-v1`. The header shows save failures if storage is unavailable. Use the project-name menu to download a JSON backup or open another project. Importing is undoable and validates dimensions, shapes, colors, IDs, and grid placement before replacing the current design.

Undo keeps the most recent 60 actions in memory. Continuous edits to one slider are grouped when updates are less than 400 ms apart; structural changes remain separate actions. Undo history is not included in saved project files. Browser data clearing or private-browsing storage policies can remove locally saved work, so JSON files are the portable backup format.

## Simulation model

The live scene uses Three.js physical materials for acrylic panels, a perspective camera, orbit controls, a tripod, a rotating base, and a studio spotlight. Custom wall and floor shaders project rays through each panel's current shape and orientation. They combine color filtering multiplicatively for subtractive overlap, with softened edges, beam falloff, and surface-incidence shading. The rendered panel contours share their shape definitions with the fabrication geometry.

This is a visual transmission preview, not a calibrated spectral light solver. It approximates absorption from the selected display color; it does not solve wavelength-dependent acrylic transmission, refractive caustics, complete global illumination, camera exposure, or every opaque-object shadow. Intensity controls are relative percentages, not measured fixture lumens or lux. Use the preview to explore compositions and movement, then evaluate the chosen acrylic and fixture in the studio. The cut plan flags possible panel intersections using conservative footprints; the layout editor does not prevent these overlaps.

The renderer limits device-pixel ratio by the quality setting, pauses rendering while the page is hidden, and releases GPU resources when the preview unmounts. A WebGL-capable browser is required for the 3D view; the editor and export workflow remain available when WebGL initialization fails.

## Laser-cut output

- Exports use millimetres and closed cut contours. SVG files declare physical `mm` dimensions; DXF files declare millimetre insertion units and use closed polylines on a `CUT` layer.
- The clear base plate and each distinct acrylic color receive separate stock sheets. Deterministic shelf packing adds sheets as required, keeps a 10 mm outer margin and 8 mm inter-part gap, and rejects parts that cannot fit. It is not an optimized nesting algorithm.
- Every panel has one continuous outline with an integrated mounting tab. Its nominal tab width and depth equal the configured acrylic thickness. Square base slots have nominal side length `thickness + clearance`, allowing quarter-turn placement.
- Kerf is the full cut width. Cut centerlines expand exterior contours by half the kerf and contract holes by half the kerf. Import at **1:1 scale** and disable additional compensation in cutter software to avoid applying it twice. Curved contours are exported as fine polygon segments.
- Download every material sheet needed for the kit. Preview labels are excluded from cutter files. SVG cut paths are red hairlines, while DXF keeps all contours on the cut layer.
- Confirm material thickness, kerf, and slot fit with an offcut before the complete job. The tripod, rotating hardware, and attachment hardware are separate from the laser-cut sheets.

## Project structure

```text
src/
  App.tsx                    Studio workspace and editing interactions
  components/
    StudioScene.tsx          Three.js scene lifecycle and picking
    CutPlan.tsx              Fabrication settings, previews, downloads
    ShapeIcon.tsx            Shape library previews
    ui/                      shadcn-style Radix UI primitives
  hooks/useProject.ts        Local persistence and history integration
  lib/
    types.ts                 Shared types, palettes, default composition
    project.ts               Project validation and serialization
    project-history.ts       Undo/redo and continuous-edit grouping
    shapes.ts                Shared panel silhouettes and mounting tabs
    scene-shapes.ts          Three.js contours and transmission shaders
    fabrication.ts           Kerf compensation, packing, SVG/DXF export
  styles.css                 Responsive workspace and component styling
```

Built with Vite, React, TypeScript, Three.js, Radix/shadcn-style components, and Lucide icons.

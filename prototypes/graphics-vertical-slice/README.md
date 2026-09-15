# Graphics Vertical Slice

This is a non-production Phase A art-direction prototype. It is isolated from the Statefall game and does not implement gameplay or simulation behavior.

Open `index.html` directly in a browser. The scene is deterministic and contains no animation. It adapts to desktop and mobile viewports and honors reduced-motion preferences.

## Asset provenance

- Map, terrain, water, coast, borders, structures, ships, wakes, aircraft, units, smoke, lighting, and combat effects: original procedural Canvas drawing in `scene.js`.
- Interface shapes, symbols, overlays, typography treatment, and layout: original HTML/CSS in this directory.
- Fonts: local system fonts only; no font files are bundled or downloaded.
- Third-party art, icons, textures, photographs, shaders, and other visual assets: none.

## Screenshot smoke test

From the repository root, run:

```powershell
npm run test:prototype
```

The standalone test checks desktop and mobile layout, uniform camera scaling, overflow, Canvas output, and browser errors without loading production game code. On Windows it also compares the authoritative Chromium pixel baselines. Linux runs the same semantic checks without looking for Windows snapshots.

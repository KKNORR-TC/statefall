# High-Resolution Direction Decisions

## 2026-09-20 Human Direction

- Ken approved Terrain Direction 02 and the general Unit Direction 02 for production translation by saying “proceed”. This approves the general visual direction only: it does not approve final in-game terrain, any individual Phase G row, deployment, or release.

- Ownership in the terrain prototype is too muted. Increase its chroma and opacity while retaining visible contours, relief, hydrography, and ground texture.
- Strategic ownership must read more immediately than operational ownership. Territorial interiors need a soft allied boundary and a crisp hostile boundary.
- Units should carry restrained ambient motion. Moving classes should also have occasional class-specific transit motion.
- Fighters may occasionally barrel-roll during sustained transit. The top-down treatment should use wing foreshortening, a moving fuselage highlight, lateral shadow shift, a gentle bank/S path, and a contrail corkscrew rather than rotating the complete aircraft through 360 degrees. Bombers bank slowly and do not roll.
- Presentation-only animation must not affect simulation, hitboxes, commands, marker DOM, canonical map placement, labels, or production state.
- Animation phases are staggered from stable class/entity IDs so repeated effects do not synchronize.
- Animation must respect zoom and quality budgets: operational scale may show class detail, strategic scale retains semantic silhouettes, device pixel ratio is capped at 2, and live redraw is capped near 30 fps.
- Reduced-motion presentation suppresses decorative movement, blinking, wake oscillation, rotating radar/dish, beacon, sonar sweep, roll, and projectile progression while preserving static semantic state and readability.
- The “proceed” approval authorizes production translation of the general direction. Final in-game terrain still requires human visual approval, and no individual unit or Phase G row is approved.

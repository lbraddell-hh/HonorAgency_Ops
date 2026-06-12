# Agency Avatars — Shared Art Direction

Character system for HonorHealth Front Door agents. Pixar/Disney-style warmth,
**non-humanistic by mandate**: these are charming objects-with-souls (think
Luxo Jr., WALL·E's Eve, the Pixar lamp lineage) — never humanoid faces, never
clinical mascot clichés (no smiling stethoscopes, no scrubs-wearing blobs).

## Why non-humanistic

Employees should feel they're talking to *talent with personality*, not a fake
person. Object-characters sidestep the uncanny valley, age well, and stay
trustworthy in a healthcare setting.

## Shared system (applies to every agent)

- **Silhouette**: built on the brand squircle (34% corner radius). Each
  character must read at 32px as its geometric placeholder motif — the motif IS
  the character's skeleton.
- **Proportions**: 1:1 canvas; character occupies ~80% with breathing room;
  one dominant mass + one or two small appendages max.
- **Material/finish**: soft matte ceramic with a single warm specular
  highlight, upper-left key light (consistent across the cast). No gradients
  harsher than 15% luminance shift; no glossy plastic.
- **Line**: no outlines; forms separate by value and color.
- **Palette**: character body = agent primary color; emotive elements (eyes of
  light, glow, gesture lines) = agent accent color. White reserved for
  highlights. Never recolor the HonorHealth logo palette.
- **Eyes**: abstract light-forms (lens glints, glowing dots, apertures) — never
  human eyes with sclera/iris.
- **Expression set** (each agent needs all six, same camera angle):
  `idle`, `listening`, `speaking`, `thinking`, `handing-off` (gesturing toward
  a peer), `celebrating` (subtle — this is a calm brand).
- **Animation notes**: idle = slow 2% scale breathing; listening = lean-in 4°;
  speaking = accent-color pulse synced to amplitude (matches the UI's gold
  speaking ring); handoff = a passed spark of the accent color between the two
  characters.
- **What to avoid**: realistic faces, limbs with fingers, medical equipment as
  bodies, purple-on-purple (body must contrast the cream/white UI), hard drop
  shadows, more than two accent colors per character.

## Production notes

- Deliver as layered SVG or 1024px transparent PNG per expression.
- The UI's `Avatar` component already renders squircle + speaking ring;
  character art replaces only the inner motif layer — silhouette, color, and
  ring behavior carry over unchanged.
- Per-agent specs: [sol.md](./sol.md), [mara.md](./mara.md),
  [otto.md](./otto.md), [remy.md](./remy.md).

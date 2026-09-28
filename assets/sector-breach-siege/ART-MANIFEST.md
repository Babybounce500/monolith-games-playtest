# Alien Breach generated surface art

Generated source images are kept in `attached_assets/generated_images/`. The game uses optimized local JPEG or WebP derivatives in this folder so the textures work without an external image request.

## Fire-caster gunner

- Source: `attached_assets/generated_images/alien-breach-firecaster-source.png`
- Game asset: `enemy-gunner-firecaster.webp` (768 × 768, transparent WebP)
- The former weapon-bearing gunner is now an original infernal caster that throws a visible fireball from between its hands.

## Forcefield portal

- Source: `attached_assets/generated_images/alien-breach-forcefield-source.png`
- Game asset: `forcefield-portal.jpg` (768 × 768, JPEG quality 90)
- Prompt: “Create a square 1:1 game texture for a barricade forcefield in a gritty-but-clean science-fiction orbital station FPS. Front-facing orthographic surface, no perspective, no environment: a luminous translucent cyan-blue energy shield filling the center, subtle fine hexagonal energy mesh, brighter electric-cyan vertical edge glows, restrained soft bloom, surrounded by a narrow light silver-gray modular metal frame with small bolts and inset seams. Match the attached reference screenshot's pale gray industrial wall panels and clear cyan portal color. Readable at small in-game size, balanced contrast, believable game texture, no text, no logos, no characters. The complete framed panel must fill the square and be suitable for mapping onto a cube face.”

## Sector-2 enemy roster (Siege 20)

- Game assets: `enemy-stalker.webp`, `enemy-brute.webp`, `enemy-scout.webp` (768 × 768, transparent WebP, lossless VP8L)
- Generated to fill out the wave 11-20 roster added alongside Siege 20 (see `ENEMY_TYPES` in `SECTOR-BREACH-SIEGE.html`): a fast low-health flanker, a mid-tier melee tank, and a long-range hiding glass cannon.

## Sector-2 weapon roster (Siege 20)

- Game assets: `weapon-plasma-pistol.png`, `weapon-ion-thrower.png`, `weapon-arc-smg.png`, `weapon-sniper-rifle.png`, `weapon-gatling.png`, `weapon-shock-cannon.png`, `weapon-plasma-shotgun.png` (1024 × 1024, transparent PNG)
- Generated to fill the wave 5+ weapon-drop gap added alongside Siege 20 (see `WEAPON_DEFS`/`WEAPON_DROP_ORDER`). Shipped as PNG rather than WebP (no local WebP encoder was available at integration time); `WEAPON_DEFS` overrides each entry's viewmodel `scale` to 0.225 (down from the original six's 0.3) to compensate for the larger 1024px source relative to the original 768px renders, so all thirteen weapons read at the same size on the HUD.

## Station wall

- Source: `attached_assets/generated_images/alien-breach-wall-source.png`
- Game asset: `station-wall.jpg` (768 × 768, JPEG quality 89)
- Prompt: “Create a square seamless tileable game texture for interior walls of a science-fiction orbital station FPS, matching the attached screenshot. Front-facing orthographic material texture, no perspective and no room scene: light cool-gray and off-white painted steel wall panels, broad rectangular inset plates, clean straight panel seams, occasional narrow structural rails, small recessed fasteners and restrained service details, subtle wear and light scuffing only. Bright neutral station lighting, medium-low contrast, silver gray palette with a few tiny muted cyan indicator accents. Keep edges tileable with no obvious border or unique focal object; no text, warning labels, logos, characters, or strong shadows. Stylized realistic game texture, clearly readable in repeated wall blocks.”
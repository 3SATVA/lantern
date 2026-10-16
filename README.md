# LUMEN

An 8-bit action RPG about a sentient lantern and a scarf that survived the end of the sky.

The shatter broke time into four dimensions. Each one still has a core, and each core has a warden. You walk the open wilds, spend the coin the dark drops, and carry the light back.

## Story

You were a lantern on a gatepost. When the sky cracked, a soul poured into your flame and a stranger's scarf caught on your hook. It still remembers wind from before the break.

Four dimensions hang loose:

- **Emberwild** — a forest that burns without going out. Living embers scorch the ground. Pyreheart guards the first core with expanding fire rings, rotating volleys, and a burning dash.
- **Frostvault** — a cathedral of held breath. Black ice slows and bites. Rimecrown sweeps the arena with ice walls, delayed frost mines, and a freezing cone.
- **Verdant Rift** — a garden that learned to hunt. Spore bogs poison. Bloomrot erupts roots, spits lingering pools, pulls you in, and splits into spore pods.
- **Voidspire** — where the shatter is loudest. Gravity wells drag. The Unmade blinks, opens a singularity, and cuts the arena with delayed reality tears.

Light a core and the next rift opens. Light all four and the shatter slows.

## Controls

| Action | Desktop | Touch |
| --- | --- | --- |
| Move | WASD or arrow keys | Left-side joystick |
| Aim | Mouse | Right-side drag |
| Cast | Hold left mouse or Space | Hold the right side |
| Spells | `1`–`5` or scroll | SPL button |
| Interact | `E` or Enter | E button |
| Pause | Esc or `P` | II button |
| Mute | `M` | Pause menu |

Spells you start with: **Magic Bolt** and **Scarf Whip**. Merchants sell Cinder Nova, Homing Mote, Glass Lance, and upgrades to damage, cast speed, max health, move speed, range, and mana.

## Play

```bash
npm install
npm run dev
```

Production build (static files in `dist/`):

```bash
npm run build
npm run preview
```

The build is a static Vite site and can be deployed on Vercel with no extra configuration. Progress is saved in `localStorage` under `lumen-save-v1`.

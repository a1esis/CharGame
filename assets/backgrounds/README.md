# Arena backgrounds

Drop battle-background art here and it's picked up automatically — no code
changes needed. Until a file exists for an arena, the game uses a CSS
gradient instead (see the `.arena-*` classes in `style.css`).

Recommended format: PNG or JPG, landscape, at least 800x450.

```
living-room.png
arcade.png
forest.png
space.png
bedroom.png
```

The filenames must match each arena's `id` field in `data.js` (`ARENAS`).
One arena is picked at random each time a battle starts.

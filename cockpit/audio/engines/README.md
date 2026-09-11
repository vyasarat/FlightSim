# Engine loops

Two files per voice: `<key>-idle.m4a` and `<key>-high.m4a`, where `<key>` is one
of the voices in `TUNE.audio.engines.voices` (`prop`, `jet`, `airliner`, `heli`,
`car`, `boat`, `yacht`).

They must be **seamless loops** — the model runs them for ever and never fades
them — of a steady engine at idle and at full chat. Mono is fine and preferred;
the graph does its own filtering, pitch and panning, so the clip wants to be dry
and flat. A second or two each is plenty.

`js/engines.js` looks for them once per voice per session and takes them if they
are there. Until then it synthesises a placeholder loop of the same shape from
the `idle`/`high` timbre in that voice's TUNE entry, so the crossfade, the pitch
travel, the per-view filtering, the wobble and the gain staging are all live and
tunable now. A clip arriving replaces one buffer and changes nothing else.

CC0 only, from freesound, and credit each one in `CHANGELOG.md` under Credits.

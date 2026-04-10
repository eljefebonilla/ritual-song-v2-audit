# Liturgical Positions

Source: `src/lib/grid-types.ts`, `src/lib/types.ts`, `src/tools/recommendation/scoring.ts`

## All Positions

The full grid row key list defines every slot in the Mass plan:

```
prelude, entranceAntiphon, gathering, sprinklingRite, penitentialAct,
gloria, firstReading, psalmText, psalm, secondReading,
gospelAcclamation, gospelVerse, gospel,
offertory, massSetting, massSettingHoly, massSettingMemorial, massSettingAmen,
lordsPrayer, fractionRite, communionAntiphon,
communion1, communion2, communion3, communion4, sending
```

Reading rows (non-editable, display-only): entranceAntiphon, firstReading, psalmText, secondReading, gospelVerse, gospel, communionAntiphon.

## Positions by Type

### Processional Songs (category: song only)
| Position | Liturgical Role | Key Notes |
|---|---|---|
| prelude | Before Mass begins | Meditative; function tags: prelude, gathering, meditation |
| gathering | Entrance procession | Function tags: gathering, entrance |
| offertory | Preparation of gifts | Function tags: offertory, preparation_of_gifts |
| communion1 | First communion song | Function tags: communion |
| communion2 | Second communion song | Function tags: communion |
| communion3 | Third communion song | Function tags: communion |
| communion4 | Fourth communion song | Function tags: communion (rarely used) |
| sending | Recessional | Function tags: sending, recessional, closing |

### Hard-Gated Structural Slots
These positions use function tags as **hard gates** — only songs with the correct function appear.

| Position | Category Gate | Function Required |
|---|---|---|
| psalm | psalm | psalm, responsorial |
| gospelAcclamation | gospel_acclamation, gospel_acclamation_refrain | gospel_acclamation |
| penitentialAct | song, mass_part | penitential_act, kyrie |
| gloria | song, mass_part | gloria |
| fractionRite | song, mass_part | fraction_rite, lamb_of_god |
| lordsPrayer | song, mass_part | lords_prayer |

Additionally, `psalm` position has a **psalm number hard gate**: only settings of the specific prescribed psalm appear.

### Mass Setting Sub-Rows
`massSetting` expands into three sub-rows:
- massSettingHoly (Holy, Holy)
- massSettingMemorial (Memorial Acclamation)
- massSettingAmen (Great Amen)

### Optional / Seasonal Slots
| Position | Usage |
|---|---|
| sprinklingRite | Easter season; replaces penitentialAct |

## Mass Structure (Liturgy of the Word → Liturgy of the Eucharist)

```
INTRODUCTORY RITES
  prelude → gathering → sprinklingRite/penitentialAct → gloria

LITURGY OF THE WORD
  firstReading → psalmText/psalm → secondReading
  gospelAcclamation (+ gospelVerse) → gospel

LITURGY OF THE EUCHARIST
  offertory → massSetting (Holy, Holy / Memorial / Amen)
  lordsPrayer → fractionRite → communionAntiphon → communion1/2/3

CONCLUDING RITES
  sending
```

## Position Aliases

The scoring engine accepts both camelCase and snake_case:
- `gospelAcclamation` = `gospel_acclamation`
- `fractionRite` = `fraction_rite`
- `penitentialAct` = `penitential_act`
- `lordsPrayer` = `lords_prayer`
- `communion` = `communion1` (for single communion slot contexts)

## Antiphon Positions

Antiphons (from occasion data) are associated with:
- `gathering` → entrance antiphon (2 options per occasion)
- `communion1/2/3` → communion antiphon (2 options per occasion)

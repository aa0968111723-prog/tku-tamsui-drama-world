#!/usr/bin/env python3
"""Validate the referential integrity of world/world.json.

This is the "build/lint" for a World-as-Code repository: it enforces exactly
the consistency that CONTRIBUTING.md asks contributors to keep between
world.json, SCRIPT.md, LOCATIONS.md and CHARACTERS.md.

Checks performed:
  * world.json parses as JSON
  * required top-level keys are present
  * location / character / scene ids are unique
  * every scene.locationId references an existing location
  * every scene.characters[] entry references an existing character
  * every dialogue beat.speaker references an existing character
  * beat.type is one of the known kinds and required fields are present

Exits with status 0 when the world is consistent, 1 otherwise.
Pure standard library so it runs on the default image with no dependencies.
"""

from __future__ import annotations

import json
import os
import sys

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
WORLD_PATH = os.path.join(REPO_ROOT, "world", "world.json")

VALID_BEAT_TYPES = {"action", "dialogue", "note"}


def _fmt(errors: list[str]) -> str:
    return "\n".join(f"  - {e}" for e in errors)


def validate(world: dict) -> list[str]:
    errors: list[str] = []

    for key in ("id", "title", "locations", "characters", "episode"):
        if key not in world:
            errors.append(f"missing required top-level key: '{key}'")

    locations = world.get("locations", []) or []
    characters = world.get("characters", []) or []
    episode = world.get("episode", {}) or {}

    location_ids: set[str] = set()
    for i, loc in enumerate(locations):
        lid = loc.get("id")
        if not lid:
            errors.append(f"locations[{i}] is missing an 'id'")
            continue
        if lid in location_ids:
            errors.append(f"duplicate location id: '{lid}'")
        location_ids.add(lid)
        for field in ("name", "desc"):
            if not loc.get(field):
                errors.append(f"location '{lid}' is missing '{field}'")

    character_ids: set[str] = set()
    for i, ch in enumerate(characters):
        cid = ch.get("id")
        if not cid:
            errors.append(f"characters[{i}] is missing an 'id'")
            continue
        if cid in character_ids:
            errors.append(f"duplicate character id: '{cid}'")
        character_ids.add(cid)
        for field in ("name", "role"):
            if not ch.get(field):
                errors.append(f"character '{cid}' is missing '{field}'")

    scenes = episode.get("scenes", []) or []
    if not scenes:
        errors.append("episode has no scenes")

    scene_ids: set[str] = set()
    for i, scene in enumerate(scenes):
        sid = scene.get("id") or f"scenes[{i}]"
        if scene.get("id"):
            if sid in scene_ids:
                errors.append(f"duplicate scene id: '{sid}'")
            scene_ids.add(sid)
        else:
            errors.append(f"scenes[{i}] is missing an 'id'")

        loc_id = scene.get("locationId")
        if not loc_id:
            errors.append(f"scene '{sid}' is missing 'locationId'")
        elif loc_id not in location_ids:
            errors.append(
                f"scene '{sid}' references unknown locationId '{loc_id}'"
            )

        for cid in scene.get("characters", []) or []:
            if cid not in character_ids:
                errors.append(
                    f"scene '{sid}' references unknown character '{cid}'"
                )

        for j, beat in enumerate(scene.get("beats", []) or []):
            btype = beat.get("type")
            if btype not in VALID_BEAT_TYPES:
                errors.append(
                    f"scene '{sid}' beat[{j}] has invalid type '{btype}' "
                    f"(expected one of {sorted(VALID_BEAT_TYPES)})"
                )
            if btype == "dialogue":
                speaker = beat.get("speaker")
                if not speaker:
                    errors.append(
                        f"scene '{sid}' beat[{j}] (dialogue) is missing 'speaker'"
                    )
                elif speaker not in character_ids:
                    errors.append(
                        f"scene '{sid}' beat[{j}] references unknown speaker '{speaker}'"
                    )
            if not beat.get("text"):
                errors.append(f"scene '{sid}' beat[{j}] is missing 'text'")

    return errors


def main() -> int:
    if not os.path.exists(WORLD_PATH):
        print(f"world.json not found at {WORLD_PATH}", file=sys.stderr)
        return 1

    try:
        with open(WORLD_PATH, encoding="utf-8") as fh:
            world = json.load(fh)
    except json.JSONDecodeError as exc:
        print(f"world.json is not valid JSON: {exc}", file=sys.stderr)
        return 1

    errors = validate(world)

    n_loc = len(world.get("locations", []) or [])
    n_ch = len(world.get("characters", []) or [])
    n_scenes = len((world.get("episode", {}) or {}).get("scenes", []) or [])

    if errors:
        print(f"world.json FAILED validation with {len(errors)} issue(s):")
        print(_fmt(errors))
        return 1

    print("world.json is valid.")
    print(
        f"  title:      {world.get('title')}\n"
        f"  locations:  {n_loc}\n"
        f"  characters: {n_ch}\n"
        f"  episode:    {(world.get('episode', {}) or {}).get('title')}\n"
        f"  scenes:     {n_scenes}"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

#!/usr/bin/env python3
"""Build static comparison report for 人脸油腻50case (Agnes-1015 vs Hybrid-FP8 无 LoRA)."""

from __future__ import annotations

import json
import statistics
import urllib.parse
from pathlib import Path
from typing import Any

REPORT_DIR = Path("/mnt/Video_group/SQL/报告专用")
DATASET_DIR = Path("/mnt/Video_group/ZSY/人脸模糊case/人脸油腻50case")
LEFT_DIR = Path("/mnt/Video_group/SQL/outputs_face_oily_50")
RIGHT_DIR = Path("/mnt/Video_group/SQL/outputs_face_oily_50_hybrid_nolora")


def ensure_symlink(link_path: Path, target_path: Path) -> None:
    link_path.parent.mkdir(parents=True, exist_ok=True)
    if link_path.is_symlink():
        if link_path.resolve() == target_path.resolve():
            return
        link_path.unlink()
    elif link_path.exists():
        raise RuntimeError(f"{link_path} exists and is not a symlink")
    link_path.symlink_to(target_path)


def rel_url(*parts: str) -> str:
    return "/".join(urllib.parse.quote(p) for p in parts)


def load_state(root: Path) -> dict[str, dict[str, Any]]:
    st = json.loads((root / "state.json").read_text(encoding="utf-8"))
    return st.get("cases", {})


def summarize_times(times: list[float]) -> dict[str, float]:
    return {
        "mean": round(statistics.mean(times), 2),
        "median": round(statistics.median(times), 2),
        "min": round(min(times), 2),
        "max": round(max(times), 2),
    }


def main() -> None:
    media_dir = REPORT_DIR / "media"
    ensure_symlink(media_dir / "left", LEFT_DIR / DATASET_DIR.name)
    ensure_symlink(media_dir / "right", RIGHT_DIR / DATASET_DIR.name)
    ensure_symlink(media_dir / "dataset", DATASET_DIR / "cases")

    items = json.loads((DATASET_DIR / "index.json").read_text(encoding="utf-8"))
    left_state = load_state(LEFT_DIR)
    right_state = load_state(RIGHT_DIR)

    cases: list[dict[str, Any]] = []
    left_times: list[float] = []
    right_times: list[float] = []

    for item in items:
        folder = item["folder"]
        key = f"{DATASET_DIR.name}/{folder}"
        l_meta = left_state.get(key, {})
        r_meta = right_state.get(key, {})
        l_mp4 = LEFT_DIR / DATASET_DIR.name / f"{folder}.mp4"
        r_mp4 = RIGHT_DIR / DATASET_DIR.name / f"{folder}.mp4"
        if not (l_mp4.is_file() and r_mp4.is_file()):
            continue

        task = "REF2VA" if item.get("mode") == "reference" else "T2VA"
        l_sec = l_meta.get("elapsed_seconds")
        r_sec = r_meta.get("elapsed_seconds")
        if isinstance(l_sec, (int, float)):
            left_times.append(float(l_sec))
        if isinstance(r_sec, (int, float)):
            right_times.append(float(r_sec))

        refs = [
            {"name": p, "url": rel_url("media", "dataset", folder, p)}
            for p in item.get("reference_images", [])
        ]
        audios = [
            {"name": p, "url": rel_url("media", "dataset", folder, p)}
            for p in item.get("reference_audios", [])
        ]
        ref_videos = [
            {"name": p, "url": rel_url("media", "dataset", folder, p)}
            for p in item.get("reference_videos", [])
        ]

        cases.append(
            {
                "id": folder,
                "index": item.get("global_index"),
                "caseLabel": item.get("case_label") or folder,
                "group": item.get("group") or task,
                "task": task,
                "kicker": f"CASE {item.get('global_index', 0):02d} / {task}",
                "title": f"{item.get('case_label') or folder} · {item.get('group') or task}",
                "aspectRatio": item.get("aspect_ratio") or "9:16",
                "durationSeconds": item.get("duration_seconds") or 8,
                "rulesAndJudgement": item.get("rules_and_judgement") or "",
                "promptInput": item.get("prompt_input") or "",
                "promptFinal": item.get("prompt_final") or "",
                "leftUrl": rel_url("media", "left", f"{folder}.mp4"),
                "rightUrl": rel_url("media", "right", f"{folder}.mp4"),
                "leftSeconds": l_sec,
                "rightSeconds": r_sec,
                "leftBytes": l_meta.get("bytes"),
                "rightBytes": r_meta.get("bytes"),
                "references": refs,
                "audios": audios,
                "refVideos": ref_videos,
            }
        )

    payload = {
        "title": "人脸油腻 50 Case · Agnes-1015 vs Hybrid-FP8 无 LoRA",
        "leftLabel": "Agnes-1015 (二采 0.90)",
        "rightLabel": "Hybrid-FP8 无 LoRA (二采 0.90)",
        "summary": {
            "totalCases": len(cases),
            "ref2vaCount": sum(1 for c in cases if c["task"] == "REF2VA"),
            "t2vaCount": sum(1 for c in cases if c["task"] == "T2VA"),
            "leftStats": summarize_times(left_times) if left_times else None,
            "rightStats": summarize_times(right_times) if right_times else None,
        },
        "cases": cases,
    }

    data_dir = REPORT_DIR / "data"
    data_dir.mkdir(parents=True, exist_ok=True)
    json_text = json.dumps(payload, ensure_ascii=False, indent=2)
    (data_dir / "cases.json").write_text(json_text + "\n", encoding="utf-8")
    (data_dir / "cases.js").write_text(
        f"window.REPORT_DATA = {json_text};\n", encoding="utf-8"
    )
    print(f"Built {data_dir / 'cases.json'} and cases.js with {len(cases)} paired cases.")


if __name__ == "__main__":
    main()


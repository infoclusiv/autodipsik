from __future__ import annotations

from pathlib import Path

import pytest

from autodipsik_gateway.files.file_store import FileStore


def write_excel(tmp_path: Path, name: str) -> Path:
    path = tmp_path / name
    path.write_bytes(b"xlsx")
    return path


def test_file_store_tracks_multiple_selected_files(tmp_path: Path) -> None:
    store = FileStore()
    first = write_excel(tmp_path, "first.xlsx")
    second = write_excel(tmp_path, "second.xlsx")

    stored_files = store.set_selected_paths([first, second])

    assert len(stored_files) == 2
    assert [item.name for item in store.get_selected_files()] == ["first.xlsx", "second.xlsx"]
    assert store.get_selected_file() is not None
    assert store.get_selected_file().file_id == stored_files[0].file_id
    assert store.get_file_by_id(stored_files[1].file_id).name == "second.xlsx"


def test_file_store_selects_active_file_by_id(tmp_path: Path) -> None:
    store = FileStore()
    stored_files = store.set_selected_paths(
        [write_excel(tmp_path, "first.xlsx"), write_excel(tmp_path, "second.xlsx")]
    )

    active = store.set_active_file_id(stored_files[1].file_id)

    assert active.file_id == stored_files[1].file_id
    assert store.get_selected_file().file_id == stored_files[1].file_id


def test_file_store_rejects_unknown_active_file_id(tmp_path: Path) -> None:
    store = FileStore()
    store.set_selected_paths([write_excel(tmp_path, "first.xlsx")])

    with pytest.raises(ValueError, match="Unknown selected file id"):
        store.set_active_file_id("missing-file-id")


def test_single_selected_path_remains_backward_compatible(tmp_path: Path) -> None:
    store = FileStore()

    stored = store.set_selected_path(write_excel(tmp_path, "single.xlsx"))

    assert store.get_selected_file() == stored
    assert len(store.get_selected_files()) == 1
    assert store.get_selected_files()[0] == stored

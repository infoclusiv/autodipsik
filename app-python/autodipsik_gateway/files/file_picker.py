from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path


@dataclass
class FileSelectionResult:
    selected: bool
    path: Path | None = None
    error: str | None = None


@dataclass
class MultiFileSelectionResult:
    selected: bool
    paths: list[Path]
    error: str | None = None


def open_file_picker(allowed_extensions: tuple[str, ...], dialog_title: str) -> FileSelectionResult:
    try:
        import tkinter as tk
        from tkinter import filedialog
    except Exception as error:  # pragma: no cover
        return FileSelectionResult(selected=False, error=f"tkinter unavailable: {error}")

    root = tk.Tk()
    root.withdraw()
    root.attributes("-topmost", True)
    filetypes = [("Excel and CSV files", " ".join(f"*{ext}" for ext in allowed_extensions))]
    selected_path = filedialog.askopenfilename(title=dialog_title, filetypes=filetypes)
    root.destroy()

    if not selected_path:
        return FileSelectionResult(selected=False)

    return FileSelectionResult(selected=True, path=Path(selected_path))


def open_multi_file_picker(allowed_extensions: tuple[str, ...], dialog_title: str) -> MultiFileSelectionResult:
    try:
        import tkinter as tk
        from tkinter import filedialog
    except Exception as error:  # pragma: no cover
        return MultiFileSelectionResult(selected=False, paths=[], error=f"tkinter unavailable: {error}")

    root = tk.Tk()
    root.withdraw()
    root.attributes("-topmost", True)
    filetypes = [("Excel and CSV files", " ".join(f"*{ext}" for ext in allowed_extensions))]
    selected_paths = filedialog.askopenfilenames(title=dialog_title, filetypes=filetypes)
    root.destroy()

    if not selected_paths:
        return MultiFileSelectionResult(selected=False, paths=[])

    return MultiFileSelectionResult(selected=True, paths=[Path(path) for path in selected_paths])

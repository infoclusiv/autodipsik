from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path


@dataclass
class FileSelectionResult:
    selected: bool
    path: Path | None = None
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

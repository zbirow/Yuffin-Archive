# Yuffin Universal Media Archive

[![License](https://img.shields.io/badge/license-MIT-green)](LICENSE)
[![Python Version](https://img.shields.io/badge/python-3.8+-blue.svg)](https://www.python.org/)
[![JavaScript Version](https://img.shields.io/badge/JavaScript-ES6+-yellow.svg)](https://developer.mozilla.org/en-US/docs/Web/JavaScript)
[![Status](https://img.shields.io/badge/status-active-brightgreen.svg)]()

A revolutionary, 100% client-side ecosystem for archiving and viewing massive media collections. Yuffin introduces two specialized, high-performance container formats that enable instant loading and seamless browsing of multi-gigabyte archives directly in your web browser, with zero server dependency.

## 🚀 Core Philosophy

This project challenges the conventional wisdom that handling huge local files in a browser is slow and inefficient. By leveraging the power of native browser APIs (`File API`, `Blob`, `slice()`), Yuffin achieves performance that feels almost impossible, proving that a simple, elegant architecture can outperform complex systems.

## 🌟 Key Features

*   **Universal Launcher:** A single, clean interface to open both `.yuf` (for large media) and `.yufi` (for image collections) container files.
*   **Blazing Fast Performance:** Open multi-gigabyte archives in a fraction of a second. The system only reads the tiny index, not the entire file.
*   **Zero Dependencies:** The entire front-end is a single, self-contained HTML file. No installation, no servers, no external libraries. It works perfectly offline.
*   **Two Specialized Formats:**
    *   **`.yuf` (Media Container):** Optimized for a smaller number of large files like videos and audio albums. Features a centralized JSON index for instant content listing.
    *   **`.yufi` (Image Archive):** Optimized for thousands of smaller files. Features a binary file system structure for maximum scalability and fast random access.
*   **Extreme Memory Efficiency:** Thanks to `File.slice()`, media files are never fully loaded into RAM. The application only references data on disk, enabling smooth playback of 2GB+ videos on machines with limited memory.

## 💡 Architecture: A Launcher with Modular Viewers

Yuffin's elegance lies in its modular architecture. Instead of one monolithic application, it functions as a central launcher that opens the appropriate specialized viewer based on the file's signature.

1.  **The Launcher (`index.html`):** A minimalist welcome screen whose sole purpose is to select a `.yuf` or `.yufi` file.
2.  **File Router:** Upon file selection, the JavaScript code reads the first 6 bytes to identify the file signature (`YUFFIN` or `Yuffin`).
3.  **Modular Viewers:** The correct full-screen modal application is launched:
    *   **Media Viewer (`.yuf`):** A professional player interface with a file list and a large playback window for video and audio.
    *   **Image Archive Viewer (`.yufi`):** A complete, feature-rich gallery application ported from the original Yuffin Image Archive project.

This approach keeps the code clean, separates concerns, and allows each viewer to be perfectly optimized for its specific task.

## ✨ Feature List

### Universal Launcher
-   Single-click file selection for both `.yuf` and `.yufi` formats.
-   Automatic detection of container type based on binary signature.
-   Clean, minimalist user interface.

### Media Viewer (.yuf files)
-   Instant listing of all video, audio, and nested `.yufi` archives.
-   On-demand media player: player element is created only when a file is clicked.
-   Seamless, lag-free seeking in large video and audio files.
-   Support for a wide range of formats (`.mp4`, `.mkv`, `.mp3`, `.flac`, etc.).
-   **Nested Archive Support:** Clicking a `.yufi` archive within a `.yuf` file seamlessly closes the media viewer and opens the image viewer.

### Image Archive Viewer (.yufi files)
-   **Two Viewing Modes:**
    -   **Grid View:** A responsive grid of thumbnails for quickly browsing large collections.
    -   **Comic View:** A vertical, single-column layout perfect for reading manga or comics.
-   **Directory Filtering:** A dropdown menu to filter images by their original folder structure.
-   **Chapter Navigation:** In comic view, easily jump between `chapter_*` directories with "Previous" and "Next" buttons.
-   **Natural Sorting:** Chapters and directories are sorted logically (e.g., 1, 2, ..., 10, 11), not alphabetically.
-   **Pagination:** Simple and effective page navigation for grid view.
-   **Lightbox:** Click on any thumbnail in grid view to open a full-sized image viewer with keyboard and on-screen navigation.
-   **Fullscreen Mode:** An immersive, browser-chrome-free viewing experience for the entire image viewer.

## 📦 File Format Specifications

### `.yuf` (Media Container)
Optimized for large files, using a centralized JSON index.

| Offset (bytes) | Size (bytes)  | Description                                 |
| :------------- | :------------ | :------------------------------------------ |
| `0-5`          | `6`           | **Signature:** The ASCII text `YUFFIN`.     |
| `6-7`          | `2`           | **Padding:** Two null bytes (`\x00\x00`).    |
| `8-15`         | `8`           | **Index Length:** 64-bit unsigned integer (big-endian) specifying the size of the Base64-encoded index. |
| `16 - ...`     | *Variable*    | **Index:** A JSON array of file metadata objects, encoded to Base64. |
| `...`          | *File Remainder* | **Binary Data:** The raw, concatenated data of all files. |

### `.yufi` (Image Archive)
Optimized for a vast number of small files, using a binary file-system-like structure.

| Part                 | Description                                                              |
| :------------------- | :----------------------------------------------------------------------- |
| **Main Header** (38 bytes) | Contains the `Yuffin` signature, version, file/dir counts, and offsets to the tables. |
| **Directory Table**  | A block of null-terminated strings representing all unique directory paths. |
| **File Index Table** | A fixed-size entry for each image, containing the offset to its data block and its parent directory ID. |
| **Data Blocks**      | A series of blocks, each prefixed with a `ZBIR` signature and data length, followed by the raw image data. |

## 🛠️ Usage

### Packer Tool (`Yuffin-Archive.py`)

A desktop GUI application for creating and unpacking both `.yuf` and `.yufi` container files.

1.  **Dependencies:**
    The application requires `customtkinter`. Install it using pip:
    ```bash
    pip install customtkinter
    ```
2.  **Running the Application:**
    Execute the script from your terminal:
    ```bash
    python Yuffin-Archive.py
    ```
3.  **Features:**
    *   **Packing:** Select media files (`.mp4`, `.mp3`, etc.) or pre-packed `.yufi` archives to create a new `.yuf` container. A separate tool ([`Yuffin Image Archive`](https://github.com/zbirow/Yuffin-Image-Archive)) is used to create the `.yufi` files.
    *   **Unpacking:** Select an existing `.yuf` file to view its contents and extract all files to a directory of your choice.

### Web Launcher (`index.html`)

An elegant, standalone application for browsing your Yuffin archives.

1.  **Running the Launcher:**
    Simply **open the `index.html` file in a modern web browser** (e.g., Google Chrome, Microsoft Edge, Firefox).
    Or visit the live page: [Page Link](https://zbirow.github.io/Yuffin-Archive/)
2.  **How to Use:**
    *   Click the "Select File" button to load your `.yuf` or `.yufi` archive.
    *   The appropriate viewer will launch automatically.
    *   Use the "X" button in the corner to close the viewer and return to the launcher screen.


# ✨Streaming

You can set up a streaming server that supports .yuf files. All episodes for a series in one file.

[Check Here](https://github.com/zbirow/Yuffin-Archive-Streaming-Server)

## 📜 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

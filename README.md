# Yuffin Video Container

![License](https://img.shields.io/badge/license-MIT-green)
[![Python 3.8+](https://img.shields.io/badge/python-3.8+-blue.svg)](https://www.python.org/)
[![JavaScript](https://img.shields.io/badge/JavaScript-ES6+-yellow.svg)](https://developer.mozilla.org/en-US/docs/Web/JavaScript)

An incredibly efficient, 100% client-side video container that enables instant loading and seamless playback of gigabyte-sized archives directly in your web browser, with no server required. This project leverages the power of native browser APIs (`File API`) to achieve performance that feels almost impossible.

## 🚀 Key Features

*   **Instant Loading:** Open multi-gigabyte container files (`.yuf`) in a fraction of a second. The file index is read instantly, regardless of the archive's total size.
*   **Seamless Seeking:** Jump to any point in a 2GB+ video file with zero lag. The player uses a highly optimized, native mechanism for accessing file data.
*   **Zero Dependencies (Player):** The player is a single, self-contained HTML file that requires no installation, no server, and no external libraries. It works entirely offline.
*   **Multi-Format Support:** Flawlessly plays `.mp4`, `.mkv`, and other video containers supported by modern web browsers.
*   **Simple & Open Format:** The `.yuf` file format specification is fully documented, straightforward, and easy to implement in other tools.
*   **Memory Efficient:** Thanks to the `File.slice()` operation, the entire video file is never copied into RAM—only the small buffers needed for current playback.

## 💡 How It Works

The secret to this project's incredible performance lies in its clever use of how modern web browsers handle local files.

1.  **The Packer Tool (`yuf_video_packer.py`):**
    *   The application builds a "table of contents" (an index) in memory. This JSON index contains metadata for each file: its name, size, MIME type, and its future position (offset) within the container.
    *   It then iteratively calculates the precise final size of this index to determine the exact byte where the binary video data will begin.
    *   Finally, it writes everything to a single `.yuf` file: a fixed `YUFFIN` header, the precisely calculated index, and then appends the raw binary data of all video files, one after another.

2.  **The Web Player (`index.html`):**
    *   When a `.yuf` file is selected, the player reads **only the first few kilobytes** from the disk to parse the header and the index. This operation is instantaneous, even for a 23 GB file.
    *   When the user clicks on a video, the JavaScript code calls `File.slice(offset, offset + size)`. This function **does not copy 2 GB of data into RAM**. Instead, it creates a lightweight `Blob` object, which is merely a **pointer (or reference)** to a segment of the original file on the disk.
    *   This pointer, wrapped in a temporary URL, is passed to the native `<video>` player element. The player, seeing a reference to a disk file, uses its own highly optimized internal mechanisms to buffer and seek through the data as if it were a normal, single file.

> In short: We've created a custom, simple file system inside a single file, and the browser turns out to be an incredibly efficient engine for reading it.

## 📦 File Format Specification (`.yuf`)

The binary structure of the container file is simple and predictable.

| Offset (bytes) | Size (bytes)  | Description                                                                 |
| :------------- | :------------ | :-------------------------------------------------------------------------- |
| `0-5`          | `6`           | **Signature:** The ASCII text `YUFFIN`.                                     |
| `6-7`          | `2`           | **Padding:** Two null bytes (`\x00\x00`) for 8-byte alignment.               |
| `8-15`         | `8`           | **Index Length:** A 64-bit unsigned integer (big-endian) specifying the size of the Base64-encoded index that follows. |
| `16 - ...`     | *Variable*    | **Index:** A JSON array of file metadata objects, encoded to `UTF-8` then `Base64`. |
| `...`          | *File Remainder* | **Binary Data:** The raw, concatenated binary data of all video files.     |

#### JSON Index Object Structure:
```json
[
    {
        "id": 0,
        "name": "movie_title.mp4",
        "size": 56008554,
        "mime": "video/mp4",
        "offset": 3676
    },
    {
        "id": 1,
        "name": "another_film.mkv",
        "size": 122267429,
        "mime": "video/x-matroska",
        "offset": 56012230
    }
]
```

## 🛠️ Usage

### Packer Tool (`yuf_video_packer.py`)

A desktop GUI application for creating and unpacking `.yuf` container files.

1.  **Dependencies:**
    The application requires the `customtkinter` library. Install it using pip:
    ```bash
    pip install customtkinter
    ```
2.  **Running the Application:**
    Execute the script from your terminal:
    ```bash
    python yuf_video_packer.py
    ```
3.  **Features:**
    *   **Packing:** Select the video files you want to archive, then choose a save location for the new `.yuf` container.
    *   **Unpacking:** Select an existing `.yuf` file to view its contents, then extract all files to a directory of your choice.

### Web Player (`yuf_player_pro.html`)

An elegant, standalone player for browsing the contents of `.yuf` containers.

1.  **Running the Player:**
    Simply **open the `index.html` file in a modern web browser** (e.g., Google Chrome, Microsoft Edge, Firefox).
    or open [Page](https://zbirow.github.io/Yuffin-Video-Archive/)
2.  **How to Use:**
    *   Click the "Select .yuf Container" button to load your archive.
    *   The list of videos will appear automatically.
    *   Click any video in the list to begin playback instantly.

## 📜 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

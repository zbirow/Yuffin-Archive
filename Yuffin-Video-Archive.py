import customtkinter as ctk
from tkinter import filedialog, messagebox
import json
import base64
import os
import threading

# --- Application Appearance Settings ---
ctk.set_appearance_mode("dark")
ctk.set_default_color_theme("blue")

class YufVideoPacker(ctk.CTk):
    def __init__(self):
        super().__init__()

        self.title("Yuffin Video Packer (.yuf)")
        self.geometry("800x600")

        self.grid_columnconfigure(0, weight=1)
        self.grid_rowconfigure(0, weight=1)

        self.tab_view = ctk.CTkTabview(self, width=250)
        self.tab_view.grid(row=0, column=0, padx=20, pady=20, sticky="nsew")

        # Set up tabs with English names
        self.tab_view.add("Packing")
        self.tab_view.add("Unpacking")

        self.setup_packing_tab()
        self.setup_unpacking_tab()

    # ==============================================================================
    # PACKING TAB
    # ==============================================================================
    def setup_packing_tab(self):
        tab = self.tab_view.tab("Packing")
        tab.grid_columnconfigure(0, weight=1)

        self.files_to_pack_list = []

        self.packing_files_frame = ctk.CTkScrollableFrame(tab, label_text="Video files to pack")
        self.packing_files_frame.grid(row=0, column=0, padx=10, pady=10, sticky="nsew", columnspan=2)
        tab.grid_rowconfigure(0, weight=1)

        self.btn_select_files = ctk.CTkButton(tab, text="Select Video Files", command=self.select_files_to_pack)
        self.btn_select_files.grid(row=1, column=0, padx=10, pady=10, sticky="ew")

        self.btn_pack = ctk.CTkButton(tab, text="Pack to .yuf", command=self.start_packing_thread, state="disabled")
        self.btn_pack.grid(row=1, column=1, padx=10, pady=10, sticky="ew")

        self.packing_progress = ctk.CTkProgressBar(tab, orientation="horizontal")
        self.packing_progress.set(0)
        self.packing_progress.grid(row=2, column=0, columnspan=2, padx=10, pady=5, sticky="ew")
        
        self.packing_status_label = ctk.CTkLabel(tab, text="Ready.")
        self.packing_status_label.grid(row=3, column=0, columnspan=2, padx=10, pady=5, sticky="ew")

    def select_files_to_pack(self):
        files = filedialog.askopenfilenames(
            title="Select video files",
            filetypes=[("Video Files", "*.mp4 *.mkv *.webm *.mov *.avi"), ("All files", "*.*")]
        )
        if files:
            self.files_to_pack_list = list(files)
            self.update_packing_file_list_ui()
            self.btn_pack.configure(state="normal")

    def update_packing_file_list_ui(self):
        for widget in self.packing_files_frame.winfo_children():
            widget.destroy()
        
        for i, f in enumerate(self.files_to_pack_list):
            label = ctk.CTkLabel(self.packing_files_frame, text=f"{i}: {os.path.basename(f)}")
            label.pack(anchor="w", padx=5, pady=2)

    def start_packing_thread(self):
        output_path = filedialog.asksaveasfilename(
            defaultextension=".yuf",
            filetypes=[("Yuffin Video Container", "*.yuf")],
            title="Save container as..."
        )
        if not output_path:
            return

        self.btn_pack.configure(state="disabled")
        self.btn_select_files.configure(state="disabled")
        self.packing_progress.set(0)
        
        # Run the packing process in a separate thread to avoid freezing the GUI
        thread = threading.Thread(target=self.pack_worker, args=(self.files_to_pack_list, output_path))
        thread.start()

    def pack_worker(self, file_paths, output_path):
        """Worker function to pack video files into a .yuf container with a MIME type."""
        try:
            MIME_TYPES = {
                '.mp4': 'video/mp4', '.mkv': 'video/x-matroska', '.webm': 'video/webm',
                '.mov': 'video/quicktime', '.avi': 'video/x-msvideo'
            }
            self.update_packing_status("Analyzing files and building index...")
            
            base_index_data = []
            for i, p in enumerate(file_paths):
                ext = os.path.splitext(p)[1].lower()
                mime_type = MIME_TYPES.get(ext, 'application/octet-stream')
                base_index_data.append({
                    "id": i, "name": os.path.basename(p), "size": os.path.getsize(p), 
                    "mime": mime_type, "offset": 0
                })

            # Iteratively calculate the final index size to get correct offsets
            last_index_size = -1
            final_index_b64 = b''
            index_with_offsets = []
            
            while len(final_index_b64) != last_index_size:
                last_index_size = len(final_index_b64)
                STATIC_HEADER_SIZE = 16
                data_start_offset = STATIC_HEADER_SIZE + (last_index_size if last_index_size != -1 else 0)
                
                index_with_offsets = []
                current_offset = data_start_offset
                for item in base_index_data:
                    new_item = item.copy()
                    new_item['offset'] = current_offset
                    index_with_offsets.append(new_item)
                    current_offset += new_item['size']
                
                header_json = json.dumps(index_with_offsets)
                final_index_b64 = base64.b64encode(header_json.encode('utf-8'))
            
            total_size_to_write = sum(item['size'] for item in index_with_offsets)
            written_bytes = 0

            with open(output_path, 'wb') as f_out:
                # Write the YUFFIN header
                f_out.write(b'YUFFIN')
                f_out.write(b'\x00\x00') # Padding
                f_out.write(len(final_index_b64).to_bytes(8, 'big')) # Index length
                f_out.write(final_index_b64) # Index data

                # Write the binary data for each file
                for item in index_with_offsets:
                    path = next((p for p in file_paths if os.path.basename(p) == item['name']), None)
                    if path is None: continue # Skip if file not found (should not happen)
                    self.update_packing_status(f"Packing: {item['name']}")
                    with open(path, 'rb') as f_in:
                        while chunk := f_in.read(4 * 1024 * 1024): # Read in 4MB chunks
                            f_out.write(chunk)
                            written_bytes += len(chunk)
                            self.update_packing_progress(written_bytes / total_size_to_write)
            
            self.update_packing_status(f"Success! Container saved to: {output_path}")

        except Exception as e:
            self.update_packing_status(f"Error: {e}")
            self.after(0, lambda: messagebox.showerror("Packing Error", str(e)))
        finally:
            # Re-enable buttons and reset progress bar on completion or error
            self.after(0, lambda: self.btn_pack.configure(state="normal"))
            self.after(0, lambda: self.btn_select_files.configure(state="normal"))
            self.after(0, lambda: self.update_packing_progress(0))

    def update_packing_status(self, text):
        self.after(0, lambda: self.packing_status_label.configure(text=text))
    
    def update_packing_progress(self, value):
        self.after(0, lambda: self.packing_progress.set(value))

    # ==============================================================================
    # UNPACKING TAB
    # ==============================================================================
    def setup_unpacking_tab(self):
        tab = self.tab_view.tab("Unpacking")
        tab.grid_columnconfigure(0, weight=1)

        self.unpack_container_path = None
        self.unpack_index = []

        self.unpacking_files_frame = ctk.CTkScrollableFrame(tab, label_text="Container Contents")
        self.unpacking_files_frame.grid(row=0, column=0, padx=10, pady=10, sticky="nsew", columnspan=2)
        tab.grid_rowconfigure(0, weight=1)

        self.btn_select_container = ctk.CTkButton(tab, text="Select .yuf Container", command=self.select_container_to_unpack)
        self.btn_select_container.grid(row=1, column=0, padx=10, pady=10, sticky="ew", columnspan=2)

        self.btn_unpack_all = ctk.CTkButton(tab, text="Unpack All To...", command=self.start_unpacking_thread, state="disabled")
        self.btn_unpack_all.grid(row=2, column=0, padx=10, pady=10, sticky="ew", columnspan=2)

        self.unpacking_progress = ctk.CTkProgressBar(tab, orientation="horizontal")
        self.unpacking_progress.set(0)
        self.unpacking_progress.grid(row=3, column=0, columnspan=2, padx=10, pady=5, sticky="ew")
        
        self.unpacking_status_label = ctk.CTkLabel(tab, text="Select a container file.")
        self.unpacking_status_label.grid(row=4, column=0, columnspan=2, padx=10, pady=5, sticky="ew")

    def select_container_to_unpack(self):
        path = filedialog.askopenfilename(
            title="Select Yuffin container file",
            filetypes=[("Yuffin Video Container", "*.yuf")]
        )
        if not path: return
        
        self.unpack_container_path = path
        try:
            with open(path, 'rb') as f:
                signature = f.read(6)
                if signature != b'YUFFIN':
                    raise ValueError("Not a Yuffin container file! Invalid signature.")
                f.seek(8) # Skip signature and padding
                index_size_bytes = f.read(8)
                index_size = int.from_bytes(index_size_bytes, 'big')
                index_b64 = f.read(index_size)
            
            index_json = base64.b64decode(index_b64).decode('utf-8')
            self.unpack_index = json.loads(index_json)
            
            self.update_unpacking_file_list_ui()
            self.btn_unpack_all.configure(state="normal")
            self.update_unpacking_status(f"Loaded container: {os.path.basename(path)}")

        except Exception as e:
            messagebox.showerror("Read Error", f"Could not read container: {e}")
            self.unpack_container_path = None
            self.unpack_index = []
            self.update_unpacking_file_list_ui()

    def update_unpacking_file_list_ui(self):
        for widget in self.unpacking_files_frame.winfo_children(): widget.destroy()
        if not self.unpack_index:
            self.btn_unpack_all.configure(state="disabled")
            return
        for item in self.unpack_index:
            size_mb = item['size'] / 1024 / 1024
            label_text = f"ID: {item['id']} - {item['name']} ({size_mb:.2f} MB)"
            label = ctk.CTkLabel(self.unpacking_files_frame, text=label_text)
            label.pack(anchor="w", padx=5, pady=2)

    def start_unpacking_thread(self):
        """Asks the user for a destination folder BEFORE starting the worker thread."""
        if not self.unpack_container_path: return

        # Open the system dialog to choose a directory
        dest_dir = filedialog.askdirectory(title="Select destination folder for unpacking")
        
        # If the user cancels (closes the window), stop the function
        if not dest_dir:
            self.update_unpacking_status("Unpacking operation cancelled.")
            return

        # If a folder was chosen, proceed
        self.btn_unpack_all.configure(state="disabled")
        self.btn_select_container.configure(state="disabled")
        self.unpacking_progress.set(0)
        
        # Start the worker thread, passing the chosen destination directory
        thread = threading.Thread(target=self.unpack_worker, args=(dest_dir,))
        thread.start()
        
    def unpack_worker(self, dest_dir):
        """Worker function that now accepts 'dest_dir' as an argument."""
        try:
            total_size_to_extract = sum(item['size'] for item in self.unpack_index)
            extracted_bytes = 0
            with open(self.unpack_container_path, 'rb') as f_in:
                for item in self.unpack_index:
                    self.update_unpacking_status(f"Unpacking: {item['name']}")
                    
                    # Use os.path.join to create a valid file path in the destination folder
                    output_file_path = os.path.join(dest_dir, item['name'])
                    
                    bytes_to_read = item['size']
                    f_in.seek(item['offset'])
                    
                    with open(output_file_path, 'wb') as f_out:
                        while bytes_to_read > 0:
                            chunk_size = min(bytes_to_read, 4 * 1024 * 1024)
                            chunk = f_in.read(chunk_size)
                            if not chunk: break
                            f_out.write(chunk)
                            bytes_to_read -= len(chunk)
                            extracted_bytes += len(chunk)
                            self.update_unpacking_progress(extracted_bytes / total_size_to_extract)
            
            self.update_unpacking_status(f"Success! All files unpacked to: {dest_dir}")

        except Exception as e:
            self.update_unpacking_status(f"Error: {e}")
            self.after(0, lambda: messagebox.showerror("Unpacking Error", str(e)))
        finally:
            self.after(0, lambda: self.btn_unpack_all.configure(state="normal"))
            self.after(0, lambda: self.btn_select_container.configure(state="normal"))
            self.after(0, lambda: self.update_unpacking_progress(0))

    def update_unpacking_status(self, text):
        self.after(0, lambda: self.unpacking_status_label.configure(text=text))
    
    def update_unpacking_progress(self, value):
        self.after(0, lambda: self.unpacking_progress.set(value))

# ==============================================================================
# RUN THE APPLICATION
# ==============================================================================
if __name__ == "__main__":
    app = YufVideoPacker()
    app.mainloop()

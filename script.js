document.addEventListener('DOMContentLoaded', () => {

    // --- GŁÓWNY ROUTER APLIKACJI ---
    const fileInput = document.getElementById('fileInput');
    const statusLabel = document.getElementById('status');
    
    const MAIN_CONTAINER_SIGNATURE = 'YUFFIN';
    const IMAGE_ARCHIVE_SIGNATURE = 'Yuffin';

    fileInput.addEventListener('change', handleFileSelect);
    
    document.querySelectorAll('.close-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const modal = document.getElementById(btn.dataset.modalId);
            if (modal) {
                modal.style.display = 'none';
                cleanup(btn.dataset.modalId);
            }
        });
    });

    async function handleFileSelect(event) {
        const file = event.target.files[0];
        if (!file) return;
        statusLabel.textContent = `Analyzing file: ${file.name}...`;
        try {
            const headerSlice = file.slice(0, 6);
            const headerBuffer = await headerSlice.arrayBuffer();
            const signature = new TextDecoder().decode(headerBuffer);
            if (signature === MAIN_CONTAINER_SIGNATURE) {
                mediaViewer.initialize(file);
            } else if (signature === IMAGE_ARCHIVE_SIGNATURE) {
                imageViewer.initialize(file, true);
            } else {
                throw new Error("Unknown or invalid file signature.");
            }
        } catch (error) {
            handleInitError(error);
        }
    }

    function cleanup(modalId) {
        if (modalId === 'media-viewer-modal') mediaViewer.cleanup();
        else if (modalId === 'image-viewer-modal') imageViewer.cleanup();
        fileInput.value = ''; 
        statusLabel.textContent = '';
    }
    
    function handleInitError(err) {
        statusLabel.textContent = `ERROR: ${err.message}`;
        alert(`Error loading file: ${err.message}`);
    }

    // --- MODUŁ ODTWARZACZA MEDIÓW (.YUF) ---
    const mediaViewer = (() => {
        const modal = document.getElementById('media-viewer-modal');
        if (!modal) return { initialize: () => {}, cleanup: () => {} };
        const title = document.getElementById('media-modal-title');
        const mediaListElement = document.getElementById('mediaList');
        const playerPanel = document.getElementById('player-panel');
        let fileHandle, index, currentUrl;
        async function initialize(file) {
            fileHandle = file;
            title.textContent = file.name;
            const MAIN_HEADER_SIZE = 16;
            const dataView = new DataView(await file.slice(0, MAIN_HEADER_SIZE).arrayBuffer());
            const indexSize = dataView.getBigUint64(8, false);
            const indexEndOffset = MAIN_HEADER_SIZE + Number(indexSize);
            const indexSlice = file.slice(MAIN_HEADER_SIZE, indexEndOffset);
            const indexJson = new TextDecoder().decode(Uint8Array.from(atob(await indexSlice.text()), c => c.charCodeAt(0)));
            index = JSON.parse(indexJson);
            renderList();
            modal.style.display = 'flex';
        }
        function renderList() {
            mediaListElement.innerHTML = '';
            index.forEach(info => {
                const li = document.createElement('li');
                li.title = info.name;
                li.innerHTML = `<span class="media-name">${info.name}</span><span class="media-size">${(info.size / 1024/1024).toFixed(2)} MB</span>`;
                li.addEventListener('click', () => {
                    document.querySelectorAll('#mediaList li').forEach(el => el.classList.remove('active'));
                    li.classList.add('active');
                    if (info.mime === 'application/vnd.yuffin-image-archive') {
                        openNestedImageViewer(info);
                    } else {
                        play(info);
                    }
                });
                mediaListElement.appendChild(li);
            });
        }
        function play(info) {
            if (currentUrl) URL.revokeObjectURL(currentUrl);
            const slice = fileHandle.slice(info.offset, info.offset + info.size);
            const blob = new Blob([slice], { type: info.mime });
            currentUrl = URL.createObjectURL(blob);
            const tag = info.mime.startsWith('video/') ? 'video' : 'audio';
            playerPanel.innerHTML = `<${tag} id="mediaPlayer" controls autoplay></${tag}>`;
            playerPanel.querySelector('#mediaPlayer').src = currentUrl;
        }
        function openNestedImageViewer(info) {
            const slice = fileHandle.slice(info.offset, info.offset + info.size);
            const blobAsFile = new File([slice], info.name, { type: 'application/vnd.yuffin-image-archive' });
            modal.style.display = 'none';
            imageViewer.initialize(blobAsFile, false);
        }
        function cleanup() {
            if (currentUrl) URL.revokeObjectURL(currentUrl);
            currentUrl = null; mediaListElement.innerHTML = '';
            playerPanel.innerHTML = 'Wybierz plik z listy, aby rozpocząć odtwarzanie.';
            fileHandle = null; index = null;
        }
        return { initialize, cleanup };
    })();
    
    // --- MODUŁ PRZEGLĄDARKI OBRAZÓW (.YUFI) ---
    const imageViewer = (() => {
        const modal = document.getElementById('image-viewer-modal');
        if (!modal) return { initialize: () => {}, cleanup: () => {} };
        const title = document.getElementById('image-modal-title');
        const gallery = document.getElementById('image-gallery-container');
        const dirFilter = document.getElementById('dir-filter');
        const viewToggle = document.getElementById('view-toggle');
        const pagination = document.getElementById('pagination');
        const chapterNavTop = document.getElementById('chapter-navigation-top');
        const chapterNavBottom = document.getElementById('chapter-navigation-bottom');
        const fullscreenBtn = document.getElementById('fullscreen-btn');
        const lightbox = document.getElementById('lightbox');
        const lightboxImage = document.getElementById('lightbox-image');
        const lightboxCounter = document.getElementById('lightbox-counter');
        const closeLightboxBtn = document.getElementById('close-lightbox-btn');
        const prevLightboxBtn = document.getElementById('prev-lightbox-btn');
        const nextLightboxBtn = document.getElementById('next-lightbox-btn');
        
        let fileHandle, allImages = [], filteredImages = [], directories = [], sortedChapterDirs = [];
        let createdUrls = []; let lightboxUrl = null;
        const IMAGES_PER_PAGE = 36;
        let currentPage = 1, currentChapterIndex = 0, currentLightboxIndex = 0;
        let isOpenedFromLauncher = false;

        async function initialize(file, fromLauncher) {
            isOpenedFromLauncher = fromLauncher;
            fileHandle = file;
            title.textContent = file.name;
            const HEADER_SIZE = 38, ENTRY_SIZE = 8;
            const headerView = new DataView(await file.slice(0, HEADER_SIZE).arrayBuffer());
            if (new TextDecoder().decode(headerView.buffer.slice(0, 6)) !== IMAGE_ARCHIVE_SIGNATURE) throw new Error("Invalid .yufi file signature (expected 'Yuffin').");
            const imageCount = Number(headerView.getBigUint64(10, true));
            const dirCount = headerView.getUint32(18, true);
            const dirTableOffset = Number(headerView.getBigUint64(22, true));
            const fileIndexOffset = Number(headerView.getBigUint64(30, true));
            const dirTableText = await file.slice(dirTableOffset, fileIndexOffset).text();
            directories = dirTableText.split('\0').slice(0, dirCount);
            const fileIndexBuffer = await file.slice(fileIndexOffset, fileIndexOffset + imageCount * ENTRY_SIZE).arrayBuffer();
            const fileIndexView = new DataView(fileIndexBuffer);
            allImages = Array.from({ length: imageCount }, (_, i) => ({
                offset: fileIndexView.getUint32(i * ENTRY_SIZE, true),
                dirId: fileIndexView.getUint16(i * ENTRY_SIZE + 4, true),
                globalIndex: i // Zapamiętaj globalny indeks
            }));
            populateFilter();
            applyFilter();
            modal.style.display = 'flex';
        }

        function naturalSortKey(s) {
            return s.split(/(\d+)/).map(t => { const num = parseInt(t); return isNaN(num) ? t.toLowerCase() : num; });
        }

        function populateFilter() {
           dirFilter.innerHTML = '<option value="-1">Wszystkie katalogi</option>';
           const chapterPrefixRegex = /^chapter_/i;
           sortedChapterDirs = directories
             .filter(dir => chapterPrefixRegex.test(dir))
             .sort((a, b) => naturalSortKey(a).toString().localeCompare(naturalSortKey(b).toString(), undefined, { numeric: true }));
           const sortedDirs = [...directories].sort((a, b) => naturalSortKey(a).toString().localeCompare(naturalSortKey(b).toString(), undefined, { numeric: true }));
           sortedDirs.forEach(dir => {
           const dirId = directories.indexOf(dir);
           const option = document.createElement('option');
              option.value = dirId;
              option.textContent = (dir === '' || dir === '.') ? '[Główny katalog]' : dir;
              dirFilter.appendChild(option);
           });
        }

        function applyFilter() {
            const selectedDirId = parseInt(dirFilter.value, 10);
            filteredImages = (selectedDirId === -1) ? allImages : allImages.filter(img => img.dirId === selectedDirId);
            currentPage = 1;
            updateDisplay();
        }

        function updateDisplay() {
            gallery.className = viewToggle.checked ? 'comic-view' : 'grid-view';
            if (viewToggle.checked) {
                pagination.style.display = 'none';
                if(sortedChapterDirs.length > 0) {
                    chapterNavTop.style.display = 'flex'; chapterNavBottom.style.display = 'flex';
                    const selectedDirName = directories[parseInt(dirFilter.value, 10)] || sortedChapterDirs[0];
                    currentChapterIndex = sortedChapterDirs.indexOf(selectedDirName);
                    if(currentChapterIndex === -1) currentChapterIndex = 0;
                    updateChapterNavigation(); renderCurrentChapter();
                } else {
                    chapterNavTop.style.display = 'none'; chapterNavBottom.style.display = 'none';
                    renderAllImagesComic();
                }
            } else {
                chapterNavTop.style.display = 'none'; chapterNavBottom.style.display = 'none';
                pagination.style.display = 'flex';
                renderPage(1);
            }
        }
        
        function renderPage(page) {
            currentPage = page; gallery.innerHTML = '';
            const totalPages = Math.ceil(filteredImages.length / IMAGES_PER_PAGE);
            const start = (page - 1) * IMAGES_PER_PAGE;
            const end = start + IMAGES_PER_PAGE;
            filteredImages.slice(start, end).forEach((info, indexInPage) => {
                const itemDiv = document.createElement('div'); itemDiv.className = 'gallery-item';
                const img = document.createElement('img');
                itemDiv.appendChild(img); gallery.appendChild(itemDiv);
                loadImage(info, img, start + indexInPage); // Przekaż indeks w przefiltrowanej liście
            });
            renderPagination(totalPages);
        }
        
        function renderAllImagesComic() {
            gallery.innerHTML = '';
            filteredImages.forEach((info, index) => {
                const itemDiv = document.createElement('div'); itemDiv.className = 'gallery-item';
                const img = document.createElement('img'); img.loading = 'lazy';
                itemDiv.appendChild(img); gallery.appendChild(itemDiv);
                loadImage(info, img, index);
            });
        }
        
        function renderCurrentChapter() {
            const chapterDirName = sortedChapterDirs[currentChapterIndex];
            const chapterDirId = directories.indexOf(chapterDirName);
            filteredImages = allImages.filter(img => img.dirId === chapterDirId);
            renderAllImagesComic();
            modal.querySelector('.modal-content').scrollTop = 0;
        }
        
        function updateChapterNavigation() {
            const chapterName = sortedChapterDirs[currentChapterIndex];
            document.getElementById('current-chapter-top').textContent = chapterName;
            document.getElementById('current-chapter-bottom').textContent = chapterName;
            const prevDisabled = currentChapterIndex === 0;
            const nextDisabled = currentChapterIndex === sortedChapterDirs.length - 1;
            document.getElementById('prev-chapter-top').disabled = prevDisabled;
            document.getElementById('prev-chapter-bottom').disabled = prevDisabled;
            document.getElementById('next-chapter-top').disabled = nextDisabled;
            document.getElementById('next-chapter-bottom').disabled = nextDisabled;
        }

        function renderPagination(totalPages) {
             pagination.innerHTML = totalPages > 1 ? `<button id="prev-page">‹</button> <span>Strona ${currentPage} / ${totalPages}</span> <button id="next-page">›</button>` : '';
             if(totalPages > 1) {
                 document.getElementById('prev-page').disabled = currentPage === 1;
                 document.getElementById('next-page').disabled = currentPage === totalPages;
                 document.getElementById('prev-page').onclick = () => renderPage(currentPage - 1);
                 document.getElementById('next-page').onclick = () => renderPage(currentPage + 1);
             }
        }

        async function loadImage(imageInfo, imgElement, filteredIndex) {
            try {
                const headerView = new DataView(await fileHandle.slice(imageInfo.offset, imageInfo.offset + 8).arrayBuffer());
                const imageSize = headerView.getUint32(4, true);
                const imageBlob = fileHandle.slice(imageInfo.offset + 8, imageInfo.offset + 8 + imageSize);
                const url = URL.createObjectURL(imageBlob);
                createdUrls.push(url);
                imgElement.src = url;
                imgElement.classList.add('loaded');
                // --- NOWOŚĆ: Dodaj listener tylko w widoku siatki ---
                if (!viewToggle.checked) {
                    imgElement.onclick = () => openLightbox(filteredIndex);
                }
            } catch (e) { console.error("Error loading image:", e); }
        }
        
        function cleanup() {
            if (document.fullscreenElement) { document.exitFullscreen(); }
            closeLightbox(); // Zamknij lightbox jeśli jest otwarty
            gallery.innerHTML = ''; pagination.innerHTML = '';
            createdUrls.forEach(url => URL.revokeObjectURL(url));
            createdUrls = []; allImages = []; filteredImages = []; directories = []; fileHandle = null;
            if (!isOpenedFromLauncher) {
                document.getElementById('media-viewer-modal').style.display = 'flex';
            }
        }

        function changeChapter(direction) {
            const newIndex = currentChapterIndex + direction;
            if (newIndex >= 0 && newIndex < sortedChapterDirs.length) {
                currentChapterIndex = newIndex;
                const chapterDirId = directories.indexOf(sortedChapterDirs[currentChapterIndex]);
                dirFilter.value = chapterDirId;
                updateChapterNavigation();
                renderCurrentChapter();
            }
        }
        
        function toggleFullscreen() {
            if (!document.fullscreenElement) {
                modal.requestFullscreen().catch(err => { alert(`Error: ${err.message}`); });
            } else { document.exitFullscreen(); }
        }

        // --- NOWA LOGIKA LIGHTBOXA ---
        function openLightbox(index) {
            currentLightboxIndex = index;
            changeLightboxImage(0); // Pokaż pierwszy obraz bez zmiany indeksu
            lightbox.classList.add('visible');
        }

        function closeLightbox() {
            lightbox.classList.remove('visible');
            if (lightboxUrl) URL.revokeObjectURL(lightboxUrl);
            lightboxUrl = null;
        }

        async function changeLightboxImage(direction) {
            currentLightboxIndex += direction;

            if (currentLightboxIndex < 0) currentLightboxIndex = filteredImages.length - 1;
            if (currentLightboxIndex >= filteredImages.length) currentLightboxIndex = 0;

            const imageInfo = filteredImages[currentLightboxIndex];
            if (!imageInfo) return;

            if (lightboxUrl) URL.revokeObjectURL(lightboxUrl);

            const headerView = new DataView(await fileHandle.slice(imageInfo.offset, imageInfo.offset + 8).arrayBuffer());
            const imageSize = headerView.getUint32(4, true);
            const imageBlob = fileHandle.slice(imageInfo.offset + 8, imageInfo.offset + 8 + imageSize);
            
            lightboxUrl = URL.createObjectURL(imageBlob);
            lightboxImage.src = lightboxUrl;
            lightboxCounter.textContent = `${currentLightboxIndex + 1} / ${filteredImages.length}`;
        }
        
        // Listenery
        dirFilter.addEventListener('change', applyFilter);
        viewToggle.addEventListener('change', updateDisplay);
        fullscreenBtn.addEventListener('click', toggleFullscreen);
        closeLightboxBtn.addEventListener('click', closeLightbox);
        prevLightboxBtn.addEventListener('click', () => changeLightboxImage(-1));
        nextLightboxBtn.addEventListener('click', () => changeLightboxImage(1));
        
        ['top', 'bottom'].forEach(pos => {
            document.getElementById(`prev-chapter-${pos}`).onclick = () => changeChapter(-1);
            document.getElementById(`next-chapter-${pos}`).onclick = () => changeChapter(1);
        });
        document.addEventListener('keydown', (e) => {
            if (modal.style.display === 'flex' && e.key.toLowerCase() === 'f') {
                e.preventDefault(); toggleFullscreen();
            }
            if (lightbox.classList.contains('visible')) {
                if (e.key === 'Escape') closeLightbox();
                if (e.key === 'ArrowRight') changeLightboxImage(1);
                if (e.key === 'ArrowLeft') changeLightboxImage(-1);
            }
        });

        return { initialize, cleanup };
    })();
});

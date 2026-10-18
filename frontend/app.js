const BACKEND_URL = window.location.protocol.startsWith('http')
    ? window.location.origin
    : 'http://127.0.0.1:8080';

const isLocalhost = window.location.hostname === '127.0.0.1' || 
                    window.location.hostname === 'localhost' || 
                    window.location.hostname === '';

const TORRSERVER_URL = isLocalhost ? 'http://127.0.0.1:8090' : BACKEND_URL;

const TMDB_API_KEY      = '3fd2be6f0c70a2a598f084ddfb75487c';
const TMDB_BASE_URL     = 'https://api.themoviedb.org/3';
const TMDB_IMAGE_URL    = 'https://image.tmdb.org/t/p/w500';
const TMDB_BACKDROP_URL = 'https://image.tmdb.org/t/p/original';

const magnetStore = {};
let magnetCounter = 0;

const currentPlayback = {
    magnetId: null,
    videoIndex: 1,
    audioTrack: 0,
    seekTime: 0,
    duration: 7200,
    audioTracks: []
};

// ─── Init ────────────────────────────────────────────────────────────────────

function scrollRow(rowId, direction) {
    document.getElementById(rowId).scrollBy({ left: direction * 600, behavior: 'smooth' });
}

document.addEventListener('DOMContentLoaded', () => {
    checkSystemStatus();
    loadCatalog();
    document.getElementById('movieTitle').addEventListener('keypress', e => {
        if (e.key === 'Enter') searchMovie();
    });
});

// ─── Системный статус ────────────────────────────────────────────────────────

async function checkSystemStatus() {
    try {
        const res = await fetch(`${BACKEND_URL}/status`);
        if (!res.ok) return;
        const data = await res.json();

        const pillTorr = document.getElementById('pillTorr');
        const pillVlc  = document.getElementById('pillVlc');

        if (data.torrserver && data.torrserver.running) {
            pillTorr.classList.add('online');
            pillTorr.title = `TorrServer ${data.torrserver.version || ''} активен`;
        } else {
            pillTorr.classList.remove('online');
            pillTorr.title = 'TorrServer не запущен';
        }

        if (data.vlc && data.vlc.installed) {
            pillVlc.classList.add('online');
            pillVlc.title = 'VLC плеер готов к прямому запуску';
        } else {
            pillVlc.classList.remove('online');
            pillVlc.title = 'VLC плеер не найден';
        }
    } catch (e) {
        console.warn('[Status] Бэкенд пока недоступен:', e);
    }
}

// ─── Toast Уведомления ───────────────────────────────────────────────────────

let toastTimeout = null;
function showToast(message) {
    const toast = document.getElementById('toastNotification');
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add('show');
    clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => {
        toast.classList.remove('show');
    }, 3500);
}

// ─── Каталог ─────────────────────────────────────────────────────────────────

async function loadCatalog() {
    try {
        const [trendingRes, actionRes, topRes] = await Promise.all([
            fetch(`${TMDB_BASE_URL}/trending/movie/week?api_key=${TMDB_API_KEY}&language=ru`),
            fetch(`${TMDB_BASE_URL}/discover/movie?api_key=${TMDB_API_KEY}&language=ru&sort_by=popularity.desc&include_video=false&page=2`),
            fetch(`${TMDB_BASE_URL}/movie/top_rated?api_key=${TMDB_API_KEY}&language=ru&page=1`)
        ]);
        const [trendingData, actionData, topData] = await Promise.all([
            trendingRes.json(), actionRes.json(), topRes.json()
        ]);
        renderRow(trendingData.results || [], 'trendingRow');
        renderRow(actionData.results || [],   'ultraHdRow');
        renderRow(topData.results || [],      'topRatedRow');
        if (trendingData.results && trendingData.results.length > 0) {
            setupHeroBanner(trendingData.results[0]);
        }
    } catch (err) {
        console.error('Ошибка загрузки TMDB:', err);
    }
}

function setupHeroBanner(movie) {
    const banner = document.getElementById('heroBanner');
    if (!banner || !movie) return;
    if (movie.backdrop_path) {
        banner.style.backgroundImage = `url('${TMDB_BACKDROP_URL}${movie.backdrop_path}')`;
    }
    document.getElementById('heroTitle').textContent    = movie.title;
    document.getElementById('heroOverview').textContent = movie.overview || '';
    document.getElementById('heroPlayBtn').onclick      = () => openMovieDetails(movie);
}

function renderRow(movies, rowId) {
    const row = document.getElementById(rowId);
    if (!row) return;
    row.innerHTML = '';
    movies.forEach((movie, i) => {
        if (!movie.poster_path) return;
        const card = document.createElement('div');
        card.className = 'movie-card';
        card.style.animationDelay = `${i * 0.04}s`;
        card.onclick = () => openMovieDetails(movie);
        card.innerHTML = `
            <div class="movie-card-rating">★ ${movie.vote_average ? movie.vote_average.toFixed(1) : '—'}</div>
            <img src="${TMDB_IMAGE_URL}${movie.poster_path}" alt="${escapeHtml(movie.title)}" loading="lazy">
            <div class="movie-card-overlay"><div class="movie-card-play">▶</div></div>
            <div class="movie-card-title">${escapeHtml(movie.title)}</div>
        `;
        row.appendChild(card);
    });
}

// ─── Модалка ─────────────────────────────────────────────────────────────────

function openMovieDetails(movie) {
    const modal = document.getElementById('movieModal');
    modal.style.display = 'block';
    document.body.style.overflow = 'hidden';

    stopPlayer();
    document.getElementById('playerContainer').style.display = 'none';
    const fileSelector = document.getElementById('fileSelectorContainer');
    if (fileSelector) fileSelector.style.display = 'none';
    const audioSelector = document.getElementById('audioSelectorContainer');
    if (audioSelector) audioSelector.style.display = 'none';

    const modalHero = document.getElementById('modalHero');
    if (movie.backdrop_path) {
        modalHero.style.backgroundImage = `url('${TMDB_BACKDROP_URL}${movie.backdrop_path}')`;
        modalHero.style.display = 'block';
    } else {
        modalHero.style.display = 'none';
    }

    document.getElementById('modalPoster').src           = movie.poster_path ? `${TMDB_IMAGE_URL}${movie.poster_path}` : '';
    document.getElementById('modalTitle').textContent    = movie.title;
    document.getElementById('modalRating').textContent   = `★ ${movie.vote_average ? movie.vote_average.toFixed(1) : '—'}`;
    document.getElementById('modalYear').textContent     = movie.release_date ? movie.release_date.split('-')[0] : '—';
    document.getElementById('modalOverview').textContent = movie.overview || 'Описание отсутствует.';

    fetchTorrents(movie.title);
}

function closeModal() {
    document.getElementById('movieModal').style.display = 'none';
    document.body.style.overflow = 'auto';
    stopPlayer();
}

function showHomeScreen() {
    closeModal();
    document.getElementById('movieTitle').value = '';
    document.getElementById('heroBanner').style.display = 'flex';
    document.querySelectorAll('.movie-section').forEach(s => s.style.display = 'block');
    const headerTitle = document.getElementById('trendingRow').closest('.movie-section').querySelector('h2');
    if (headerTitle) headerTitle.textContent = '🔥 Популярно сейчас';
    loadCatalog();
}

// ─── Поиск ───────────────────────────────────────────────────────────────────

async function searchMovie() {
    const query = document.getElementById('movieTitle').value.trim();
    if (!query) return;

    document.getElementById('heroBanner').style.display = 'none';
    document.querySelectorAll('.movie-section').forEach((s, i) => {
        s.style.display = i === 0 ? 'block' : 'none';
    });
    const headerTitle = document.getElementById('trendingRow').closest('.movie-section').querySelector('h2');
    if (headerTitle) headerTitle.textContent = `Результаты: «${query}»`;

    try {
        const res  = await fetch(`${TMDB_BASE_URL}/search/movie?api_key=${TMDB_API_KEY}&language=ru&query=${encodeURIComponent(query)}`);
        const data = await res.json();
        renderRow(data.results || [], 'trendingRow');
    } catch (err) {
        console.error(err);
    }
}

// ─── Торренты ────────────────────────────────────────────────────────────────

async function fetchTorrents(title) {
    const grid   = document.getElementById('resultsGrid');
    const status = document.getElementById('statusMessage');

    grid.innerHTML       = '';
    status.style.display = 'block';
    status.textContent   = '🔍 Поиск раздач на трекерах...';

    try {
        const response = await fetch(`${BACKEND_URL}/search?title=${encodeURIComponent(title)}`);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const torrents = await response.json();

        if (!Array.isArray(torrents) || torrents.length === 0) {
            status.textContent = '✗ Раздач не найдено. Попробуйте изменить название фильма.';
            return;
        }

        status.style.display = 'none';

        torrents.forEach(t => {
            const id = magnetCounter++;
            magnetStore[id] = (t.magnet.includes('%3A') || t.magnet.includes('%3a'))
                ? decodeURIComponent(t.magnet) : t.magnet;

            const card = document.createElement('div');
            card.className = 'torrent-card';
            card.innerHTML = `
                <div class="torrent-info">
                    <div class="torrent-title">${escapeHtml(t.title)}</div>
                    <div class="torrent-meta">
                        ${getQualityBadge(t.title, t.size)}
                        <span>💾 ${t.size} ГБ</span>
                        <span>🌱 <span class="seeders">${t.seeders}</span> сидов</span>
                    </div>
                </div>
                <div class="torrent-actions">
                    <button class="play-btn" onclick="startStreaming(${id})">▶ Смотреть</button>
                    <button class="vlc-btn"  onclick="openInVLC(${id})">🎬 VLC</button>
                </div>
            `;
            grid.appendChild(card);
        });

    } catch (err) {
        status.style.display = 'block';
        status.textContent   = '⚠ Бэкенд не отвечает. Убедитесь, что запущен start.bat';
        console.error(err);
    }
}

function getQualityBadge(title, sizeGb) {
    const t = title.toUpperCase();
    if (t.includes('2160') || t.includes('4K') || t.includes('UHD') || sizeGb > 30)
        return '<span class="badge badge-4k">4K</span>';
    if (t.includes('1080') || sizeGb > 8)
        return '<span class="badge badge-fhd">FHD</span>';
    if (t.includes('720'))
        return '<span class="badge badge-hd">HD</span>';
    return '';
}

function escapeHtml(str) {
    return String(str)
        .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
        .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

// ─── Стриминг ────────────────────────────────────────────────────────────────

async function startStreaming(magnetId) {
    const pureMagnet = magnetStore[magnetId];
    if (!pureMagnet) return;

    currentPlayback.magnetId = magnetId;
    currentPlayback.videoIndex = 1;
    currentPlayback.audioTrack = 0;
    currentPlayback.seekTime = 0;

    const playerContainer = document.getElementById('playerContainer');
    stopPlayer();
    playerContainer.style.display = 'block';
    setPlayerStatus('⏳ Подключение к раздаче в TorrServer...');
    playerContainer.scrollIntoView({ behavior: 'smooth' });

    let videoIndex = 1;
    let videoFiles = [];

    try {
        const infoRes = await fetch(`${BACKEND_URL}/torrent-info?magnet=${encodeURIComponent(pureMagnet)}`);
        if (infoRes.ok) {
            const info  = await infoRes.json();
            const files = info.file_stats || [];
            const videoExt = /\.(mkv|mp4|avi|mov|ts|m2ts|webm)$/i;

            videoFiles = files.filter(f => videoExt.test(f.path || ''));

            let maxSize = 0;
            videoFiles.forEach(f => {
                if (f.length > maxSize) {
                    maxSize    = f.length;
                    videoIndex = f.id !== undefined ? f.id : 1;
                }
            });
            currentPlayback.videoIndex = videoIndex;
            console.log(`[TorrServer] Видеофайл id=${videoIndex}, найдено видео: ${videoFiles.length}`);
        }
    } catch (e) {
        console.warn('[torrent-info] Ошибка получения списка файлов:', e);
    }

    renderFileSelector(videoFiles, videoIndex, magnetId);

    // Загружаем список аудиодорожек через бэкенд
    loadAudioTracks(pureMagnet, videoIndex);

    // Запускаем воспроизведение
    playCurrentStream(0);
}

async function loadAudioTracks(pureMagnet, videoIndex) {
    const container = document.getElementById('audioSelectorContainer');
    if (!container) return;
    try {
        const res = await fetch(`${BACKEND_URL}/audio-tracks?magnet=${encodeURIComponent(pureMagnet)}&index=${videoIndex}`);
        if (res.ok) {
            const data = await res.json();
            currentPlayback.audioTracks = data.tracks || [];
            renderAudioSelector(currentPlayback.audioTracks);
        }
    } catch (e) {
        console.warn('[audio-tracks] Ошибка загрузки дорожек:', e);
    }
}

function renderAudioSelector(tracks) {
    const container = document.getElementById('audioSelectorContainer');
    if (!container) return;

    if (!tracks || tracks.length <= 1) {
        container.style.display = 'none';
        container.innerHTML = '';
        return;
    }

    container.style.display = 'flex';
    container.innerHTML = `
        <span class="file-selector-label">🔊 Аудиодорожка:</span>
        <select class="file-select" id="movieAudioSelect"></select>
    `;

    const select = document.getElementById('movieAudioSelect');
    tracks.forEach(t => {
        const opt = document.createElement('option');
        opt.value = t.id;
        opt.textContent = t.title;
        if (t.id === currentPlayback.audioTrack) opt.selected = true;
        select.appendChild(opt);
    });

    select.onchange = () => {
        currentPlayback.audioTrack = parseInt(select.value, 10);
        showToast(`🔊 Выбрана дорожка: ${select.options[select.selectedIndex].text}`);
        const video = document.getElementById('player');
        const currentTime = (video && !isNaN(video.currentTime)) ? video.currentTime : 0;
        playCurrentStream(currentTime);
    };
}

function renderFileSelector(videoFiles, currentIndex, magnetId) {
    const container = document.getElementById('fileSelectorContainer');
    if (!container) return;

    if (!videoFiles || videoFiles.length <= 1) {
        container.style.display = 'none';
        container.innerHTML = '';
        return;
    }

    container.style.display = 'flex';
    container.innerHTML = `
        <span class="file-selector-label">📂 Файл/Серия:</span>
        <select class="file-select" id="movieFileSelect"></select>
    `;

    const select = document.getElementById('movieFileSelect');
    videoFiles.forEach(f => {
        const opt = document.createElement('option');
        opt.value = f.id;
        const sizeMb = (f.length / (1024 * 1024)).toFixed(0);
        opt.textContent = `${f.path} (${sizeMb} МБ)`;
        if (f.id === currentIndex) opt.selected = true;
        select.appendChild(opt);
    });

    select.onchange = () => {
        const chosenId = parseInt(select.value, 10);
        currentPlayback.videoIndex = chosenId;
        const pureMagnet = magnetStore[magnetId];
        loadAudioTracks(pureMagnet, chosenId);
        playCurrentStream(0);
    };
}

function onToggleAudioFix() {
    const chk = document.getElementById('chkAudioFix');
    const isChecked = chk ? chk.checked : true;
    showToast(isChecked ? '🔊 Включена трансляция со звуком AAC' : '🔇 Переключено на прямой исходный поток');
    const video = document.getElementById('player');
    const currentTime = (video && !isNaN(video.currentTime)) ? video.currentTime : 0;
    playCurrentStream(currentTime);
}

function playCurrentStream(seekSeconds = 0) {
    const pureMagnet = magnetStore[currentPlayback.magnetId];
    if (!pureMagnet) return;

    const chk = document.getElementById('chkAudioFix');
    const useAudioFix = chk ? chk.checked : true;

    let streamUrl = '';
    if (useAudioFix) {
        // Транскодируем несовместимый AC3/DTS звук в понятный браузеру AAC стерео
        streamUrl = `${BACKEND_URL}/stream-live?magnet=${encodeURIComponent(pureMagnet)}&index=${currentPlayback.videoIndex}&audio_track=${currentPlayback.audioTrack}`;
        if (seekSeconds > 0) {
            streamUrl += `&ss=${Math.floor(seekSeconds)}`;
        }
    } else {
        // Прямой поток из TorrServer или через прокси бэкенда при удаленном хостинге
        streamUrl = isLocalhost
            ? `${TORRSERVER_URL}/stream/?link=${encodeURIComponent(pureMagnet)}&index=${currentPlayback.videoIndex}&play`
            : `${BACKEND_URL}/stream-proxy?magnet=${encodeURIComponent(pureMagnet)}&index=${currentPlayback.videoIndex}`;
    }

    loadCustomPlayer(streamUrl, currentPlayback.magnetId, seekSeconds);
}

async function openInVLC(magnetId) {
    const pureMagnet = magnetStore[magnetId];
    if (!pureMagnet) return;

    showToast('⏳ Подготовка VLC...');

    let videoIndex = currentPlayback.videoIndex || 1;
    try {
        const infoRes = await fetch(`${BACKEND_URL}/torrent-info?magnet=${encodeURIComponent(pureMagnet)}`);
        if (infoRes.ok) {
            const info  = await infoRes.json();
            const files = info.file_stats || [];
            const videoExt = /\.(mkv|mp4|avi|mov|ts|m2ts|webm)$/i;
            let maxSize = 0;
            files.forEach(f => {
                if (videoExt.test(f.path || '') && f.length > maxSize) {
                    maxSize    = f.length;
                    videoIndex = f.id !== undefined ? f.id : 1;
                }
            });
        }
    } catch (e) {
        console.warn('[VLC] Ошибка получения файлов:', e);
    }

    const streamUrl = isLocalhost
        ? `${TORRSERVER_URL}/stream/?link=${encodeURIComponent(pureMagnet)}&index=${videoIndex}&play`
        : `${BACKEND_URL}/stream-proxy?magnet=${encodeURIComponent(pureMagnet)}&index=${videoIndex}`;

    try {
        const res = await fetch(`${BACKEND_URL}/open-vlc?url=${encodeURIComponent(streamUrl)}`);
        const data = await res.json();
        if (data.success) {
            showToast('🎬 Воспроизведение запущено в VLC!');
            return;
        }
    } catch (e) {
        console.warn('API /open-vlc недоступен:', e);
    }

    downloadM3U(streamUrl);
    showToast('📥 Скачан файл film.m3u для открытия в плеере');
}

// ─── Кастомный плеер ─────────────────────────────────────────────────────────

const playerState = {
    hideControlsTimer: null,
    isDragging: false,
};

function stopPlayer() {
    const v = document.getElementById('player');
    if (v) {
        v.pause();
        v.removeAttribute('src');
        v.load();
    }
    clearTimeout(playerState.hideControlsTimer);
    const overlay = document.getElementById('playerOverlay');
    if (overlay) overlay.style.display = 'flex';
}

function setPlayerStatus(msg) {
    const el = document.getElementById('nowPlaying');
    if (el) el.innerHTML = msg;
}

function loadCustomPlayer(streamUrl, magnetId, seekOffset = 0) {
    const video      = document.getElementById('player');
    const overlay    = document.getElementById('playerOverlay');

    setPlayerStatus('⏳ Подключение к пирам и запуск видео со звуком...');

    video.src = streamUrl;
    video.load();

    video.oncanplay = () => {
        overlay.style.display = 'none';
        video.play().catch(() => {
            overlay.style.display = 'flex';
            setPlayerStatus('▶ Нажмите кнопку Play для воспроизведения');
        });
    };

    video.onplaying = () => {
        overlay.style.display = 'none';
        setPlayerStatus(`
            🎬 <strong>Воспроизводится в браузере (со звуком AAC)</strong>
            &nbsp;·&nbsp;
            <a href="#" onclick="openInVLC(${magnetId}); return false;" style="color:var(--green); font-weight:600;">Открыть в VLC</a>
            <button class="copy-btn" onclick="copyToClipboard('${escapeHtml(streamUrl)}')">📋 Ссылка</button>
        `);
    };

    video.onwaiting = () => {
        setPlayerStatus('⏳ Буферизация потока...');
    };

    video.onerror = () => {
        console.warn('[Player] Ошибка воспроизведения видео тегом <video>');
        setPlayerStatus(`
            <div class="codec-warning-box">
                <p>⚠ <strong>Браузер не может воспроизвести поток</strong>. Рекомендуем открыть фильм в VLC плеере (в 1 клик):</p>
                <div class="codec-actions">
                    <button class="vlc-btn" onclick="openInVLC(${magnetId})" style="padding:7px 14px; font-size:13px;">🎬 Запустить в VLC плеере (1 клик)</button>
                    <button class="play-btn" onclick="downloadM3U('${escapeHtml(streamUrl)}')" style="padding:7px 14px; font-size:13px; background:var(--surface3);">📥 Скачать .m3u</button>
                    <button class="copy-btn" onclick="copyToClipboard('${escapeHtml(streamUrl)}')">📋 Скопировать ссылку</button>
                </div>
            </div>
        `);
    };

    overlay.onclick = () => {
        overlay.style.display = 'none';
        video.play().catch(console.error);
    };

    initCustomControls(video);
}

function initCustomControls(video) {
    const wrapper       = document.querySelector('.video-wrapper');
    const controls      = document.getElementById('customControls');
    const playPauseBtn  = document.getElementById('btnPlayPause');
    const progress      = document.getElementById('progressBar');
    const progressFill  = document.getElementById('progressFill');
    const progressBuf   = document.getElementById('progressBuffer');
    const progressThumb = document.getElementById('progressThumb');
    const timeDisplay   = document.getElementById('timeDisplay');
    const volumeSlider  = document.getElementById('volumeSlider');
    const volumeIcon    = document.getElementById('btnVolume');
    const fullscreenBtn = document.getElementById('btnFullscreen');

    playPauseBtn.onclick = () => video.paused ? video.play() : video.pause();
    video.onpause = () => { playPauseBtn.textContent = '▶'; };
    video.onplay  = () => { playPauseBtn.textContent = '❚❚'; };

    video.ontimeupdate = () => {
        if (playerState.isDragging) return;
        const totalDuration = (video.duration && isFinite(video.duration) && video.duration > 0)
            ? video.duration
            : currentPlayback.duration;

        const effectiveTime = video.currentTime + (currentPlayback.seekTime || 0);
        const pct = Math.min(1, effectiveTime / totalDuration);
        progressFill.style.width = `${pct * 100}%`;
        progressThumb.style.left = `${pct * 100}%`;
        timeDisplay.textContent  = `${formatTime(effectiveTime)} / ${formatTime(totalDuration)}`;
    };

    video.onprogress = () => {
        if (!video.duration || !isFinite(video.duration) || !video.buffered.length) return;
        const pct = video.buffered.end(video.buffered.length - 1) / video.duration;
        progressBuf.style.width = `${pct * 100}%`;
    };

    progress.onmousedown = (e) => { playerState.isDragging = true; seekTo(e, progress, video); };
    document.onmousemove = (e) => { if (playerState.isDragging) seekTo(e, progress, video); };
    document.onmouseup   = ()  => { playerState.isDragging = false; };

    volumeSlider.oninput = () => {
        video.volume = parseFloat(volumeSlider.value);
        video.muted  = video.volume === 0;
        updateVolumeIcon(video, volumeIcon);
    };
    volumeIcon.onclick = () => {
        video.muted = !video.muted;
        volumeSlider.value = video.muted ? 0 : video.volume;
        updateVolumeIcon(video, volumeIcon);
    };

    fullscreenBtn.onclick = () => toggleFullscreen(wrapper, fullscreenBtn);
    document.onfullscreenchange = () => {
        fullscreenBtn.textContent = document.fullscreenElement ? '⊡' : '⛶';
    };

    wrapper.onmousemove = () => {
        controls.style.opacity = '1';
        wrapper.style.cursor   = 'default';
        clearTimeout(playerState.hideControlsTimer);
        if (!video.paused) {
            playerState.hideControlsTimer = setTimeout(() => {
                controls.style.opacity = '0';
                wrapper.style.cursor   = 'none';
            }, 3000);
        }
    };
    wrapper.onmouseleave = () => {
        if (!video.paused) {
            controls.style.opacity = '0';
            wrapper.style.cursor   = 'none';
        }
    };

    document.onkeydown = (e) => {
        if (document.getElementById('movieModal').style.display !== 'block') return;
        if (e.target.tagName === 'INPUT') return;
        switch (e.code) {
            case 'Space':       e.preventDefault(); video.paused ? video.play() : video.pause(); break;
            case 'ArrowRight':  e.preventDefault(); video.currentTime = Math.min((video.duration || 7200), video.currentTime + 10); break;
            case 'ArrowLeft':   e.preventDefault(); video.currentTime = Math.max(0, video.currentTime - 10); break;
            case 'ArrowUp':     e.preventDefault(); video.volume = Math.min(1, video.volume + 0.1); volumeSlider.value = video.volume; updateVolumeIcon(video, volumeIcon); break;
            case 'ArrowDown':   e.preventDefault(); video.volume = Math.max(0, video.volume - 0.1); volumeSlider.value = video.volume; updateVolumeIcon(video, volumeIcon); break;
            case 'KeyF':        e.preventDefault(); toggleFullscreen(wrapper, fullscreenBtn); break;
            case 'KeyM':        e.preventDefault(); volumeIcon.click(); break;
        }
    };

    video.ondblclick = () => toggleFullscreen(wrapper, fullscreenBtn);
}

function seekTo(e, progressEl, video) {
    const rect = progressEl.getBoundingClientRect();
    const pct  = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const chk  = document.getElementById('chkAudioFix');

    if (chk && chk.checked) {
        const totalDuration = (video.duration && isFinite(video.duration) && video.duration > 0)
            ? video.duration
            : currentPlayback.duration;
        const targetSec = Math.floor(pct * totalDuration);
        currentPlayback.seekTime = targetSec;
        playCurrentStream(targetSec);
    } else {
        if (video.duration && isFinite(video.duration)) {
            video.currentTime = pct * video.duration;
        }
    }
    document.getElementById('progressFill').style.width  = `${pct * 100}%`;
    document.getElementById('progressThumb').style.left  = `${pct * 100}%`;
}

function toggleFullscreen(wrapper, btn) {
    if (!document.fullscreenElement) {
        wrapper.requestFullscreen().catch(console.error);
    } else {
        document.exitFullscreen();
    }
}

function updateVolumeIcon(video, icon) {
    if (video.muted || video.volume === 0) icon.textContent = '🔇';
    else if (video.volume < 0.5)           icon.textContent = '🔉';
    else                                   icon.textContent = '🔊';
}

function formatTime(sec) {
    if (!sec || isNaN(sec)) return '0:00';
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = Math.floor(sec % 60);
    return h > 0
        ? `${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`
        : `${m}:${String(s).padStart(2,'0')}`;
}

function downloadM3U(url) {
    const blob = new Blob([`#EXTM3U\n#EXTINF:-1,Фильм\n${url}`], { type: 'audio/x-mpegurl' });
    const a    = document.createElement('a');
    a.href     = URL.createObjectURL(blob);
    a.download = 'film.m3u';
    a.click();
}

function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => {
        showToast('📋 Ссылка на стрим скопирована!');
    }).catch(() => {
        alert('Ссылка: ' + text);
    });
}
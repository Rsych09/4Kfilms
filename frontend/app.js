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
    currentPlayback.seekTime = 0;
    currentPlayback.duration = 7200;

    // Загружаем точную длительность фильма из TMDB если есть ID
    if (movie.id) {
        fetch(`https://api.themoviedb.org/3/movie/${movie.id}?api_key=${TMDB_API_KEY}&language=ru-RU`)
            .then(r => r.json())
            .then(data => {
                if (data.runtime && data.runtime > 0) {
                    currentPlayback.duration = data.runtime * 60;
                    console.log(`[TMDB] Длительность: ${data.runtime} мин (${currentPlayback.duration} сек)`);
                    updateTimeDisplay(0, currentPlayback.duration);
                }
            })
            .catch(() => {});
    }

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
    try {
        const res = await fetch(`${BACKEND_URL}/audio-tracks?magnet=${encodeURIComponent(pureMagnet)}&index=${videoIndex}`);
        if (res.ok) {
            const data = await res.json();
            currentPlayback.audioTracks = data.tracks || [];
            if (data.duration && data.duration > 60) {
                currentPlayback.duration = Math.round(data.duration);
                console.log(`[MediaInfo] Точная длительность файла: ${currentPlayback.duration} сек (${formatTime(currentPlayback.duration)})`);
                const video = document.getElementById('player');
                const cur = (video && !isNaN(video.currentTime)) ? video.currentTime : 0;
                updateTimeDisplay((currentPlayback.seekTime || 0) + cur, currentPlayback.duration);
            }
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
        const effectiveTime = (currentPlayback.seekTime || 0) + ((video && !isNaN(video.currentTime)) ? video.currentTime : 0);
        playCurrentStream(Math.floor(effectiveTime));
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
    const effectiveTime = (currentPlayback.seekTime || 0) + ((video && !isNaN(video.currentTime)) ? video.currentTime : 0);
    playCurrentStream(Math.floor(effectiveTime));
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

function getTotalDuration(video) {
    if (currentPlayback.duration && currentPlayback.duration > 60) {
        return currentPlayback.duration;
    }
    const chk = document.getElementById('chkAudioFix');
    const isLive = chk && chk.checked;
    if (!isLive && video && video.duration && isFinite(video.duration) && video.duration > 60) {
        return Math.round(video.duration);
    }
    return currentPlayback.duration || 7200;
}

function updateTimeDisplay(currentTime, totalDuration) {
    const timeDisplay = document.getElementById('timeDisplay');
    if (!timeDisplay) return;
    timeDisplay.textContent = `${formatTime(currentTime)} / ${formatTime(totalDuration)}`;
}

let seekDragTime = 0;

function commitSeek(targetSec, video) {
    const chk = document.getElementById('chkAudioFix');
    const totalDuration = getTotalDuration(video);
    const clampedSec = Math.max(0, Math.min(totalDuration, targetSec));

    if (chk && chk.checked) {
        currentPlayback.seekTime = clampedSec;
        playCurrentStream(clampedSec);
    } else {
        if (video.duration && isFinite(video.duration)) {
            video.currentTime = clampedSec;
        }
    }
}

function skipRelative(deltaSeconds) {
    const video = document.getElementById('player');
    const chk = document.getElementById('chkAudioFix');
    const totalDuration = getTotalDuration(video);
    const curTime = (video && !isNaN(video.currentTime)) ? video.currentTime : 0;
    const effective = (currentPlayback.seekTime || 0) + curTime;
    const target = Math.max(0, Math.min(totalDuration, Math.floor(effective + deltaSeconds)));

    if (chk && chk.checked) {
        currentPlayback.seekTime = target;
        playCurrentStream(target);
    } else {
        if (video.duration && isFinite(video.duration)) {
            video.currentTime = target;
        }
    }
}

function initCustomControls(video) {
    const wrapper       = document.querySelector('.video-wrapper');
    const controls      = document.getElementById('customControls');
    const playPauseBtn  = document.getElementById('btnPlayPause');
    const progress      = document.getElementById('progressBar');
    const progressFill  = document.getElementById('progressFill');
    const progressBuf   = document.getElementById('progressBuffer');
    const progressThumb = document.getElementById('progressThumb');
    const volumeSlider  = document.getElementById('volumeSlider');
    const volumeIcon    = document.getElementById('btnVolume');
    const fullscreenBtn = document.getElementById('btnFullscreen');

    playPauseBtn.onclick = () => video.paused ? video.play() : video.pause();
    video.onpause = () => { playPauseBtn.textContent = '▶'; };
    video.onplay  = () => { playPauseBtn.textContent = '❚❚'; };

    video.ontimeupdate = () => {
        if (playerState.isDragging) return;
        const totalDuration = getTotalDuration(video);
        const effectiveTime = video.currentTime + (currentPlayback.seekTime || 0);
        const pct = Math.max(0, Math.min(1, effectiveTime / totalDuration));
        progressFill.style.width = `${pct * 100}%`;
        progressThumb.style.left = `${pct * 100}%`;
        updateTimeDisplay(effectiveTime, totalDuration);
    };

    video.onprogress = () => {
        const totalDuration = getTotalDuration(video);
        if (!totalDuration || !video.buffered.length) return;
        const bufferedEnd = video.buffered.end(video.buffered.length - 1);
        const effectiveBuffered = (currentPlayback.seekTime || 0) + bufferedEnd;
        const pct = Math.max(0, Math.min(1, effectiveBuffered / totalDuration));
        progressBuf.style.width = `${pct * 100}%`;
    };

    function getEventClientX(e) {
        if (e.touches && e.touches.length > 0) return e.touches[0].clientX;
        if (e.changedTouches && e.changedTouches.length > 0) return e.changedTouches[0].clientX;
        return e.clientX;
    }

    function handleSeekEvent(e, commit = false) {
        const clientX = getEventClientX(e);
        const rect = progress.getBoundingClientRect();
        const pct  = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
        const totalDuration = getTotalDuration(video);
        seekDragTime = Math.floor(pct * totalDuration);

        progressFill.style.width = `${pct * 100}%`;
        progressThumb.style.left = `${pct * 100}%`;
        updateTimeDisplay(seekDragTime, totalDuration);

        if (commit) {
            commitSeek(seekDragTime, video);
        }
    }

    progress.onmousedown = (e) => {
        playerState.isDragging = true;
        handleSeekEvent(e, false);
    };
    progress.addEventListener('touchstart', (e) => {
        playerState.isDragging = true;
        handleSeekEvent(e, false);
    }, { passive: true });

    document.addEventListener('mousemove', (e) => {
        if (playerState.isDragging) {
            handleSeekEvent(e, false);
        }
    });
    document.addEventListener('touchmove', (e) => {
        if (playerState.isDragging) {
            handleSeekEvent(e, false);
        }
    }, { passive: true });

    document.addEventListener('mouseup', (e) => {
        if (playerState.isDragging) {
            playerState.isDragging = false;
            commitSeek(seekDragTime, video);
        }
    });
    document.addEventListener('touchend', (e) => {
        if (playerState.isDragging) {
            playerState.isDragging = false;
            commitSeek(seekDragTime, video);
        }
    });

    progress.onclick = (e) => {
        handleSeekEvent(e, true);
    };

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

    const showControls = () => {
        controls.style.opacity = '1';
        controls.style.pointerEvents = 'auto';
        wrapper.style.cursor   = 'default';
        clearTimeout(playerState.hideControlsTimer);
        if (!video.paused) {
            playerState.hideControlsTimer = setTimeout(() => {
                if (playerState.isDragging || controls.matches(':hover')) return;
                controls.style.opacity = '0';
                controls.style.pointerEvents = 'none';
                wrapper.style.cursor   = 'none';
            }, 3000);
        }
    };

    wrapper.addEventListener('mousemove', showControls);
    wrapper.addEventListener('mouseenter', showControls);
    wrapper.addEventListener('touchstart', showControls, { passive: true });

    // В полноэкранном режиме мышь может двигаться по любому месту экрана
    document.addEventListener('mousemove', (e) => {
        if (document.fullscreenElement) {
            showControls();
        }
    });

    controls.addEventListener('mouseenter', () => {
        clearTimeout(playerState.hideControlsTimer);
        controls.style.opacity = '1';
        controls.style.pointerEvents = 'auto';
    });
    controls.addEventListener('mouseleave', () => {
        if (!video.paused && !playerState.isDragging) {
            playerState.hideControlsTimer = setTimeout(() => {
                controls.style.opacity = '0';
                controls.style.pointerEvents = 'none';
                wrapper.style.cursor   = 'none';
            }, 2000);
        }
    });

    fullscreenBtn.onclick = () => toggleFullscreen(wrapper, fullscreenBtn);
    document.onfullscreenchange = () => {
        const isFs = !!document.fullscreenElement;
        fullscreenBtn.textContent = isFs ? '⊡' : '⛶';
        wrapper.classList.toggle('fullscreen-mode', isFs);
        showControls();
    };

    document.onkeydown = (e) => {
        if (e.key === 'Escape') {
            closePhoneModal();
            closeModal();
            return;
        }
        if (document.getElementById('movieModal').style.display !== 'block') return;
        if (e.target.tagName === 'INPUT') return;
        switch (e.code) {
            case 'Space':       e.preventDefault(); video.paused ? video.play() : video.pause(); break;
            case 'ArrowRight':  e.preventDefault(); skipRelative(10); break;
            case 'ArrowLeft':   e.preventDefault(); skipRelative(-10); break;
            case 'ArrowUp':     e.preventDefault(); video.volume = Math.min(1, video.volume + 0.1); volumeSlider.value = video.volume; updateVolumeIcon(video, volumeIcon); break;
            case 'ArrowDown':   e.preventDefault(); video.volume = Math.max(0, video.volume - 0.1); volumeSlider.value = video.volume; updateVolumeIcon(video, volumeIcon); break;
            case 'KeyF':        e.preventDefault(); toggleFullscreen(wrapper, fullscreenBtn); break;
            case 'KeyM':        e.preventDefault(); volumeIcon.click(); break;
        }
    };

    video.onclick = () => {
        if (controls.style.opacity === '0') {
            showControls();
        } else {
            video.paused ? video.play() : video.pause();
        }
    };

    video.ondblclick = () => toggleFullscreen(wrapper, fullscreenBtn);
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
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(() => {
            showToast('📋 Ссылка на стрим скопирована!');
        }).catch(() => {
            copyFallback(text, '📋 Ссылка скопирована!');
        });
    } else {
        copyFallback(text, '📋 Ссылка скопирована!');
    }
}

function copyFallback(text, msg = '📋 Скопировано!') {
    const tempInput = document.createElement('input');
    tempInput.value = text;
    document.body.appendChild(tempInput);
    tempInput.select();
    try {
        document.execCommand('copy');
        showToast(msg);
    } catch (err) {
        alert('Адрес: ' + text);
    }
    document.body.removeChild(tempInput);
}

// ─── Подключение смартфона по QR-коду ───────────────────────────────────────

let phoneNetworkUrl = '';

async function openPhoneModal() {
    const modal = document.getElementById('qrModal');
    if (!modal) return;
    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';

    const urlEl = document.getElementById('qrUrlText');
    const imgEl = document.getElementById('qrCodeImg');
    if (urlEl) urlEl.textContent = 'Определение адреса в сети...';

    try {
        const res = await fetch(`${BACKEND_URL}/network-info`);
        if (res.ok) {
            const data = await res.json();
            phoneNetworkUrl = data.phone_url || window.location.origin;
            if (urlEl) urlEl.textContent = phoneNetworkUrl;
            if (imgEl && data.qr_code) {
                imgEl.src = data.qr_code;
            }
        } else {
            throw new Error(`HTTP ${res.status}`);
        }
    } catch (e) {
        console.warn('Ошибка получения QR от бэкенда, пробуем fallback:', e);
        phoneNetworkUrl = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
            ? `http://${window.location.hostname}:8080`
            : window.location.origin;
        if (urlEl) urlEl.textContent = phoneNetworkUrl;
        if (imgEl) {
            imgEl.src = `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(phoneNetworkUrl)}`;
        }
    }
}

function closePhoneModal(e) {
    if (e && e.target && e.target.id !== 'qrModal' && !e.target.classList.contains('qr-modal-close')) {
        return;
    }
    const modal = document.getElementById('qrModal');
    if (modal) modal.style.display = 'none';
    const movieModal = document.getElementById('movieModal');
    if (!movieModal || movieModal.style.display !== 'block') {
        document.body.style.overflow = 'auto';
    }
}

function copyPhoneUrl() {
    if (!phoneNetworkUrl) return;
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(phoneNetworkUrl).then(() => {
            showToast('📋 Адрес скопирован в буфер обмена!');
        }).catch(() => {
            copyFallback(phoneNetworkUrl, '📋 Адрес скопирован в буфер обмена!');
        });
    } else {
        copyFallback(phoneNetworkUrl, '📋 Адрес скопирован в буфер обмена!');
    }
}
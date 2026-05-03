// Dữ liệu bài hát (Đảm bảo đúng tên file trong thư mục music của bạn)
const musicData = [
    { id: 1, file: "#memorizethepast.mp3", title: "Memorize The Past", artist: "Unknown", img: "https://picsum.photos/seed/1/200" },
    { id: 2, file: "Like Him (feat. Lola Young).mp3", title: "Like Him", artist: "Lola Young", img: "https://picsum.photos/seed/2/200" },
    { id: 3, file: "Met her on the internet (normal) - TheyHateMako (1).mp3", title: "Met her on the internet", artist: "TheyHateMako", img: "https://picsum.photos/seed/3/200" },
    { id: 4, file: "NUMBER - TWERKNATION28.mp3", title: "NUMBER", artist: "TWERKNATION28", img: "https://picsum.photos/seed/4/200" },
    { id: 5, file: "SpotiDownloader.com - breaking down - ERRx.mp3", title: "Breaking Down", artist: "ERRx", img: "https://picsum.photos/seed/5/200" },
    { id: 6, file: "SpotiDownloader.com - MEMORIZING - DJ DELACROIX.mp3", title: "Memorizing", artist: "DJ DELACROIX", img: "https://picsum.photos/seed/6/200" },
    { id: 7, file: "SpotiDownloader.com - MEMORIZING 2 - DJ DELACROIX.mp3", title: "Memorizing 2", artist: "DJ DELACROIX", img: "https://picsum.photos/seed/7/200" },
    { id: 8, file: "SpotiDownloader.com - Met her on the internet (normal) - TheyHateMako.mp3", title: "Internet Love", artist: "TheyHateMako", img: "https://picsum.photos/seed/8/200" },
    { id: 9, file: "SpotiDownloader.com - QUANTUM - Slowed - PHNKR.mp3", title: "QUANTUM (Slowed)", artist: "PHNKR", img: "https://picsum.photos/seed/9/200" },
    { id: 10, file: "Stephanie - Nafeesisboujee.mp3", title: "Stephanie", artist: "Nafeesisboujee", img: "https://picsum.photos/seed/10/200" }
];

// Lưu ý: Tôi dùng https://picsum.photos để tạo ảnh giả lập cho đẹp. 
// Nếu bạn có ảnh thật trong thư mục image, hãy đổi thành: img: "../image/ten_anh.jpg"

let currentAudio = new Audio();
let isPlaying = false;
let currentUser = null;

// ==========================================
// 1. XỬ LÝ KHI TRANG LOAD XONG
// ==========================================
window.onload = () => {
    console.log("App started...");
    
    // Kiểm tra xem đã có người dùng trong máy chưa
    const savedUser = localStorage.getItem('songtify_user');
    if (savedUser) {
        currentUser = JSON.parse(savedUser);
        console.log("User found:", currentUser.name);
        loadApp(); // Vào thẳng app
    } else {
        console.log("No user found, showing login...");
        // Hiện màn hình login (mặc định HTML đã hiện rồi)
    }

    // Xử lý Theme (Dark/Light)
    const savedTheme = localStorage.getItem('songtify_theme');
    const themeToggle = document.getElementById('theme-toggle');
    if (savedTheme === 'light') {
        document.body.classList.add('light-mode');
        if(themeToggle) themeToggle.checked = false;
    } else {
        if(themeToggle) themeToggle.checked = true;
    }
};

// ==========================================
// 2. HÀM LOGIN (Xử lý khi bấm nút Log In)
// ==========================================
function handleLogin() {
    console.log("Login button clicked");
    const nameInput = document.getElementById('login-name');
    const name = nameInput.value.trim();

    if (!name) {
        alert("Vui lòng nhập tên của bạn!");
        return;
    }

    // Tạo đối tượng user mới
    currentUser = { 
        name: name, 
        avatar: 'https://i.pravatar.cc/150?u=' + name // Ảnh ngẫu nhiên theo tên
    };

    // Lưu vào máy để lần sau không cần login lại
    localStorage.setItem('songtify_user', JSON.stringify(currentUser));
    
    console.log("Login successful, loading app...");
    loadApp();
}

// ==========================================
// 3. HÀM LOAD APP (Vào giao diện chính)
// ==========================================
function loadApp() {
    try {
        // 1. Ẩn login, hiện app
        document.getElementById('login-overlay').classList.add('d-none');
        document.getElementById('main-app').classList.remove('d-none');

        // 2. Cập nhật thông tin User lên giao diện
        if(document.getElementById('top-user-name')) 
            document.getElementById('top-user-name').innerText = currentUser.name;
        
        if(document.getElementById('display-name')) 
            document.getElementById('display-name').innerText = currentUser.name;
        
        if(document.getElementById('top-user-avatar')) 
            document.getElementById('top-user-avatar').src = currentUser.avatar;
        
        if(document.getElementById('user-avatar')) 
            document.getElementById('user-avatar').src = currentUser.avatar;

        // 3. Hiển thị danh sách nhạc
        renderSongs(musicData, 'songList');
        
        console.log("App loaded successfully!");
    } catch (error) {
        console.error("Lỗi khi load App:", error);
    }
}

// ==========================================
// 4. CÁC HÀM XỬ LÝ NHẠC & GIAO DIỆN KHÁC
// ==========================================

function renderSongs(data, containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = '';
    data.forEach(song => {
        container.innerHTML += `
            <div class="col-md-3">
                <div class="song-card-modern" onclick="playMusic('../music/${song.file}', '${song.title}', '${song.artist}')">
                    <div class="card-img-wrapper mb-3 shadow">
                        <img src="https://via.placeholder.com/200/1ed760/ffffff?text=${song.title[0]}" class="w-100">
                        <div class="play-hover">
                            <i class="fas fa-play fa-2x text-white"></i>
                        </div>
                    </div>
                    <h6 class="fw-bold mb-1 text-truncate text-white">${song.title}</h6>
                    <p class="small text-white-50 mb-0">${song.artist}</p>
                </div>
            </div>`;
    });
}

function playMusic(path, title, artist) {
    currentAudio.src = path;
    currentAudio.play();
    isPlaying = true;
    document.getElementById('playIcon').className = 'fas fa-pause';
    document.getElementById('nowPlaying').innerText = title;
    // Cập nhật thông tin dưới player bar
    const playerBarArtist = document.querySelector('.controls-player + .volume-player'); // Bạn có thể thêm ID cho artist bên dưới
    console.log("Playing:", title);
}

function togglePlay() {
    if(!currentAudio.src) return;
    if(isPlaying) {
        currentAudio.pause();
        document.getElementById('playIcon').className = 'fas fa-play';
    } else {
        currentAudio.play();
        document.getElementById('playIcon').className = 'fas fa-pause';
    }
    isPlaying = !isPlaying;
}

function handleLogout() {
    localStorage.removeItem('songtify_user');
    location.reload(); // Load lại trang để về màn hình login
}

function showPage(pageId) {
    document.querySelectorAll('.page-section').forEach(p => p.classList.add('d-none'));
    document.getElementById(`page-${pageId}`).classList.remove('d-none');
    
    // Đổi màu menu active
    document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
    // (Tự thêm logic active link nếu cần)
}

// Xử lý Volume
function changeVol(v) {
    currentAudio.volume = v / 100;
}

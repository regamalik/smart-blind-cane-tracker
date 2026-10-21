// Refactor untuk Live Update 5 Detik Tanpa Auto Refresh
lucide.createIcons();

let map = L.map('map').setView([-6.2, 106.8166], 12);
let lastMarker = null;
let userMarker = null;
let routeLine = null;
let routeCoords = [];
let lastLatLng = null;
let locationWatchId = null;
let isAutoFollow = true;
let refreshCountdown = 5;


L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '© OpenStreetMap contributors'
}).addTo(map);

function formatDate(date) {
  return date.toISOString().split('T')[0];
}

function getDistanceFromLatLonInKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) *
    Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function updateStats(data) {
  const pointCount = data.length;
  let distance = 0;
  for (let i = 1; i < data.length; i++) {
    distance += getDistanceFromLatLonInKm(
      data[i - 1].latitude, data[i - 1].longitude,
      data[i].latitude, data[i].longitude
    );
  }

  document.getElementById("pointCount").textContent = pointCount;
  document.getElementById("totalDistance").textContent = distance.toFixed(2);
}

function showLiveUpdate() {
  const el = document.querySelector('.live-update');
  if (!el) return;
  el.style.display = 'block';
  el.classList.add('live-update');
  setTimeout(() => {
    el.style.display = 'none';
  }, 2000);
}

function loadLocations(silent = false, forceCenter = false) {
  isAutoFollow = true;

  const date = document.getElementById('dateFilter').value;
  const spinner = document.getElementById('loading-spinner');
  const noData = document.getElementById('no-data');

  if (!silent) spinner.style.display = 'block';
  noData.style.display = 'none';

  fetch(`get_locations.php?date=${date}`)
    .then(res => res.json())
    .then(data => {
      if (!silent) spinner.style.display = 'none';

      if (!data.length) {
        noData.style.display = 'block';
        return;
      }

      const last = data[data.length - 1];
      const latLng = [last.latitude, last.longitude];
      logLocation(last.latitude, last.longitude, last.accuracy || 0);


      const isNewPosition = !lastLatLng || latLng[0] !== lastLatLng[0] || latLng[1] !== lastLatLng[1];

      if (isNewPosition || forceCenter) {
        showLiveUpdate();
        lastLatLng = latLng;

        lastMarker = L.marker(latLng, {
          icon: L.icon({
            iconUrl: "https://maps.gstatic.com/mapfiles/ms2/micons/red-dot.png",
            iconSize: [32, 32],
            iconAnchor: [16, 32]
          })
        }).addTo(map);
        lastMarker._icon.style.transition = 'opacity 0.3s ease';
      } else {
        lastMarker._icon.style.opacity = 0;
        setTimeout(() => {
          lastMarker.setLatLng(latLng);
          lastMarker._icon.style.opacity = 1;
          lastMarker._icon.classList.add('marker-pulse');
          setTimeout(() => lastMarker._icon.classList.remove('marker-pulse'), 1000);
        }, 200);
      }

      const newRouteCoords = data.map(loc => [loc.latitude, loc.longitude]);
      const sameLength = routeCoords.length === newRouteCoords.length;
      const sameCoords = sameLength && routeCoords.every((v, i) => v[0] === newRouteCoords[i][0] && v[1] === newRouteCoords[i][1]);

      if (!sameCoords) {
        routeCoords = newRouteCoords;
        if (routeLine) map.removeLayer(routeLine);
        routeLine = L.polyline(routeCoords, { color: 'red' }).addTo(map);
      }

      updateStats(data);
    })
    .catch(err => {
      if (!silent) spinner.style.display = 'none';
      console.error(err);
    });
}

function loadLastOnly() {
  const date = document.getElementById('dateFilter').value;
  const spinner = document.getElementById('loading-spinner');
  const noData = document.getElementById('no-data');

  spinner.style.display = 'block';
  noData.style.display = 'none';

  fetch(`get_locations.php?date=${date}`)
    .then(res => res.json())
    .then(data => {
      spinner.style.display = 'none';

      if (!data.length) {
        noData.style.display = 'block';
        return;
      }

      const last = data[data.length - 1];
      const latLng = [last.latitude, last.longitude];

      // Hapus marker lama jika ada
      if (lastMarker) map.removeLayer(lastMarker);

      lastMarker = L.marker(latLng, {
        icon: L.icon({
          iconUrl: "https://maps.gstatic.com/mapfiles/ms2/micons/red-dot.png",
          iconSize: [32, 32],
          iconAnchor: [16, 32]
        })
      }).addTo(map);

      map.flyTo(latLng, 18);
    })
    .catch(err => {
      spinner.style.display = 'none';
      console.error(err);
    });
}

function showUserLocation() {
  if (!navigator.geolocation) {
    alert("Browser tidak mendukung geolokasi.");
    return;
  }

  navigator.geolocation.getCurrentPosition(
    pos => {
      const { latitude, longitude } = pos.coords;
      if (userMarker) {
        userMarker.setLatLng([latitude, longitude]);
      } else {
        userMarker = L.marker([latitude, longitude], {
          icon: L.icon({
            iconUrl: "https://maps.gstatic.com/mapfiles/ms2/micons/blue-dot.png",
            iconSize: [32, 32],
            iconAnchor: [16, 32]
          }),
          rotationAngle: 0
        }).addTo(map).bindPopup("Lokasi Anda").openPopup();
      }

      map.setView([latitude, longitude], 18, { animate: true });
    },
    err => {
      console.error(err);
    },
    { enableHighAccuracy: true, maximumAge: 0 }
  );
}

function toggleDarkMode() {
  const body = document.body;
  const isDark = body.classList.contains("dark");
  body.classList.toggle("dark", !isDark);
  body.classList.toggle("light", isDark);

  const themeIcon = document.getElementById("themeIcon");
  themeIcon.setAttribute("data-lucide", isDark ? "moon" : "sun");
  themeIcon.setAttribute("title", isDark ? "Mode Gelap" : "Mode Terang");
  lucide.createIcons();

  document.querySelectorAll(".navbar, .card, .alert, .form-control").forEach(el => {
    el.classList.toggle("dark", !isDark);
    el.classList.toggle("light", isDark);
  });
}

function toggleAutoFollow() {
  isAutoFollow = !isAutoFollow;
  const btn = document.getElementById('followBtn');
  btn.innerHTML = `<i data-lucide="target"></i> Ikuti Marker: ${isAutoFollow ? "ON" : "OFF"}`;
  lucide.createIcons();
}

function getUserCity() {
  if (!navigator.geolocation) {
    document.getElementById("userCity").innerText = "📍 Kota Anda: Tidak tersedia";
    return;
  }

  navigator.geolocation.getCurrentPosition(
    pos => {
      const lat = pos.coords.latitude;
      const lon = pos.coords.longitude;
      const apiKey = "GANTI_DENGAN_GEOAPIFY_API_KEY";

      fetch(`https://api.geoapify.com/v1/geocode/reverse?lat=${lat}&lon=${lon}&apiKey=${apiKey}`)
        .then(res => res.json())
        .then(data => {
          const city = data.features?.[0]?.properties?.city || "Tidak diketahui";
          document.getElementById("userCity").innerText = "📍 Kota Anda: " + city;
        })
        .catch(err => {
          console.error(err);
          document.getElementById("userCity").innerText = "📍 Kota Anda: Tidak dapat diakses";
        });
    },
    err => {
      console.error(err);
      document.getElementById("userCity").innerText = "📍 Kota Anda: Tidak tersedia";
    }
  );
}

let autoRefresh = true;
document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("autoRefreshBtn").onclick = () => {
    autoRefresh = !autoRefresh;
    document.getElementById("autoRefreshBtn").innerText = `🔁 Auto Refresh: ${autoRefresh ? "ON" : "OFF"}`;
  };
});


window.onload = () => {
  document.getElementById("dateFilter").value = formatDate(new Date());
  const jam = new Date().getHours();
  if (jam >= 6 && jam <= 18) {
    if (document.body.classList.contains("dark")) toggleDarkMode();
  }
  loadLocations();
  getUserCity();
  lucide.createIcons();
  // Live update polling every 5 seconds
  setInterval(() => {
    if (autoRefresh) {
      refreshCountdown = 5;
      loadLocations(true);
    }
  }, 5000);
  setInterval(() => {
    if (autoRefresh) {
      refreshCountdown--;
      const el = document.getElementById("refreshCountdownSmall");
      el.innerText = `(${refreshCountdown})`;
      el.classList.remove("countdown-warning", "countdown-danger");

      if (refreshCountdown === 2) {
        el.classList.add("countdown-warning");
      } else if (refreshCountdown === 1) {
        el.classList.add("countdown-danger");
      }

      if (refreshCountdown <= 0) refreshCountdown = 5;
    }
  }, 1000);


};


function getBearing(lat1, lon1, lat2, lon2) {
  const toRad = deg => deg * Math.PI / 180;
  const toDeg = rad => rad * 180 / Math.PI;

  const dLon = toRad(lon2 - lon1);
  const y = Math.sin(dLon) * Math.cos(toRad(lat2));
  const x = Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) -
    Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(dLon);
  const brng = toDeg(Math.atan2(y, x));
  return (brng + 360) % 360;
}

function toggleFullscreen() {
  const mapEl = document.getElementById("map");
  if (!document.fullscreenElement) {
    mapEl.requestFullscreen();
  } else {
    document.exitFullscreen();
  }
}

// Array untuk menyimpan log data GPS
let gpsLogs = [];

function logLocation(lat, lon, accuracy) {
  const now = new Date().toLocaleTimeString();

  gpsLogs.push({
    time: now,
    latitude: lat.toFixed(6),
    longitude: lon.toFixed(6),
    accuracy: accuracy ? accuracy.toFixed(2) : "0"
  });
}


function exportGPSCSV() {
  if (gpsLogs.length === 0) {
    alert("Belum ada data GPS yang dicatat.");
    return;
  }

  let csv = [
    "Waktu,Latitude,Longitude,Akurasi (m),Kualitas Akurasi"
  ];

  gpsLogs.forEach(log => {
    const acc = parseFloat(log.accuracy);
    let kualitas = "";

    if (acc <= 5) kualitas = "Akurat";
    else if (acc <= 15) kualitas = "Sedang";
    else kualitas = "Buruk";

    csv.push(`${log.time},${log.latitude},${log.longitude},${log.accuracy},${kualitas}`);
  });

  // Tambahkan ringkasan akurasi di bagian bawah
  const summary = getAccuracySummary();
  if (summary) {
    csv.push(""); // baris kosong
    csv.push("Ringkasan Akurasi");
    csv.push(`Jumlah Titik: ${summary.count}`);
    csv.push(`Rata-rata Akurasi: ${summary.mean} meter`);
    csv.push(`Standar Deviasi: ${summary.stddev} meter`);
  }

  const blob = new Blob([csv.join("\n")], { type: "text/csv" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = "gps_marker_merah.csv";
  link.click();
}


function getAccuracySummary() {
  if (gpsLogs.length === 0) return null;

  const values = gpsLogs.map(log => parseFloat(log.accuracy));
  const total = values.reduce((a, b) => a + b, 0);
  const mean = total / values.length;

  const variance = values.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / values.length;
  const stddev = Math.sqrt(variance);

  return {
    mean: mean.toFixed(2),
    stddev: stddev.toFixed(2),
    count: values.length
  };
}


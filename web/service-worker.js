self.addEventListener('install', function(e) {
  e.waitUntil(
    caches.open('gps-tracker-cache').then(function(cache) {
      return cache.addAll([
        '/',
        '/index.html',
        '/get_locations.php',
        '/save_location.php',
        '/db_config.php'
      ]);
    })
  );
});

self.addEventListener('fetch', function(e) {
  e.respondWith(
    caches.match(e.request).then(function(response) {
      return response || fetch(e.request);
    })
  );
});

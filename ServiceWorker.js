const serviceWorkerName = "dev-visual-scripting-site-v1"
const min_assets = [
    "/",
    "/index.html",
    "/env.html",

    "/css/stylesheet.css",
    "/css/sidepanel.css",
    "/css/process.css",

    "/assets/icon_connector.svg",
    "/assets/icon_process.svg",
    "/assets/shortcuts.json",

    "/js/env.mod.js",
    "/js/SidePanel.mod.js",

    "/js/design/DesignBoard.mod.js",
    "/js/design/DesignConnection.mod.js",
    "/js/design/DesignPort.mod.js",
    "/js/design/DesignProcess.mod.js",
    "/js/design/DesignType.mod.js",
    "/js/design/designUtils.mod.js",
    "/js/design/DesignViewPort.mod.js",
    "/js/design/premadeProcesses.mod.js",

    "/js/FBP/process-lib/FbpDLatchProcess.mod.js",
    "/js/FBP/process-lib/FbpSheetPortProcess.mod.js",

    "/js/FBP/fbp.mod.js",
    "/js/FBP/FbpConnection.mod.js",
    "/js/FBP/FbpPort.mod.js",
    "/js/FBP/FbpProcess.mod.js",
    "/js/FBP/FbpSheet.mod.js",
    "/js/FBP/FbpType.mod.js",
]

self.addEventListener("install", installEvent => {
    installEvent.waitUntil(
        caches.open(serviceWorkerName).then(cache => {
            return cache.addAll(min_assets);
        })
    )
});
self.addEventListener("fetch", fetchEvent => {
    fetchEvent.respondWith(
        caches.match(fetchEvent.request).then(res => {
            return res || fetch(fetchEvent.request)
        })
    )
});

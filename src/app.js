// <reference path='https://api.tiles.mapbox.com/mapbox-gl-js/v1.8.0/mapbox-gl.js' />

'use strict'

const vmapSize = 18;
const mapSize = 17.28;
const tileSize = 1.92;

var grid = loadSettings();

let debug = !!new URL(window.location.href).searchParams.get('debug');
let debugElements = document.getElementsByClassName('debug');
if (debug) while (debugElements.length > 0) {
    debugElements[0].classList.remove('debug');
}
// This token is created by original repo owner. For now no need to change it (until it works).
mapboxgl.accessToken = 'pk.eyJ1Ijoiam9obmJlcmciLCJhIjoiY2s2d3FwdTJpMDJnejNtbzBtb2ljbXZiYyJ9.yRKViKWpsMTtE-NPesWZvA';

var map = new mapboxgl.Map({
    container: 'map', // Specify the container ID
    style: 'mapbox://styles/mapbox/outdoors-v11', // Specify which map style to use
    //style: 'mapbox://styles/mapbox/streets-v11', // Specify which map style to use
    center: [grid.lng, grid.lat], // Specify the starting position [lng, lat]
    zoom: grid.zoom // Specify the starting zoom
});

var geocoder = new MapboxGeocoder({
    accessToken: mapboxgl.accessToken,
    mapboxgl: mapboxgl,
    marker: false
});

document.getElementById('geocoder').appendChild(geocoder.onAdd(map));

map.on('load', function () {
    var canvas = map.getCanvasContainer();

    map.addSource('grid', {
        'type': 'geojson',
        'data': getGrid(grid.lng, grid.lat, vmapSize)
    });

    map.addLayer({
        'id': 'gridlines',
        'type': 'fill',
        'source': 'grid',
        'paint': {
            'fill-color': 'gray',
            'fill-outline-color': 'gray',
            'fill-opacity': 0.25
        }
    });

    map.addSource('playable', {
        'type': 'geojson',
        'data': getGrid(grid.lng, grid.lat, vmapSize / 9 * 5)
    });

    map.addLayer({
        'id': 'playablesquare',
        'type': 'fill',
        'source': 'playable',
        'paint': {
            'fill-color': 'green',
            'fill-outline-color': 'green',
            'fill-opacity': 0.3
        }
    });

    map.addSource('start', {
        'type': 'geojson',
        'data': getGrid(grid.lng, grid.lat, vmapSize / 9)
    });

    map.addLayer({
        'id': 'startsquare',
        'type': 'fill',
        'source': 'start',
        'paint': {
            'fill-color': 'blue',
            'fill-outline-color': 'blue',
            'fill-opacity': 0.1
        }
    });

    map.addSource('mapbox-streets', {
        type: 'vector',
        url: 'mapbox://mapbox.mapbox-streets-v8'
    });

    map.addSource('contours', {
        type: 'vector',
        url: 'mapbox://mapbox.mapbox-terrain-v2'
    });

    map.addLayer({
        'id': 'contours',
        'type': 'line',
        'source': 'contours',
        'source-layer': 'contour',
        'layout': {
            'visibility': 'visible',
            'line-join': 'round',
            'line-cap': 'round'
        },
        'paint': {
            'line-color': '#877b59',
            'line-width': 0.25
        }
    });

    map.addLayer({
        'id': 'water-streets',
        'source': 'mapbox-streets',
        'source-layer': 'water',
        'type': 'fill',
        'paint': {
            'fill-color': 'rgba(66,100,225, 0.3)',
            'fill-outline-color': 'rgba(33,33,255, 1)'
        }
    });

    // debug: area that is downloaded
    if (debug) {
        map.addSource('debug', {
            'type': 'geojson',
            // 'data': turf.squareGrid([0, 0, 0, 0], tileSize, { units: 'kilometers' })
            'data': turf.bboxPolygon(turf.bbox(turf.lineString([0, 0], [0, 0])))
        });

        map.addLayer({
            'id': 'debugLayer',
            'type': 'line',
            'source': 'debug',
            'paint': {
                'line-color': 'orangered',
                'line-width': 1
            },
            'layout': {
                'visibility': 'none'
            },
        });
    }

    map.on('mouseenter', 'startsquare', function () {
        map.setPaintProperty('startsquare', 'fill-opacity', 0.3);
        map.setPaintProperty('startsquare', 'fill-color', 'blue');
        canvas.style.cursor = 'move';
        hideDebugLayer()
    });

    map.on('mouseleave', 'startsquare', function () {
        map.setPaintProperty('startsquare', 'fill-color', 'blue');
        map.setPaintProperty('startsquare', 'fill-opacity', 0.1);
        canvas.style.cursor = '';
        saveSettings();
    });

    map.on('mousedown', 'startsquare', function (e) {
        // Prevent the default map drag behavior.
        e.preventDefault();

        canvas.style.cursor = 'grab';

        map.on('mousemove', onMove);
        map.once('mouseup', onUp);
    });

    map.on('touchstart', 'startsquare', function (e) {
        if (e.points.length !== 1) return;

        // Prevent the default map drag behavior.
        e.preventDefault();

        map.on('touchmove', onMove);
        map.once('touchend', onUp);
    });

    showWaterLayer();
    showHeightLayer();
});

map.on('click', function (e) {
    grid.lng = e.lngLat.lng;
    grid.lat = e.lngLat.lat;

    setGrid(grid.lng, grid.lat, vmapSize);
    map.panTo(new mapboxgl.LngLat(grid.lng, grid.lat));
    saveSettings();
    hideDebugLayer();
    updateInfopanel();
});

map.on('idle', function () {
    saveSettings();
});

geocoder.on('result', function (query) {
    grid.lng = query.result.center[0];
    grid.lat = query.result.center[1];

    setGrid(grid.lng, grid.lat, vmapSize);
    map.setZoom(10.2);

    saveSettings();
    hideDebugLayer();
    updateInfopanel();
});

function onMove(e) {
    grid.lng = e.lngLat.lng;
    grid.lat = e.lngLat.lat;
    setGrid(e.lngLat.lng, e.lngLat.lat, vmapSize);
}

function onUp(e) {
    grid.lng = e.lngLat.lng;
    grid.lat = e.lngLat.lat;
    setGrid(e.lngLat.lng, e.lngLat.lat, vmapSize);

    // Unbind mouse/touch events
    map.off('mousemove', onMove);
    map.off('touchmove', onMove);

    hideDebugLayer();
    updateInfopanel();
}

function showHeightContours(el) {
    grid.heightContours = !grid.heightContours;
    if (grid.heightContours) {
        el.classList.add('active');
    } else {
        el.classList.remove('active');
    }
    showHeightLayer();
}

function showHeightLayer() {
    let el = document.getElementById('showHeightContours');
    if (grid.heightContours) {
        if (!el.classList.contains('active')) el.classList.add('active');
        map.setLayoutProperty('contours', 'visibility', 'visible');
    } else {
        if (el.classList.contains('active')) el.classList.remove('active');
        map.setLayoutProperty('contours', 'visibility', 'none');
    }
}

function showWaterContours(el) {
    grid.waterContours = !grid.waterContours;
    if (grid.waterContours) {
        el.classList.add('active');
    } else {
        el.classList.remove('active');
    }
    showWaterLayer();
}

function showWaterLayer() {
    let el = document.getElementById('showWaterContours');
    if (grid.waterContours) {
        if (!el.classList.contains('active')) el.classList.add('active');
        map.setLayoutProperty('water-streets', 'visibility', 'visible');
    } else {
        if (el.classList.contains('active')) el.classList.remove('active');
        map.setLayoutProperty('water-streets', 'visibility', 'none');
    }
}

function hideDebugLayer() {
    if (debug) map.setLayoutProperty('debugLayer', 'visibility', 'none');
    grid.minHeight = null;
    grid.maxHeight = null;
}

function setGrid(lng, lat, size) {
    map.getSource('grid').setData(getGrid(lng, lat, size));
    map.getSource('start').setData(getGrid(lng, lat, size / 9));
    map.getSource('playable').setData(getGrid(lng, lat, size / 9 * 5));
    grid.zoom = map.getZoom();
}

function getExtent(lng, lat, size = vmapSize) {
    let dist = Math.sqrt(2 * Math.pow(size / 2, 2));
    let point = turf.point([lng, lat]);
    let topleft = turf.destination(point, dist, -45, { units: 'kilometers' }).geometry.coordinates;
    let bottomright = turf.destination(point, dist, 135, { units: 'kilometers' }).geometry.coordinates;
    return { 'topleft': topleft, 'bottomright': bottomright };
}

function getGrid(lng, lat, size) {
    let extent = getExtent(lng, lat, size);
    return turf.squareGrid([extent.topleft[0], extent.topleft[1], extent.bottomright[0], extent.bottomright[1]], tileSize, { units: 'kilometers' });
}

function loadSettings() {
    let grid = JSON.parse(localStorage.getItem('grid')) || {};
    grid.lng = parseFloat(grid.lng) || -122.43877;
    grid.lat = parseFloat(grid.lat) || 37.75152;
    grid.zoom = parseFloat(grid.zoom) || 11.0;
    grid.minHeight = parseFloat(grid.minHeight) || 0;
    grid.maxHeight = parseFloat(grid.maxHeight) || 0;
    grid.heightContours = grid.heightContours || false;
    grid.waterContours = grid.waterContours || false;
    return grid;
}

function saveSettings() {
    grid.zoom = map.getZoom();
    localStorage.setItem('grid', JSON.stringify(grid));
}

function Create2DArray(rows, def = null) {
    let arr = new Array(rows);
    for (let i = 0; i < rows; i++) {
        arr[i] = new Array(rows).fill(def);
    }
    return arr;
}

function togglePanel() {
    let panel = document.getElementById('infopanel');
    let icon = document.getElementById('panelicon');
    let isOpen = panel.classList.contains('slide-in');

    panel.setAttribute('class', isOpen ? 'slide-out' : 'slide-in'); // removes also the hidden class!
    icon.setAttribute('class', isOpen ? 'fas fa-info-circle' : 'fa fa-angle-left');

    if (!isOpen) {
        getHeightmap(2);
    }
}

function calcMinMaxHeight(heightmap, xOffset, yOffset) {
    let minHeight = 100000;
    let maxHeight = -100000;

    // iterate over the heightmap
    for (let y = yOffset; y < yOffset + 1081 ; y++) {
        for (let x = xOffset; x < yOffset + 1081; x++) {
            let h = heightmap[y][x];
            if (h > maxHeight) maxHeight = h;
            if (h < minHeight) minHeight = h;
        }
    }
    grid.minHeight = minHeight / 10;
    grid.maxHeight = maxHeight / 10;
}

function updateInfopanel() {
    document.getElementById('lng').innerHTML = grid.lng.toFixed(5);
    document.getElementById('lat').innerHTML = grid.lat.toFixed(5);
    document.getElementById('minh').innerHTML = grid.minHeight;
    document.getElementById('maxh').innerHTML = grid.maxHeight;
}

function zoomIn() {
    map.zoomIn();
}

function zoomOut() {
    map.zoomOut();
}

function getHeightmap(mode = 0) {
    saveSettings(false);

    // get the extent of the current map
    let extent = getExtent(grid.lng, grid.lat, mapSize);

    // zoom is 13 in principle
    let zoom = 13;

    // get a tile that covers the top left and bottom right (for the tile count calculation)
    let x = long2tile(extent.topleft[0], zoom);
    let y = lat2tile(extent.topleft[1], zoom);
    let x2 = long2tile(extent.bottomright[0], zoom);
    let y2 = lat2tile(extent.bottomright[1], zoom);

    // get the required tile count in Zoom 13
    let tileCnt = Math.max(x2 - x + 1, y2 - y + 1);

    let iCnt = tileCnt;

    // fixed in high latitudes: adjusted the tile count to 6 or less
    // because Terrain-RGB tile is different in size at latitude
    // don't need too many tiles
    if (tileCnt > 6) {
        let z = zoom;
        do {
            z--;
            var tx = long2tile(extent.topleft[0], z);
            var ty = lat2tile(extent.topleft[1], z);
            let tx2 = long2tile(extent.bottomright[0], z);
            let ty2 = lat2tile(extent.bottomright[1], z);
            var tc = Math.max(tx2 - tx + 1, ty2 - ty + 1);
        } while (tc > 6);
        // reflect the fixed result
        x = tx;
        y = ty;
        zoom = z;
        tileCnt = tc;
    }

    let tileLng = tile2long(x, zoom);
    let tileLat = tile2lat(y, zoom);

    let tileLng2 = tile2long(x + tileCnt, zoom);
    let tileLat2 = tile2lat(y + tileCnt, zoom);

    // get the length of one side of the tiles extent
    let distance = turf.distance(turf.point([tileLng, tileLat]), turf.point([tileLng2, tileLat2]), { units: 'kilometers' }) / Math.SQRT2;

    // find out the center position of the area we want inside the tiles
    let topDistance = turf.distance(turf.point([tileLng, tileLat]), turf.point([tileLng, extent.topleft[1]]), { units: 'kilometers' });
    let leftDistance = turf.distance(turf.point([tileLng, tileLat]), turf.point([extent.topleft[0], tileLat]), { units: 'kilometers' });

    // create the tiles empty array
    let tiles = Create2DArray(tileCnt);

    if (debug) {
        map.setLayoutProperty('debugLayer', 'visibility', 'visible');
        let line = turf.lineString([[tileLng, tileLat], [tileLng2, tileLat2]]);
        map.getSource('debug').setData(turf.bboxPolygon(turf.bbox(line)));
    }

    // download the tiles
    for (let i = 0; i < tileCnt; i++) {
        for (let j = 0; j < tileCnt; j++) {
            let url = 'https://api.mapbox.com/v4/mapbox.terrain-rgb/' + zoom + '/' + (x + j) + '/' + (y + i) + '@2x.pngraw?access_token=' + mapboxgl.accessToken;

            PNG.load(url, function (png) {
                tiles[i][j] = png;
            });
        }
    }

    // download pbf to vTiles
    var vTiles = Create2DArray(tileCnt, 0);

    for (let i = 0; i < tileCnt; i++) {
        for (let j = 0; j < tileCnt; j++) {
            let url = 'https://api.mapbox.com/v4/mapbox.mapbox-streets-v8/' + zoom + '/' + (x + j) + '/' + (y + i) + '.vector.pbf?access_token=' + mapboxgl.accessToken;

            downloadPbfToTile(url).then((data) => vTiles[i][j] = data);
        }
    }

    // wait for the download to complete
    let ticks = 0;
    let timer = window.setInterval(function () {
        ticks++;

        if (isDownloadComplete(tiles, vTiles)) {
            console.log('download ok');
            clearInterval(timer);
            let canvas, url;

            // heightmap size corresponds to 1081px map size
            let heightmap = toHeightmap(tiles, distance);

            // heightmap edge to map edge distance
            let xOffset = Math.round(leftDistance / distance * heightmap.length);
            let yOffset = Math.round(topDistance / distance * heightmap.length);

            calcMinMaxHeight(heightmap, xOffset, yOffset);

            let watermap = toWatermap(vTiles, heightmap.length);

            if (isNaN(scope.baseLevel)) {
                autoSettings(false);
            }

            switch (mode) {
                case 0:
                    let citiesmap = toCitiesmap(heightmap, watermap, xOffset, yOffset);
                    download('heightmap.raw', citiesmap);
                    break;
                case 1:
                    canvas = toCanvas(heightmap, watermap, xOffset, yOffset);
                    url = canvas.toDataURL('image/png').replace('image/png', 'image/octet-stream');
                    download('heightmap.png', null, url);
                    break;
                case 2:
                    updateInfopanel();
                    break;
                case 255:
                    canvas = toTerrainRGB(heightmap);
                    url = canvas.toDataURL('image/png').replace('image/png', 'image/octet-stream');
                    download('tiles.png', null, url);
                    break;
            }
            console.log('complete in ', ticks * 10, ' ms');
        }

        // timeout!
        if (ticks >= 10000) {
            clearInterval(timer);
            console.log('timeout');
        }
    }, 10);
}

function autoSettings(withMap = true) {
    if (withMap) getHeightmap(2);
    scope.baseLevel = grid.minHeight;
    scope.waterDepth = 5.0;
    scope.heightScale = Math.min(250, Math.floor((1024 - scope.waterDepth) / (grid.maxHeight - scope.baseLevel) * 100));
    scope.seaLevel = Math.floor(grid.minHeight);
    scope.depth = 5.0;
    scope.heightScale = Math.min(250, Math.floor((1024 - scope.depth) / (grid.maxHeight - scope.seaLevel) * 100));
    document.getElementById('landOnly').checked = scope.seaLevel === 0;
    console.log(map.getStyle().layers);
    document.getElementById('blurWs').checked = false;
    document.getElementById('drawStrm').checked = false;
}

function isDownloadComplete(tiles, vTiles) {
    let tileNum = tiles.length;
    for (let i = 0; i < tileNum; i++) {
        for (let j = 0; j < tileNum; j++) {
            if (!(tiles[i][j] && vTiles[i][j])) return false;
        }
    }
    return true;
}

function toWatermap(vTiles, length) {
    // extract feature geometry from VectorTileFeature in VectorTile.
    // draw the polygons of the water area from the feature geometries and return as a water area map.

    let tileCnt = vTiles.length;
    let canvas = document.getElementById('wMap-canvas');
    const ctx = canvas.getContext('2d');

    canvas.width = length;
    canvas.height = length;

    let coef = length / (tileCnt * 4096);     // vTiles[][].layers.water.feature(0).extent = 4096 (default)

    // water
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, length, length);
    ctx.fillStyle = '#000000';
    ctx.beginPath();

    for (let ty = 0; ty < tileCnt; ty++) {
        for (let tx = 0; tx < tileCnt; tx++) {
            if (vTiles[ty][tx].layers.water != undefined) {   // judge by 'undefined'
                let geo = vTiles[ty][tx].layers.water.feature(0).loadGeometry();

                for (let i = 0; i < geo.length; i++) {
                    ctx.moveTo(Math.round(geo[i][0].x * coef + (tx * length / tileCnt)), Math.round(geo[i][0].y * coef + (ty * length / tileCnt)));
                    for (let j = 1; j < geo[i].length; j++) {
                        ctx.lineTo(Math.round(geo[i][j].x * coef + (tx * length / tileCnt)), Math.round(geo[i][j].y * coef + (ty * length / tileCnt)));
                    }
                }

            }
        }
    }
    ctx.closePath();
    ctx.fill();

    if (document.getElementById('drawStrm').checked) {
        // waterway
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 1;
        ctx.beginPath();

        for (let ty = 0; ty < tileCnt; ty++) {
            for (let tx = 0; tx < tileCnt; tx++) {
                if (vTiles[ty][tx].layers.waterway != undefined) {   // judge by 'undefined'
                    let geo = vTiles[ty][tx].layers.waterway.feature(0).loadGeometry();

                    for (let i = 0; i < geo.length; i++) {
                        ctx.moveTo(Math.round(geo[i][0].x * coef + (tx * length / tileCnt)), Math.round(geo[i][0].y * coef + (ty * length / tileCnt)));
                        for (let j = 1; j < geo[i].length; j++) {
                            ctx.lineTo(Math.round(geo[i][j].x * coef + (tx * length / tileCnt)), Math.round(geo[i][j].y * coef + (ty * length / tileCnt)));
                        }
                    }

                }
            }
        }
        ctx.stroke();
    }

    let watermap = Create2DArray(length, 1);
    let img = ctx.getImageData(0, 0, length, length);

    for (let i = 0; i < length; i++) {
        for (let j = 0; j < length; j++) {
            let index = i * length * 4 + j * 4;
            watermap[i][j] = img.data[index] / 255;     // 0 => 255 : 0 => 1    0 = water, 1 = land
        }
    }

    return watermap;
}

function blurWatermap(watermap) {
    // gaussian blur
    let len = watermap.length;
    let src = Array.from(watermap);
    let wm = Create2DArray(len, 0);

    // border padding
    src.unshift(watermap[0]);
    src.push(watermap[len - 1]);
    src[1].unshift(watermap[1][0]);
    src[1].push(watermap[1][len - 1]);

    for (let i = 0; i < len - 1; i++) {
        // border padding
        src[i + 2].unshift(watermap[i + 1][0]);
        src[i + 2].push(watermap[i + 1][len - 1]);

        for (let j = 0; j < len; j++) {
            wm[i][j] = (src[i][j] + src[i][j + 2] + src[i + 2][j] + src[i + 2][j + 2]) / 16
                + (src[i][j + 1] + src[i + 1][j] + src[i + 1][j + 2] + src[i + 2][j + 1]) / 8
                + src[i + 1][j + 1] / 4;
        }
    }

    for (let j = 0; j < len; j++) {
        wm[len - 1][j] = (src[len - 1][j] + src[len - 1][j + 2] + src[len + 1][j] + src[len + 1][j + 2]) / 16
            + (src[len - 1][j + 1] + src[len][j] + src[len][j + 2] + src[len + 1][j + 1]) / 8
            + src[len][j + 1] / 4;
    }

    return wm;
}

function toHeightmap(tiles, distance) {
    let tileNum = tiles.length;
    let srcMap = Create2DArray(tileNum * 512, 0);
    let heightmap = Create2DArray(Math.round(1081 * distance / mapSize), 0);
    let smSize = srcMap.length;
    let hmSize = heightmap.length;
    let r = (hmSize - 1) / (smSize - 1);

    for (let i = 0; i < tileNum; i++) {
        for (let j = 0; j < tileNum; j++) {
            let tile = tiles[i][j].decode();
            for (let y = 0; y < 512; y++) {
                for (let x = 0; x < 512; x++) {
                    let tileIndex = y * 512 * 4 + x * 4;
                    // resolution 0.1 meters
                    srcMap[i * 512 + y][j * 512 + x] = -100000 + ((tile[tileIndex] * 256 * 256 + tile[tileIndex + 1] * 256 + tile[tileIndex + 2]));
                }
            }
        }
    }

    // bilinear interpolation
    let hmIndex = Array(hmSize);

    for (let i = 0; i < hmSize; i++) {hmIndex[i] = i / r}
    for (let i = 0; i < (hmSize - 1); i++) {
        for (let j = 0; j < (hmSize - 1); j++) {
            let y0 = Math.floor(hmIndex[i]);
            let x0 = Math.floor(hmIndex[j]);
            let y1 = y0 + 1;
            let x1 = x0 + 1;
            let dy = hmIndex[i] - y0;
            let dx = hmIndex[j] - x0;
            heightmap[i][j] = Math.round((1 - dx) * (1 - dy) * srcMap[y0][x0] + dx * (1 - dy) * srcMap[y0][x1] + (1 - dx) * dy * srcMap[y1][x0] + dx * dy * srcMap[y1][x1]);
        }
    }
    for (let i = 0; i < hmSize; i++) {heightmap[i][hmSize - 1] = srcMap[i][hmSize - 1]}
    for (let j = 0; j < hmSize; j++) {heightmap[hmSize - 1][j] = srcMap[hmSize - 1][j]}

    return heightmap;
}

function toTerrainRGB(heightmap) {
    let canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    canvas.width = heightmap.length;
    canvas.height = heightmap.length;

    let img = ctx.createImageData(canvas.width, canvas.height);

    for (let y = 0; y < canvas.height; y++) {
        for (let x = 0; x < canvas.width; x++) {
            let r = Math.floor((Math.floor((heightmap[y][x] + 100000) / 256)) / 256);
            let g = (Math.floor((heightmap[y][x] + 100000) / 256)) % 256;
            let b = (heightmap[y][x] + 100000) % 256;

            let index = y * canvas.width * 4 + x * 4;

            // create pixel
            img.data[index + 0] = r;
            img.data[index + 1] = g;
            img.data[index + 2] = b;
            img.data[index + 3] = 255;
        }
    }

    ctx.putImageData(img, 0, 0);

    return canvas;
}

function toCanvas(heightmap, watermap, xOffset, yOffset) {
    let canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    canvas.width = 1081;
    canvas.height = 1081;

    let img = ctx.createImageData(1081, 1081);

    // water depth is unaffected by height scale
    let depthUnits = scope.waterDepth / 4;

    let wMap;

    let distSlope = scope.wsSlope / 16;

    // option
    if (document.getElementById('blurWs').checked) {
        wMap = blurWatermap(setWatersideSlope(watermap, distSlope));
    } else {
        wMap = setWatersideSlope(watermap, distSlope);
    }

    // iterate over the heightmap
    for (let y = 0; y < 1081; y++) {
        for (let x = 0; x < 1081; x++) {

            // scale the height, an integer in 0.1 meter resolution
            // to 4 meters resolution, max is 1023m.
            let height = (heightmap[y + yOffset][x + xOffset] / 10 - scope.baseLevel) / 4 * parseFloat(scope.heightScale) / 100;

            // raise the land by the amount of water depth
            // a height lower than baselevel is considered to be the below sea level and the height is set to 0
            let h = Math.max(0, Math.round(height + (depthUnits * wMap[y + yOffset][x + xOffset])));

            h = Math.min(255, h);

            // calculate index in image
            let index = y * 1081 * 4 + x * 4;

            // create pixel
            img.data[index + 0] = h;    // heightmap[y, x] / 10;  // red
            img.data[index + 1] = h;    // green
            img.data[index + 2] = h;    // blue
            img.data[index + 3] = 255;  // alpha, 255 is full opaque
        }
    }

    if (document.getElementById('drawGrid').checked) {
        // draw a grid on the image
        for (let y = 1; y < 1081; y++) {
            for (let x = 1; x < 1081; x++) {

                if (y % 120 == 0 || x % 120 == 0) {
                    // calculate index in image
                    let index = y * 1081 * 4 + x * 4;

                    // create pixel
                    img.data[index + 0] = 63;
                    img.data[index + 1] = 63;
                    img.data[index + 2] = 63;
                }
            }
        }
    }

    ctx.putImageData(img, 0, 0);

    return canvas;
}

function toCitiesmap(heightmap, watermap, xOffset, yOffset) {
    // cities has L/H byte order
    let citiesmap = new Uint8ClampedArray(2 * 1081 * 1081);
    let wMap;

    // water depth is unaffected by height scale
    let depthUnits = scope.waterDepth / 0.015625;

    let distSlope = scope.wsSlope / 16;

    // option
    if (document.getElementById('blurWs').checked) {
        wMap = blurWatermap(setWatersideSlope(watermap, distSlope));
    } else {
        wMap = setWatersideSlope(watermap, distSlope);
    }

    for (let y = 0; y < 1081; y++) {
        for (let x = 0; x < 1081; x++) {

            // scale the height, taking baseLevel and scale into account
            let height = (heightmap[y + yOffset][x + xOffset] / 10 - scope.baseLevel) / 0.015625 * parseFloat(scope.heightScale) / 100;

            // raise the land by the amount of water depth
            // a height lower than baselevel is considered to be the below sea level and the height is set to 0
            let h = Math.max(0, Math.round(height + (depthUnits * wMap[y + yOffset][x + xOffset])));

            if (h > 65535) h = 65535;

            // calculate index in image
            let index = y * 1081 * 2 + x * 2;

            // cities used hi/low 16 bit
            citiesmap[index + 0] = h >> 8;
            citiesmap[index + 1] = h & 255;
        }
    }

    // marker, upper left corner
    citiesmap[0] = 255;
    citiesmap[1] = 255;
    citiesmap[2] = 0;
    citiesmap[3] = 0;

    // log the correct bounding rect to the console
    let bounds = getExtent(grid.lng, grid.lat, mapSize);
    console.log(bounds.topleft[0], bounds.topleft[1], bounds.bottomright[0], bounds.bottomright[1]);

    return citiesmap;
}

function download(filename, data, url = false) {
    var a = window.document.createElement('a');

    if (url) {
        a.href = url;
    } else {
        a.href = window.URL.createObjectURL(new Blob([data], { type: 'application/octet-stream' }));
    }
    a.download = filename;

    // Append anchor to body.
    document.body.appendChild(a)
    a.click();

    // Remove anchor from body
    document.body.removeChild(a)
}

async function downloadPbfToTile(url) {
    let response = await fetch(url);
    if (response.ok) {
		let bufferRes = await response.arrayBuffer();
        let tile = new VectorTile(new Protobuf(new Uint8Array(bufferRes)));
        return tile;
	} else {
		console.error("downloadPbf error:", response.status);
	}
}
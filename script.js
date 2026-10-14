// 1. Inisialisasi Peta
var map = L.map('map', {
    attributionControl: false,
    zoomControl: true
}).setView([-7.6, 112.5], 8);

var geojsonLayer;
var currentMode = 'crime'; // Default mode
var legendControl; // Untuk menampung objek legenda
var selectedInterval = null; // Menyimpan filter interval legenda yang aktif
var isLegendMinimized = false; // Status minimize legenda untuk tampilan mobile

// --- FUNGSI PEWARNAAN ---

// Warna untuk Kriminalitas (Gradasi Merah)
function getColor(d) {
    return d > 3000 ? '#800026' : 
           d > 2000 ? '#BD0026' : 
           d > 1000 ? '#E31A1C' : 
           d > 500  ? '#FD8D3C' : 
                      '#FEB24C';
}

// Mengubah ID Cluster GeoDa menjadi teks manusia yang mudah dipahami dosen
function getLisaStatusText(cl) {
    switch(cl) {
        case 1: return 'High-High (Hotspot)';
        case 2: return 'Low-Low (Coldspot)';
        default: return 'Not Significant (Tidak Signifikan)';
    }
}

// Warna untuk LISA Cluster (Berdasarkan Output GeoDa)
function getLisaColor(cl) {
    switch(cl) {
        case 1: return '#ff0000'; // High-High (Hotspot - Merah)
        case 2: return '#0000ff'; // Low-Low (Coldspot - Biru)
        default: return '#334155'; // Not Significant (Abu-abu gelap)
    }
}

// --- LOGIKA SWITCH PETA ---

function switchMap(mode) {
    currentMode = mode;
    selectedInterval = null; // Reset filter legenda jika pindah mode
    
    // Update tampilan tombol di UI
    document.getElementById('btnCrime').classList.toggle('active', mode === 'crime');
    document.getElementById('btnLisa').classList.toggle('active', mode === 'lisa');
    
    // Refresh style peta tanpa reload data
    if (geojsonLayer) {
        geojsonLayer.setStyle(styleMap);
    }
    
    // Refresh legenda
    addLegend();
}

function styleMap(f) {
    let p = f.properties;
    let val = p["Jumlah Kejahatan yang Dilaporkan"] || 0;
    
    // --- LOGIKA FILTER LEGENDA (Klik Interaktif pada Legenda) ---
    if (currentMode === 'crime' && selectedInterval !== null) {
        let match = false;
        if (selectedInterval === 0 && val <= 500) match = true;
        else if (selectedInterval === 500 && val > 500 && val <= 1000) match = true;
        else if (selectedInterval === 1000 && val > 1000 && val <= 2000) match = true;
        else if (selectedInterval === 2000 && val > 2000 && val <= 3000) match = true;
        else if (selectedInterval === 3000 && val > 3000) match = true;
        
        if (!match) {
            return { fillOpacity: 0.1, weight: 0.5, opacity: 0.2, color: '#1e293b' }; // Meredup jika tidak cocok
        }
    }

    return {
        fillColor: currentMode === 'crime' 
                   ? getColor(val) 
                   : getLisaColor(p.LISA_CL), 
        weight: 1.5,
        opacity: 1,
        color: '#1e293b', 
        fillOpacity: 0.8
    };
}

// --- CORE LOGIC UPDATE SIDEBAR ---
function updateSidebar(props) {
    if (props) {
        document.getElementById('stat-title').innerText = "Kab/Kota: " + props.WADMKK;
        document.getElementById('stat-count').innerText = (props["Jumlah Kejahatan yang Dilaporkan"] || 0).toLocaleString();
        document.getElementById('stat-info').innerText = "Penyelesaian: " + (props["Persentase Penyelesaian Tindak Pidana"] || 0) + "%";
        
        // Menampilkan status LISA di bawah persentase penyelesaian
        let statusText = getLisaStatusText(props.LISA_CL);
        
        // Cari atau buat elemen status-lisa di HTML agar tidak error
        let elStatus = document.getElementById('stat-lisa');
        if (!elStatus) {
            let infoEl = document.getElementById('stat-info');
            elStatus = document.createElement('div');
            elStatus.id = 'stat-lisa';
            elStatus.style.marginTop = '8px';
            elStatus.style.fontWeight = 'bold';
            infoEl.parentNode.insertBefore(elStatus, infoEl.nextSibling);
        }
        
        // Beri warna teks khusus berdasarkan status klaster agar interaktif
        if (props.LISA_CL === 1) elStatus.style.color = '#ff4d4d'; // Merah untuk Hotspot
        else if (props.LISA_CL === 2) elStatus.style.color = '#4d4dff'; // Biru untuk Coldspot
        else elStatus.style.color = '#94a3b8'; // Abu-abu untuk Non-Signifikan
        
        elStatus.innerText = "Status Analisis Spasial (LISA): " + statusText;

        // --- SISTEM PENGAMBIL KEPUTUSAN OTOMATIS BERDASARKAN HASIL LISA ---
        const recContent = document.getElementById('recommendation-content');
        if (props.LISA_CL === 1) {
            recContent.innerHTML = `
                <p style="margin-bottom: 8px;">
                    <strong style="color: #ff4d4d;"><i class="fa-solid fa-triangle-exclamation mr-1"></i> Peringatan Hotspot HH:</strong> 
                    Wilayah <b>${props.WADMKK}</b> terbukti secara spasial merupakan bagian dari koridor metropolitan rawan tingkat tinggi (High-High) bersama Surabaya, Sidoarjo, dan Gresik.
                </p>
                <div style="background: rgba(239, 68, 68, 0.1); border-left: 2px solid #ef4444; padding: 8px; border-radius: 4px; font-size: 10px; color: #f3f4f6;">
                    <b>Rekomendasi Spasial Polda Jatim:</b> Lakukan koordinasi patroli bersama (*joint-patrol*) di wilayah perbatasan administratif kabupaten untuk mengantisipasi perpindahan pelaku kriminal (*displacement effect*).
                </div>
            `;
        } else if (props.LISA_CL === 2) {
            recContent.innerHTML = `
                <p style="margin-bottom: 8px;">
                    <strong style="color: #60a5fa;"><i class="fa-solid fa-circle-check mr-1"></i> Zona Aman Spasial LL:</strong> 
                    Wilayah <b>${props.WADMKK}</b> terbukti secara spasial sebagai klaster aman rendah (Low-Low) / Coldspot.
                </p>
                <div style="background: rgba(59, 130, 246, 0.1); border-left: 2px solid #3b82f6; padding: 8px; border-radius: 4px; font-size: 10px; color: #f3f4f6;">
                    <b>Rekomendasi Spasial Pemda:</b> Pertahankan stabilitas kohesi sosial lokal dan kuatkan sistem pengawasan mandiri masyarakat sebagai tameng pelindung spasial wilayah sekitar.
                </div>
            `;
        } else {
            recContent.innerHTML = `
                <p style="margin-bottom: 6px;">
                    Wilayah <b>${props.WADMKK}</b> terklasifikasi sebagai <b>Not Significant</b> (pola sebaran acak secara spasial).
                </p>
                <p style="color: #64748b; font-style: italic;">
                    Silakan klik wilayah Surabaya, Sidoarjo, Gresik, atau Magetan pada peta untuk melihat simulasi rekomendasi spasial taktis.
                </p>
            `;
        }
    }

    // ===============================
    // ANALISIS OTOMATIS SISTEM
    // ===============================
    let analisis = "";
    if(props.LISA_CL == 1) {
        analisis=`
            <b style="color:#ef4444;">Status :</b> HOTSPOT (High-High)<br><br>
            Wilayah <b>${props.WADMKK}</b> memiliki tingkat kriminalitas tinggi dan berdekatan dengan wilayah yang juga memiliki tingkat kriminalitas tinggi.
            <hr>
            <b>Rekomendasi Sistem</b>
            <ul style="padding-left:18px;">
            <li>Meningkatkan patroli keamanan.</li>
            <li>Koordinasi dengan wilayah sekitar.</li>
            <li>Monitoring kriminalitas secara berkala.</li>
            </ul>
            <b style="color:#22c55e;">Prioritas Penanganan : SANGAT TINGGI</b>
        `;
    } else if(props.LISA_CL == 2) {
        analisis=`
            <b style="color:#3b82f6;">Status :</b> COLDSPOT (Low-Low)<br><br>
            Wilayah ini memiliki tingkat kriminalitas rendah dan dikelilingi wilayah dengan karakteristik yang sama.
            <hr>
            <b>Rekomendasi Sistem</b>
            <ul style="padding-left:18px;">
            <li>Pertahankan sistem keamanan.</li>
            <li>Monitoring berkala.</li>
            </ul>
            <b style="color:#38bdf8;">Prioritas Penanganan : RENDAH</b>
        `;
    } else {
        analisis=`
            <b>Status :</b> Tidak Signifikan<br><br>
            Hasil analisis spasial menunjukkan wilayah ini tidak memiliki hubungan spasial yang signifikan terhadap wilayah sekitarnya.
            <hr>
            <b>Rekomendasi Sistem</b>
            <ul style="padding-left:18px;">
            <li>Tetap lakukan monitoring.</li>
            </ul>
            <b style="color:#facc15;">Prioritas Penanganan : SEDANG</b>
        `;
    }
    document.getElementById("analysisResult").innerHTML = analisis;

    let penjelasan = "";
    if(props.LISA_CL == 1) {
        penjelasan = `
            <b style="color:#ef4444;">Mengapa termasuk Hotspot?</b><br><br>
            Wilayah <b>${props.WADMKK}</b> dikategorikan sebagai <b>High-High (Hotspot)</b> karena memiliki jumlah kriminalitas tinggi dan dikelilingi wilayah dengan tingkat kriminalitas tinggi. Menunjukkan autokorelasi spasial positif lokal.
        `;
    } else if(props.LISA_CL == 2) {
        penjelasan = `
            <b style="color:#3b82f6;">Mengapa termasuk Coldspot?</b><br><br>
            Wilayah <b>${props.WADMKK}</b> memiliki jumlah kriminalitas rendah dan dikelilingi wilayah lain dengan tingkat kriminalitas rendah. Menggambarkan stabilitas keamanan wilayah.
        `;
    } else {
        penjelasan = `
            <b>Mengapa Tidak Signifikan?</b><br><br>
            Nilai Local Moran's I pada wilayah <b>${props.WADMKK}</b> tidak memenuhi tingkat signifikansi statistik yang kuat terhadap wilayah sekitarnya.
        `;
    }
    document.getElementById("lisaExplanation").innerHTML = penjelasan;
}

fetch('Terbaru_Gabungan.geojson')
    .then(res => {
        if (!res.ok) throw new Error("Gagal memuat file GeoJSON.");
        return res.json();
    })
    .then(data => {
        let hotspot = 0;
        let coldspot = 0;

        data.features.forEach(f => {
            if (f.properties.LISA_CL == 1) hotspot++;
            if (f.properties.LISA_CL == 2) coldspot++;
        });

        if (document.getElementById("totalWilayah")) document.getElementById("totalWilayah").innerHTML = data.features.length;
        if (document.getElementById("totalHotspot")) document.getElementById("totalHotspot").innerHTML = hotspot;
        if (document.getElementById("totalColdspot")) document.getElementById("totalColdspot").innerHTML = coldspot;

        const tableBody = document.getElementById('data-table-body');
        if (tableBody) {
            tableBody.innerHTML = ''; 
            const sortedFeatures = [...data.features].sort((a, b) => 
                (b.properties["Jumlah Kejahatan yang Dilaporkan"] || 0) - (a.properties["Jumlah Kejahatan yang Dilaporkan"] || 0)
            );

            sortedFeatures.forEach(f => {
                let p = f.properties;
                let persen = p["Persentase Penyelesaian Tindak Pidana"];
                if (p.WADMKK && p.WADMKK !== "null" && persen !== 0 && persen !== null) {
                    tableBody.innerHTML += `
                    <tr style="cursor:pointer;" onclick="focusWilayah('${p.WADMKK}')">
                        <td style="color:white; font-weight:600; padding: 12px;">${p.WADMKK}</td>
                        <td style="text-align:center;">${(p["Jumlah Kejahatan yang Dilaporkan"] || 0).toLocaleString()}</td>
                        <td style="text-align:center;">${persen}%</td>
                    </tr>`;
                }
            });
        }

        geojsonLayer = L.geoJSON(data, {
            style: styleMap,
            onEachFeature: function (f, l) {
                if (f.properties && f.properties.WADMKK) {
                    var namaSingkat = f.properties.WADMKK.replace("Kabupaten ", "Kab. ").replace("Kota ", "");
                    l.bindTooltip(namaSingkat, {
                        permanent: true,
                        direction: 'center',
                        className: 'map-label'
                    }).openTooltip();
                }

                l.on({
                    mouseover: e => {
                        if (selectedInterval === null) {
                            e.target.setStyle({ weight: 3, color: '#fff', fillOpacity: 1 });
                        }
                    },
                    mouseout: e => {
                        if (selectedInterval === null) geojsonLayer.resetStyle(e.target);
                    },
                    click: e => {
                        updateSidebar(f.properties);
                        l.bindPopup(`
                            <h3>${f.properties.WADMKK}</h3>
                            <b>Jumlah Kriminalitas</b><br>${(f.properties["Jumlah Kejahatan yang Dilaporkan"] || 0).toLocaleString()} Kasus<br><br>
                            <b>Persentase Penyelesaian</b><br>${f.properties["Persentase Penyelesaian Tindak Pidana"] || 0} %<br><br>
                            <b>Kategori LISA</b><br>${getLisaStatusText(f.properties.LISA_CL)}
                        `).openPopup();
                        map.fitBounds(e.target.getBounds());
                    }
                });
            }
        }).addTo(map);

        map.fitBounds(geojsonLayer.getBounds());
        addLegend();
    })
    .catch(err => console.error(err));

function focusWilayah(namaKabKota) {
    geojsonLayer.eachLayer(l => {
        if (l.feature.properties.WADMKK === namaKabKota) {
            map.fitBounds(l.getBounds());
            l.openPopup();
            updateSidebar(l.feature.properties);
        }
    });
}

function searchLocation() {
    var val = document.getElementById('search-input').value.toUpperCase();
    if (!geojsonLayer) return;
    
    geojsonLayer.eachLayer(l => {
        let nama = (l.feature.properties.WADMKK || "").toUpperCase();
        if (nama.includes(val) && val !== "") {
            map.fitBounds(l.getBounds());
            l.openPopup();
            updateSidebar(l.feature.properties);
        }
    });
}

// --- LEGENDA DINAMIS & INTERAKTIF DENGAN TOMBOL MINIMIZE (X) ---
function addLegend() {
    if (legendControl) map.removeControl(legendControl);

    legendControl = L.control({position: 'bottomright'});
    legendControl.onAdd = function () {
        var div = L.DomUtil.create('div', 'info legend');
        div.style.background = 'rgba(30, 41, 59, 0.95)';
        div.style.padding = '12px';
        div.style.color = '#fff';
        div.style.borderRadius = '12px';
        div.style.lineHeight = '22px';
        div.style.boxShadow = '0 4px 15px rgba(0, 0, 0, 0.3)';
        div.style.maxWidth = '260px';
        div.style.fontSize = '12px';
        
        if (!document.getElementById('legend-style')) {
            var style = document.createElement('style');
            style.id = 'legend-style';
            style.innerHTML = `
                .legend i { width: 16px; height: 16px; float: left; margin-right: 8px; opacity: 0.8; border-radius:3px; } 
                .legend-item { cursor:pointer; padding: 3px 6px; margin: 2px 0; } 
                .legend-item:hover { background: rgba(255,255,255,0.1); border-radius:4px; }
                .legend-toggle-btn { background: #ef4444; color: white; border: none; padding: 3px 8px; border-radius: 4px; cursor: pointer; font-weight: bold; font-size: 11px; }
            `;
            document.head.appendChild(style);
        }
        
        let toggleBtnText = isLegendMinimized ? '🔍 Buka Legenda' : '❌ Tutup';
        let headerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(255,255,255,0.2); padding-bottom: 6px; margin-bottom: 8px;">
                <strong>📊 Keterangan Peta</strong>
                <button onclick="toggleLegendView()" class="legend-toggle-btn">${toggleBtnText}</button>
            </div>
        `;

        if (isLegendMinimized) {
            div.innerHTML = headerHTML;
            return div;
        }

        let contentHTML = headerHTML;

        if (currentMode === 'crime') {
            var grades = [0, 500, 1000, 2000, 3000];
            var labels = ['0&ndash;500', '500&ndash;1000', '1000&ndash;2000', '2000&ndash;3000', '3000+'];
            
            contentHTML += '<strong>Interval Kejadian</strong><br>';
            for (var i = 0; i < grades.length; i++) {
                let activeStyle = (selectedInterval === grades[i]) ? 'style="background: rgba(255,255,255,0.2); font-weight:bold; border-left: 3px solid #fff;"' : '';
                
                contentHTML += '<div class="legend-item" ' + activeStyle + ' onclick="filterByInterval(' + grades[i] + ')">' +
                    '<i style="background:' + getColor(grades[i] + 1) + '"></i> ' + labels[i] + '</div>';
            }
            if(selectedInterval !== null) {
                contentHTML += '<div style="text-align:center; margin-top:6px;"><button onclick="resetLegendFilter()" style="font-size:11px; padding:3px 8px; cursor:pointer; background:#ef4444; color:#fff; border:none; border-radius:4px;">Reset Filter</button></div>';
            }
        } else {
           contentHTML += `
            <div style="font-size:11px; line-height:18px; margin-bottom: 6px;">
                <strong>Global Moran's I</strong><br>
                Moran's I: <b>0.3078</b> (p: 0.003)<br>
                <span style="color:#22c55e;">Autokorelasi Spasial Positif</span>
            </div>
            <strong>Klaster LISA</strong><br>
            <div class="legend-item"><i style="background:#ff0000"></i>High-High (Hotspot)</div>
            <div class="legend-item"><i style="background:#0000ff"></i>Low-Low (Coldspot)</div>
            <div class="legend-item"><i style="background:#334155"></i>Not Significant</div>`;
        }

        div.innerHTML = contentHTML;
        return div;
    };
    legendControl.addTo(map);
}

function toggleLegendView() {
    isLegendMinimized = !isLegendMinimized;
    addLegend();
}

function filterByInterval(lowerBound) {
    if (selectedInterval === lowerBound) {
        selectedInterval = null;
    } else {
        selectedInterval = lowerBound;
    }
    geojsonLayer.setStyle(styleMap);
    addLegend();
}

function resetLegendFilter() {
    selectedInterval = null;
    geojsonLayer.setStyle(styleMap);
    addLegend();
}
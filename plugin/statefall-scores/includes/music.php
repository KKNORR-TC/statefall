<?php
if (!defined('ABSPATH')) exit;

/** Music library: files in uploads/statefall/audio/, catalogue in playlist.json (survives game package installs). */
function statefall_audio_dir() { return statefall_game_dir() . 'audio/'; }
function statefall_playlist_path() { return statefall_audio_dir() . 'playlist.json'; }
function statefall_playlist_read() {
    $p = statefall_playlist_path();
    $j = is_file($p) ? json_decode(file_get_contents($p), true) : null;
    if (!is_array($j) || !isset($j['tracks']) || !is_array($j['tracks'])) $j = ['tracks' => []];
    usort($j['tracks'], function ($a, $b) { return ($a['order'] ?? 0) <=> ($b['order'] ?? 0); });
    return $j;
}
function statefall_playlist_write(array $j) { if (!is_dir(statefall_audio_dir())) wp_mkdir_p(statefall_audio_dir()); file_put_contents(statefall_playlist_path(), wp_json_encode($j, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE)); }
function statefall_cats() { return ['menu' => 'Pre-game (start card)', 'game' => 'In-game', 'victory' => 'Sting: victory', 'defeat' => 'Sting: defeat', 'top1' => 'Sting: #1 on the site', 'credits' => 'Credit roll (default song)']; }

/** Public playlist for the game. */
function statefall_playlist_public() {
    $j = statefall_playlist_read(); $out = ['menu' => [], 'game' => [], 'stings' => []];
    foreach ($j['tracks'] as $t) {
        if (empty($t['enabled'])) continue;
        $url = statefall_game_url() . 'audio/' . rawurlencode($t['file']) . '?v=' . rawurlencode($t['ver'] ?? '1');
        $row = ['id' => $t['id'], 'title' => $t['title'], 'url' => $url, 'seconds' => (float) ($t['seconds'] ?? 0)];
        if ($t['cat'] === 'menu' || $t['cat'] === 'game') $out[$t['cat']][] = $row; else { $out['stings'][$t['cat']][] = $row; if ($t['cat'] === 'credits') $out['game'][] = $row; }
    }
    return $out;
}

add_action('rest_api_init', function () {
    $ns = 'statefall/v1';
    register_rest_route($ns, '/playlist', ['methods' => 'GET', 'callback' => function () { return statefall_playlist_public(); }, 'permission_callback' => '__return_true']);
    $admin = function () { return current_user_can('manage_options'); };
    register_rest_route($ns, '/music', [
        ['methods' => 'GET', 'callback' => function () { return statefall_playlist_read(); }, 'permission_callback' => $admin],
        ['methods' => 'POST', 'callback' => 'statefall_music_upload', 'permission_callback' => $admin],
    ]);
    register_rest_route($ns, '/music/save', ['methods' => 'POST', 'callback' => 'statefall_music_save', 'permission_callback' => $admin]);
    register_rest_route($ns, '/music/(?P<id>[a-z0-9]+)', ['methods' => 'DELETE', 'callback' => 'statefall_music_delete', 'permission_callback' => $admin]);
});

function statefall_music_upload(WP_REST_Request $req) {
    $files = $req->get_file_params();
    if (empty($files['file'])) return new WP_REST_Response(['error' => 'malformed', 'message' => 'No file.'], 400);
    $f = $files['file']; if ($f['error'] !== UPLOAD_ERR_OK) return new WP_REST_Response(['error' => 'upload', 'message' => 'Upload failed (' . $f['error'] . ').'], 400);
    $name = sanitize_file_name($f['name']); $ext = strtolower(pathinfo($name, PATHINFO_EXTENSION));
    if (!in_array($ext, ['mp3', 'ogg', 'opus', 'm4a', 'wav'], true)) return new WP_REST_Response(['error' => 'type', 'message' => 'Use mp3, ogg, m4a or wav.'], 415);
    if (!is_dir(statefall_audio_dir())) wp_mkdir_p(statefall_audio_dir());
    $id = substr(md5(uniqid('', true)), 0, 8);
    $file = $id . '-' . preg_replace('/[^A-Za-z0-9._-]/', '-', $name);
    if (!move_uploaded_file($f['tmp_name'], statefall_audio_dir() . $file)) return new WP_REST_Response(['error' => 'server', 'message' => 'Could not save the file.'], 500);
    $j = statefall_playlist_read();
    $title = sanitize_text_field($req->get_param('title') ?: preg_replace('/\.[^.]+$/', '', $f['name']));
    $cat = sanitize_key($req->get_param('cat') ?: 'game'); if (!isset(statefall_cats()[$cat])) $cat = 'game';
    $j['tracks'][] = ['id' => $id, 'title' => $title, 'file' => $file, 'cat' => $cat, 'order' => count($j['tracks']) + 1, 'enabled' => 1, 'seconds' => (float) $req->get_param('seconds'), 'ver' => (string) time(), 'size' => filesize(statefall_audio_dir() . $file)];
    statefall_playlist_write($j);
    return ['ok' => true, 'id' => $id, 'file' => $file];
}
function statefall_music_save(WP_REST_Request $req) {
    $in = $req->get_json_params(); if (!is_array($in) || !isset($in['tracks'])) return new WP_REST_Response(['error' => 'malformed'], 400);
    $j = statefall_playlist_read(); $byId = []; foreach ($j['tracks'] as $t) $byId[$t['id']] = $t;
    $out = []; $i = 1;
    foreach ($in['tracks'] as $t) { if (!isset($byId[$t['id']])) continue; $o = $byId[$t['id']]; $o['title'] = sanitize_text_field($t['title'] ?? $o['title']); $c = sanitize_key($t['cat'] ?? $o['cat']); if (isset(statefall_cats()[$c])) $o['cat'] = $c; $o['enabled'] = empty($t['enabled']) ? 0 : 1; $o['order'] = $i++; $out[] = $o; }
    $j['tracks'] = $out; statefall_playlist_write($j); return ['ok' => true];
}
function statefall_music_delete(WP_REST_Request $req) {
    $id = sanitize_key($req['id']); $j = statefall_playlist_read(); $keep = [];
    foreach ($j['tracks'] as $t) { if ($t['id'] === $id) { @unlink(statefall_audio_dir() . $t['file']); continue; } $keep[] = $t; }
    $j['tracks'] = $keep; statefall_playlist_write($j); return ['ok' => true];
}

/** Admin page: upload (with in-browser WAV→MP3 conversion) and manage the library. */
function statefall_admin_music() {
    $rest = esc_url_raw(rest_url('statefall/v1/')); $nonce = wp_create_nonce('wp_rest'); $cats = statefall_cats();
    ?>
    <div class="wrap"><h1>Statefall — music</h1>
    <p>Upload WAV, MP3, OGG or M4A. WAV files are converted to 160 kbps MP3 in your browser before upload, so large masters are fine. Tracks are served from the uploads folder and survive game package updates. Several tracks in the same sting category (victory, defeat, #1, credits) rotate at random. The game picks up changes on its next load.</p>
    <h2>Add a track</h2>
    <p><input type="file" id="sfFile" accept=".wav,.mp3,.ogg,.opus,.m4a" multiple> &nbsp; <label>Category <select id="sfCat"><?php foreach ($cats as $k => $v) echo '<option value="' . esc_attr($k) . '">' . esc_html($v) . '</option>'; ?></select></label> &nbsp; <button class="button button-primary" id="sfUp">Convert &amp; upload</button></p>
    <p class="description">Title is taken from the file name (e.g. <code>game-03 Iron Coast.wav</code> → "Iron Coast"); you can edit it below. Loops should start and end on a bar with no tail across the boundary.</p>
    <pre id="sfLog" style="background:#fff;border:1px solid #ccd;padding:8px;min-height:40px;max-height:200px;overflow:auto"></pre>
    <h2>Library</h2>
    <table class="widefat striped" id="sfTbl"><thead><tr><th style="width:30px"></th><th>Title</th><th>Category</th><th>Length</th><th>Size</th><th>Enabled</th><th></th></tr></thead><tbody></tbody></table>
    <p><button class="button button-primary" id="sfSave">Save order &amp; titles</button> <span id="sfSaved"></span></p>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/lamejs/1.2.1/lame.min.js"></script>
    <script>
    (function(){
      const REST=<?php echo wp_json_encode($rest); ?>, NONCE=<?php echo wp_json_encode($nonce); ?>, CATS=<?php echo wp_json_encode($cats); ?>, AUDIO_BASE=<?php echo wp_json_encode(statefall_game_url() . 'audio/'); ?>;
      const $=id=>document.getElementById(id); const log=m=>{ $('sfLog').textContent+=m+"\n"; $('sfLog').scrollTop=1e9; };
      let tracks=[];
      async function load(){ const r=await fetch(REST+'music',{headers:{'X-WP-Nonce':NONCE},credentials:'same-origin'}); const j=await r.json(); tracks=j.tracks||[]; render(); }
      function fmt(s){ s=Math.round(s||0); return s?Math.floor(s/60)+':'+String(s%60).padStart(2,'0'):'—'; }
      function render(){ const tb=$('sfTbl').querySelector('tbody'); tb.innerHTML=''; tracks.forEach((t,i)=>{ const tr=document.createElement('tr'); tr.innerHTML=`<td><button class="button button-small" data-up="${i}">▲</button><button class="button button-small" data-down="${i}">▼</button></td><td><input type="text" value="${t.title.replace(/"/g,'&quot;')}" data-title="${i}" class="regular-text"></td><td><select data-cat="${i}">${Object.entries(CATS).map(([k,v])=>`<option value="${k}" ${t.cat===k?'selected':''}>${v}</option>`).join('')}</select></td><td>${fmt(t.seconds)}</td><td>${t.size?(t.size/1048576).toFixed(1)+' MB':'—'}</td><td><input type="checkbox" data-en="${i}" ${t.enabled?'checked':''}></td><td><a href="${AUDIO_BASE}${encodeURIComponent(t.file)}" target="_blank">listen</a> · <button class="button button-small" data-del="${i}">Delete</button></td>`; tb.appendChild(tr); });
        tb.querySelectorAll('[data-up]').forEach(b=>b.onclick=()=>{ const i=+b.dataset.up; if(i>0){ [tracks[i-1],tracks[i]]=[tracks[i],tracks[i-1]]; render(); } });
        tb.querySelectorAll('[data-down]').forEach(b=>b.onclick=()=>{ const i=+b.dataset.down; if(i<tracks.length-1){ [tracks[i+1],tracks[i]]=[tracks[i],tracks[i+1]]; render(); } });
        tb.querySelectorAll('[data-del]').forEach(b=>b.onclick=async()=>{ const t=tracks[+b.dataset.del]; if(!confirm('Delete "'+t.title+'"?')) return; await fetch(REST+'music/'+t.id,{method:'DELETE',headers:{'X-WP-Nonce':NONCE},credentials:'same-origin'}); load(); }); }
      $('sfSave').onclick=async()=>{ const tb=$('sfTbl'); tracks.forEach((t,i)=>{ t.title=tb.querySelector(`[data-title="${i}"]`).value; t.cat=tb.querySelector(`[data-cat="${i}"]`).value; t.enabled=tb.querySelector(`[data-en="${i}"]`).checked?1:0; }); const r=await fetch(REST+'music/save',{method:'POST',headers:{'X-WP-Nonce':NONCE,'Content-Type':'application/json'},credentials:'same-origin',body:JSON.stringify({tracks})}); $('sfSaved').textContent=r.ok?'Saved.':'Save failed.'; setTimeout(()=>{$('sfSaved').textContent='';},2500); load(); };
      function titleOf(name){ return name.replace(/\.[^.]+$/,'').replace(/^(menu|game|victory|defeat|top1)[-_ ]?\d*[-_ ]*/i,'').replace(/[-_]+/g,' ').trim()||name; }
      async function wavToMp3(file,onProgress){ const ac=new (window.AudioContext||window.webkitAudioContext)(); const buf=await ac.decodeAudioData(await file.arrayBuffer()); const ch=buf.numberOfChannels, sr=buf.sampleRate, n=buf.length; const enc=new lamejs.Mp3Encoder(ch>1?2:1,sr,160); const L=buf.getChannelData(0), R=ch>1?buf.getChannelData(1):null; const block=1152*8; const parts=[]; const toI16=(f)=>Math.max(-32768,Math.min(32767,Math.round(f*32767)));
        for(let i=0;i<n;i+=block){ const m=Math.min(block,n-i); const l=new Int16Array(m), r=R?new Int16Array(m):null; for(let k=0;k<m;k++){ l[k]=toI16(L[i+k]); if(r) r[k]=toI16(R[i+k]); } const out=r?enc.encodeBuffer(l,r):enc.encodeBuffer(l); if(out.length) parts.push(new Uint8Array(out)); if(i%(block*20)===0){ onProgress(i/n); await new Promise(res=>setTimeout(res,0)); } }
        const end=enc.flush(); if(end.length) parts.push(new Uint8Array(end)); ac.close(); return {blob:new Blob(parts,{type:'audio/mpeg'}),seconds:buf.duration}; }
      async function durationOf(file){ try{ const ac=new (window.AudioContext||window.webkitAudioContext)(); const b=await ac.decodeAudioData(await file.arrayBuffer()); ac.close(); return b.duration; }catch(e){ return 0; } }
      $('sfUp').onclick=async()=>{ const files=[...$('sfFile').files]; if(!files.length){ alert('Choose a file first.'); return; } const cat=$('sfCat').value;
        for(const f of files){ try{ let blob=f, name=f.name, seconds=0; if(/\.wav$/i.test(f.name)){ log('Converting '+f.name+' …'); const r=await wavToMp3(f,p=>{ $('sfLog').textContent=$('sfLog').textContent.replace(/\n\s*\d+%$/,'')+"\n"+Math.round(p*100)+'%'; }); blob=r.blob; seconds=r.seconds; name=f.name.replace(/\.wav$/i,'.mp3'); log('Converted → '+(blob.size/1048576).toFixed(1)+' MB MP3'); } else seconds=await durationOf(f);
          const fd=new FormData(); fd.append('file',blob,name); fd.append('title',titleOf(f.name)); fd.append('cat',cat); fd.append('seconds',String(seconds)); log('Uploading '+name+' …'); const r=await fetch(REST+'music',{method:'POST',headers:{'X-WP-Nonce':NONCE},credentials:'same-origin',body:fd}); const j=await r.json().catch(()=>({})); log(r.ok?'Added "'+titleOf(f.name)+'" ('+cat+')':'Failed: '+(j.message||r.status)); }catch(e){ log('Error: '+e.message); } }
        $('sfFile').value=''; load(); };
      load();
    })();
    </script></div>
    <?php
}

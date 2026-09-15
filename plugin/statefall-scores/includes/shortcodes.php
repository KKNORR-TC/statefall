<?php
if (!defined('ABSPATH')) exit;

function statefall_play_url($seed = '', $cls = '') { $u = home_url('/play/'); $args = []; if ($seed) $args['seed'] = rawurlencode($seed); if ($cls && $cls !== '__all') $args['cls'] = rawurlencode($cls); return $args ? add_query_arg($args, $u) : $u; }

function statefall_table_html(array $rows, $showPlayer = true) {
    if (!$rows) return '<p class="sf-empty">No leader yet — play and take a spot!</p>';
    $th = function ($label, $key, $num = false) { return '<th data-sort="' . esc_attr($key) . '"' . ($num ? ' data-num="1"' : '') . ' title="Sort">' . esc_html($label) . '</th>'; };
    $h = '<div class="sf-scroll"><table class="sf-board sf-sortable"><thead><tr><th>#</th>' . ($showPlayer ? $th('Player', 'player') : '') . $th('Played', 'when', true) . $th('Score', 'score', true) . $th('Result', 'result') . $th('Country', 'country') . $th('Map', 'map') . $th('Difficulty', 'diff') . $th('Modes', 'modes') . $th('Time', 'minutes', true) . $th('Land', 'land', true) . $th('Kills', 'kills', true) . $th('Seed', 'seed') . '<th></th></tr></thead><tbody>';
    foreach ($rows as $r) {
        $modes = implode(', ', array_filter([$r['fog'] ? 'fog' : '', $r['risky'] ? 'risky' : ''])) ?: '—';
        $h .= '<tr class="' . ($r['rank'] === 1 ? 'sf-first' : '') . '"><td>' . (int) $r['rank'] . '</td>'
            . ($showPlayer ? '<td data-v="' . esc_attr($r['user']['name']) . '">' . statefall_player_flag_html($r['user']['id']) . '<a href="' . esc_url(statefall_player_url($r['user']['id'])) . '" style="color:inherit;text-decoration:none">' . esc_html($r['user']['name']) . '</a></td>' : '')
            . '<td data-v="' . (int) ($r['when'] / 1000) . '" data-sf-when="' . (int) ($r['when'] / 1000) . '" class="sf-muted" style="white-space:nowrap">' . esc_html(gmdate('Y-m-d H:i', (int) ($r['when'] / 1000))) . '</td>'
            . '<td class="sf-score">' . (int) $r['score'] . '</td><td>' . esc_html($r['result']) . '</td><td><span data-sf-flag="' . esc_attr(!empty($r['flag']) && !empty($r['flag']['layers']) ? wp_json_encode($r['flag']) : $r['country']) . '" data-w="27" data-h="18" style="display:inline-block;width:27px;height:18px;margin-right:6px;vertical-align:middle"></span>' . esc_html($r['country']) . '</td><td>' . esc_html(statefall_map_name($r['map'])) . '</td><td>' . esc_html(statefall_diff_name($r['diff'])) . '</td><td>' . esc_html($modes) . '</td><td>' . esc_html($r['minutes']) . ' min</td><td>' . esc_html($r['land']) . '%</td><td>' . (int) $r['kills'] . '</td>'
            . '<td><a class="sf-seed" href="' . esc_url(statefall_play_url($r['seed'], $r['cls'])) . '" title="Play this map">' . esc_html($r['seed']) . '</a></td>'
            . '<td>' . (!empty($r['hasStats']) ? '<a class="sf-watch" href="' . esc_url(home_url('/play/?credits=' . (int) $r['id'])) . '" title="Watch this match\'s credits">▶ Credits</a> <a class="sf-share" href="' . esc_url('https://www.facebook.com/sharer/sharer.php?u=' . rawurlencode(home_url('/credits/' . (int) $r['id'] . '/'))) . '" target="_blank" rel="noopener" title="Share on Facebook">Share</a>' : '') . '</td></tr>';
    }
    add_action('wp_footer', 'statefall_sort_js');
    return $h . '</tbody></table></div>';
}
function statefall_sort_js() { static $done = false; if ($done) return; $done = true; ?>
<script>
(function(){document.querySelectorAll('[data-sf-when]').forEach(function(td){var t=+td.dataset.sfWhen*1000;if(t)td.textContent=new Date(t).toLocaleString([],{year:'numeric',month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'});});
document.querySelectorAll('table.sf-sortable').forEach(function(tbl){var ths=tbl.querySelectorAll('th[data-sort]');ths.forEach(function(th){th.style.cursor='pointer';th.addEventListener('click',function(){var idx=Array.prototype.indexOf.call(th.parentNode.children,th);var num=th.dataset.num==='1';var dir=th.dataset.dir==='asc'?'desc':'asc';ths.forEach(function(o){o.dataset.dir='';o.classList.remove('sf-asc','sf-desc');});th.dataset.dir=dir;th.classList.add(dir==='asc'?'sf-asc':'sf-desc');var tb=tbl.tBodies[0];var rows=Array.prototype.slice.call(tb.rows);rows.sort(function(a,b){var ca=a.children[idx],cb=b.children[idx];var va=ca?(ca.dataset.v!==undefined?ca.dataset.v:ca.textContent.trim()):'',vb=cb?(cb.dataset.v!==undefined?cb.dataset.v:cb.textContent.trim()):'';if(num){va=parseFloat(va)||0;vb=parseFloat(vb)||0;return dir==='asc'?va-vb:vb-va;}return dir==='asc'?va.localeCompare(vb):vb.localeCompare(va);});rows.forEach(function(r){tb.appendChild(r);});});});});})();
</script>
<?php }

/** [statefall_board cls="Standard" limit="50"] — cls="__all" shows the top 3 of every class. A ?cls= query overrides. */
add_shortcode('statefall_board', function ($atts) {
    wp_enqueue_style('statefall-board'); wp_enqueue_script('statefall-flags', statefall_flags_url(), [], STATEFALL_VERSION, true);
    $a = shortcode_atts(['cls' => '__all', 'limit' => 50], $atts);
    $cls = isset($_GET['cls']) ? sanitize_text_field(wp_unslash($_GET['cls'])) : $a['cls'];
    $classes = statefall_rest_classes();
    $common = ['Standard', 'Garrisons', 'Quick start', 'Risky start', 'End game', 'Instant build', 'Billionaire'];
    $names = array_values(array_unique(array_merge($common, array_column($classes, 'cls'))));
    $counts = array_column($classes, 'count', 'cls');
    $h = '<div class="sf-wrap"><p class="sf-trust"><b>Community leaderboard.</b> Scores are submitted by players and are not independently verified.</p><form class="sf-filter" method="get"><label>Board <select name="cls" onchange="this.form.submit()"><option value="__all"' . ($cls === '__all' ? ' selected' : '') . '>All classes — top 3 each</option>';
    foreach ($names as $n) $h .= '<option value="' . esc_attr($n) . '"' . ($cls === $n ? ' selected' : '') . '>' . esc_html($n) . ' (' . (int) ($counts[$n] ?? 0) . ')</option>';
    $h .= '</select></label></form>';
    if ($cls === '__all') {
        $all = statefall_top('__all');
        foreach ($names as $n) {
            $rows = $all[$n] ?? [];
            $h .= '<div class="sf-class"><div class="sf-class-head"><h3>' . esc_html($n) . '</h3><a class="sf-play" href="' . esc_url(statefall_play_url('', $n)) . '">Play ' . esc_html($n) . '</a></div>' . statefall_table_html($rows) . '</div>';
        }
    } else {
        $h .= '<div class="sf-class"><div class="sf-class-head"><h3>' . esc_html($cls) . '</h3><a class="sf-play" href="' . esc_url(statefall_play_url('', $cls)) . '">Play ' . esc_html($cls) . '</a></div>' . statefall_table_html(statefall_top($cls, (int) $a['limit'])) . '</div>';
    }
    return $h . '</div>';
});

/** [statefall_profile] — the logged-in player's stats and history. */
add_shortcode('statefall_profile', function ($atts = []) {
    wp_enqueue_style('statefall-board');
    $atts = shortcode_atts(['public' => 0], $atts); $publicUid = (int) $atts['public']; if (!$publicUid && get_query_var('statefall_player')) $publicUid = (int) get_query_var('statefall_player'); if (!$publicUid && !empty($_GET['u'])) $publicUid = (int) $_GET['u'];
    if ($publicUid && is_user_logged_in() && $publicUid === get_current_user_id()) $publicUid = 0; // your own public link shows your full profile
    if (!$publicUid && !is_user_logged_in()) return '<div class="sf-wrap"><p>Log in to see your matches.</p><p><a class="sf-play" href="' . esc_url(wp_login_url(get_permalink())) . '">Log in</a> · <a href="' . esc_url(wp_registration_url()) . '">Register</a></p></div>';
    global $wpdb; $t = statefall_table(); $u = $publicUid ? get_userdata($publicUid) : wp_get_current_user(); if (!$u) return '<p>No such player.</p>'; $uid = $u->ID;
    $s = statefall_user_summary($uid);
    $fav = $wpdb->get_row($wpdb->prepare("SELECT map, COUNT(*) n FROM $t WHERE user_id=%d GROUP BY map ORDER BY n DESC LIMIT 1", $uid), ARRAY_A);
    $favc = $wpdb->get_row($wpdb->prepare("SELECT cls, COUNT(*) n FROM $t WHERE user_id=%d GROUP BY cls ORDER BY n DESC LIMIT 1", $uid), ARRAY_A);
    $rows = $wpdb->get_results($wpdb->prepare("SELECT * FROM $t WHERE user_id=%d ORDER BY id DESC LIMIT 100", $uid), ARRAY_A);
    $out = array_map(function ($r, $i) { return statefall_row_out($r, $i + 1); }, $rows, array_keys($rows));
    $tot = ['conquests' => 0, 'kills' => 0, 'continents' => 0, 'shipsSunk' => 0, 'missiles' => 0, 'intercepts' => 0, 'planesDown' => 0, 'nuked' => 0]; foreach ($rows as $r) { if (empty($r['stats'])) continue; $c = json_decode($r['stats'], true)['c'] ?? []; foreach ($tot as $k => $v) $tot[$k] += (int) ($c[$k] ?? 0); }
    $own = get_current_user_id() === (int) $uid;
    $tabs = '<div class="sf-tabs" role="tablist"><button class="on" data-tab="overview">Overview</button><button data-tab="achievements">Achievements</button>' . ($own ? '<button data-tab="nation">Nation</button><button data-tab="saves">Saved games</button><button data-tab="replays">Replays</button>' : '') . '<button data-tab="history">Match history</button></div>';
    $nationAttrs = ' data-sf-nation data-rest="' . esc_attr(rest_url('statefall/v1/')) . '" data-nonce="' . esc_attr(wp_create_nonce('wp_rest')) . '" data-edit="' . ($own ? '1' : '0') . '" data-uid="' . (int) $uid . '"';
    wp_enqueue_script('statefall-flags', statefall_flags_url(), [], STATEFALL_VERSION, true); wp_enqueue_script('statefall-nation', plugins_url('assets/nation.js', dirname(__FILE__)), ['statefall-flags'], STATEFALL_VERSION, true);
    $h = '<div class="sf-wrap sf-profile"' . $nationAttrs . '><h2 class="sf-title">' . esc_html($u->display_name) . '</h2><p class="sf-trust">Match results, rankings, and achievements are based on player-submitted scores that are not independently verified.</p>' . $tabs . '<section class="sf-section" data-pane="overview"><h3>' . ($own ? 'Your nation' : 'Nation') . '</h3><div class="sf-top"><div data-panel><p class="sf-muted">Loading…</p></div><div class="sf-trophies" data-awards></div></div><h3 style="margin-top:16px">Overview</h3><div class="sf-stats">'
        . '<div><b>' . (int) $s['matches'] . '</b><span>matches</span></div><div><b>' . (int) $s['wins'] . '</b><span>wins</span></div><div><b>' . (int) $s['best'] . '</b><span>best score</span></div>'
        . '<div><b>' . esc_html($fav ? statefall_map_name($fav['map']) : '—') . '</b><span>favourite map</span></div><div><b>' . esc_html($favc ? $favc['cls'] : '—') . '</b><span>most played</span></div></div>'
        . '<h3 style="margin-top:16px">Career</h3><div class="sf-stats">' . '<div><b>' . number_format($tot['conquests']) . '</b><span>provinces taken</span></div><div><b>' . number_format($tot['kills']) . '</b><span>nations eliminated</span></div><div><b>' . number_format($tot['continents']) . '</b><span>continents unified</span></div><div><b>' . number_format($tot['shipsSunk']) . '</b><span>ships sunk</span></div><div><b>' . number_format($tot['missiles']) . '</b><span>missiles launched</span></div><div><b>' . number_format($tot['intercepts']) . '</b><span>missiles shot down</span></div><div><b>' . number_format($tot['planesDown']) . '</b><span>aircraft shot down</span></div><div><b>' . number_format($tot['nuked']) . '</b><span>times nuked</span></div>'
        . '</div><div data-botpanel></div></section><section class="sf-section" data-pane="achievements" style="display:none"><h3>Achievements</h3><div data-trophies><p class="sf-muted">Loading…</p></div></section>' . ($own ? '<section class="sf-section" data-pane="nation" style="display:none"><h3>Nation builder</h3><p class="sf-muted" style="font-size:13px;margin:0 0 12px">Design your flag from a field, up to seven layers and an emblem, then name your nation. Your flag flies on the map in every match you play, on the leaderboard, in the credits and on your share cards; at ' . STATEFALL_TIER_BOT . ' qualifying wins it can appear as a rival nation in other players\' games.</p><div data-builder><p class="sf-muted">Loading…</p></div></section>' : '') . statefall_saves_html($uid) . '<section class="sf-section" data-pane="history" style="display:none"><h3>Match history</h3>' . statefall_table_html($out, false) . '</section>'
        . '</div>';
    add_action('wp_footer', 'statefall_profile_tabs_js');
    return $h;
});

/** [statefall_howto tab="basics"] — serves a how-to page from the installed package; [statefall_howto] shows all tabs with a switcher (?tab=). */
add_shortcode('statefall_howto', function ($atts) {
    $a = shortcode_atts(['tab' => ''], $atts);
    $dir = statefall_release_dir() . 'howto/';
    $tabs = is_file($dir . 'tabs.json') ? json_decode(file_get_contents($dir . 'tabs.json'), true) : [['basics', 'Basics'], ['build', 'Buildings'], ['ships', 'Ships'], ['air', 'Air'], ['systems', 'Systems'], ['garrisons', 'Garrisons'], ['modes', 'Modes'], ['about', 'About']];
    $tab = $a['tab'] ?: (isset($_GET['tab']) ? sanitize_key(wp_unslash($_GET['tab'])) : $tabs[0][0]);
    $tab = sanitize_key($tab);
    $file = $dir . $tab . '.html';
    if (!is_file($file)) return '<p>How-to-play pages are not installed yet (upload a release package under Statefall → Game package).</p>';
    $html = file_get_contents($file);
    if (!$a['tab']) { // switcher
        $nav = '<div class="sf-howto-tabs">';
        foreach ($tabs as $t) $nav .= '<a class="' . ($t[0] === $tab ? 'on' : '') . '" href="' . esc_url(add_query_arg('tab', $t[0])) . '">' . esc_html($t[1]) . '</a>';
        $nav .= '</div><style>.sf-howto-tabs{display:flex;flex-wrap:wrap;gap:6px;margin:0 0 14px}.sf-howto-tabs a{background:#1a2634;border:1px solid #33475c;color:#e8ecef;text-decoration:none;padding:6px 12px;border-radius:8px;font-size:13px}.sf-howto-tabs a.on{background:#2f5a8c}</style>';
        // drop the page's own inline nav line since the switcher replaces it
        $html = preg_replace('#<div class="sf-nav">.*?</div>#s', '', $html, 1);
        $html = $nav . $html;
    } else {
        $html = preg_replace('#<div class="sf-nav">.*?</div>#s', '', $html, 1);
    }
    return $html;
});

/** Saved games and replays on the profile (own profile only): Resume / Watch open the game with the save loaded. */
function statefall_saves_html($uid) {
    if (!function_exists('statefall_saves_table') || get_current_user_id() !== (int) $uid) return '';
    global $wpdb; $t = statefall_saves_table();
    $rows = $wpdb->get_results($wpdb->prepare("SELECT id,kind,slot,seed,country,cls,diff,result,tick,updated_at FROM $t WHERE user_id=%d ORDER BY updated_at DESC", $uid), ARRAY_A) ?: [];
    $saves = array_values(array_filter($rows, function ($r) { return $r['kind'] === 'save'; })); $reps = array_values(array_filter($rows, function ($r) { return $r['kind'] === 'replay'; }));
    $row = function ($r, $isRep) { $url = home_url('/play/?load=' . (int) $r['id'] . '&mode=' . ($isRep ? 'watch' : 'resume')); return '<tr><td><b>' . esc_html($r['slot']) . '</b><br><span class="sf-muted">' . esc_html($r['seed']) . ' · ' . esc_html($r['country']) . ' · ' . esc_html(statefall_diff_name($r['diff'])) . ' · ' . esc_html($r['cls']) . '</span></td><td>' . esc_html(round((int) $r['tick'] / 600, 1)) . ' min' . ($isRep ? '<br><span class="sf-muted">' . esc_html($r['result']) . '</span>' : '') . '</td><td class="sf-muted">' . esc_html($r['updated_at']) . '</td><td><a class="sf-play" href="' . esc_url($url) . '">' . ($isRep ? '▶ Watch replay' : '▶ Resume') . '</a> <a class="sf-share" href="' . esc_url(add_query_arg('_wpnonce', wp_create_nonce('wp_rest'), rest_url('statefall/v1/saves/' . (int) $r['id'] . '/file'))) . '" title="Download the .state file">Download</a></td></tr>'; };
    $h = '<section class="sf-section" data-pane="saves" style="display:none"><h3>Saved games</h3>' . ($saves ? '<table class="sf-table sf-saves"><thead><tr><th>Save</th><th>Clock</th><th>Saved (UTC)</th><th></th></tr></thead><tbody>' . implode('', array_map(function ($r) use ($row) { return $row($r, false); }, $saves)) . '</tbody></table>' : '<p class="sf-muted">No saved games. The game autosaves while you play; Save &amp; quit on the pause card keeps a named copy.</p>');
    $h .= '</section><section class="sf-section" data-pane="replays" style="display:none"><h3>Replays</h3>' . ($reps ? '<table class="sf-table sf-saves"><thead><tr><th>Replay</th><th>Length</th><th>Finished (UTC)</th><th></th></tr></thead><tbody>' . implode('', array_map(function ($r) use ($row) { return $row($r, true); }, $reps)) . '</tbody></table>' : '<p class="sf-muted">No replays yet — every match you finish is kept here.</p>') . '</section>';
    return $h;
}

function statefall_profile_tabs_js() { ?>
<script>
(function(){document.querySelectorAll('.sf-profile').forEach(function(w){var bs=w.querySelectorAll('.sf-tabs button'),ps=w.querySelectorAll('[data-pane]');function go(k){bs.forEach(function(b){b.classList.toggle('on',b.dataset.tab===k)});ps.forEach(function(p){p.style.display=p.dataset.pane===k?'':'none'});try{history.replaceState(null,'','#'+k)}catch(e){}}bs.forEach(function(b){b.addEventListener('click',function(){go(b.dataset.tab)})});var h=location.hash.replace('#','');if(h&&w.querySelector('[data-pane="'+h+'"]'))go(h);});})();
</script>
<?php }

/** The player's own nation flag (if they have one), as a mini flag placeholder drawn by flags.js. Cached per request. */
function statefall_player_flag_html($uid) {
    static $cache = []; $uid = (int) $uid;
    if (!array_key_exists($uid, $cache)) { $f = get_user_meta($uid, 'statefall_flag', true); $cache[$uid] = (is_array($f) && !empty($f['layers'])) ? wp_json_encode(['layers' => $f['layers']]) : ''; }
    if ($cache[$uid] === '') return '';
    $name = get_user_meta($uid, 'statefall_nation', true);
    return '<span data-sf-flag="' . esc_attr($cache[$uid]) . '" data-w="27" data-h="18" title="' . esc_attr($name ?: 'Custom flag') . '" style="display:inline-block;width:27px;height:18px;margin-right:6px;vertical-align:middle"></span>';
}

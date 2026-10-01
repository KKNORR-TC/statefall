// Apply only the imagery changes to a verified current theme backup.
const fs=require('node:fs'),path=require('node:path'),maps=require('./captures.json');
const [backup,output]=process.argv.slice(2);if(!backup||!output)throw Error('Pass backup and output directories');
const read=n=>fs.readFileSync(path.join(backup,n),'utf8');
function once(s,a,b){if(s.split(a).length!==2)throw Error('Unexpected template: '+a.slice(0,100));return s.replace(a,b);}
const media='/wp-content/uploads/2026/09/';
const quote=s=>"'"+s.replaceAll('\\','\\\\').replaceAll("'","\\'")+"'";
const captions=maps.map(m=>`        ${quote(m.slug)} => ${quote(m.caption)},`).join('\n');
const helper=`
/** Gameplay media shared by map tiles and map detail pages. */
function statefall_map_art( $slug ) {
    $base = '${media}';
    if ( $slug === 'continents' ) {
        return array(
            'main' => $base . 'continents-coast-v2.jpg', 'tile' => $base . 'continents-coast-v2.jpg',
            'detail' => $base . 'continents-rivers-v2.jpg', 'overview' => $base . 'continents-overview-v1.png',
            'width' => 2100, 'height' => 1180, 'detail_width' => 1600, 'detail_height' => 1000,
            'overview_width' => 1040, 'overview_height' => 640, 'seed' => 'TERRAIN2026',
            'caption' => 'Build along the coast. Fight for the crossings. Actual Continents gameplay, zoomed in to show the terrain.',
        );
    }
    $captions = array(
${captions}
    );
    return array(
        'main' => $base . $slug . '-terrain-v3.jpg', 'tile' => $base . $slug . '-tile-v3.jpg',
        'detail' => $base . $slug . '-close-v3.jpg', 'overview' => $base . $slug . '-overview-v3.jpg',
        'width' => 1800, 'height' => 1013, 'detail_width' => 1200, 'detail_height' => 750,
        'overview_width' => 1280, 'overview_height' => 737, 'seed' => 'MAPS2026',
        'caption' => $captions[$slug] ?? 'Actual Statefall gameplay, zoomed in to show the terrain.',
    );
}
`;
let functions=read('functions.php');
functions=once(functions,"$img = $map['slug'] === 'continents' ? home_url( '/wp-content/uploads/2026/09/continents-coast-v2.jpg' ) : get_stylesheet_directory_uri() . '/assets/maps/' . $map['slug'] . '.jpg';","$art = statefall_map_art( $map['slug'] );\n\t\t$img = home_url( $art['tile'] );");
functions=once(functions,'function statefall_render_maps_grid() {',helper+'\nfunction statefall_render_maps_grid() {');
let map=read('map-single.php');
const start=map.indexOf("<?php if ( $map['slug'] === 'continents' ) : ?>"),end=map.indexOf('<?php endif; ?>',start);
if(start<0||end<start)throw Error('Missing map gallery');
map=map.slice(0,start)+fs.readFileSync(path.join(__dirname,'gallery.php'),'utf8')+map.slice(end+'<?php endif; ?>'.length);
map=once(map,"$img_url  = get_stylesheet_directory_uri() . '/assets/maps/' . $map['slug'] . '.jpg';",'');
let front=read('front-page.php');
front=once(front,"get_stylesheet_directory_uri() . '/assets/screenshot-zoomed-map.jpg'",`home_url( '${media}homepage-garrisons-v3.jpg' )`);
front=once(front,'alt="A close-up view of a Statefall map showing supply lines, cities and factories between neighbouring nations."','width="1600" height="1000" style="width:100%;height:auto;" loading="lazy" alt="Statefall gameplay showing wooded terrain, river-separated territories, ports and transport ships."');
front=once(front,"get_stylesheet_directory_uri() . '/assets/screenshot-how-to-play.jpg'",`home_url( '${media}homepage-help-v3.jpg' )`);
front=once(front,'alt="The in-game How to play panel, Ships tab, showing every ship class and its stats."','width="860" height="485" style="width:100%;height:auto;" loading="lazy" alt="The current in-game How to play panel, with the Ships tab and unit stats."');
fs.mkdirSync(output,{recursive:true});
for(const[n,s]of Object.entries({'functions.php':functions,'map-single.php':map,'front-page.php':front}))fs.writeFileSync(path.join(output,n),s);
console.log('Prepared three theme files; existing hero, menu and styles preserved.');

// Build narrow editor-ready changes from a freshly backed-up live theme.
// Outputs stay outside tracked source; the existing header/menu is never changed.
const fs=require('node:fs'),path=require('node:path');
const [backup,output]=process.argv.slice(2);
if(!backup||!output)throw Error('Usage: node website/prepare-publish.cjs <fresh-theme-backup> <output>');
const read=n=>fs.readFileSync(path.join(backup,n),'utf8');
function replaceOnce(text,old,next){if(text.split(old).length!==2)throw Error('Unexpected template input: '+old.slice(0,80));return text.replace(old,next);}
const media='/wp-content/uploads/2026/09/';
let hero=fs.readFileSync(path.join(__dirname,'hero/hero.php'),'utf8').replace(/^<\?php.*?\?>\s*/,'');
hero=hero.replace("get_stylesheet_directory_uri() . '/assets/statefall-hero-v1.png'","home_url( '"+media+"statefall-hero-v1.png' )");
let front=read('front-page.php');
const start='<!-- ============ HERO ============ -->',end='<!-- ============ FOUNDING PLAYER STRIP ============ -->';
if(front.split(start).length!==2||front.split(end).length!==2)throw Error('Hero boundaries changed');
const s=front.indexOf(start),e=front.indexOf(end);if(e<=s)throw Error('Invalid hero boundaries');
front=front.slice(0,s)+start+'\n'+hero+'\n'+front.slice(e);
let functions=read('functions.php');
functions=replaceOnce(functions,"define( 'STATEFALL_THEME_VERSION', '1.1.0' );","define( 'STATEFALL_THEME_VERSION', '1.1.2' );");
functions=replaceOnce(functions,"$img = get_stylesheet_directory_uri() . '/assets/maps/' . $map['slug'] . '.jpg';","$img = $map['slug'] === 'continents' ? home_url( '"+media+"continents-coast-v2.jpg' ) : get_stylesheet_directory_uri() . '/assets/maps/' . $map['slug'] . '.jpg';");
let detail=fs.readFileSync(path.join(__dirname,'continents/detail.php'),'utf8').replace(/^<\?php.*?\?>\s*/,'');
detail=detail.replace(/get_stylesheet_directory_uri\(\) \. '\/assets\/maps\/([^']+)'/g,(_,file)=>"home_url( '"+media+file+"' )");
let map=read('map-single.php');
const mapHero=map.match(/<div class="map-hero">[\s\S]*?<\/div>/g);if(mapHero?.length!==1)throw Error('Map hero changed');
map=replaceOnce(map,mapHero[0],"<?php if ( $map['slug'] === 'continents' ) : ?>\n"+detail+"<?php else : ?>\n"+mapHero[0]+"\n<?php endif; ?>");
const style=replaceOnce(read('style.css'),'Version: 1.0.0','Version: 1.1.2')+'\n'+fs.readFileSync(path.join(__dirname,'hero/hero.css'),'utf8');
fs.mkdirSync(output,{recursive:true});
for(const [n,value]of Object.entries({'front-page.php':front,'functions.php':functions,'map-single.php':map,'style.css':style}))fs.writeFileSync(path.join(output,n),value);
console.log('Prepared four theme files; header and menu remain untouched.');

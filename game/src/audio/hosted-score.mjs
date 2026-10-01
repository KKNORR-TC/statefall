const normalized=value=>String(value).toLowerCase().replace(/[^a-z0-9]/g,'');
function fileTitle(url){
  try{return decodeURIComponent(new URL(url,'https://statefall.invalid').pathname.split('/').at(-1)).replace(/^[a-f0-9]{8}-/i,'').replace(/\.[^.]+$/,'');}catch{return '';}
}

// The hosted admin permits display-name edits (for example Siege Heartbeat (1)
// is now Death Comes For Everyone). Match its original filename and duration too.
export function matchHostedScore(catalog,playlist){
  const all=[...(playlist.menu||[]),...(playlist.game||[]),...Object.values(playlist.stings||{}).flat()].filter(t=>t?.url&&t.id&&typeof t.title==='string');
  return catalog.map(local=>{
    const key=normalized(local.title);
    const hosted=all.find(t=>(normalized(t.title)===key||normalized(fileTitle(t.url))===key)&&Math.abs((t.seconds||0)-local.seconds)<1);
    return hosted?{...local,...hosted,roles:local.roles,catalogId:local.id,fallbackUrl:local.url}:null;
  }).filter(Boolean); // A successfully loaded playlist is authoritative about enabled tracks.
}

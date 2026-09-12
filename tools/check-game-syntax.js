const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');

const file=path.resolve(__dirname,'..','game','index.html');
const html=fs.readFileSync(file,'utf8');
const start=html.indexOf('<script>'),end=html.lastIndexOf('</script>');
if(start<0||end<=start) throw new Error('Could not find the game script in '+file);
new vm.Script(html.slice(start+8,end),{filename:file});
console.log('Game script syntax OK');

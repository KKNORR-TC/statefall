'use strict';

const {command,frame,parseArgs,run,startMatch}=require('./trailer-capture.js');

const MAPS=['world','europe','americas','africa','asia','mideast'];
const HELP=`Usage: node tools/trailer2.js [--frames N] [--smoke]

Captures a deterministic real-world-map montage and dense late-game scene from
the real built Statefall Canvas.
Output: OUT (default /tmp/trailerB)/f00000.jpg, f00001.jpg, ...

Options:
  --frames N  Maximum total frames (default 168)
  --smoke     Skip the montage and capture one dense late-game frame
  --help      Show this help

SKIPMAPS=1 skips the map montage. Run "npm run build:trailer" first. This tool
emits a JPEG frame sequence and does not assemble GIF or video.
`;

async function main(){
  const {options,positional}=parseArgs(process.argv.slice(2),168);
  if(options.help){process.stdout.write(HELP);return;}
  if(positional.length)throw new Error('trailer2.js does not accept positional arguments. See --help.');
  const output=process.env.OUT||'/tmp/trailerB';
  const count=await run(output,async capture=>{
    if(!options.smoke&&!process.env.SKIPMAPS){
      for(const map of MAPS){
        if(capture.index>=options.frames)return;
        await startMatch(capture,{seed:`MAPS${map}`.toUpperCase().slice(0,16),map,difficulty:'superhard',quick:true,instant:true});
        await command(capture,'advance',500);
        for(let i=0;i<12&&capture.index<options.frames;i++){
          if(i)await command(capture,'advance',2);
          await command(capture,'setCamera',0.85+i*0.01,'world');
          await frame(capture);
        }
      }
    }
    if(capture.index>=options.frames)return;
    await startMatch(capture,{seed:'DEEP2',difficulty:'impossible',quick:true,instant:true,fog:true,noCap:true});
    await command(capture,'installLateGameScene');
    while(capture.index<options.frames){
      if(capture.index)await command(capture,'advance',2);
      await frame(capture);
    }
  });
  process.stdout.write(`frames ${count} output ${output}\n`);
}

main().catch(error=>{console.error(error.stack||error);process.exitCode=1;});

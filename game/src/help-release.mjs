import {GAME_VERSION,GAME_BUILD} from './config/build.js';

// Update this player-facing note with every game release. The package build
// deliberately fails when it no longer matches the release metadata.
export const HELP_RELEASE={
 version:'1.10.62',
 build:'2026-09-30-tactical-pause',
 title:'Pause. Read the battlefield. Plan your next move.',
 changes:[
  'Pausing leaves the battlefield clear. Pan, zoom and inspect while the clock is stopped; use the compact pause controls to resume, save or restart.',
  'With Paused orders enabled, you can build and issue orders directly on the paused map.',
  'Opening How to Play pauses a running single-player match. Closing it returns to your previous running or paused state.'
 ]
};
export function assertHelpRelease(version=GAME_VERSION,build=GAME_BUILD){
 if(HELP_RELEASE.version!==version||HELP_RELEASE.build!==build||!HELP_RELEASE.changes.length)throw new Error('Update the About release note before building this release.');
}

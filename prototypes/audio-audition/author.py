"""Offline recorded-source edits for Statefall. No oscillators or generated noise.
Run from the repository root; dependencies may be in .artifacts/audio-python.
"""
import sys
from pathlib import Path
ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT.parents[1] / '.artifacts/audio-python'))
import json, hashlib, io
from locked_audio import approved_files, check_candidate
import numpy as np
import soundfile as sf
from scipy import signal
from fractions import Fraction

SR = 48000
OUT = ROOT / 'audio'
OUT.mkdir(exist_ok=True)
S = ROOT / 'sources'
NAV = S / 'naval/qubodup-NavalBattleSoundSet-cc0'
MET = S / 'impacts/Audio'
used = {}
audio_locks=approved_files(ROOT)

def read(path, start=0, end=None, rate=1):
    x, sr = sf.read(path, always_2d=True)
    used[str(path.relative_to(ROOT))] = hashlib.sha256(path.read_bytes()).hexdigest()
    x = x[int(start*sr):int(end*sr) if end is not None else None]
    if x.shape[1] == 1: x = np.repeat(x, 2, axis=1)
    ratio = Fraction(SR/(sr*rate)).limit_denominator(1000)
    return signal.resample_poly(x, ratio.numerator, ratio.denominator, axis=0)

def filt(x, low=35, high=None):
    y = signal.sosfilt(signal.butter(3, low, 'highpass', fs=SR, output='sos'), x, axis=0)
    if high: y = signal.sosfilt(signal.butter(3, high, 'lowpass', fs=SR, output='sos'), y, axis=0)
    return y

def fade(x, attack=.004, release=.15):
    x=x.copy(); a=min(len(x)//2,int(attack*SR)); b=min(len(x)//2,int(release*SR))
    if a: x[:a] *= np.linspace(0,1,a)[:,None]**1.4
    if b: x[-b:] *= np.linspace(1,0,b)[:,None]**1.4
    return x

def norm(x, rms=.15):
    return x * min(8, rms/max(1e-8,np.sqrt(np.mean(x*x))))

def decay(x, seconds):
    return x*np.exp(-np.arange(len(x))/SR/seconds)[:,None]

def mix(layers):
    n=max(int(at*SR)+len(x) for x,at,g in layers)
    y=np.zeros((n,2))
    for x,at,g in layers:
        i=int(at*SR); y[i:i+len(x)] += x*g
    return y

def tail(x, amount=.1):
    # Short outdoor reflections from the recording itself; no artificial noise bed.
    layers=[(x,0,1)]
    for delay,g in [(.083,.5),(.149,.35),(.241,.23),(.389,.13),(.577,.07)]:
        layers.append((filt(x[:,::-1],65,3300),delay,amount*g))
    return mix(layers)

def stretch_pitch(x, rate):
    frac=Fraction(1/rate).limit_denominator(1000)
    return signal.resample_poly(x,frac.numerator,frac.denominator,axis=0)

gun=norm(fade(filt(read(S/'artillery.mp3',0,2.78),45,9500),.002,.28))
blast=norm(fade(filt(read(NAV/'ExplosionMetal.wav'),35,10000),.002,.18))
metal=norm(fade(filt(read(MET/'impactMetal_heavy_001.ogg'),90,7800)))
debris=norm(fade(filt(read(MET/'impactMining_002.ogg'),240,6500)))
water=norm(fade(filt(read(NAV/'Splash.wav'),75,6500),.04,.35))
wave=norm(fade(filt(read(S/'waves.flac'),55,3800),.15,.6))
rocket=norm(fade(filt(read(S/'rocket.mp3',0,6.8,rate=1.35),75,7000),.07,.85))
siren=norm(fade(filt(read(S/'siren-close.mp3',3.15,6.95),280,2400),.09,.28))

natural={
 'artillery':tail(mix([(decay(gun,1.8),0,1),(metal,.035,.12)]),.13),
 'shell-impact':tail(mix([(blast,0,.95),(debris,.09,.16)]),.12),
 'missile-launch':mix([(rocket,0,.85),(blast[:int(.32*SR)],0,.19),(metal,0,.1)]),
 'nuclear-detonation':tail(mix([(blast,0,.7),(filt(stretch_pitch(blast,.47),28,950),.035,1.1),(fade(filt(stretch_pitch(gun,.55),28,520),.02,1.4),.13,.7),(fade(filt(stretch_pitch(rocket,.8),40,330),.5,2),.18,.28),(debris,.25,.11)]),.25),
 'ship-sinking':mix([(blast,0,.35),(stretch_pitch(metal,.58),.12,.6),(stretch_pitch(metal,.69),.48,.35),(water,.35,.8),(stretch_pitch(wave,.75),1,.5),(fade(stretch_pitch(debris,.57)),.85,.2)]),
 'incoming-warning':siren,
}
heavy={
 'artillery':tail(mix([(decay(gun,1.15),0,.8),(filt(stretch_pitch(blast,.68),35,750),.018,.95),(metal,.026,.3),(debris,.18,.08)]),.2),
 'shell-impact':tail(mix([(blast,0,1),(filt(stretch_pitch(blast,.72),38,950),.022,.85),(metal,.018,.3),(debris,.075,.36),(stretch_pitch(debris,.8),.19,.1)]),.22),
 'missile-launch':tail(mix([(rocket,0,.8),(filt(stretch_pitch(rocket,.7),45,1100),0,.4),(blast,0,.4),(metal,.014,.22)]),.08),
 'nuclear-detonation':tail(mix([(blast,0,.8),(gun[:int(.55*SR)],.012,.28),(filt(stretch_pitch(blast,.34),25,650),.025,1.1),(fade(filt(stretch_pitch(gun,.4),26,430),.01,2),.07,.7),(fade(filt(stretch_pitch(rocket,.72),35,580),.32,2.2),.18,.4),(debris,.24,.2),(stretch_pitch(debris,.5),.55,.17)]),.3),
 'ship-sinking':tail(mix([(blast,0,.52),(filt(stretch_pitch(blast,.55),35,1200),.06,.35),(stretch_pitch(metal,.43),.13,.7),(stretch_pitch(metal,.62),.53,.52),(stretch_pitch(metal,.5),1.05,.25),(stretch_pitch(water,.82),.35,.95),(stretch_pitch(wave,.62),1,.65),(stretch_pitch(debris,.5),.65,.3)]),.13),
 'incoming-warning':mix([(fade(stretch_pitch(siren,.88),.04,.2),0,.75),(fade(stretch_pitch(siren,.88),.04,.2),.08,.12),(metal,0,.1)]),
}
descriptions={
 'artillery':('Heavy artillery','Recorded gun report with a short mechanical action.','Deeper blast body and a sharper mechanical attack.'),
 'shell-impact':('Shell impact','Compact detonation with light earth and debris.','More concussion, metal and debris for a clear hit.'),
 'missile-launch':('Missile launch','Recorded rocket roar with a brief ignition transient.','Reinforced ignition and a deeper exhaust layer.'),
 'nuclear-detonation':('Nuclear detonation','Designed blast with low concussion and a long rolling tail.','Broader layered shock and heavier sustained aftermath.'),
 'ship-sinking':('Ship sinking','Blast, hull impacts and water displacement.','Slower hull breakup, deeper impact and a heavier water tail.'),
 'incoming-warning':('Incoming attack warning','A short edit of a recorded civil-defense siren.','Lower siren treatment with a mechanical attention cue.'),
}
source_ids={
 'artillery':['artillery','impacts','naval'], 'shell-impact':['naval','impacts'],
 'missile-launch':['rocket','naval','impacts'], 'nuclear-detonation':['naval','artillery','rocket','impacts'],
 'ship-sinking':['naval','impacts','waves'], 'incoming-warning':['siren-close','impacts'],
}
# Frequent player actions get their own short, non-musical vocabulary.
light=norm(fade(filt(read(MET/'impactMetal_light_003.ogg'),300,6000)))
mechanical=norm(fade(filt(read(MET/'impactMetal_medium_000.ogg'),180,4200)))
shot=norm(fade(filt(read(NAV/'GunShot.wav'),180,4200)))
ground={
 'attack-start':mix([(mechanical,0,.7),(shot,.075,.28)]),
 'attack-progress':mix([(filt(stretch_pitch(shot,r),200,3500),t,g) for t,r,g in [(0,1,.45),(.19,1.12,.24),(.65,.89,.35),(1.35,1.06,.4),(1.61,.94,.25),(2.3,1,.32),(2.61,1.14,.18)]]),
 'attack-stalled':mix([(stretch_pitch(mechanical,.72),0,.7),(stretch_pitch(mechanical,.66),.3,.42)]),
 'attack-success':mix([(mechanical,0,.35),(light,.12,.65),(stretch_pitch(light,1.17),.3,.48)]),
 'attack-failed':mix([(stretch_pitch(metal,.8),0,.55),(stretch_pitch(mechanical,.52),.2,.5)]),
 'construction-start':mix([(metal,0,.38),(mechanical,.12,.5),(debris,.18,.28)]),
 'construction-complete':mix([(mechanical,0,.35),(light,.16,.7)]),
 'sam-launch':mix([(fade(filt(read(S/'rocket.mp3',.4,1.6,rate=1.5),320,9500),.005,.25),.02,.65),(mechanical,0,.4)]),
 'sam-intercept':tail(mix([(fade(filt(stretch_pitch(blast,1.6),320,9500),.002,.14),0,.8),(fade(filt(stretch_pitch(debris,1.3),900,9500)),.055,.2)]),.08),
}
ground_desc={
 'attack-start':('Ground attack: start','Mechanical order confirmation followed by a brief gun report.','Heavier order confirmation and a more forceful combat onset.'),
 'attack-progress':('Ground attack: advancing','A short, sparse recorded gunfire texture for an active front.','Fuller battle texture; intended to sit quietly under other cues.'),
 'attack-stalled':('Ground attack: stalled','Two restrained, low mechanical knocks.','A firmer double knock to mark loss of momentum.'),
 'attack-success':('Ground attack: success','A short ascending sequence of recorded metal clicks.','Brighter, more definite resolution without a musical fanfare.'),
 'attack-failed':('Ground attack: failed','A descending mechanical closure.','A heavier closure, distinct from a rejected command.'),
 'construction-start':('Construction: started','Placement clunk with a brief work texture.','More substantial placement and assembly.'),
 'construction-complete':('Construction: complete','A latch followed by a light completion click.','A crisp, prominent completion cue.'),
 'sam-launch':('SAM: launch','Fast, compact rocket release with a launcher click.','Sharper release, deliberately shorter than a strategic missile.'),
 'sam-intercept':('SAM: successful intercept','A brief high-frequency airburst and fragments.','A stronger airburst; no nuclear rumble or ground-impact tail.'),
}
for key,x in ground.items():
    natural[key]=x
    if key in ['attack-progress','attack-start']: extra=filt(stretch_pitch(x,.86),90,1700)
    elif key in ['sam-launch','sam-intercept']: extra=filt(stretch_pitch(x,.92),120,2400)
    else: extra=filt(stretch_pitch(x,.85),100,1800)
    heavy[key]=mix([(x,0,.85),(extra,.018,.32)])
    descriptions[key]=ground_desc[key]
    source_ids[key]=(['naval','impacts'] if key in ['attack-start','attack-progress','sam-intercept'] else ['rocket','impacts'] if key=='sam-launch' else ['impacts'])
mg=norm(fade(filt(read(S/'machinegun.mp3'),130,6500),.003,.14))
tracks=norm(fade(filt(read(S/'tracks.mp3',.4,8.8),70,4700),.25,.55))
foley=norm(fade(filt(read(S/'tank-foley.mp3',1,12),120,4200),.2,.5))
def pan(x,p):
    return x*np.array([min(1,1-p),min(1,1+p)])[None,:]
def fighting(reinforced=False):
    layers=[(pan(tracks,-.15),.1,.3),(pan(foley,.2),.5,.26)]
    for t,r,g,p in [(.05,1,.6,-.3),(1.9,.92,.4,.3),(3.4,1.07,.5,-.15),(5.5,.97,.45,.2),(7.3,1.12,.34,-.3),(9.4,1,.52,.1)]:
        layers.append((pan(stretch_pitch(mg,r),p),t,g*.2))
    for t,r,g,p in [(2.5,.92,.43,.24),(8,.84,.5,-.18)]:
        layers.append((pan(stretch_pitch(decay(gun,1.2),r),p),t,g))
    if reinforced:
        layers.extend([(filt(stretch_pitch(blast,.7),40,850),2.54,.5),(filt(stretch_pitch(blast,.65),40,750),8.04,.6)])
    return fade(mix(layers),.08,.65)
natural['attack-progress']=fighting()
heavy['attack-progress']=fighting(True)
descriptions['attack-progress']=('Ground attack: active fighting','Machine-gun bursts, tracked movement, mechanical squeaks and occasional artillery.','The same battlefield blend with stronger artillery concussion.')
source_ids['attack-progress']=['machinegun','tracks','tank-foley','artillery','naval']
# Revision 2: outcomes are dry machinery/track gestures, not pitched UI cadences.
settle=norm(fade(filt(read(S/'tracks.mp3',5.2,6.45),110,1600),.06,.45))
stop=norm(fade(filt(read(S/'tank-foley.mp3',12.4,13.15),130,1700),.025,.22))
winddown=norm(fade(filt(read(S/'tracks.mp3',6.2,8.5),80,1050),.06,.85))
outcomes={
 'attack-stalled':decay(settle,.8),
 'attack-failed':mix([(decay(winddown,.95),0,1),(fade(filt(debris,180,950),.06,.35),.15,.09)]),
}
outcome_descriptions={
 'attack-stalled':('Ground attack: stalled','Brief track friction settling into quiet.','A slightly fuller mechanical settling sound.'),
 'attack-success':('Ground attack: success','A short, dry machinery stop; no ascending clicks.','A firmer mechanical stop, without a celebratory pattern.'),
 'attack-failed':('Ground attack: failed','A longer, subdued track wind-down into silence.','A weightier machinery wind-down; no descending notes.'),
}
for key,x in outcomes.items():
    natural[key]=x
    heavy[key]=mix([(x,0,1),(filt(x,75,500),0,.25)])
    descriptions[key]=outcome_descriptions[key]
    source_ids[key]=['tank-foley'] if key=='attack-success' else ['tracks','impacts'] if key=='attack-failed' else ['tracks']
# Recorded bugle phrases, retaining performed pitch and timing.
neutral_call=fade(filt(read(S/'fanfare.ogg',37,39.05),100,6500),.045,.35)
enemy_call=fade(filt(read(S/'fanfare.ogg',35.35,39.05),100,7500),.035,.35)
taps=fade(filt(read(S/'taps.ogg',0,7.3),100,7000),.02,.35)
for key,x,title,desc,source in [
 ('capture-neutral',neutral_call,'Neutral territory captured','A brief held bugle salute for completing a neutral territory.', 'fanfare'),
 ('capture-enemy',enemy_call,'Enemy territory captured','A brisk closing flourish resolving into a held bugle call for a completed enemy territory.', 'fanfare'),
 ('enemy-eliminated',taps,'Enemy eliminated: Taps','Opening phrase of recorded Taps. Reserved for removing an enemy from the game.', 'taps')]:
    natural[key]=x
    heavy[key]=tail(x,.16)
    descriptions[key]=(title,desc,'The same performance with a restrained outdoor reflection.')
    source_ids[key]=[source]
# Construction uses recorded work and machinery, without UI chimes or pitched cadences.
hammer=norm(fade(filt(read(S/'hammer.mp3',.25,1.65),110,5200),.008,.12))
diesel=norm(fade(filt(read(S/'diesel.mp3',0,2.15),65,4500),.02,.25))
horn=norm(fade(filt(read(S/'ship-horn.wav',.25,1.65),90,3200),.1,.3))
servo=norm(fade(filt(read(S/'tank-foley.mp3',2,3.05),160,3800),.04,.15))
motor=norm(fade(filt(read(S/'tank-foley.mp3',6,7.2),85,2200),.08,.22))
gate=norm(fade(filt(read(S/'tank-foley.mp3',11.8,12.65),80,2100),.01,.18))
lock=norm(fade(filt(read(MET/'impactMetal_heavy_003.ogg'),110,2200),.004,.15))
wood=norm(fade(filt(read(MET/'impactWood_medium_002.ogg'),120,2600),.004,.12))
boots=[norm(fade(filt(read(MET/f'footstep_concrete_00{i}.ogg'),180,3400),.008,.1)) for i in range(3)]
air=fade(filt(rocket[:int(1.4*SR)],600,5600),.18,.35)
wash=fade(water[:int(1.3*SR)],.09,.35)
natural['construction-start']=hammer
heavy['construction-start']=mix([(hammer,0,1),(filt(hammer,80,700),0,.18)])
descriptions['construction-start']=('Construction: hammering starts','Short recorded hammering on a board.','The same hammering with a little more body.')
source_ids['construction-start']=['hammer']
building_specs={
 'city':('City',[(wood,0,.5),(boots[0],.2,.3),(boots[1],.52,.25)],'Door settles, then two footsteps.',['impacts']),
 'factory':('Factory',[(diesel,0,.8),(mechanical,1.6,.15)],'Engine catches and settles into work.',['diesel','impacts']),
 'port':('Port',[(horn,0,.65),(wash,.15,.2)],'Short dock horn over water.',['ship-horn','naval']),
 'fort':('Bastion',[(gate,0,.75),(lock,.65,.4)],'Heavy gate closes and bolts home.',['tank-foley','impacts']),
 'sam':('SAM site',[(servo,0,.65),(mechanical,.7,.4),(mechanical,.92,.3)],'Launcher aligns, followed by two dry latches.',['tank-foley','impacts']),
 'silo':('Missile silo',[(gate,0,.5),(motor,.3,.65),(lock,1.25,.5)],'Heavy hatch motor and a single deep lock.',['tank-foley','impacts']),
 'command':('Missile command',[(mechanical,0,.6),(motor,.15,.35),(wood,.75,.25)],'Control-bank switch, machinery and desk closure.',['tank-foley','impacts']),
 'shield':('Shield generator',[(fade(filt(diesel,65,500),.4,.35),0,.9),(lock,.05,.22)],'Deep generator engaging behind a power contactor.',['diesel','impacts']),
 'battery':('Coastal battery',[(gate,0,.45),(lock,.42,.45),(wash,.15,.2)],'Turret lock with a soft coastal wash.',['tank-foley','impacts','naval']),
 'shore':('Shore guns',[(mechanical,0,.6),(mechanical,.2,.4),(wash,.08,.15)],'Quick paired breech actions beside water.',['impacts','naval']),
 'bertha':('Big Bertha',[(motor,0,.5),(lock,.65,.7),(metal,.78,.2)],'Slow heavy gun mechanism, then a substantial breech closure.',['tank-foley','impacts']),
 'airfield':('Airfield',[(gate,0,.3),(air,.2,.65)],'Hangar latch and a short rising air-flow texture.',['tank-foley','rocket']),
 'flightops':('Flight operations',[(mechanical,0,.5),(mechanical,.18,.3),(air,.45,.32)],'Paired control actions followed by distant air-flow.',['impacts','rocket']),
 'subbase':('Submarine base',[(lock,0,.65),(wash,.2,.65),(gate,.65,.35)],'Pressure hatch and water displacement.',['impacts','naval','tank-foley']),
 'engcmd':('Engineering command',[(hammer,0,.45),(diesel,.85,.6)],'Workshop hammering, then a repair-vehicle engine.',['hammer','diesel']),
 'troopcmd':('Troop command',[(boots[0],0,.5),(boots[1],.23,.45),(boots[2],.46,.4),(wood,.8,.3)],'Three deliberate boots and a dry equipment closure.',['impacts']),
 'radar':('Radar station',[(servo,0,.65),(mechanical,.9,.2)],'One compact dish-drive movement and relay closure.',['tank-foley','impacts']),
 'lradar':('Long-range radar',[(motor,0,.55),(servo,.55,.6),(mechanical,1.5,.2)],'Longer motor movement followed by a distinct second sweep.',['tank-foley','impacts']),
 'jammer':('Radar jammer',[(mechanical,0,.35),(fade(filt(air,1200,3200),.08,.2),.14,.6),(mechanical,.55,.25)],'Switched, narrow-band air hiss: a designed interference signature.',['impacts','rocket']),
 'satellite':('Satellite launch site',[(servo,0,.4),(gate,.5,.5),(lock,1.05,.35),(lock,1.3,.25)],'Gantry movement ending with a spaced pair of clamps.',['tank-foley','impacts']),
}
# Revision 5: only the factory retains an engine. Distinguish materials and gestures,
# not differently filtered versions of the same motor/servo recording.
chain=norm(fade(filt(read(S/'chain.wav',1.08,2.55),100,6200),.006,.18))
ratchet=norm(fade(filt(read(S/'ratchet.wav',21.5,22.55),150,6500),.008,.14))
contactor=norm(fade(filt(read(S/'contactor.wav',0,1.35),55,5000),.002,.4))
shutter=norm(fade(filt(read(S/'shutter.wav',8.25,10.35),100,5200),.015,.2))
camera=norm(fade(filt(read(S/'camera.wav'),180,6500),.002,.06))
steam=norm(fade(filt(read(S/'steam.wav',8,9.2),600,6500),.045,.18))
rf=norm(fade(filt(read(S/'interference.wav',.3,1.6),450,3800),.025,.15))
radio=norm(fade(filt(read(S/'radio.wav',.15,.72),450,3400),.012,.1))
plate=norm(fade(filt(read(MET/'impactPlate_heavy_003.ogg'),65,2600),.003,.18))
tin=norm(fade(filt(read(MET/'impactTin_medium_002.ogg'),200,5800),.003,.12))
stone=norm(fade(filt(read(MET/'impactMining_004.ogg'),60,2200),.005,.18))
building_specs.update({
 'fort':('Bastion',[(chain,0,.6),(stone,1.12,.5)],'Heavy chain draws tight; a stone gate seats with a dull thud.',['chain','impacts']),
 'sam':('SAM site',[(ratchet[:int(.55*SR)],0,.6),(tin,.48,.45)],'Short loading-rack ratchet and a light sprung catch.',['ratchet','impacts']),
 'silo':('Missile silo',[(steam,0,.48),(plate,1,.65)],'Pressure release followed by one deep hatch closure.',['steam','impacts']),
 'command':('Missile command',[(radio,0,.5),(wood,.65,.4)],'A brief radio squelch, then the handset settles on a desk.',['radio','impacts']),
 'shield':('Shield generator',[(contactor,0,.65)],'One substantial electrical contactor closes, with its short metal resonance.',['contactor']),
 'battery':('Coastal battery',[(chain[:int(.65*SR)],0,.4),(plate,.5,.55),(wash,.1,.16)],'Short ammunition-chain clatter, breech closure and distant water.',['chain','impacts','naval']),
 'shore':('Shore guns',[(tin,0,.55),(tin,.17,.3),(mechanical,.42,.4)],'Two light metal magazine knocks followed by a dry catch.',['impacts']),
 'bertha':('Big Bertha',[(stone,0,.5),(plate,.28,.65),(metal,.4,.18)],'Heavy ammunition seats with a slow double thud and steel resonance.',['impacts']),
 'airfield':('Airfield',[(shutter,0,.65)],'A corrugated hangar shutter rolls down and stops.',['shutter']),
 'flightops':('Flight operations',[(camera,0,.32),(radio,.35,.4),(camera,1,.2)],'Console key, short headset squelch, then a final switch.',['camera','radio']),
 'subbase':('Submarine base',[(wash,0,.6),(steam,.25,.28),(lock,1.25,.4)],'Water displacement and an air seal closing on a hatch.',['naval','steam','impacts']),
 'engcmd':('Engineering command',[(ratchet,0,.6),(wood,.95,.25)],'Hand-tool ratchet tightens a fitting, then the tool is set down.',['ratchet','impacts']),
 'radar':('Radar station',[(camera,0,.2),(radio,.2,.32)],'A crisp relay snap followed by a short receiver crackle.',['camera','radio']),
 'lradar':('Long-range radar',[(rf,0,.45),(camera,1.25,.22)],'A longer, wavering receiver search that ends in a relay snap.',['interference','camera']),
 'jammer':('Radar jammer',[(fade(rf[:int(.22*SR)],.01,.03),0,.4),(fade(rf[int(.4*SR):int(.64*SR)],.01,.03),.33,.4),(fade(rf[int(.8*SR):int(1.1*SR)],.01,.08),.72,.4)],'Three broken bursts of recorded radio interference, then silence.',['interference']),
 'satellite':('Satellite launch site',[(camera,0,.45),(camera,.6,.4),(tin,.95,.16)],'Two clearly separated imaging shutters and a light equipment latch.',['camera','impacts']),
})
for building,(title,layers,desc,sources) in building_specs.items():
    key='construction-'+building; x=fade(mix(layers),.008,.16)
    natural[key]=x; heavy[key]=mix([(x,0,1),(filt(x,65,700),0,.16)])
    descriptions[key]=(title+': complete',desc,'Slightly fuller treatment of the same machinery signature.')
    source_ids[key]=sources
exec(compile((ROOT/'round2.py').read_text(encoding='utf-8'),'round2.py','exec'))
exec(compile((ROOT/'round3.py').read_text(encoding='utf-8'),'round3.py','exec'))
order=['attack-start','attack-progress','attack-stalled','attack-failed','capture-neutral','capture-enemy','enemy-eliminated','construction-start']+['construction-'+b for b in building_specs]+['missile-launch','sam-launch','sam-intercept','nuclear-detonation','incoming-warning','artillery','shell-impact','ship-sinking']
rows=[]; report=[]; rendered={}

def master(x, heavy=False):
    x=filt(x,28,15000)
    # Fixed saturation only for the reinforced treatment, then comparable active RMS.
    if heavy: x=np.tanh(x*1.6)/1.6
    envelope=np.sqrt(np.mean(x*x,axis=1)); active=envelope>max(envelope.max()*.035,1e-5)
    rms=np.sqrt(np.mean(x[active]**2)); x*=10**(-20/20)/max(rms,1e-8)
    peak=np.max(abs(signal.resample_poly(x,4,1,axis=0)))
    x*=min(1,10**(-2.5/20)/max(peak,1e-8))
    return fade(x,.002,.07)

def export(key,x):
    # Check the proposed encoded WAV before any write; approvals protect both formats.
    locked='audio/'+key+'.wav' in audio_locks
    if locked:
        candidate=io.BytesIO();sf.write(candidate,x,SR,format='WAV',subtype='PCM_24')
        check_candidate(audio_locks,'audio/'+key+'.wav',candidate.getvalue())
    previous=(OUT/(key+'.wav')).read_bytes() if (OUT/(key+'.wav')).exists() else None
    if not locked:sf.write(OUT/(key+'.wav'),x,SR,subtype='PCM_24')
    if previous!=(OUT/(key+'.wav')).read_bytes() or not (OUT/(key+'.ogg')).exists():
        with sf.SoundFile(OUT/(key+'.ogg'),'w',samplerate=SR,channels=2,format='OGG',subtype='VORBIS') as stream:
            for i in range(0,len(x),4096): stream.write(x[i:i+4096])
    y,sr=sf.read(OUT/(key+'.wav'),always_2d=True)
    peak=float(np.max(abs(signal.resample_poly(y,4,1,axis=0))))
    assert np.isfinite(y).all() and len(y)>SR*.1 and peak<.8 and np.max(abs(y))>.02
    assert np.max(abs(y[0]))<1e-5 and np.max(abs(y[-1]))<1e-5
    report.append(dict(file=key+'.wav',seconds=round(len(y)/sr,3),sampleRate=sr,channels=2,truePeakDb=round(20*np.log10(peak),2),rmsDb=round(20*np.log10(np.sqrt(np.mean(y*y))),2),sha256=hashlib.sha256((OUT/(key+'.wav')).read_bytes()).hexdigest()))
    return y

for id in order:
    title,a,b=descriptions[id]
    group='Construction' if id.startswith('construction-') else 'Capture & elimination' if id.startswith('capture-') or id=='enemy-eliminated' else 'Ground attacks' if id.startswith('attack-') else 'Missiles & defense' if id in ['missile-launch','sam-launch','sam-intercept','nuclear-detonation','incoming-warning'] else 'Heavy combat'
    row=dict(id=id,title=title,group=group,sources=source_ids[id],versions=[],reviewRevision=7 if id in revised3 else 6 if id in revised else 5)
    if id.startswith('construction-') and id!='construction-start': row['buildingType']=id.removeprefix('construction-')
    for kind,collection,desc in [('natural',natural,a),('reinforced',heavy,b)]:
        key=id+'-'+kind; x=master(collection[id],kind=='reinforced' and not id.startswith(('capture-','construction-')) and id!='enemy-eliminated')
        if id.startswith('construction-'): x*=.7
        if id in outcomes: x*=.6
        rendered[key]=export(key,x)
        wavepeaks=[round(float(np.max(abs(v))),3) for v in np.array_split(x,90)]
        row['versions'].append(dict(kind=kind,description=desc,file='audio/'+key+'.wav',compressed='audio/'+key+'.ogg',seconds=round(len(x)/SR,2),waveform=wavepeaks))
    rows.append(row)

# Identical timed battle sequence for both styles, with protected warning and nuke space.
timeline=[('artillery',.4,.7),('shell-impact',1.3,.55),('artillery',2,.48),('shell-impact',2.9,.43),('missile-launch',4,.65),('ship-sinking',6.1,.6),('incoming-warning',11,.66),('nuclear-detonation',16,.85)]
for style in ['natural','reinforced']:
    demo=mix([(rendered[id+'-'+style],at,g) for id,at,g in timeline]); export('battle-sequence-'+style,master(demo))
    ground_timeline=[('construction-start',.3,.6),('construction-factory',2,.6),('attack-start',4.5,.65),('attack-progress',5.6,.52),('attack-stalled',17.3,.65),('attack-start',19,.5),('attack-progress',20.2,.52),('capture-enemy',32,.65),('missile-launch',38,.6),('sam-launch',39.6,.7),('sam-intercept',40.4,.7)]
    demo=mix([(rendered[id+'-'+style],at,g) for id,at,g in ground_timeline]); export('everyday-sequence-'+style,master(demo))

for id,x in [('machineguns',mg),('tracks',mix([(tracks,0,.65),(foley,.3,.5)])),('artillery',decay(gun,1.3))]:
    export('layer-'+id,master(x))
# Explicit quiet -> fighting -> quiet demonstration with true silence at both ends.
for style in ['natural','reinforced']:
    x=rendered['attack-progress-'+style]; demo=np.zeros((len(x)+6*SR,2)); demo[3*SR:3*SR+len(x)]=x
    export('quiet-fighting-quiet-'+style,demo)

(ROOT/'manifest.json').write_text(json.dumps(rows,indent=2)+'\n',encoding='utf-8')
revision=hashlib.sha256((ROOT/'manifest.json').read_bytes()).hexdigest()
(ROOT/'manifest.js').write_text('window.AUDITION = '+json.dumps(rows)+';\nwindow.AUDITION_REVISION = '+json.dumps(revision)+';\n',encoding='utf-8')
(ROOT/'audio-checks.json').write_text(json.dumps(dict(note='Signal/decode checks only; aesthetic listening approval pending. 4x oversampled true-peak estimate. No claim of original lossless source quality for MP3 inputs.',files=report,sourceFiles=used),indent=2)+'\n',encoding='utf-8')
print(json.dumps(report,indent=2))

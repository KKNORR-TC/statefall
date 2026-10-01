"""Revision 6 candidates based on Ken's first review. Executed by author.py."""
def candidate(key,x,desc,sources,reinforced=None):
    natural[key]=x
    heavy[key]=reinforced if reinforced is not None else mix([(x,0,1),(filt(x,65,700),0,.16)])
    descriptions[key]=(descriptions[key][0],desc,'Fuller treatment of this revised cue.')
    source_ids[key]=sources
    revised.add(key)

def excerpt(name,start,end,low=80,high=7500,attack=.015,release=.2):
    return norm(fade(filt(read(S/(name+'.mp3'),start,end),low,high),attack,release))

revised=set()
# Retain the opening flourish, shorten the sustained final note with a crossfade.
call=fade(filt(read(S/'fanfare.ogg',35.35,37.9),100,7500),.035,.28)
candidate('capture-enemy',call,'Shortened 2.55-second bugle flourish for a completed enemy territory.',['fanfare'],tail(call,.09))
launch=excerpt('rocket',.4,1.85,170,7800,.015,.32)
candidate('sam-launch',mix([(launch,.025,.8),(mechanical,0,.2)]),'Longer 1.5-second rocket release with a clear exhaust tail.',['rocket','impacts'])
intercept=tail(mix([(filt(stretch_pitch(blast,.94),90,4800),0,.85),(filt(stretch_pitch(blast,.7),50,800),.015,.35),(filt(debris,250,2600),.08,.08)]),.07)
candidate('sam-intercept',intercept,'Lower, fuller airburst; the shrill fragment layer is removed.',['naval','impacts'])
sink=mix([(filt(blast,45,4200),0,.45),(filt(stretch_pitch(water,.9),65,4200),.32,.7),(stretch_pitch(wave,.75),.75,.5)])
candidate('ship-sinking',sink,'Blast and water displacement without the opening metal clinks.',['naval','waves'])

work=excerpt('worksite',10,13.1,110,6200,.12,.4)
candidate('construction-start',work,'A short outdoor construction-site ambience with irregular work and hammering.',['worksite'])
candidate('construction-city',excerpt('cheer',0,1.91,110,8500,.012,.18),'A small crowd gives a brief, human cheer.',['cheer'])
rack=excerpt('rack',.3,2.15,90,6500)
candidate('construction-fort',fade(stretch_pitch(rack,.82),.006,.18),'A substantial pull-and-return weapon-racking gesture.',['rack'])
candidate('construction-bertha',mix([(filt(stretch_pitch(rack,.62),55,4000),0,.8),(plate,2.4,.18)]),'A slower, heavier breech rack and final seating thud.',['rack','impacts'])
sweep=excerpt('sweepmotor',.2,2,90,6000,.06,.18)
candidate('construction-sam',mix([(fade(sweep[:int(.75*SR)],.035,.12),0,.6),(rack[:int(.5*SR)],.72,.35)]),'A quick launcher alignment followed by a compact loading action.',['sweepmotor','rack'])
candidate('construction-battery',fade(filt(stretch_pitch(sweep,.65),55,3000),.14,.3),'Slow, weighty powered turret rotation.',['sweepmotor'])
candidate('construction-shore',fade(stretch_pitch(sweep[:int(1.15*SR)],1.12),.06,.18),'A shorter, lighter powered gun rotation.',['sweepmotor'])
vent=norm(fade(filt(read(S/'steam.wav',7.6,9.8),350,7800),.08,.55))
candidate('construction-silo',vent,'Sustained pressure venting as a missile system readies; no hatch slam.',['steam'])
voice=excerpt('chatter',1.2,3.2,480,2000,.055,.17)
candidate('construction-command',voice,'Muffled, digitally broken voice transmission.',['chatter'])
voice2=excerpt('chatter',6,8.5,340,2400,.055,.2)
candidate('construction-flightops',mix([(voice2,0,.8),(radio,2.38,.13)]),'A longer muffled radio exchange ending in a soft squelch.',['chatter','radio'])
hum=excerpt('hum',1,3.6,45,1200,.22,.45)
# Slow gain modulation of a recorded transformer, not a generated musical tone.
hum*= (.68+.32*np.cos(2*np.pi*2.4*np.arange(len(hum))/SR))[:,None]
candidate('construction-shield',hum,'A low electrical hum with a slow oscillating pulse.',['hum'])
jet=excerpt('jet',15,18.6,85,7500,.22,.7)
candidate('construction-airfield',jet,'A compact excerpt of recorded F-16 takeoff roar.',['jet'])
ping=excerpt('ping',0,2.2,250,5000,.004,.35)
candidate('construction-radar',ping[:int(1.45*SR)]*np.linspace(1,0,len(ping[:int(1.45*SR)]))[:,None],'One clean, sonar-like detection ping with a short tail.',['ping'])
candidate('construction-lradar',mix([(stretch_pitch(ping,.8),0,.7),(fade(ping[:int(.65*SR)],.01,.2),1.25,.23)]),'A lower, longer detection ping with a distant second return.',['ping'])
candidate('construction-subbase',mix([(filt(stretch_pitch(ping,.65),150,1800),.12,.6),(filt(lock,70,1500),0,.16)]),'A deep sonar return behind a subdued pressure-door latch; no water flush.',['ping','impacts'])
# Several recorded boots in a short marching cadence, with offset ranks.
march=[]
for step in range(6):
    for rank in range(3):
        march.append((pan(boots[(step+rank)%3],(rank-1)*.3),step*.37+rank*.032,.42-rank*.075))
candidate('construction-troopcmd',fade(mix(march),.01,.12),'A short formation of marching boots in a steady cadence.',['impacts'])
jam=excerpt('hum',3.8,5.5,130,1900,.09,.32)
jam=mix([(jam,0,.7),(fade(filt(stretch_pitch(rf,.65),240,1700),.15,.3),.05,.13)])
candidate('construction-jammer',jam,'A sustained rough electrical buzz that swells and cuts out, without the three static bursts.',['hum','interference'])

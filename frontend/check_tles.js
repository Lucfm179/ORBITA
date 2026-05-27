import * as satellite from 'satellite.js';

async function check() {
  try {
    const res = await fetch('http://localhost:8000/api/objects/tle');
    const tles = await res.json();
    console.log('Fetched TLEs count:', tles.length);
    
    let propagatedCount = 0;
    let propFailedCount = 0;
    const now = new Date();
    const gmst = satellite.gstime(now);

    let loggedError = false;

    for (const tle of tles) {
      try {
        const satrec = satellite.twoline2satrec(tle.tle_line1, tle.tle_line2);
        const pv = satellite.propagate(satrec, now);
        if (pv.position && typeof pv.position !== 'boolean') {
          const ecf = satellite.eciToEcf(pv.position, gmst);
          if (ecf && typeof ecf.x === 'number' && !isNaN(ecf.x)) {
            propagatedCount++;
          } else {
            propFailedCount++;
          }
        } else {
          propFailedCount++;
          if (!loggedError) {
            console.log('Failed satellite details:', tle);
            console.log('Satrec:', {
              error: satrec.error,
              satnum: satrec.satnum,
              epochyr: satrec.epochyr,
              epochdays: satrec.epochdays,
              ndot: satrec.ndot,
              nddot: satrec.nddot,
              bstar: satrec.bstar,
              inclo: satrec.inclo,
              nodeo: satrec.nodeo,
              ecco: satrec.ecco,
              argpo: satrec.argpo,
              mo: satrec.mo,
              no_km: satrec.no_km
            });
            console.log('Propagation result:', pv);
            loggedError = true;
          }
        }
      } catch (err) {
        propFailedCount++;
        if (!loggedError) {
          console.log('Failed with exception for satellite:', tle.name, err);
          loggedError = true;
        }
      }
    }
    
    console.log('Successfully propagated:', propagatedCount);
    console.log('Failed to propagate:', propFailedCount);


    if (tles.length > 0) {
      console.log('Sample TLE 1:', tles[0]);
    }
  } catch (err) {
    console.error('Error:', err);
  }
}

check();

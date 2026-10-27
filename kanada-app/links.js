// Suchlinks zu Unterkunftsportalen, schon mit Ort, Datum, Personen und Preisgrenze ausgefüllt.
// Die Portale haben keine freie Schnittstelle für Preise, deshalb öffnet die App die fertige Suche.
// (Flüge laufen direkt über die Airlines, siehe AIRLINES in data.js.)

const enc = encodeURIComponent;

// l: { place, lat?, lng?, checkIn, checkOut, maxNight?, park? }, pax: { adults, children }
export function lodgingLinks(l, pax) {
  const a = Math.max(1, pax.adults || 1), c = Math.max(0, pax.children || 0);
  const place = l.place + ", Kanada";
  const max = l.maxNight ? Math.max(10, Math.floor(l.maxNight)) : 0;
  const out = [];

  const ab = new URLSearchParams({ checkin: l.checkIn, checkout: l.checkOut, adults: a, currency: "EUR" });
  if (c) ab.set("children", c);
  if (max) ab.set("price_max", max);
  if (l.lat != null && l.near) {
    // Nur im Umkreis der gebuchten Unterkunft suchen (ca. 4 km)
    const dLat = 0.035, dLng = 0.055;
    ab.set("ne_lat", (l.lat + dLat).toFixed(4)); ab.set("ne_lng", (l.lng + dLng).toFixed(4));
    ab.set("sw_lat", (l.lat - dLat).toFixed(4)); ab.set("sw_lng", (l.lng - dLng).toFixed(4));
    ab.set("search_by_map", "true"); ab.set("zoom", "13");
  }
  out.push({ name: "Airbnb", url: `https://www.airbnb.de/s/${enc(place)}/homes?${ab}` });

  const bk = new URLSearchParams({ ss: place, checkin: l.checkIn, checkout: l.checkOut, group_adults: a, group_children: c, no_rooms: 1, order: "price", selected_currency: "EUR" });
  if (max) bk.set("nflt", `price=EUR-min-${max}-1`);
  if (c) bk.set("age", "11");
  out.push({ name: "Booking.com", url: `https://www.booking.com/searchresults.de.html?${bk}` });

  const vr = new URLSearchParams({ destination: place, startDate: l.checkIn, endDate: l.checkOut, adults: a, sort: "PRICE_LOW_TO_HIGH" });
  if (c) vr.set("children", Array(c).fill("1_11").join(","));
  out.push({ name: "Vrbo", url: `https://www.vrbo.com/de-de/search?${vr}` });

  const ex = new URLSearchParams({ destination: place, startDate: l.checkIn, endDate: l.checkOut, adults: a, sort: "PRICE_LOW_TO_HIGH" });
  out.push({ name: "Expedia", url: `https://www.expedia.de/Hotel-Search?${ex}` });

  const de = iso => iso.split("-").reverse().join(".");
  out.push({ name: "Google Hotels", url: `https://www.google.com/travel/search?q=${enc(`Unterkünfte ${l.place} Kanada ${de(l.checkIn)} bis ${de(l.checkOut)}`)}&hl=de&curr=EUR` });

  if (l.park) out.push({ name: "Parks Canada Camping", url: "https://reservation.pc.gc.ca/" });
  return out;
}

export const mapsPlace = p => `https://www.google.com/maps/search/?api=1&query=${p.lat},${p.lng}`;
export function mapsRoute(points) {
  if (points.length < 2) return mapsPlace(points[0]);
  const ll = p => `${p.lat},${p.lng}`;
  const sp = new URLSearchParams({ api: 1, origin: ll(points[0]), destination: ll(points.at(-1)), travelmode: "driving" });
  const mid = points.slice(1, -1).slice(0, 9);
  if (mid.length) sp.set("waypoints", mid.map(ll).join("|"));
  return "https://www.google.com/maps/dir/?" + sp;
}

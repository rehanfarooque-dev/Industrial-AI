#!/usr/bin/env python3
"""
live.py - real, live external data from free public APIs (no API key, stdlib only).

These are genuine internet signals that map onto an industrial operation:

  USGS earthquakes      -> supply-chain / supplier disruption risk
  Open-Meteo weather    -> plant HVAC load, demand, fleet/route delay risk
  UK Carbon Intensity   -> live grid carbon for the energy module
  Frankfurter (ECB) FX  -> pricing / margin in multiple currencies
  World Bank            -> macro industrial-production indicator

Design (production-minded):
  * Thread-safe TTL cache so we don't hammer the APIs (refresh on an interval).
  * Hard timeouts; every fetch fails *soft* (returns None) and serves stale if it can.
  * No third-party packages - urllib only - so it runs anywhere Python does.
  * warm() pre-fetches in parallel at server start so requests stay fast.
"""

import json
import ssl
import threading
import time
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from math import asin, cos, radians, sin, sqrt

# Where the (simulated) plant physically sits - drives live weather/HVAC.
PLANT = {"name": "Riverside Works", "lat": 41.88, "lon": -87.63}  # Chicago, US

_UA = "AI-Portfolio-Dashboard/1.0 (+local demo)"
_CTX = ssl.create_default_context()

# cache: key -> (fetched_at_epoch, value)
_cache = {}
_lock = threading.Lock()
# last known status per source: name -> {ok, at, error}
_status = {}


# ---------------------------------------------------------------------------
# Core fetch + cache
# ---------------------------------------------------------------------------
def _get_json(url, timeout=8):
    req = urllib.request.Request(url, headers={"User-Agent": _UA})
    with urllib.request.urlopen(req, timeout=timeout, context=_CTX) as r:
        return json.loads(r.read().decode("utf-8"))


def _cached(key, ttl, fetch, retries=2):
    """Return cached value if fresh; else fetch (with retries). On failure serve
    stale if we have it, otherwise None - the caller then falls back to the sim."""
    now = time.time()
    with _lock:
        ent = _cache.get(key)
        if ent and (now - ent[0]) < ttl:
            return ent[1]
    last_err = None
    for attempt in range(retries):
        try:
            val = fetch()
            with _lock:
                _cache[key] = (time.time(), val)
                _status[key] = {"ok": True, "at": time.time(), "error": None}
            return val
        except Exception as e:  # transient (e.g. 502) - retry then soft-fail
            last_err = e
            if attempt + 1 < retries:
                time.sleep(0.5)
    with _lock:
        _status[key] = {"ok": False, "at": time.time(), "error": "%s" % last_err}
        if key in _cache:
            return _cache[key][1]   # stale but better than nothing
    return None


def haversine_km(lat1, lon1, lat2, lon2):
    r = 6371.0
    dlat, dlon = radians(lat2 - lat1), radians(lon2 - lon1)
    a = sin(dlat / 2) ** 2 + cos(radians(lat1)) * cos(radians(lat2)) * sin(dlon / 2) ** 2
    return 2 * r * asin(sqrt(a))


# ---------------------------------------------------------------------------
# Source fetchers (each returns a small normalized dict/list)
# ---------------------------------------------------------------------------
def get_quakes():
    """Significant-ish earthquakes in the past day (M2.5+)."""
    def _f():
        d = _get_json("https://earthquake.usgs.gov/earthquakes/feed/v1.0/"
                      "summary/2.5_day.geojson")
        out = []
        for ft in d.get("features", []):
            p, g = ft["properties"], ft["geometry"]["coordinates"]
            out.append({"mag": p.get("mag") or 0, "place": p.get("place") or "",
                        "lon": g[0], "lat": g[1], "time": p.get("time")})
        out.sort(key=lambda q: q["mag"], reverse=True)
        return out
    return _cached("quakes", ttl=300, fetch=_f)


def get_carbon():
    """UK national grid carbon intensity (gCO2/kWh) + index band."""
    def _f():
        d = _get_json("https://api.carbonintensity.org.uk/intensity")
        i = d["data"][0]["intensity"]
        return {"gco2": i.get("actual") or i.get("forecast"),
                "index": i.get("index", "n/a")}
    return _cached("carbon", ttl=300, fetch=_f)


def get_fx():
    """USD-based FX rates from the ECB via Frankfurter."""
    def _f():
        d = _get_json("https://api.frankfurter.app/latest?from=USD&to=EUR,GBP,JPY,CNY,INR")
        return {"date": d.get("date"), "rates": d.get("rates", {})}
    return _cached("fx", ttl=3600, fetch=_f)


def get_weather(lat=None, lon=None):
    """Current weather at a location (defaults to the plant)."""
    lat = PLANT["lat"] if lat is None else lat
    lon = PLANT["lon"] if lon is None else lon
    key = "weather:%0.2f,%0.2f" % (lat, lon)

    def _f():
        try:  # primary: Open-Meteo
            d = _get_json("https://api.open-meteo.com/v1/forecast?latitude=%s&longitude=%s"
                          "&current=temperature_2m,wind_speed_10m,precipitation" % (lat, lon))
            c = d.get("current", {})
            return {"temp_c": c.get("temperature_2m"), "wind": c.get("wind_speed_10m"),
                    "precip": c.get("precipitation"), "src": "open-meteo"}
        except Exception:  # fallback: wttr.in (different provider, also key-free)
            d = _get_json("https://wttr.in/%s,%s?format=j1" % (lat, lon))
            c = d["current_condition"][0]
            return {"temp_c": float(c["temp_C"]), "wind": float(c["windspeedKmph"]),
                    "precip": float(c["precipMM"]), "src": "wttr.in"}
    return _cached(key, ttl=900, fetch=_f)


def get_macro():
    """World industrial value-added growth (annual, % ) from the World Bank."""
    def _f():
        d = _get_json("https://api.worldbank.org/v2/country/WLD/indicator/"
                      "NV.IND.TOTL.KD.ZG?format=json&per_page=60", timeout=15)
        for row in d[1]:
            if row.get("value") is not None:
                return {"year": row["date"], "growth": round(row["value"], 1)}
        return {"year": None, "growth": None}
    return _cached("macro", ttl=86400, fetch=_f)


# ---------------------------------------------------------------------------
# Status / warm-up
# ---------------------------------------------------------------------------
def status():
    with _lock:
        return {k: dict(v) for k, v in _status.items()}


def any_live():
    with _lock:
        return any(v.get("ok") for v in _status.values())


def warm():
    """Pre-fetch all sources in parallel (called at server start + on a timer)."""
    fns = [get_quakes, get_carbon, get_fx, get_weather, get_macro]
    with ThreadPoolExecutor(max_workers=len(fns)) as ex:
        for fn in fns:
            ex.submit(fn)


def start_refresher(interval=120):
    """Background daemon: keep the cache warm so requests never block on the net."""
    def _loop():
        while True:
            try:
                warm()
            except Exception:
                pass
            time.sleep(interval)
    t = threading.Thread(target=_loop, daemon=True)
    t.start()
    return t


if __name__ == "__main__":
    warm()
    print(json.dumps({"status": status(), "quakes": (get_quakes() or [])[:3],
                      "carbon": get_carbon(), "fx": get_fx(),
                      "weather": get_weather(), "macro": get_macro()}, indent=2))

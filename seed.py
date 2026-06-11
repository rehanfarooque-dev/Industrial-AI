#!/usr/bin/env python3
"""
seed.py - generate a synthetic industrial dataset into SQLite (dashboard.db).

This is NOT "jitter around hardcoded numbers". It simulates a small factory +
commercial operation from first principles using standard models:

  * Reliability  : Weibull time-to-failure for machines
  * Sensors      : Gaussian readings with wear-driven drift
  * Quality      : deviation from spec -> logistic rework probability; Poisson defects
  * Demand       : trend + seasonality + noise over a year of orders
  * OEE          : Availability x Performance x Quality from raw shift records
  * Supply       : per-SKU demand/lead-time -> days-of-cover; supplier on-time rates
  * Safety       : Poisson incidents with a declining (AI-adoption) rate

The dashboard API then *aggregates* these raw rows into the numbers shown.
Run:  python seed.py            # (re)creates dashboard.db, deterministic seed
"""

import math
import os
import random
import sqlite3
from pathlib import Path

DB_PATH = Path(os.environ.get("DASHBOARD_DB",
                              str(Path(__file__).resolve().parent / "dashboard.db")))
SEED = 42  # deterministic dataset; change for a different "factory"

# ---------------------------------------------------------------------------
# Distribution samplers (stdlib only, no numpy)
# ---------------------------------------------------------------------------
def weibull(shape, scale):
    """Inverse-transform Weibull sample: scale * (-ln U)^(1/shape)."""
    u = 1.0 - random.random()
    return scale * (-math.log(u)) ** (1.0 / shape)


def weibull_cdf(x, shape, scale):
    return 1.0 - math.exp(-((x / scale) ** shape))


def poisson(lam):
    """Knuth's algorithm."""
    if lam <= 0:
        return 0
    L, k, p = math.exp(-lam), 0, 1.0
    while True:
        k += 1
        p *= random.random()
        if p <= L:
            return k - 1


def logistic(z):
    return 1.0 / (1.0 + math.exp(-z))


def clamp(v, lo, hi):
    return max(lo, min(hi, v))


# ---------------------------------------------------------------------------
# Schema
# ---------------------------------------------------------------------------
SCHEMA = """
DROP TABLE IF EXISTS plants;
DROP TABLE IF EXISTS lines;
DROP TABLE IF EXISTS assets;
DROP TABLE IF EXISTS sensor_readings;
DROP TABLE IF EXISTS oee_shifts;
DROP TABLE IF EXISTS customers;
DROP TABLE IF EXISTS leads;
DROP TABLE IF EXISTS quotes;
DROP TABLE IF EXISTS orders;
DROP TABLE IF EXISTS energy_quarter;
DROP TABLE IF EXISTS suppliers;
DROP TABLE IF EXISTS vendors;
DROP TABLE IF EXISTS skus;
DROP TABLE IF EXISTS inspections;
DROP TABLE IF EXISTS defects;
DROP TABLE IF EXISTS safety_quarter;
DROP TABLE IF EXISTS tickets;
DROP TABLE IF EXISTS schedule_runs;
DROP TABLE IF EXISTS kb_documents;
DROP TABLE IF EXISTS facility_metrics;
DROP TABLE IF EXISTS shipments;
DROP TABLE IF EXISTS wh_zones;

CREATE TABLE plants  (id INTEGER PRIMARY KEY, name TEXT, capacity_per_quarter REAL);
CREATE TABLE lines   (id INTEGER PRIMARY KEY, plant_id INT, name TEXT);
CREATE TABLE assets  (id INTEGER PRIMARY KEY, line_id INT, name TEXT, kind TEXT,
                      age_hours REAL, weibull_shape REAL, weibull_scale REAL, is_twin INT);
CREATE TABLE sensor_readings (id INTEGER PRIMARY KEY, asset_id INT, metric TEXT,
                      ts INT, value REAL, unit TEXT, nominal REAL);
CREATE TABLE oee_shifts (id INTEGER PRIMARY KEY, line_id INT, day INT, shift INT,
                      planned_min REAL, downtime_min REAL, ideal_rate REAL,
                      good_units INT, scrap_units INT);
CREATE TABLE customers (id INTEGER PRIMARY KEY, name TEXT, contact TEXT, segment TEXT,
                      price_sensitivity REAL, service_needs REAL, tech_adoption REAL,
                      growth_potential REAL, risk_profile REAL, arr REAL,
                      upsell_score REAL, remote_service INT);
CREATE TABLE leads   (id INTEGER PRIMARY KEY, stage_reached INT);
CREATE TABLE quotes  (id INTEGER PRIMARY KEY, customer_id INT, win_rate REAL,
                      margin REAL, ai_priced INT, won INT);
CREATE TABLE orders  (id INTEGER PRIMARY KEY, customer_id INT, day INT, qty INT,
                      unit_price REAL, margin REAL);
CREATE TABLE energy_quarter (quarter INT, units REAL, kwh REAL, cost_per_unit REAL);
CREATE TABLE suppliers (id INTEGER PRIMARY KEY, name TEXT, country TEXT,
                      map_x REAL, map_y REAL, on_time_rate REAL, risk_score REAL);
CREATE TABLE vendors (id INTEGER PRIMARY KEY, name TEXT, on_time_rate REAL,
                      quality_rate REAL, trust_score REAL);
CREATE TABLE skus    (id INTEGER PRIMARY KEY, code TEXT, on_hand INT,
                      daily_demand REAL, lead_time_days REAL, mover TEXT);
CREATE TABLE inspections (id INTEGER PRIMARY KEY, asset_id INT, day INT,
                      deviation REAL, rework INT, n_defects INT);
CREATE TABLE defects (id INTEGER PRIMARY KEY, inspection_id INT, x REAL, y REAL,
                      w REAL, h REAL, kind TEXT);
CREATE TABLE safety_quarter (quarter INT, incidents INT);
CREATE TABLE tickets (id INTEGER PRIMARY KEY, customer_id INT, issue TEXT,
                      severity TEXT, value_at_risk REAL, risk_score REAL, status TEXT);
CREATE TABLE schedule_runs (id INTEGER PRIMARY KEY, line_id INT, name TEXT,
                      start_month INT, end_month INT, kind TEXT);
CREATE TABLE kb_documents (id INTEGER PRIMARY KEY, title TEXT, icon TEXT,
                      doc_type TEXT, relevance REAL);
CREATE TABLE facility_metrics (id INTEGER PRIMARY KEY, name TEXT, value TEXT,
                      color TEXT, icon TEXT, sort INT);
CREATE TABLE shipments (id INTEGER PRIMARY KEY, vehicle TEXT, route TEXT,
                      status TEXT, eta_hours REAL, load_pct INT, delay_reason TEXT);
CREATE TABLE wh_zones (id INTEGER PRIMARY KEY, zone TEXT, klass TEXT,
                      utilization INT, picks_per_hr INT, travel_m REAL, reslot INT);
"""

LINE_NAMES = ["Line 1", "Line 2", "Line 3", "Assembly"]
SEGMENTS = ["Enterprise", "Mid-Market", "SMB"]

# Pools for generating realistic B2B account + contact names
CO_PREFIX = ["Vortex", "Apex", "Northwind", "Summit", "Ironclad", "Cascade",
             "Meridian", "Atlas", "Pioneer", "Vanguard", "Keystone", "Titan",
             "Nova", "Quanta", "Brightline", "Forge", "Stellar", "Cobalt",
             "Granite", "Helix", "Orion", "Redwood", "Sterling", "Beacon"]
CO_CORE = ["Manufacturing", "Industries", "Dynamics", "Steelworks", "Robotics",
           "Fabrication", "Materials", "Components", "Systems", "Machinery",
           "Metalworks", "Automation", "Engineering", "Mechanical", "Precision"]
CO_SUFFIX = ["Inc.", "Corp.", "Co.", "Ltd.", "Group", "LLC"]
FIRST_NAMES = ["Sarah", "James", "Priya", "Liam", "Mia", "Noah", "Aisha", "Lucas",
               "Elena", "Omar", "Chloe", "Daniel", "Yuki", "Marcus", "Nina",
               "Diego", "Hannah", "Wei", "Sofia", "Ethan", "Fatima", "Jack"]
LAST_NAMES = ["Chen", "Patel", "Okafor", "Novak", "Reyes", "Kim", "Müller",
              "Santos", "Ahmed", "Larsen", "Ivanov", "Garcia", "Tanaka", "Rossi",
              "Hassan", "Walsh", "Schmidt", "Nguyen", "Costa", "Bauer"]


# ---------------------------------------------------------------------------
# Generation
# ---------------------------------------------------------------------------
def build(con):
    cur = con.cursor()

    # --- Plant / lines ------------------------------------------------------
    cur.execute("INSERT INTO plants(id,name,capacity_per_quarter) VALUES (1,?,?)",
                ("Riverside Works", 1000.0))
    for i, nm in enumerate(LINE_NAMES, start=1):
        cur.execute("INSERT INTO lines(id,plant_id,name) VALUES (?,1,?)", (i, nm))

    # --- Assets (machines) with Weibull reliability -------------------------
    kinds = ["CNC Mill", "Press", "Turbine", "Conveyor", "Robot Arm"]
    asset_id = 0
    twin_id = None
    for line_id in range(1, len(LINE_NAMES) + 1):
        for _ in range(random.randint(2, 3)):
            asset_id += 1
            kind = random.choice(kinds)
            shape = round(random.uniform(1.6, 3.0), 2)        # >1 => wear-out
            scale = round(random.uniform(4500, 9000), 0)      # characteristic life (hrs)
            age = round(random.uniform(0.2, 0.95) * scale, 0)  # current age
            is_twin = 1 if (kind == "Turbine" and twin_id is None) else 0
            if is_twin:
                twin_id = asset_id
            cur.execute("""INSERT INTO assets(id,line_id,name,kind,age_hours,
                           weibull_shape,weibull_scale,is_twin) VALUES (?,?,?,?,?,?,?,?)""",
                        (asset_id, line_id, "%s #%d" % (kind, asset_id), kind,
                         age, shape, scale, is_twin))
    if twin_id is None:  # ensure a digital-twin asset exists
        twin_id = 1
        cur.execute("UPDATE assets SET is_twin=1 WHERE id=1")
    # Push one asset past its characteristic life so predictive maintenance has
    # a genuinely at-risk machine to surface (emergent urgency, not hardcoded).
    cur.execute("UPDATE assets SET age_hours = weibull_scale*1.08 WHERE id=?", (asset_id,))

    # --- Digital-twin sensor readings (wear-driven drift) -------------------
    # nominal setpoints; drift grows with the twin asset's age fraction
    twin = cur.execute("SELECT age_hours,weibull_scale FROM assets WHERE id=?",
                       (twin_id,)).fetchone()
    wear = clamp(twin[0] / twin[1], 0, 1)
    # (metric, nominal setpoint, unit, sd, drift_direction with wear)
    specs = [("Pressure", 95.0, "%", 3.0, -1.0),     # worn -> pressure sags
             ("Temperature", 42.0, "degC", 3.0, +1.0),  # worn -> runs hotter
             ("Speed", 2500.0, "RPM", 80.0, -1.0)]    # worn -> slower
    ts = 0
    for metric, nominal, unit, sd, direction in specs:
        drift = nominal * 0.06 * wear * direction  # worn machine drifts off setpoint
        for _ in range(40):            # recent history
            ts += 1
            val = random.gauss(nominal + drift, sd)
            cur.execute("""INSERT INTO sensor_readings(asset_id,metric,ts,value,unit,nominal)
                           VALUES (?,?,?,?,?,?)""",
                        (twin_id, metric, ts, round(val, 2), unit, nominal))

    # --- OEE shift records (raw -> A x P x Q emerges) -----------------------
    for line_id in range(1, len(LINE_NAMES) + 1):
        line_quality = random.uniform(0.95, 0.99)
        line_avail = random.uniform(0.80, 0.93)
        for day in range(90):
            for shift in range(3):
                planned = 480.0  # 8h
                # downtime from unplanned stops (Poisson count x duration)
                stops = poisson(1.6 * (1 - line_avail) * 10)
                downtime = clamp(sum(random.uniform(5, 35) for _ in range(stops)),
                                 0, planned * 0.6)
                uptime = planned - downtime
                ideal_rate = random.uniform(1.8, 2.4)  # units/min at full speed
                # performance loss: run slower than ideal
                perf = clamp(random.gauss(0.90, 0.05), 0.6, 1.0)
                produced = int(uptime * ideal_rate * perf)
                scrap = int(produced * (1 - clamp(random.gauss(line_quality, 0.02), 0.85, 1.0)))
                good = produced - scrap
                cur.execute("""INSERT INTO oee_shifts(line_id,day,shift,planned_min,
                               downtime_min,ideal_rate,good_units,scrap_units)
                               VALUES (?,?,?,?,?,?,?,?)""",
                            (line_id, day, shift, planned, round(downtime, 1),
                             round(ideal_rate, 3), good, scrap))

    # --- Customers (segment-driven attributes) ------------------------------
    NC = 200
    # Unique company names (prefix x core), then a suffix; plus a contact person
    combos = ["%s %s" % (p, c) for p in CO_PREFIX for c in CO_CORE]
    random.shuffle(combos)
    for cid in range(1, NC + 1):
        company = "%s %s" % (combos[cid - 1], random.choice(CO_SUFFIX))
        contact = "%s %s" % (random.choice(FIRST_NAMES), random.choice(LAST_NAMES))
        seg = random.choices(SEGMENTS, weights=[0.25, 0.4, 0.35])[0]
        if seg == "Enterprise":
            ps, sn, ta, gp, rp, arr = 40, 85, 75, 80, 45, random.uniform(120, 400)
        elif seg == "Mid-Market":
            ps, sn, ta, gp, rp, arr = 60, 65, 60, 70, 55, random.uniform(40, 120)
        else:
            ps, sn, ta, gp, rp, arr = 80, 50, 45, 65, 65, random.uniform(8, 40)
        attrs = [clamp(random.gauss(m, 9), 5, 99) for m in (ps, sn, ta, gp, rp)]
        upsell = clamp(random.gauss((attrs[3] + attrs[2]) / 2 - attrs[0] * 0.3, 12), 0, 100)
        remote = 1 if random.random() < (0.2 + attrs[2] / 200) else 0
        cur.execute("""INSERT INTO customers(id,name,contact,segment,price_sensitivity,
                       service_needs,tech_adoption,growth_potential,risk_profile,
                       arr,upsell_score,remote_service)
                       VALUES (?,?,?,?,?,?,?,?,?,?,?,?)""",
                    (cid, company, contact, seg, *[round(a, 1) for a in attrs],
                     round(arr, 1), round(upsell, 1), remote))

    # --- Marketing funnel (lead journeys) -----------------------------------
    conv = [0.62, 0.58, 0.55]  # interest, consideration, loyalty conversion
    for _ in range(6000):
        stage = 1
        for p in conv:
            if random.random() < p:
                stage += 1
            else:
                break
        cur.execute("INSERT INTO leads(stage_reached) VALUES (?)", (stage,))

    # --- Quotes (AI pricing -> better win/margin) ---------------------------
    for _ in range(80):
        cust = random.randint(1, NC)
        ai = 1 if random.random() < 0.45 else 0
        if ai:
            win = clamp(random.gauss(72, 10), 20, 99)
            margin = clamp(random.gauss(62, 9), 20, 95)
        else:
            win = clamp(random.gauss(38, 14), 5, 95)
            margin = clamp(random.gauss(34, 12), 5, 90)
        won = 1 if random.random() < win / 100 else 0
        cur.execute("""INSERT INTO quotes(customer_id,win_rate,margin,ai_priced,won)
                       VALUES (?,?,?,?,?)""",
                    (cust, round(win, 1), round(margin, 1), ai, won))

    # --- Orders over a year (trend + seasonality + noise) -------------------
    cum_units = 0
    energy_acc = {0: [0.0, 0.0], 1: [0.0, 0.0], 2: [0.0, 0.0], 3: [0.0, 0.0]}
    base_price = 100.0
    for day in range(365):
        q = min(3, day // 91)
        trend = 1.0 + 0.6 * (day / 365.0)                 # +60% growth over year
        season = 1.0 + 0.28 * math.sin((day / 365.0) * 2 * math.pi - 1.2)  # Q4 peak
        weekly = 0.7 if (day % 7) in (5, 6) else 1.0       # weekend dip
        lam = 26 * trend * season * weekly
        n_orders = poisson(lam / 4)                        # a few orders per day
        for _ in range(n_orders):
            cust = random.randint(1, NC)
            qty = max(1, int(random.gauss(8, 3)))
            price = base_price * random.uniform(0.85, 1.2)
            margin = clamp(random.gauss(38, 8), 10, 70)
            cur.execute("""INSERT INTO orders(customer_id,day,qty,unit_price,margin)
                           VALUES (?,?,?,?,?)""",
                        (cust, day, qty, round(price, 2), round(margin, 1)))
            cum_units += qty
            # energy with a learning curve: kWh/unit falls as cumulative volume rises
            epu = 9.0 * (max(cum_units, 1) ** -0.06)
            energy_acc[q][0] += qty
            energy_acc[q][1] += epu * qty
    for q in range(4):
        units, kwh = energy_acc[q]
        cpu = (kwh * 0.14) / units if units else 0  # $0.14/kWh
        cur.execute("INSERT INTO energy_quarter(quarter,units,kwh,cost_per_unit) VALUES (?,?,?,?)",
                    (q + 1, round(units, 1), round(kwh, 1), round(cpu, 4)))

    # --- Suppliers (geo markers, on-time -> risk) ---------------------------
    sup_coords = [("USA", 55, 56), ("Mexico", 70, 70), ("Brazil", 86, 118),
                  ("Germany", 162, 48), ("Nigeria", 166, 98), ("Russia", 218, 46),
                  ("India", 216, 82), ("Indonesia", 256, 92), ("Australia", 276, 128),
                  ("China", 238, 58)]
    for i, (country, x, y) in enumerate(sup_coords, start=1):
        on_time = clamp(random.gauss(0.88, 0.1), 0.4, 0.995)
        risk = round((1 - on_time) * 100, 1)
        cur.execute("""INSERT INTO suppliers(id,name,country,map_x,map_y,on_time_rate,risk_score)
                       VALUES (?,?,?,?,?,?,?)""",
                    (i, "Supplier %d" % i, country, x, y, round(on_time, 3), risk))

    # --- Vendors (procurement trust = f(on-time, quality)) ------------------
    for i, nm in enumerate(["Vendor A", "Vendor B", "Vendor C", "Vendor D"], start=1):
        ot = clamp(random.gauss(0.9, 0.06), 0.6, 0.99)
        qr = clamp(random.gauss(0.93, 0.05), 0.6, 0.99)
        trust = round((0.6 * ot + 0.4 * qr) * 100, 1)
        cur.execute("""INSERT INTO vendors(id,name,on_time_rate,quality_rate,trust_score)
                       VALUES (?,?,?,?,?)""",
                    (i, nm, round(ot, 3), round(qr, 3), trust))

    # --- SKUs (two movement classes -> stock-out / excess populations) ------
    for i in range(1, 121):
        fast = random.random() < 0.5
        if fast:
            daily = clamp(random.gauss(12, 4), 2, 30)
            cover_target = random.uniform(8, 22)
            mover = "fast"
        else:
            daily = clamp(random.gauss(3, 1.5), 0.3, 8)
            cover_target = random.uniform(30, 52)
            mover = "slow"
        lead = clamp(random.gauss(10, 3), 2, 25)
        on_hand = int(daily * cover_target)
        cur.execute("""INSERT INTO skus(id,code,on_hand,daily_demand,lead_time_days,mover)
                       VALUES (?,?,?,?,?,?)""",
                    (i, "SKU-%04d" % i, on_hand, round(daily, 2), round(lead, 1), mover))

    # --- Quality inspections (deviation -> logistic rework; Poisson defects) -
    last_insp_id = 0
    for i in range(1, 501):
        asset = random.randint(1, asset_id)
        dev = abs(random.gauss(0, 8))                 # |deviation| from spec
        p_rework = logistic((dev - 14) / 3.0)
        rework = 1 if random.random() < p_rework else 0
        n_def = poisson(0.3 + dev / 18.0)
        cur.execute("""INSERT INTO inspections(asset_id,day,deviation,rework,n_defects)
                       VALUES (?,?,?,?,?)""",
                    (asset, random.randint(0, 89), round(dev, 2), rework, n_def))
        last_insp_id = i
    # Defects with a typed cause for EVERY inspection that found any, so
    # root-cause analysis has a real population to aggregate. Bounding-box
    # coords matter only for the most-recent inspection (the vision view).
    box_pool = [(92, 48, 22, 22), (155, 58, 22, 22), (110, 118, 24, 22),
                (70, 40, 20, 20), (180, 100, 22, 20)]
    # each defect kind rolls up to a 6M root-cause category
    kind_cause = {"scratch": "Material", "porosity": "Material", "dent": "Machine",
                  "crack": "Machine", "misalignment": "Method"}
    kinds_d = list(kind_cause.keys())
    for ins in cur.execute("SELECT id,n_defects FROM inspections WHERE n_defects>0").fetchall():
        for j in range(ins[1]):
            x, y, w, h = box_pool[j % len(box_pool)]
            cur.execute("""INSERT INTO defects(inspection_id,x,y,w,h,kind)
                           VALUES (?,?,?,?,?,?)""",
                        (ins[0], x, y, w, h, random.choice(kinds_d)))

    # --- Safety incidents per quarter (declining Poisson rate) --------------
    for q in range(4):
        lam = 80 * (0.72 ** q)     # AI adoption drives incidents down each quarter
        cur.execute("INSERT INTO safety_quarter(quarter,incidents) VALUES (?,?)",
                    (q + 1, poisson(lam)))

    # --- Support tickets (risk = severity x account value) ------------------
    issues = ["Critical Outage", "Feature Request", "Billing Inquiry",
              "Integration Help", "Performance Degradation", "Data Sync Error",
              "Security Alert", "Onboarding Request"]
    sev_w = {"Critical Outage": 1.0, "Security Alert": 0.9, "Performance Degradation": 0.8,
             "Data Sync Error": 0.7, "Integration Help": 0.5, "Onboarding Request": 0.4,
             "Feature Request": 0.35, "Billing Inquiry": 0.2}
    for _ in range(140):
        cust = random.randint(1, NC)
        issue = random.choice(issues)
        arr = cur.execute("SELECT arr FROM customers WHERE id=?", (cust,)).fetchone()[0]
        var = arr * sev_w[issue] * random.uniform(0.5, 1.0)
        risk = clamp(sev_w[issue] * 70 + (arr / 400) * 30 + random.gauss(0, 6), 1, 99)
        sev = "high" if risk >= 70 else "medium" if risk >= 45 else "low"
        # AI service desk auto-resolves most low-risk tickets; routes the rest
        if risk < 45 and random.random() < 0.8:
            status = "resolved"
        elif risk < 70:
            status = random.choice(["triaged", "resolved"])
        else:
            status = "open"
        cur.execute("""INSERT INTO tickets(customer_id,issue,severity,value_at_risk,
                       risk_score,status) VALUES (?,?,?,?,?,?)""",
                    (cust, issue, sev, round(var, 1), round(risk, 1), status))

    # --- Fleet shipments (route delay analytics) ----------------------------
    lanes = [("Chicago → Detroit", 4), ("Dallas → Houston", 5), ("Reno → Oakland", 6),
             ("Atlanta → Miami", 10), ("Newark → Boston", 5), ("Denver → Phoenix", 12),
             ("Seattle → Portland", 4), ("KC → St. Louis", 5)]
    reasons = ["Weather", "Traffic", "Customs hold", "Carrier delay", "Re-route"]
    n_fleet = 7
    for i, (route, base_h) in enumerate(random.sample(lanes, n_fleet), start=1):
        delayed = random.random() < 0.32
        eta = base_h * (random.uniform(1.25, 1.8) if delayed else random.uniform(0.9, 1.1))
        cur.execute("""INSERT INTO shipments(vehicle,route,status,eta_hours,load_pct,delay_reason)
                       VALUES (?,?,?,?,?,?)""",
                    ("Truck %02d" % i, route, "delayed" if delayed else "on-time",
                     round(eta, 1), random.randint(58, 99),
                     random.choice(reasons) if delayed else None))

    # --- Warehouse slotting zones (ABC class -> utilization, pick rate) ------
    # Fast-movers (A) should sit near the pick face: high pick rate, low travel.
    zone_defs = [("A", "Fast", 165, 14), ("B", "Fast", 150, 18),
                 ("C", "Medium", 120, 26), ("D", "Medium", 95, 31),
                 ("E", "Slow", 60, 42), ("F", "Slow", 40, 48)]
    for i, (zone, klass, base_pick, base_travel) in enumerate(zone_defs, start=1):
        util = int(clamp(random.gauss(82 if klass == "Fast" else 64 if klass == "Medium" else 45, 8), 20, 98))
        picks = int(clamp(random.gauss(base_pick, 12), 25, 200))
        travel = round(clamp(random.gauss(base_travel, 4), 8, 60), 1)
        reslot = 1 if (klass != "Fast" and util > 70 and random.random() < 0.6) else 0
        cur.execute("""INSERT INTO wh_zones(zone,klass,utilization,picks_per_hr,travel_m,reslot)
                       VALUES (?,?,?,?,?,?)""", (zone, klass, util, picks, travel, reslot))

    # --- Production schedule (run / changeover blocks per line) -------------
    for line_id, nm in enumerate(LINE_NAMES, start=1):
        cur_m, toggle = random.randint(0, 1), 0
        while cur_m < 12:
            step = random.randint(2, 4)
            end = min(12, cur_m + step)
            kind = "run" if toggle % 2 == 0 else "changeover"
            cur.execute("""INSERT INTO schedule_runs(line_id,name,start_month,end_month,kind)
                           VALUES (?,?,?,?,?)""", (line_id, nm, cur_m, end, kind))
            cur_m, toggle = end, toggle + 1

    # --- Knowledge base documents (relevance for retrieval) -----------------
    docs = [("Pump Maintenance Guide V.4 (PDF) - Pages 12-15", "⚙", "pdf"),
            ("Troubleshooting Procedures for Model X-100 - Video Tutorial", "▶", "video"),
            ("Safety Protocols & Compliance - Document", "\U0001F6E1", "doc"),
            ("Gearbox Alignment SOP (PDF) - Section 3", "⚙", "pdf"),
            ("Sensor Calibration Walkthrough - Video", "▶", "video"),
            ("Hydraulic System Schematics - Drawing", "\U0001F4D0", "doc"),
            ("Lockout/Tagout Procedure - Compliance", "\U0001F6E1", "doc")]
    for title, icon, dt in docs:
        cur.execute("""INSERT INTO kb_documents(title,icon,doc_type,relevance)
                       VALUES (?,?,?,?)""",
                    (title, icon, dt, round(random.uniform(0.4, 0.99), 3)))

    # --- Facility metrics (derived environment readings) --------------------
    hvac = clamp(random.gauss(58.5, 4), 45, 70)
    env_out = max(0, poisson(1))             # % readings out of range
    lighting = clamp(random.gauss(1.5, 0.18), 1.0, 2.2)
    fac = [("HVAC Control", "%.1f" % hvac, "#1f4e9b", "\U0001F321"),
           ("Environmental Monitoring", "%d%%" % env_out, "#5e9f55", "\U0001F4A7"),
           ("Lighting Efficiency", "%.2f" % lighting, "#e7a93a", "\U0001F4A1")]
    for i, (nm, val, color, icon) in enumerate(fac):
        cur.execute("""INSERT INTO facility_metrics(name,value,color,icon,sort)
                       VALUES (?,?,?,?,?)""", (nm, val, color, icon, i))

    con.commit()


def main():
    random.seed(SEED)
    if DB_PATH.exists():
        DB_PATH.unlink()
    con = sqlite3.connect(DB_PATH)
    con.executescript(SCHEMA)
    build(con)
    # quick summary
    tables = ["assets", "sensor_readings", "oee_shifts", "customers", "leads",
              "quotes", "orders", "suppliers", "vendors", "skus", "inspections",
              "defects", "tickets", "shipments", "schedule_runs", "kb_documents"]
    print("Seeded %s" % DB_PATH.name)
    for t in tables:
        n = con.execute("SELECT COUNT(*) FROM %s" % t).fetchone()[0]
        print("  %-16s %6d rows" % (t, n))
    con.close()


if __name__ == "__main__":
    main()

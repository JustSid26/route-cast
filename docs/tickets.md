# Stuff to pick up

A couple of things that are ready to go — grab whichever one you fancy. Both are
pretty self-contained. Branch off main, open a PR when you're ready, let CI run,
and I'll review.

---

## 1. Let people upload their own "usual route"

Right now the "optimized vs usual" comparison is a bit of a cheat — the "usual"
route is just the deliveries in the order they were added, and we pretend that's
how they'd normally drive. Fine for a demo, but the real pitch is *"here's how
**you** drive today vs what we'd do instead."*

So let's let them upload their actual route as a CSV and use that as the baseline.

The good news is most of the plumbing already exists — the baseline has a `source`
field (`mock` vs `uploaded`), and the map + savings panel already draw whatever's
sitting in `analysis.baseline`. So really it's:

- an endpoint that takes a CSV of stops in order, matches them to the job's
  deliveries, runs them through the *same* distance/time matrix (so the numbers
  are comparable), grabs the road geometry, and saves it as the baseline with
  `source: 'uploaded'`
- a small "upload usual route" button on the map page
- pick a sensible CSV format — probably `sequence,delivery_id`, or
  `sequence,customer_name,latitude,longitude`

It's done when you can upload a route for a finished job and the map + savings
flip to comparing against it (and the little "(estimated)" tag disappears).

Worth poking around `routeService.ts` and `csvService.ts` — there's already a CSV
importer you can lean on. One heads-up: this changes the API a bit (CONTRACT.md +
the shared types), so give me a shout before you lock that down so we don't step on
each other — easiest if we agree on the shape first.

---

## 2. Printable route sheet for each driver

We can already dump one big CSV of everything, but what drivers actually want is a
clean sheet *per truck* — where to leave from, the stops in order, the totals —
something they can print or pull up on their phone.

So: a per-vehicle export. A PDF (jspdf works, or honestly just a print-friendly
page) and an Excel/xlsx version. Each sheet is one truck: vehicle name, depot, the
numbered stops with customer/address/weight, and the totals at the bottom. Drop a
download button next to each vehicle on both the Optimize results and the map.

Done = one PDF and one spreadsheet per truck, opens cleanly, stops in the right
order.

There's already a CSV builder in `frontend/src/lib/export.ts` you can build on.
Only thing to watch: you'll be adding a dependency, so you'll touch package.json —
just own that file for this PR and we won't clash.

---

A few ground rules so merging stays painless:

- one branch per task — `feature/upload-usual-route`, `feature/driver-sheets`
- keep PRs small, rebase on main before you push
- shout before touching CONTRACT.md or package.json
- new DB change? add a new migration file, don't edit an old one

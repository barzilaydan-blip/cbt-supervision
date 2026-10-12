---
version: 1
slug: "src-pages-supervisionsessionpage-jsx"
primary_target: "src/pages/SupervisionSessionPage.jsx"
related_targets: ["src/App.jsx","src/index.css"]
---

# Supervision meeting screen

Scope: `src/pages/SupervisionSessionPage.jsx` and the app shell it sits in. Visitor mode: Operate.

Audience and job: the supervisor, during a Zoom or in-person supervision meeting, typing while listening. He needs the current patient's fields, and what was agreed last time, without searching.

Constraints: Hebrew RTL, desktop. Logo and the name/title header lines are binding. Clinical data is sensitive; demo data must be synthetic.

## Direction contract

THESIS: Continuity between meetings is visible as space. A fixed date rail keeps the previous meeting attached to today's entry. Refused: the card dashboard where "last session" is one collapsible card among others.

OWN-WORLD: The clinic's yearly appointment diary. Deep blue-green cover (#14353d) for the patient rail, white pages on a cool tinted ground (#eef3f4), ruling lines in the logo's sky blue (#9cc9ea), an amber ribbon (#e0a323) reserved for today and the active patient, red (#c2362b) for risk only. One family, Heebo, five sizes, tabular numerals for every date. Text labels, no emoji, no icon tiles.

STORY: He opens the meeting, sees who is on the list and which patients carry a risk flag, picks a patient, reads "follow up today" from the previous entry, and types.

FIRST VIEWPORT: Header 64px: logo, name and title. Below, three columns: patient rail 232px at the inline start on the cover colour, with meeting name and date on top; work area with patient name, sequence number, record and finish buttons, profile line, three writing fields, tags; date rail 392px at the inline end with today marked and the previous meeting open. Primary action, "finish meeting and save", sits top of the work area.

FORM: Appointment diary, candidate 7 of 7 on the grounded list. Seed key 00acdeba. Signature move: the date rail with sequentially numbered supervisions. Raises: tabular aligned dates; sequential numbering per patient; one colour reserved for the current; one family in five steps; no pale grey text; one patient owns the screen.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

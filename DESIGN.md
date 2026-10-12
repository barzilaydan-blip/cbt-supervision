---
name: מעקב הדרכות CBT
description: A supervisor's diary of CBT supervisions; continuity between meetings shown on a date rail.
colors:
  cover: "#14353d"
  cover-2: "#1d4650"
  cover-ink: "#e6eff1"
  cover-ink-2: "#a9c3c9"
  ground: "#eef3f4"
  page: "#ffffff"
  ink: "#132a30"
  ink-2: "#44595f"
  line: "#cfdadd"
  border: "#b9c9cd"
  rule: "#9cc9ea"
  rule-soft: "#d9eaf6"
  today: "#e0a323"
  today-ink: "#2b1f00"
  today-text: "#8a6208"
  risk: "#c2362b"
  risk-soft: "#fbeceb"
  risk-on-cover: "#ffaea6"
  risk-2: "#a82c22"
  scrim: "rgba(19, 42, 48, 0.5)"
typography:
  title:
    fontFamily: "'Heebo Variable', Heebo, Arial, sans-serif"
    fontSize: "1.625rem"
    fontWeight: 700
    lineHeight: 1.2
  date:
    fontFamily: "'Heebo Variable', Heebo, Arial, sans-serif"
    fontSize: "1.375rem"
    fontWeight: 700
    lineHeight: 1.15
  heading:
    fontFamily: "'Heebo Variable', Heebo, Arial, sans-serif"
    fontSize: "1.0625rem"
    fontWeight: 700
    lineHeight: 1.35
  body:
    fontFamily: "'Heebo Variable', Heebo, Arial, sans-serif"
    fontSize: "0.9375rem"
    fontWeight: 400
    lineHeight: 1.55
  field:
    fontFamily: "'Heebo Variable', Heebo, Arial, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.55
  small:
    fontFamily: "'Heebo Variable', Heebo, Arial, sans-serif"
    fontSize: "0.8125rem"
    fontWeight: 400
    lineHeight: 1.5
rounded:
  xs: "4px"
  sm: "8px"
  md: "10px"
  lg: "14px"
  pill: "99px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "20px"
  xl: "28px"
components:
  button-primary:
    backgroundColor: "{colors.cover}"
    textColor: "{colors.page}"
    typography: "{typography.body}"
    rounded: "{rounded.sm}"
    padding: "9px 18px"
  button-primary-hover:
    backgroundColor: "{colors.cover-2}"
  button-secondary:
    backgroundColor: "{colors.page}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sm}"
    padding: "9px 18px"
  button-secondary-hover:
    backgroundColor: "{colors.ground}"
  field:
    backgroundColor: "{colors.page}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sm}"
    padding: "10px 12px"
  chip:
    backgroundColor: "{colors.page}"
    textColor: "{colors.ink-2}"
    typography: "{typography.small}"
    rounded: "{rounded.pill}"
    padding: "5px 13px"
  chip-checked:
    backgroundColor: "{colors.cover}"
    textColor: "{colors.page}"
  sheet:
    backgroundColor: "{colors.page}"
    rounded: "{rounded.md}"
    padding: "16px 20px"
  patient-rail:
    backgroundColor: "{colors.cover}"
    textColor: "{colors.cover-ink}"
    width: "232px"
---

# Design System: מעקב הדרכות CBT

## Overview

**Creative North Star: "The supervision diary"**

The app is one supervisor's working diary. Its visual world is the clinic's yearly appointment diary: a deep blue-green cover, white pages on a cool ground, ruling lines in the sky blue of the logo, and an amber ribbon that marks today. The world lends type, palette, density and one signature move. Layout, navigation and controls stay the standard ones of a web product.

The signature move is the date rail: a vertical ruled line with dated, sequentially numbered supervisions hanging on it. It appears on the meeting screen (the previous meeting stays open next to today's entry), on the patient page (the whole history) and in the exported PDF.

Three surfaces face other people and open with the same letterhead (logo, name, title, a rule in the logo's blue): the public conceptualization form, the PDFs, and the email templates in `email-templates/`.

The interface is Hebrew, right to left, and built for a desktop window that often sits beside a Zoom call.

## Colors

Restrained pages inside a committed shell. Colour does jobs; none of it is decoration.

- **cover / cover-2**: the patient rail on the meeting screen, primary buttons, the login ground, dark dialog headers. `cover-2` is the hover and the selected row on the cover.
- **ground / page**: the app background and the white sheets that sit on it.
- **ink / ink-2**: text. `ink-2` is the only secondary text colour and passes 4.5:1 on white. There is no paler grey.
- **line / border**: sheet outlines and input borders.
- **rule / rule-soft**: the date rail, the letterhead rule, row dividers, focus glow and selection. These come from the logo.
- **today**: reserved for today's entry on the rail and the patient currently on screen. Never used for anything else.
- **risk**: reserved for risk flags and destructive actions.

## Typography

One family, Heebo (self-hosted through `@fontsource-variable/heebo`), in five sizes: 13, 15, 17, 22 and 26 px. Text the user types (fields, inputs) is set at 16px so it stays comfortable to write in. Weights 400, 500 and 700. Dates and counts use tabular numerals so they align on the rail and in lists. Dates read `DD.MM` with the year beneath on the rail, and `DD.MM.YYYY` in running text.

## Layout

- **Meeting screen**: three columns under a 65px header: patient rail 232px, work area, date rail 392px. At 1440x900 the three writing fields and the tags fit without scrolling. Below 1180px the date rail moves under the work area; below 720px everything stacks.
- **List pages** (home, therapist, patient, materials): a 900px column. A page head (back link, title, one line of facts, actions with the primary action last), then sheets and ruled lists.
- **Documents** (form, PDF, email): a single column up to 720px that starts with the letterhead.

## Elevation & Depth

Flat. Sheets are separated from the ground by a 1px line, not by shadow. Shadow is used only for dialogs over a scrim.

## Shapes

Radius 4px on small marks (the "today" ribbon, skeleton bars), 8px on controls, 10px on sheets, 14px on dialogs, full pills for tags. No side-stripe accents on cards or rows: the active patient is marked by an amber dot, a risk by red text.

## Components

- **Buttons**: primary (cover), secondary (white with border), and text links for row actions. Every button scales to 0.97 on press. One primary action per screen.
- **Ruled list**: one sheet, one row per person or item, divided by `rule-soft`. The name is the link and its hit area covers the row; row actions are text links.
- **Date rail**: `.sup-days` / `.sup-day`. A 64px date column, the ruled line with a dot per entry, and the entry body. Today's dot is amber.
- **Tag chips**: real checkboxes with a pill face. Checked is cover-coloured; the risk chip is red.
- **Fields**: white, 1px border, focus shows a cover border with a `rule-soft` glow.
- **Loading**: skeleton bars in `rule-soft`, shaped like the content, instead of spinners inside content.
- **Text labels, no icons**: controls are named in words. There is no emoji and no icon set.

## Do's and Don'ts

### Do:
- **Do** keep the previous meeting visible wherever the supervisor writes about a patient.
- **Do** show real facts in lists (count, last date, risk) instead of filler such as "click to view".
- **Do** number supervisions per patient, oldest first, wherever they appear.
- **Do** start anything a therapist sees with the letterhead.

### Don't:
- **Don't** use amber for anything except today and the active patient, or red for anything except risk and deletion.
- **Don't** add emoji, icon tiles, gradients, or coloured side stripes.
- **Don't** add a second typeface or a size outside the five steps.
- **Don't** put real patient data in demos, screenshots or examples. Demo data is synthetic and labelled.
- **Don't** change the logo or the two header lines ("דן ברזילי, פסיכולוג חינוכי", "מומחה ומדריך בטיפול ב- CBT").

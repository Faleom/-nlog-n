# F.026 — Demo, Video & Submission

**Cross-cutting · owned from the start** · Owner: **P3** · Reviewer: P4 · Status: Not started

## What
The deliverable. §16.4 names this **the task most likely to be quietly dropped
while the build is going well** — so it has an owner from day one, not from
Monday morning.

P3 moves to this **the moment Branch 2 (F.015) is done**, per §16.4.

## Depends on / Blocks
Depends on F.008 at minimum. Blocks submission — which is the whole project.

## Done when

**Demo (§18)**
- One response profile end-to-end: **calm / sameness / minimal words**.
- **Branch 1, Game 1 is the live demo.** Branch 2 is a walkthrough with a
  hardcoded example.
- Pre-captured My World library so lighting isn't a live risk — **but take at
  least one live photo** to prove the pipeline is real.
- **The profile-swap moment**: change the Companion, the whole app changes.
  Four seconds, proves the architecture.
- **Deliberately tap wrong twice** to show the prompt hierarchy. More persuasive
  than any slide about design philosophy (§7.7).
- Film on a tablet; mention phone parity; phone open on a second device.
- **Only fictional or team-member data.** Never a real child's photo or profile.
- **Show a caregiver and child together**, never a child alone with a device.
- Rehearse twice before recording.

**Failure paths tested before the demo, not during (§11)**
Recognition returns nothing · recognition slow · no internet at capture ·
face-blur fails · face in a Companion photo · guardrail check fails · camera
permission denied · rotation mid-session · **API outage → pre-seeded object set
+ hardcoded skill mappings**.

**Submission (§20)**
- Description: problem, solution, construction method · Track: **Accessible
  Education** · Video **under 3 minutes** showing it working · public **GitHub**
  link · AI-assisted development disclosed, plus libraries/assets/datasets ·
  first-year team flag if applicable · all code written inside the window ·
  project name chosen.
- **Record the video early, not at the end. Submit early, not on the deadline.**

## Review checklist
- [ ] Does the demo path run twice start to finish without a reset?
- [ ] Was the API-outage fallback actually exercised?
- [ ] Any real child's data anywhere in build or video?
- [ ] Is the privacy claim worded per §14 — *faces blurred before anything is
      sent, photo discarded, only the toy persists*? **Never "photos never leave
      the device."**
- [ ] Video under 3 minutes, opens with the **barrier** not the product?
- [ ] Is the project positioned as a **complement** to therapy, never a
      replacement?
- [ ] Commit history frequent and visible — organisers may inspect it.

## Not in this file
No new features. No last-minute engine changes to make the demo smoother.
**Never claim therapeutic outcomes** — "designed on principles from NDBI and
special-education research", never "clinically proven" (§13).

## Guide refs
§11, §14, §16.4, §18, §19, §20

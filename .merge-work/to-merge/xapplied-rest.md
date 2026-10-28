# Cross-section items applied — remaining groups (cloud session, 28 Oct 2026)

Covers every cross-section block whose target is outside `Hand/` (Hand targets: see `xapplied-hand.md`).
Sources: `## CROSS-SECTION` of log-Foot & Ankle, log-Knee & Sports, log-Pathology, log-Pediatrics (= xsec-Pediatrics, applied once), log-Recon, log-Spine, log-Trauma; `xs-Hand.md` (= log-Hand CROSS-SECTION); `se-work/cross.md` (= log-Shoulder & Elbow CROSS-SECTION). log-Basic Science has none.
Dedupe: each block was checked line by line against its target (exact match, then fuzzy token overlap, then grep of key terms) before insertion.

## Already in place before this pass (applied by the earlier, stopped appliers or by the target's own section agent)
- Trauma/Ankle Fractures, Calcaneus Fractures, Tibial Plafond Fractures — all F&A blocks
- Basic Science/Rheumatoid Arthritis (Pathology blocks), Rickets, Embryology (limb bud timeline; limb axes)
- Pediatrics/Hip Septic Arthritis — all Pathology blocks (lines merged in reworded form)
- Pediatrics/Tarsal Coalition, Congenital Vertical Talus, Flexible Pes Planovalgus, Cavovarus Foot
- Recon/Hip Osteonecrosis; Spine/Ankylosing Spondylitis (Schober, SI tests, AS drugs)
- Basic Science/Tendons — metabolism line; O₂-consumption question

## Applied in this pass
### Trauma
- Talar Neck Fractures — deltoid artery 70%, aviator's fracture, CT for medial comminution, dual-approach landmarks, fixation by comminution, infection in open fractures, absent Hawkins → MRI at 12 wk, 2 How-it's-asked. Conflicts: medial malleolar osteotomy (neck vs body only), lateral screw mode, arthritis rates, commonest complication.
- Talus Fracture (other than neck) — large fix / small excise. Skipped duplicates: sprain misdiagnosis, mechanism.
- Necrotizing Fasciitis — type 3 fungal (conflict), spread pattern, clinical clues, finger test, LRINEC risk table (+ conflict on 6–7), grey fascia, mortality factors. Skipped: bedside biopsy (frozen section already there).
- Brachial Plexus Injuries — traction / compression / Erb's point blow, MRI as preferred initial imaging, Somsak, pedicled muscle transfers. Skipped: Mackinnon (= Oberlin double fascicular).
- Distal Radius Fractures — three-column concept, ARMS, extra-parameter table, Thomas / Fernandez / AO tables, Mayo, Frykman, chauffeur mechanism, TO instability list, DRUJ-with-DRF table.
- Olecranon Fractures — Mayo table, angles (PUDA), operative indications, TBW / IM screw / plate lines. Conflicts: excision size (< 50% vs < 75%), triceps reattachment site.
- Radius and Ulnar Shaft Fractures — IOM central band, cast position by level, compartment 2nd site, ulnar approach plane, rotation check, nailing lengths, nonop isolated ulna, extra synostosis risks. Skipped: rotation axis.
- Monteggia Fractures — TO sequence (PUDA correction). Galeazzi Fractures — Rettig & Raskin, DRUJ K-wires + EDM, synonyms. Conflict: immobilisation position.
- Knee Dislocation — direction frequencies (conflict), anterior mechanism, time-of-presentation table, avulsion signs, vascular incidence, 24-h observation (conflict), fasciotomy > 6 h, splint in extension (conflict), early-surgery criteria, Mohindra staging table, tensioning sequence (conflict), rehab table, peroneal palsy, 2 How-it's-asked.
- Radial Head Fractures — load share, IOM bands, early recognition, pull test < 3 mm, DRUJ after fixation, neglected Essex-Lopresti; TO approach intervals kept with verify flag. Skipped: pull-test How-it's-asked (already there).
- Clavicle Fractures - Midshaft — unique facts, why middle third, trapezius, Allman table, AO location, nonop, plating extras. Skipped: indication list (already in table).
- Scapula Fractures — floating-shoulder history, SSSC struts, fragments, sequence, fixation bone, literature table, inclination angle, nonop thresholds, 1 How-it's-asked. Skipped: CT, GPA thresholds (already there).
- Proximal Humerus Fractures — head geometry, mechanisms, Campochiaro, Codman + AO subtypes, PROFHER, Neer rehab, GT/LT by size, modified Resch, PHILOS position, deltoid tuberosity index, beach chair, nail. Skipped: CACT < 4 mm.
- Humeral Shaft Fractures — radial nerve surgical facts, special-situation table.
- Distal Humerus Fractures — AO definition + bimodal, approach notes, reduction tips. Skipped: positional vs lag screws.
- Capitellum Fractures — reduction manoeuvre. Elbow Dislocation — Parvin's reduction, both ligaments → neutral. Skipped: epidemiology, LCL / MCL positions.
- Terrible Triad — hinge axis (sequence already in the tree). Coronoid Fractures — medial approaches.
- Acetabular Fractures — column fracture crosses quadrilateral plate.
- Evaluation, Resuscitation & DCO — head CT read sequence, 1 How-it's-asked.

### Pediatrics
- Obstetric Brachial Plexopathy — extra risk factors, cookie test, intervene criteria, co-contraction / trumpet sign, secondary procedures, 2 How-it's-asked. Skipped: Klumpke posture.
- Both Bone Forearm - Pediatric — ideal cast index 0.7, ulnar nail entry. Skipped: angulation-by-level table.
- SCFE — age pattern. Pelvis Fractures - Pediatric — iliac crest avulsion. Medial Epicondylar — trochlea without medial epicondyle.
- Lateral Condyle — fracture of necessity, cubitus valgus → tardy palsy. Supracondylar — Baumann 8–28° kept with verify flag, medial pin < 45°, wire burial. Skipped: reduction steps.

### Basic Science
- Tendons — cumulative trauma / tendinopathy block, imaging table, treatment, red flags, 2 How-it's-asked.
- General and Regional Anesthesia — Bier technique, axillary block.
- Rehab & Prosthetics — Jaipur, SAFE, SACH, Canadian; orthosis tables; floor reaction, foot, paediatric orthoses; gait-aid sizing; 1 How-it's-asked. Boston Risser 3–5 kept with verify flag.
- Fracture Healing — TO strain bands, locking plate, cancellous creeping substitution, osteoblast toxins, 1 How-it's-asked.
- Bone Circulation — venous flow after reaming (verify flag), periosteum.
- Endochondral Bone Formation — law of ossification, growth-contribution table (4 verify flags kept). Skipped: zone disorders (already in table).
- Bone Cells — osteocalcin, differentiation, porosity, osteocyte stimulated by calcitonin.
- Orthopaedic Implants — delta frame one-liner.
- Deep Vein Thrombosis — new "### Wells score (TO)", interpretation, commonest site, Virchow examples, PE.
- Anticoagulation Medications — NICE, doses, mechanical indications. Skipped: ACCP 9th.
- Fat Embolism Syndrome — criteria table, earliest tests, retina, HRCT, history, severe-FES risk, nailing precautions, ventilation, 1 How-it's-asked. Conflicts: incidence, mortality.
- Thromboembolism Prophylaxis — THR prophylaxis line.
- Rheumatoid Arthritis — order of surgery (target "Recon/Rheumatoid Arthritis.md" does not exist; placed in Basic Science/Rheumatoid Arthritis under "Shoulder · hip · knee").

### Other sections
- Shoulder & Elbow/Brachial Neuritis — steroid window.
- Foot & Ankle/Achilles Tendon Rupture — sphygmomanometer test, dynamic US, TO gap table, turndown up to 10–12 cm, repair position, FHL over FDL, conservative + rehab. Lisfranc — children. Hallux Valgus — epidemiology + guided growth. Skipped: juvenile vs adult table.
- Knee & Sports/FAI — paediatric FAI, synonyms, deep-flexion activities, frequency + damage order, red-flag ROM, muscle-tightness mimics, ideal AP pelvis, radiology signs, alpha-angle site, false-profile conflict, GRE clue, sports groin, Dunn image, nonop extras, paediatric management, Ganz alternatives. Hip Arthroscopy — portal roles.
- Spine/Congenital Muscular Torticollis — muscular vs non-muscular, natural history, aetiology, Cheng table, ultrasound, stretching, surgery indications, unipolar vs bipolar, non-muscular causes table, 3 How-it's-asked.
- Pathology/Osteoid Osteoma — femoral neck OO. Metastatic Disease of Spine — Tomita table + surgery bands, WBB, age table, strategy by primary (conflict on survival threshold), 1 How-it's-asked.
- Recon/Adult Limb Deformity & Correction — axes, MAD, malalignment test, functional CORA, Paley rules, wedge types, oblique plane, scanogram, 1 How-it's-asked.

## Not applied
- None. The image `TOn-notes-mri-of-hip-and-thigh-mar-2026-p04-f011.jpg` is referenced by `TO notes/Notes — MRI of Hip and Thigh Mar 2026.md`, but this clone has no image files, so its existence could not be checked here.

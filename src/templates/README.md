# templates (Module C)

HTML templates rendered to PDF by Puppeteer (SRS TC-05, NFR-11). Built by S5:

- `tc-ssism.html`: pink SSISM layout. TC and Character Certificate on one page.
- `tc-ssec.html`: white SSEC layout. SSEC prefix and "RGPV Enrollment No." label (AC-07).
- `fonts/`: Noto Serif, Noto Sans and Noto Sans Devanagari, stored here, never loaded from the internet.

The Character Certificate prints the exact sentence from SRS section 6 (father in the "son/daughter of"
slot, mother after "and Mrs."). Fee fields print "Nil" when nothing is due. Dates print as dd/mm/yyyy.

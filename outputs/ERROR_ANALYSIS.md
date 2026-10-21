# Error analysis (Abt-Buy matching)

Out-of-fold mistakes on the known pairs (grouped 5-fold CV, test ids never used): **36** among the pairs we would submit (confidence above the abstention cutoff). Causes over all of them:

- 16 x no model code in the name on one side of the true pair
- 9 x true pair has differently written model codes
- 7 x one-to-one assignment pushed it elsewhere / near-duplicate listing
- 2 x true match not in candidates (blocking miss)
- 2 x wrong item shares a model code (family/accessory with same code)

## 20 sampled mistakes

| # | Cause | Abt record | We predicted | Truth | Our confidence |
|---|---|---|---|---|---|
| 1 | one-to-one assignment pushed it elsewhere / near-duplicate listing | Panasonic 27' Stainless Steel Microwave Trim Kit - TK903SS | Panasonic NNSD767S 1.6 cu. ft. Stainless Steel Countertop Mi | PAN NN-TK903S MICROWAVE OVEN .08 CU. FT. | 0.81 |
| 2 | no model code in the name on one side of the true pair | Sony DSCH2 Soft Carrying Camera Case - Black Finish - LCSCSH | Sony LCS Soft Carrying Case - LCSCST | Sony LCS-CSH Soft Camera Case - LCSCSH | 0.81 |
| 3 | no model code in the name on one side of the true pair | Nikon Pink 10 Megapixel COOLPIX Digital Camera - COOLPIXS60P | Nikon Coolpix P80 Digital Camera - 26114 | Nikon COOLPIX S60 10 Megapixel Digital Camera w/ 5x Optical  | 0.81 |
| 4 | no model code in the name on one side of the true pair | Garmin 010-10723-03 Nuvi Suction Cup Mount - 0101072303 | Garmin Suction Cup Mount - 010-10936-00 | Garmin Vehicle Suction Cup mount | 0.6 |
| 5 | true pair has differently written model codes | iHome Black Clock Radio Audio System For iPod - IH9BR | iHome IP47BR Bluetooth Clock Radio & Speakerphone for iPhone | IH9B6R BLACK ALARM CLOCK F/IPODPERPCHARGES DOCKED IPOD REMOT | 0.81 |
| 6 | no model code in the name on one side of the true pair | LG LFC25770ST 25.0 Cu. Ft. Stainless Steel French Door Botto | LG 24.7 cu. ft. Stainless Steel French Door Bottom Mount Ref | LG 25.0 Cu.Ft. Total Capacity | 0.81 |
| 7 | no model code in the name on one side of the true pair | Garmin GPS Carrying Case - Black Finish - 0101070400 | Garmin Leather GPS Case | Garmin Lightweight GPS Case - 010-10704-00 | 0.81 |
| 8 | true pair has differently written model codes | Audiovox Xpress XM Satellite Radio Receiver Home Kit - XMH10 | Audiovox Satellite Radio Tuner | Audiovox XMH10 Home Docking Kit | 0.81 |
| 9 | one-to-one assignment pushed it elsewhere / near-duplicate listing | Panasonic Stainless Steel Countertop Microwave Oven - NNSD37 | Panasonic NNSD767S 1.6 cu. ft. Stainless Steel Countertop Mi | Panasonic NN-SD377S 0.8 cu.ft. 800 WATT Microwave Oven | 0.81 |
| 10 | one-to-one assignment pushed it elsewhere / near-duplicate listing | Uniden 5.8GHz Accessory Handset And Charger - TCX905 | Uniden TCX905 Cordless Handset - TCX905 | Uniden TCX905 Tru-Digital Expansion Handset With Caller ID | 0.98 |
| 11 | one-to-one assignment pushed it elsewhere / near-duplicate listing | Canon Black EOS 50D Digital SLR Camera Body - EOS50DBODY | Canon EOS 40D Digital SLR Camera - 1901B004 | Canon EOS 50D 15 Megapixel SLR Digital Camera with Live View | 0.81 |
| 12 | no model code in the name on one side of the true pair | BlueAnt Bluetooth Voice Control Headset - V1 | BlueAnt Wireless Z9i Bluetooth Headset - Black - US-091010 | BLUEANT BLUETOOTH HS DUAL MIC NIC - 091004 | 0.86 |
| 13 | true pair has differently written model codes | Sony Pink Earbud Style Headphones - MDREX55P | Sony MDREX81LP Comfort Fit Ear Hanger Headphones- Choose Col | Ex Series Earbuds Pnk - MDR EX55/PNK | 0.6 |
| 14 | no model code in the name on one side of the true pair | Sanus 13' - 30' VisionMount Flat Panel TV Silver Wall Mount  | Sanus VisionMount Flat Panel TV Wall Mount - VMPL3B | Sanus Flat Panel TV Wall Mount - VMF | 0.81 |
| 15 | no model code in the name on one side of the true pair | Garmin Vehicle Suction Cup Mount - 0101093600 | Garmin Vehicle Suction Cup mount | Garmin Suction Cup Mount - 010-10936-00 | 0.98 |
| 16 | true pair has differently written model codes | Transcend 8GB SDHC Card And Compact Card Reader - TS8GSDHC6S | Transcend 16GB SDHC Card & Compact Card Reader S5 - TS16GSDH | Transcend 8GB Secure Digital High Capacity (SDHC) Card - Cla | 0.81 |
| 17 | true pair has differently written model codes | Sony White Earbud Style Headphones - MDREX55WH | Sony MDREX81LP Comfort Fit Ear Hanger Headphones- Choose Col | Ex Series Earbuds Wht - MDR EX55/WHI | 0.6 |
| 18 | no model code in the name on one side of the true pair | LG 25.0 Cu. Ft. Titanium French Door Bottom Freezer Refriger | LG 24.7 cu. ft. Stainless Steel French Door Bottom Mount Ref | LG 25.0 Cu.Ft. Total Capacity | 0.81 |
| 19 | wrong item shares a model code (family/accessory with same code) | Canon Black EOS 50D Digital SLR Camera With 28-135MM Lens -  | Canon EOS 40D Digital SLR Camera with EF 28-135mm f/3.5-5.6  | Canon EOS 50D 15 Megapixel SLR Digital Camera w/28-135MM IS  | 0.98 |
| 20 | no model code in the name on one side of the true pair | LG LDC22720ST 22 Cu. Ft. Smooth White Bottom Freezer Refrige | LG 25 CF Refrigerator 3 Door White Tall | LG 22 Cu.Ft. Total Capacity | 0.81 |

## Reading it

- **No model code on one side** is the biggest group. Buy often names a product by its marketing description and keeps the code only in the description or not at all. Name similarity then has to carry the match and it cannot separate sibling models (same size, different colour or year).
- **Differently written model codes** (`DSCS750` vs `DSC-750`, `SP565UZ` vs `SP-565 UZ`): my code extraction strips separators but cannot repair a code that has lost a letter or whose digits were split. A fuzzy code comparison (edit distance on codes) is the first thing I would add.
- **One-to-one pressure / near-duplicates**: accessories and bundles that share a brand and vocabulary with the main product. Forcing each Buy record to be used once helps overall, but when a good match was already taken the assignment settles for a lookalike.
- **Blocking misses** are rare (2). Candidate generation is not where the errors come from.
- Confidence is calibrated on these same out-of-fold predictions, so most of these mistakes carry low confidence and land in the review queue rather than being auto-accepted.
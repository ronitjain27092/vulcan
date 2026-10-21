# Data sources

Both datasets are public and real. Credit them in your write-up.

**series.csv** comes from the Numenta Anomaly Benchmark (github.com/numenta/NAB, MIT licence, see NAB_LICENSE.txt):
three AWS EC2 network-in series and one CPU series, one reading every 5 minutes, about 2 weeks each (the Oct 2013 series is about 4 days).
Cite: Lavin and Ahmad, "Evaluating Real-time Anomaly Detection Algorithms, the Numenta Anomaly Benchmark", IEEE ICMLA 2015.
The series ids S1 to S4 are opaque on purpose. The anomaly windows are held back and are what we score against.

**abt.csv, buy.csv, known_matches.csv** come from the Abt-Buy entity-resolution benchmark of the Database Group Leipzig
(dbs.uni-leipzig.de, benchmark datasets for entity resolution, CC BY 4.0). Credit the site and Koepcke, Thor, Rahm,
"Evaluation of entity resolution approaches on real-world match problems", PVLDB 2010.
Two product catalogues describing the same products in different words. known_matches.csv holds 70% of the true pairs.
test_abt_ids.csv lists the Abt ids you must find matches for. Their true pairs are held back.

// scripts/test_pricing.js

const { extractYearsOfExperience, getPricing } = require('./helpers/pricing');

const samples = [
  { text: "Total Experience: 3.5 years\nWorked at X\nJan 2019 - Dec 2021", desc: "explicit 3.5" },
  { text: "Experience: 6 years\nSenior dev", desc: "explicit 6" },
  { text: "Jan 2018 - Mar 2020\nApr 2020 - Present", desc: "continuous with present" },
  { text: "01/2019 - 11/2021\n2017 - 2018", desc: "mixed formats" },
  { text: "No dates here, fresh graduate", desc: "no data" },
  { text: "Worked 4 years of experience in X", desc: "explicit alt" },
  { text: "Jun 2020 - Jun 2020", desc: "single month same" },
  { text: "2010-2012\n2012-2015", desc: "adjacent overlap on year boundary" }
];

for (const s of samples) {
  const years = extractYearsOfExperience(s.text);
  const pricing = getPricing(years);

  console.log("---------");
  console.log("Test:", s.desc);
  console.log("Extracted Years:", years);
  console.log("Pricing:", pricing);
}


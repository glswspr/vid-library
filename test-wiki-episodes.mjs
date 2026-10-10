const tmplRes = await fetch('https://en.wikipedia.org/w/api.php?action=parse&page=Friends%20season%207&prop=wikitext&format=json&origin=*');
const tmplData = await tmplRes.json();
const wikitext = tmplData.parse?.wikitext?.['*'] || '';

// Find all Episode list/sublist entries
const sublistMatches = [...wikitext.matchAll(/\{\{Episode list\/sublist\|([\s\S]*?)\n\}\}/gi)];
console.log('Sublist entries:', sublistMatches.length);

// Show the last entry (wedding)
for (let i = Math.max(0, sublistMatches.length - 2); i < sublistMatches.length; i++) {
  console.log(`\n=== Sublist ${i+1}/${sublistMatches.length} ===`);
  console.log(sublistMatches[i][1]);
}

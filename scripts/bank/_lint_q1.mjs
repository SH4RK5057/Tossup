import fs from 'fs';
const OPT=/^(n|n=S.*|m|f|dup|part|ok|p=S.*)$/;
const isOpts=s=>s&&s.trim().split(/\s+/).every(t=>OPT.test(t));
for (const file of process.argv.slice(2)) {
  const out = fs.readFileSync(file,'utf8').split(/\r?\n/).map(l=>{
    const f=l.split('|');
    let base = null;
    if (/^[emh]$/.test(f[0])) base=3; else if (f[0]==='-') base=4; else return l;
    if (f.length<=base) return l;
    const rest=f.slice(base);
    let opts='';
    if (isOpts(rest[rest.length-1])) opts=rest.pop();
    const parts=f.slice(0,base);
    if (rest.length) parts.push(rest.join(';')); else if (opts) parts.push('');
    if (opts) parts.push(opts);
    return parts.join('|');
  });
  fs.writeFileSync(file,out.join('\n'));
}

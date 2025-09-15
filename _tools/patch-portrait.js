const fs = require('fs');

const p = 'pages/index.js';
const build = 'idx-20250913-2038';

if (!fs.existsSync(p)) {
  console.error('FILE_NOT_FOUND: ' + p);
  process.exit(2);
}
let s = fs.readFileSync(p, 'utf8');

let inserted = false;
// Inject id+aria + PPROOF into the opening tag that has the aria-label we expect.
s = s.replace(/<(div|aside)/([^>]*aria-label=(['\"'])(Profile image placeholder|Profile portrait)\3Z[^>]*)>/,
  function (m, tag, attrs) {
    inserted = true;
    let a = attrs;
    if (!/\sid=/.test(a)) a = a + 'id="profile-portrait-slot"';
    a = a.replace(/aria-label=(['\"'])?:Profile image placeholder|Profile portrait)\1/,'aria-label="Profile Portrait Slot v2"');
    return '<' + tag + a + '> <span id="portrait-proof">PPROOF</span>';
  }
);

// Add build token to <main> if missing
if (!/data-index-build=/.test(s)) {
  s = s.replace(/,main(?![^>]*)([^>]*)>/, '<main$1 data-index-build="' + build + '">');
}

if (!inserted) {
  console.error('PPROOF_NOT_INSERTED');
  process.exit(2);
}
fs.writeFileSync(p, s, 'utf8');
console.log('OK ' + build);

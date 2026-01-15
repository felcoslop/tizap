
import 'dotenv/config';

console.log('--- ENV CHECK ---');
const keys = Object.keys(process.env);
const relevant = keys.filter(k =>
    k.includes('MAIL') ||
    k.includes('USER') ||
    k.includes('PASS') ||
    k.includes('TOKEN') ||
    k.includes('SECRET') ||
    k.includes('ID')
);

relevant.forEach(k => {
    const val = process.env[k];
    const display = val ? `(Present, length: ${val.length})` : '(Empty)';
    console.log(`${k}: ${display}`);
});

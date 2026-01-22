
import { sendMail } from './server/config/email.js';
import { EMAIL_USER } from './server/config/constants.js';

console.log('--- TEST START ---');
console.log('Attempting to send email to:', EMAIL_USER);

sendMail({
    to: EMAIL_USER,
    subject: 'Test Local Debug',
    text: 'If this arrives, the code is fixed.'
}).then(info => {
    console.log('SUCCESS:', info);
}).catch(err => {
    console.error('FAILURE:', err);
});

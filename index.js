require('dotenv').config();
const app = require('./server');
app.listen(process.env.PORT, () => console.log('Template Service Listening on ' + process.env.PORT));


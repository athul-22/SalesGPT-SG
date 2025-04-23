const {GoogleAuth} = require('google-auth-library');

async function getIdToken() {
  const auth = new GoogleAuth();
  const client = await auth.getIdTokenClient('https://salesgpt-prod-3lu6lw5c5q-as.a.run.app');
  const headers = await client.getRequestHeaders();
  console.log('Authorization header:', headers.Authorization);
}

getIdToken();

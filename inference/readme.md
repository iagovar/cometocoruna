## Flask API endpoint for ML Inference

While I've tried to make transformers.js work to reduce complexity surface, the ONNX library they use beneath is very problematic in model conversions. The ecosystem in JS is just not mature enough.

Like it or not, the whole ML ecosystem is built upon Python, so if I don't want to call external APIs + spend money + be rate limited, I have to set up my own inference server.

## How to use

This server is not supossed to be exposed to the internet, as it has no authentication.

Build upon python virtualenv so:

1. Create virtualenv ``python3 -m venv inference-virtualenv``
2. Activate virtualenv ``source ./inference-virtualenv/bin/activate``
3. Install the requirements ``pip install -r requeriments.txt``
4. Run server with ``flask --app inference run --host=0.0.0.0 --debug``. In my case the inference server is the same hosting the scraper, there you have it in case you want to change the inference location.

    Remove ``--debug`` in production.
    Be aware that ``--host`` indicates from which adresses are allowed to request, being ``0.0.0.0``all of em.
    Port ``5000`` as default.

## How to query

Look for the endpoints in the code itself, it's a single .py file.

### NodeJS

````
const axios = require('axios');

async function makeRequest(url, method, data) {
 const response = await axios({
  url: url,
  method: method,
  data: data
 });

 if (response.status === 200) {
  console.log(response.data);
 } else {
  console.error(`Error: ${response.status}`);
 }
}

// Usage of the function
makeRequest('http://localhost:5000/inference/categorize', 'post', {
 context: 'Some context',
 categoriesList: "category1, category2"
});
````

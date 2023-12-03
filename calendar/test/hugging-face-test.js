async function query(data) {
	const response = await fetch(
		"https://api-inference.huggingface.co/models/mistralai/Mistral-7B-Instruct-v0.1",
		{
			headers: { Authorization: "Bearer {API_TOKEN}" },
			method: "POST",
			body: JSON.stringify(data),
		}
	);
	const result = await response.json();
	return result;
}

query({"inputs": "Can you please let us know more details about your "}).then((response) => {
	console.log(JSON.stringify(response));
});
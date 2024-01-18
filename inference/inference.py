# Flask importing + init

from flask import Flask, jsonify, request

app = Flask(__name__)

# Inference importing + init

from transformers import pipeline

answerer_model = "MMG/bert-base-spanish-wwm-cased-finetuned-spa-squad2-es-finetuned-sqac"
classifier_model = "Recognai/zeroshot_selectra_medium"
generation_model = "TinyLlama/TinyLlama-1.1B-Chat-v1.0"

answerer = pipeline("question-answering", answerer_model)
classifier = pipeline("zero-shot-classification", classifier_model)

# LLM not possible to run under current hardware
#tinyllm = pipeline("text-generation", generation_model)

@app.route("/test", methods=["POST"])
def test():
    request_data = request.get_json()
    return jsonify({"message": f"{request_data}"}), 200

@app.route("/inference/qa", methods=["POST"])
def qa():
    """
    Answer questions given a context.

    Args:
        context (str): The context in which the question is being asked.
        question (str): The question being asked..

    Returns:
        str: The answer to the question.
    """

    try:
        request_data = request.get_json()
        context = request_data['context']
        question = request_data['question']
    except Exception as e:
        print(f"Error: {e}")
        return jsonify({"error": f"Error processing request, likely failed to provide JSON payload with context and question. Flask spits: {e}"}), 500

    answer = None

    try:
        answer = answerer(context=context, question=question)
    except Exception as e:
        print(f"Error: {e}")
        return jsonify({"error": f"Error processing request: {e}"}), 500

    return jsonify({"result": answer})

@app.route("/inference/categorize", methods=["POST"])
def categorize():
    """
    Categorize a context into a list of categories.

    Args:
        context (str): The context in which the question is being asked.
        categoriesList (list): The list of categories.

    Returns:
        str: A list of categories and their respective probabilities.    
    """
    try:
        request_data = request.get_json()
        context = request_data['context']
        categoriesList = request_data['categoriesList']
    except Exception as e:
        print(f"Error: {e}")
        return jsonify({"error": f"Error processing request, likely failed to provide JSON payload with context and categoriesList. Flask spits: {e}"}), 500
    
    result = None

    try:
        answer = classifier(context, candidate_labels = categoriesList, hypothesis_template = "Este ejemplo es {}.")
    except Exception as e:
        print(f"Error: {e}")
        return jsonify({"error": f"Error processing request: {e}"}), 500

    
    return jsonify({"result": answer})


@app.route("/")
def hello():
    return "<div>You need to specify the type of inference and input, check inference.py</div>"


if __name__ == "__main__":
    app.run(debug=True)
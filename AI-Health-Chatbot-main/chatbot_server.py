"""
SmartCare AI Health Chatbot — Flask API Server
================================================
Wraps the ML logic from Health_Chat_bot.py into a REST API.
Core ML logic (data loading, model, prediction) is UNCHANGED.
"""

import re
import os
import random
import csv
import warnings
import numpy as np
import pandas as pd
from sklearn import preprocessing
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split
from difflib import get_close_matches
from flask import Flask, request, jsonify
from flask_cors import CORS

warnings.filterwarnings("ignore", category=DeprecationWarning)

# ──────────────────────────────────────────────
#  Resolve paths relative to THIS script
# ──────────────────────────────────────────────
BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# ──────────────────────────────────────────────
#  Load Data (unchanged logic)
# ──────────────────────────────────────────────
training = pd.read_csv(os.path.join(BASE_DIR, "Data", "Training.csv"))
testing = pd.read_csv(os.path.join(BASE_DIR, "Data", "Testing.csv"))

# Clean duplicate column names
training.columns = training.columns.str.replace(r"\.\d+$", "", regex=True)
testing.columns = testing.columns.str.replace(r"\.\d+$", "", regex=True)
training = training.loc[:, ~training.columns.duplicated()]
testing = testing.loc[:, ~testing.columns.duplicated()]

# Features and labels
cols = training.columns[:-1]
x = training[cols]
y = training["prognosis"]

# Encode target
le = preprocessing.LabelEncoder()
y = le.fit_transform(y)

# Train-test split
x_train, x_test, y_train, y_test = train_test_split(
    x, y, test_size=0.33, random_state=42
)

# Model
model = RandomForestClassifier(n_estimators=300, random_state=42)
model.fit(x_train, y_train)

# ──────────────────────────────────────────────
#  Dictionaries (unchanged logic)
# ──────────────────────────────────────────────
severityDictionary = {}
description_list = {}
precautionDictionary = {}
symptoms_dict = {symptom: idx for idx, symptom in enumerate(x)}


def getDescription():
    with open(
        os.path.join(BASE_DIR, "MasterData", "symptom_Description.csv")
    ) as csv_file:
        for row in csv.reader(csv_file):
            if len(row) >= 2:
                description_list[row[0]] = row[1]


def getSeverityDict():
    with open(os.path.join(BASE_DIR, "MasterData", "Symptom_severity.csv")) as csv_file:
        for row in csv.reader(csv_file):
            try:
                severityDictionary[row[0]] = int(row[1])
            except:
                pass


def getprecautionDict():
    with open(
        os.path.join(BASE_DIR, "MasterData", "symptom_precaution.csv")
    ) as csv_file:
        for row in csv.reader(csv_file):
            if len(row) >= 5:
                precautionDictionary[row[0]] = [row[1], row[2], row[3], row[4]]


# Load all dictionaries at startup
getSeverityDict()
getDescription()
getprecautionDict()

# ──────────────────────────────────────────────
#  Symptom Extractor (unchanged logic)
# ──────────────────────────────────────────────
symptom_synonyms = {
    "stomach ache": "stomach_pain",
    "belly pain": "stomach_pain",
    "tummy pain": "stomach_pain",
    "loose motion": "diarrhoea",
    "motions": "diarrhoea",
    "diarrhea": "diarrhoea",
    "fever": "high_fever",
    "high temperature": "high_fever",
    "temperature": "high_fever",
    "feaver": "high_fever",
    "coughing": "cough",
    "throat pain": "throat_irritation",
    "sore throat": "throat_irritation",
    "cold": "chills",
    "breathing issue": "breathlessness",
    "shortness of breath": "breathlessness",
    "body ache": "muscle_pain",
}


def extract_symptoms(user_input, all_symptoms):
    extracted = []
    text = user_input.lower().replace("-", " ")

    # 1. Synonym replacement
    for phrase, mapped in symptom_synonyms.items():
        if phrase in text:
            extracted.append(mapped)

    # 2. Exact match
    for symptom in all_symptoms:
        if symptom.replace("_", " ") in text:
            extracted.append(symptom)

    # 3. Fuzzy match (typo handling)
    words = re.findall(r"\w+", text)
    for word in words:
        close = get_close_matches(
            word, [s.replace("_", " ") for s in all_symptoms], n=1, cutoff=0.8
        )
        if close:
            for sym in all_symptoms:
                if sym.replace("_", " ") == close[0]:
                    extracted.append(sym)

    return list(set(extracted))


# ──────────────────────────────────────────────
#  Prediction (unchanged logic)
# ──────────────────────────────────────────────
def predict_disease(symptoms_list):
    input_vector = np.zeros(len(symptoms_dict))
    for symptom in symptoms_list:
        if symptom in symptoms_dict:
            input_vector[symptoms_dict[symptom]] = 1

    pred_proba = model.predict_proba([input_vector])[0]
    pred_class = np.argmax(pred_proba)
    disease = le.inverse_transform([pred_class])[0]
    confidence = round(pred_proba[pred_class] * 100, 2)
    return disease, confidence, pred_proba


# ──────────────────────────────────────────────
#  Empathy Quotes (unchanged)
# ──────────────────────────────────────────────
quotes = [
    "🌸 Health is wealth, take care of yourself.",
    "💪 A healthy outside starts from the inside.",
    "☀️ Every day is a chance to get stronger and healthier.",
    "🌿 Take a deep breath, your health matters the most.",
    "🌺 Remember, self-care is not selfish.",
]


# ──────────────────────────────────────────────
#  Get disease-specific follow-up symptoms
# ──────────────────────────────────────────────
def get_disease_followup_symptoms(disease, already_have):
    """Return list of symptoms associated with a disease that user hasn't reported."""
    matching = training[training["prognosis"] == disease]
    if matching.empty:
        return []
    row = matching.iloc[0][:-1]
    disease_symptoms = list(row.index[row == 1])
    return [s for s in disease_symptoms if s not in already_have][:8]


def new_session_state():
    return {
        "state": "awaiting_name",
        "name": None,
        "age": None,
        "gender": None,
        "symptoms": [],
        "days": None,
        "severity": None,
        "pre_existing": None,
        "lifestyle": None,
        "family_history": None,
        "disease": None,
        "followup_queue": [],
        "followup_asked": 0,
    }


def make_prompt_response(state, response, follow_up=None):
    return jsonify(
        {
            "success": True,
            "state": state,
            "response": response,
            "follow_up": follow_up,
            "result": None,
        }
    )


# ══════════════════════════════════════════════
#  Flask Application
# ══════════════════════════════════════════════
app = Flask(__name__)
CORS(app)

# In-memory session store
sessions = {}


@app.route("/api/chat", methods=["POST"])
def chat():
    data = request.get_json()
    message = (data.get("message") or "").strip()
    session_id = data.get("session_id", "default")
    # Optional: user id and profile passed from PHP proxy
    user_id = data.get("user_id")
    user_profile = data.get("user_profile")

    # Initialize session if new
    if session_id not in sessions:
        sessions[session_id] = new_session_state()

    # If PHP passed an existing user profile for this logged-in user, prefill it
    if user_profile and isinstance(user_profile, dict):
        s = sessions[session_id]
        # Only set profile if not already collected in this session
        if not s.get("name"):
            s["name"] = user_profile.get("name")
            s["age"] = user_profile.get("age")
            s["gender"] = user_profile.get("gender")
            s["state"] = "awaiting_symptoms"

    session = sessions[session_id]
    state = session["state"]

    # ── Handle: reset command ──
    if message.lower() in ("reset", "restart", "new", "start over"):
        sessions[session_id] = new_session_state()
        # If the request included a user_profile, skip personal questions
        if user_profile and isinstance(user_profile, dict):
            sessions[session_id]["name"] = user_profile.get("name")
            sessions[session_id]["age"] = user_profile.get("age")
            sessions[session_id]["gender"] = user_profile.get("gender")
            sessions[session_id]["state"] = "awaiting_symptoms"
            # Return a normal awaiting_symptoms response and indicate profile already collected
            return jsonify(
                {
                    "success": True,
                    "state": "awaiting_symptoms",
                    "response": "🤖 Welcome back! Please describe your symptoms in a sentence (e.g., 'I have fever and stomach pain'):",
                    "follow_up": None,
                    "result": None,
                    "profile_collected": True,
                    "profile": {
                        "name": sessions[session_id].get("name"),
                        "age": sessions[session_id].get("age"),
                        "gender": sessions[session_id].get("gender"),
                    },
                }
            )

        # otherwise ask for name as before
        return make_prompt_response(
            "awaiting_name",
            "🤖 Welcome to HealthCare ChatBot\nHello! Please answer a few questions so I can understand your condition better.\n\n👉 What is your name? :",
        )

    # ── State: awaiting_name ──
    if state == "awaiting_name":
        # If the user replies with symptoms instead of their name (e.g., types "headache"),
        # treat the input as symptoms and start the consultation immediately.
        detected = extract_symptoms(message, cols)
        if detected:
            session["symptoms"] = detected
            session["state"] = "awaiting_days"

            # Initial prediction for the seeded symptoms
            disease, confidence, _ = predict_disease(detected)
            session["disease"] = disease

            symptom_tags = ", ".join([s.replace("_", " ") for s in detected])
            response_text = f"✅ **Detected symptoms:** {symptom_tags}"

            return make_prompt_response(
                "awaiting_days",
                response_text
                + "\n\n👉 For how many days have you had these symptoms? :",
            )

        # Otherwise treat the input as the user's name (legacy behavior)
        session["name"] = message or "there"
        session["state"] = "awaiting_age"
        return make_prompt_response(
            "awaiting_age",
            f"👉 Please enter your age, {session['name']}:",
        )

    # ── State: awaiting_age ──
    if state == "awaiting_age":
        session["age"] = message or None
        session["state"] = "awaiting_gender"
        return make_prompt_response(
            "awaiting_gender",
            "👉 What is your gender? (M/F/Other):",
        )

    # ── State: awaiting_gender ──
    if state == "awaiting_gender":
        session["gender"] = message or None
        session["state"] = "awaiting_symptoms"
        # Return the awaiting_symptoms prompt and indicate profile is now collected
        return jsonify(
            {
                "success": True,
                "state": "awaiting_symptoms",
                "response": "👉 Describe your symptoms in a sentence (e.g., 'I have fever and stomach pain'):",
                "follow_up": None,
                "result": None,
                "profile_collected": True,
                "profile": {
                    "name": session.get("name"),
                    "age": session.get("age"),
                    "gender": session.get("gender"),
                },
            }
        )

    # ── State: awaiting_symptoms ──
    if state == "awaiting_symptoms":
        # Try to extract symptoms from natural language
        detected = extract_symptoms(message, cols)

        if not detected:
            return jsonify(
                {
                    "success": True,
                    "state": "awaiting_symptoms",
                    "response": '❌ I couldn\'t detect any recognizable symptoms from your input. Please try again with more detail.\n\nFor example: *"I have fever, headache and stomach pain"*',
                    "follow_up": None,
                    "result": None,
                }
            )

        session["symptoms"] = detected
        session["state"] = "awaiting_days"

        # Initial prediction
        disease, confidence, _ = predict_disease(detected)
        session["disease"] = disease

        symptom_tags = ", ".join([s.replace("_", " ") for s in detected])
        response_text = f"✅ **Detected symptoms:** {symptom_tags}"

        return make_prompt_response(
            "awaiting_days",
            response_text + "\n\n👉 For how many days have you had these symptoms? :",
        )

    # ── State: awaiting_days ──
    if state == "awaiting_days":
        session["days"] = message or None
        session["state"] = "awaiting_severity"
        return make_prompt_response(
            "awaiting_severity",
            "👉 On a scale of 1–10, how severe do you feel your condition is? :",
        )

    # ── State: awaiting_severity ──
    if state == "awaiting_severity":
        session["severity"] = message or None
        session["state"] = "awaiting_pre_existing"
        return make_prompt_response(
            "awaiting_pre_existing",
            "👉 Do you have any pre-existing conditions (e.g., diabetes, hypertension)? :",
        )

    # ── State: awaiting_pre_existing ──
    if state == "awaiting_pre_existing":
        session["pre_existing"] = message or None
        session["state"] = "awaiting_lifestyle"
        return make_prompt_response(
            "awaiting_lifestyle",
            "👉 Do you smoke, drink alcohol, or have irregular sleep? :",
        )

    # ── State: awaiting_lifestyle ──
    if state == "awaiting_lifestyle":
        session["lifestyle"] = message or None
        session["state"] = "awaiting_family_history"
        return make_prompt_response(
            "awaiting_family_history",
            "👉 Any family history of similar illness? :",
        )

    # ── State: awaiting_family_history ──
    if state == "awaiting_family_history":
        session["family_history"] = message or None

        # Initial prediction after collecting the full health profile
        disease, confidence, _ = predict_disease(session["symptoms"])
        session["disease"] = disease

        followups = get_disease_followup_symptoms(disease, session["symptoms"])
        session["followup_queue"] = followups
        session["followup_asked"] = 0

        symptom_tags = ", ".join([s.replace("_", " ") for s in session["symptoms"]])
        response_text = f"✅ **Detected symptoms:** {symptom_tags}"

        if followups:
            session["state"] = "follow_up"
            first_q = followups[0]
            return jsonify(
                {
                    "success": True,
                    "state": "follow_up",
                    "response": response_text,
                    "follow_up": {
                        "question": f"👉 Do you also have **{first_q.replace('_', ' ')}**?",
                        "symptom": first_q,
                        "index": 0,
                        "total": len(followups),
                    },
                    "result": None,
                }
            )

        session["state"] = "complete"
        return _build_result_response(session, session_id)

    # ── State: follow_up ──
    if state == "follow_up":
        answer = message.lower().strip()
        queue = session["followup_queue"]
        idx = session["followup_asked"]

        # Guard: if index is somehow out of bounds, jump straight to result
        if idx >= len(queue):
            session["state"] = "complete"
            return _build_result_response(session, session_id)

        # Process answer
        if answer in ("yes", "y", "yeah", "yep"):
            session["symptoms"].append(queue[idx])

        session["followup_asked"] += 1
        next_idx = session["followup_asked"]

        if next_idx < len(queue):
            next_sym = queue[next_idx]
            return jsonify(
                {
                    "success": True,
                    "state": "follow_up",
                    "response": None,
                    "follow_up": {
                        "question": f"Do you also have **{next_sym.replace('_', ' ')}**?",
                        "symptom": next_sym,
                        "index": next_idx,
                        "total": len(queue),
                    },
                    "result": None,
                }
            )
        else:
            # All follow-ups done → final prediction
            session["state"] = "complete"
            return _build_result_response(session, session_id)

    # ── State: complete (new conversation) ──
    if state == "complete":
        # If the user types symptoms right after completion, treat the input as symptoms
        detected_now = extract_symptoms(message, cols)
        if detected_now:
            # Start a fresh consultation seeded with detected symptoms
            sessions[session_id] = new_session_state()
            sessions[session_id]["symptoms"] = detected_now
            sessions[session_id]["state"] = "awaiting_days"

            # Initial prediction
            disease, confidence, _ = predict_disease(detected_now)
            sessions[session_id]["disease"] = disease

            symptom_tags = ", ".join([s.replace("_", " ") for s in detected_now])
            response_text = f"✅ **Detected symptoms:** {symptom_tags}"

            return make_prompt_response(
                "awaiting_days",
                response_text
                + "\n\n👉 For how many days have you had these symptoms? :",
            )

        # Otherwise start a fresh consultation and treat the next message as the new name
        sessions[session_id] = new_session_state()
        sessions[session_id]["name"] = message or "there"
        sessions[session_id]["state"] = "awaiting_age"
        return make_prompt_response(
            "awaiting_age",
            f"👉 Please enter your age, {sessions[session_id]['name']}:",
        )

    return jsonify({"success": False, "message": "Unknown state"})


def _build_result_response(session, session_id):
    """Build the final prediction result."""
    try:
        symptoms = session.get("symptoms", [])

        # Need at least one symptom to make a prediction
        if not symptoms:
            return jsonify(
                {
                    "success": False,
                    "state": "error",
                    "response": "❌ No symptoms recorded. Please describe your symptoms and try again.",
                    "follow_up": None,
                    "result": None,
                }
            )

        disease, confidence, _ = predict_disease(symptoms)

        desc = description_list.get(disease, "No description available.")
        precs = precautionDictionary.get(disease, [])
        quote = random.choice(quotes)

        all_symptoms = [str(s).replace("_", " ") for s in symptoms]

        precautions_text = ""
        if precs:
            precautions_text = "\n\n🛡️ Suggested precautions:\n" + "\n".join(
                [f"{i + 1}. {str(p)}" for i, p in enumerate(precs) if p]
            )

        response_text = (
            f"🩺 Based on your answers, you may have **{disease}**.\n\n"
            f"🔎 Confidence: {confidence}%\n\n"
            f"📖 About: {desc}"
            f"{precautions_text}"
            f"\n\n💡 {quote}\n\n"
            "Please consult a healthcare professional for proper diagnosis and treatment."
        )

        return jsonify(
            {
                "success": True,
                "state": "complete",
                "response": response_text,
                "follow_up": None,
                "result": {
                    "disease": str(disease),
                    "confidence": float(confidence),
                    "description": str(desc),
                    "precautions": [str(p) for p in precs if p],
                    "symptoms_used": all_symptoms,
                    "quote": str(quote),
                },
            }
        )

    except Exception as e:
        print(f"[ERROR] _build_result_response failed: {e}")
        # Reset the session so the user can start fresh
        sessions[session_id] = new_session_state()
        return jsonify(
            {
                "success": False,
                "state": "error",
                "response": "⚠️ An error occurred while generating your diagnosis. Please start again with your name.",
                "follow_up": None,
                "result": None,
            }
        )


@app.route("/api/health", methods=["GET"])
def health_check():
    return jsonify(
        {
            "status": "ok",
            "model": "RandomForest (300 estimators)",
            "symptoms_count": len(symptoms_dict),
            "diseases_count": len(le.classes_),
        }
    )


if __name__ == "__main__":
    print("=" * 50)
    print("  SmartCare AI Health Chatbot Server")
    print(f"  Model loaded: {len(symptoms_dict)} symptoms, {len(le.classes_)} diseases")
    print("  Running on http://localhost:5050")
    print("=" * 50)
    app.run(host="0.0.0.0", port=5050, debug=False)

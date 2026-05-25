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
training = pd.read_csv(os.path.join(BASE_DIR, 'Data', 'Training.csv'))
testing  = pd.read_csv(os.path.join(BASE_DIR, 'Data', 'Testing.csv'))

# Clean duplicate column names
training.columns = training.columns.str.replace(r"\.\d+$", "", regex=True)
testing.columns  = testing.columns.str.replace(r"\.\d+$", "", regex=True)
training = training.loc[:, ~training.columns.duplicated()]
testing  = testing.loc[:, ~testing.columns.duplicated()]

# Features and labels
cols = training.columns[:-1]
x = training[cols]
y = training['prognosis']

# Encode target
le = preprocessing.LabelEncoder()
y = le.fit_transform(y)

# Train-test split
x_train, x_test, y_train, y_test = train_test_split(x, y, test_size=0.33, random_state=42)

# Model
model = RandomForestClassifier(n_estimators=300, random_state=42)
model.fit(x_train, y_train)

# ──────────────────────────────────────────────
#  Dictionaries (unchanged logic)
# ──────────────────────────────────────────────
severityDictionary   = {}
description_list     = {}
precautionDictionary = {}
symptoms_dict = {symptom: idx for idx, symptom in enumerate(x)}

def getDescription():
    with open(os.path.join(BASE_DIR, 'MasterData', 'symptom_Description.csv')) as csv_file:
        for row in csv.reader(csv_file):
            if len(row) >= 2:
                description_list[row[0]] = row[1]

def getSeverityDict():
    with open(os.path.join(BASE_DIR, 'MasterData', 'Symptom_severity.csv')) as csv_file:
        for row in csv.reader(csv_file):
            try:
                severityDictionary[row[0]] = int(row[1])
            except:
                pass

def getprecautionDict():
    with open(os.path.join(BASE_DIR, 'MasterData', 'symptom_precaution.csv')) as csv_file:
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
        close = get_close_matches(word, [s.replace("_", " ") for s in all_symptoms], n=1, cutoff=0.8)
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
    "🌺 Remember, self-care is not selfish."
]

# ──────────────────────────────────────────────
#  Get disease-specific follow-up symptoms
# ──────────────────────────────────────────────
def get_disease_followup_symptoms(disease, already_have):
    """Return list of symptoms associated with a disease that user hasn't reported."""
    matching = training[training['prognosis'] == disease]
    if matching.empty:
        return []
    row = matching.iloc[0][:-1]
    disease_symptoms = list(row.index[row == 1])
    return [s for s in disease_symptoms if s not in already_have][:8]

# ══════════════════════════════════════════════
#  Flask Application
# ══════════════════════════════════════════════
app = Flask(__name__)
CORS(app)

# In-memory session store
sessions = {}

@app.route('/api/chat', methods=['POST'])
def chat():
    data = request.get_json()
    message    = (data.get('message') or '').strip()
    session_id = data.get('session_id', 'default')

    # Initialize session if new
    if session_id not in sessions:
        sessions[session_id] = {
            'state': 'awaiting_symptoms',
            'symptoms': [],
            'disease': None,
            'followup_queue': [],
            'followup_asked': 0,
        }

    session = sessions[session_id]
    state   = session['state']

    # ── Handle: reset command ──
    if message.lower() in ('reset', 'restart', 'new', 'start over'):
        sessions[session_id] = {
            'state': 'awaiting_symptoms',
            'symptoms': [],
            'disease': None,
            'followup_queue': [],
            'followup_asked': 0,
        }
        return jsonify({
            'success': True,
            'state': 'awaiting_symptoms',
            'response': "🔄 Session reset! Please describe your symptoms and I'll help identify what might be going on.",
            'follow_up': None,
            'result': None,
        })

    # ── State: awaiting_symptoms ──
    if state == 'awaiting_symptoms':
        # Try to extract symptoms from natural language
        detected = extract_symptoms(message, cols)

        if not detected:
            return jsonify({
                'success': True,
                'state': 'awaiting_symptoms',
                'response': "❌ I couldn't detect any recognizable symptoms from your input. Please try again with more detail.\n\nFor example: *\"I have fever, headache and stomach pain\"*",
                'follow_up': None,
                'result': None,
            })

        session['symptoms'] = detected

        # Initial prediction
        disease, confidence, _ = predict_disease(detected)
        session['disease'] = disease

        # Prepare follow-up questions
        followups = get_disease_followup_symptoms(disease, detected)
        session['followup_queue'] = followups
        session['followup_asked'] = 0

        symptom_tags = ', '.join([s.replace('_', ' ') for s in detected])
        response_text = f"✅ **Detected symptoms:** {symptom_tags}"

        if followups:
            session['state'] = 'follow_up'
            first_q = followups[0]
            return jsonify({
                'success': True,
                'state': 'follow_up',
                'response': response_text,
                'follow_up': {
                    'question': f"Do you also have **{first_q.replace('_', ' ')}**?",
                    'symptom': first_q,
                    'index': 0,
                    'total': len(followups),
                },
                'result': None,
            })
        else:
            # No follow-ups available, go direct to result
            session['state'] = 'complete'
            return _build_result_response(session, session_id)

    # ── State: follow_up ──
    if state == 'follow_up':
        answer = message.lower().strip()
        queue  = session['followup_queue']
        idx    = session['followup_asked']

        # Guard: if index is somehow out of bounds, jump straight to result
        if idx >= len(queue):
            session['state'] = 'complete'
            return _build_result_response(session, session_id)

        # Process answer
        if answer in ('yes', 'y', 'yeah', 'yep'):
            session['symptoms'].append(queue[idx])

        session['followup_asked'] += 1
        next_idx = session['followup_asked']

        if next_idx < len(queue):
            next_sym = queue[next_idx]
            return jsonify({
                'success': True,
                'state': 'follow_up',
                'response': None,
                'follow_up': {
                    'question': f"Do you also have **{next_sym.replace('_', ' ')}**?",
                    'symptom': next_sym,
                    'index': next_idx,
                    'total': len(queue),
                },
                'result': None,
            })
        else:
            # All follow-ups done → final prediction
            session['state'] = 'complete'
            return _build_result_response(session, session_id)

    # ── State: complete (new conversation) ──
    if state == 'complete':
        # Reset and treat as new symptoms
        sessions[session_id] = {
            'state': 'awaiting_symptoms',
            'symptoms': [],
            'disease': None,
            'followup_queue': [],
            'followup_asked': 0,
        }
        # Re-process message in fresh state
        return chat()

    return jsonify({'success': False, 'message': 'Unknown state'})


def _build_result_response(session, session_id):
    """Build the final prediction result."""
    try:
        symptoms = session.get('symptoms', [])

        # Need at least one symptom to make a prediction
        if not symptoms:
            return jsonify({
                'success': False,
                'state': 'error',
                'response': '❌ No symptoms recorded. Please describe your symptoms and try again.',
                'follow_up': None,
                'result': None,
            })

        disease, confidence, _ = predict_disease(symptoms)

        desc  = description_list.get(disease, 'No description available.')
        precs = precautionDictionary.get(disease, [])
        quote = random.choice(quotes)

        all_symptoms = [str(s).replace('_', ' ') for s in symptoms]

        return jsonify({
            'success': True,
            'state': 'complete',
            'response': None,
            'follow_up': None,
            'result': {
                'disease': str(disease),
                'confidence': float(confidence),
                'description': str(desc),
                'precautions': [str(p) for p in precs if p],
                'symptoms_used': all_symptoms,
                'quote': str(quote),
            },
        })

    except Exception as e:
        print(f"[ERROR] _build_result_response failed: {e}")
        # Reset the session so the user can start fresh
        sessions[session_id] = {
            'state': 'awaiting_symptoms',
            'symptoms': [],
            'disease': None,
            'followup_queue': [],
            'followup_asked': 0,
        }
        return jsonify({
            'success': False,
            'state': 'error',
            'response': '⚠️ An error occurred while generating your diagnosis. Please describe your symptoms again.',
            'follow_up': None,
            'result': None,
        })


@app.route('/api/health', methods=['GET'])
def health_check():
    return jsonify({
        'status': 'ok',
        'model': 'RandomForest (300 estimators)',
        'symptoms_count': len(symptoms_dict),
        'diseases_count': len(le.classes_),
    })


if __name__ == '__main__':
    print("=" * 50)
    print("  SmartCare AI Health Chatbot Server")
    print(f"  Model loaded: {len(symptoms_dict)} symptoms, {len(le.classes_)} diseases")
    print("  Running on http://localhost:5050")
    print("=" * 50)
    app.run(host='0.0.0.0', port=5050, debug=False)

SOILSENSE — SOIL FERTILITY CLASSIFICATION WEBSITE

FOLDER CONTENTS
- app.py: FastAPI backend that loads the trained model package and exposes /predict
- templates/index.html: single-page website with a left sidebar and detailed sections
- static/style.css: website styling and responsive layout
- static/script.js: form validation, API call, result display and sidebar navigation
- soil_fertility_model.pkl: copy this file from your Colab output into this folder

SETUP (Windows PowerShell / VS Code terminal)
1. Put soil_fertility_model.pkl in the same folder as app.py. The filename must match exactly.
2. Open the terminal in this folder.
3. Install dependencies: python -m pip install fastapi uvicorn pandas scikit-learn joblib jinja2
4. Start the site: python -m uvicorn app:app --reload
5. Open http://127.0.0.1:8000 in your browser.

IMPORTANT
- The website uses the saved model package created in the notebook: {'model': best_rf_model, 'features': list(X.columns)}.
- If your file was downloaded as soil_fertility_model (1).pkl, rename it to soil_fertility_model.pkl.
- The dataset and Colab notebook are not required in the website folder after the model package has been saved.
- Dataset target labels are numeric class codes 0, 1 and 2. Confirm their official meaning before interpreting a class as suitable/unsuitable for a particular crop.
- The confidence display is the highest model class probability, not a guarantee of accuracy. This prototype does not replace soil-laboratory testing or agricultural advice.


MODEL ANALYSIS GRAPHS
The sidebar includes a Model Analysis & Graphs section. Accuracy and precision/recall/F1 charts use the reported evaluation values from the project. Random Forest feature importance is requested from the loaded model via /analysis. The charts are drawn locally with HTML canvas and do not require a chart library.

NOTE ABOUT METRICS
These aggregate metrics are based on the project's reported test evaluation. Feature importance is dynamically read from the saved model package. Numeric target classes 0, 1 and 2 are shown as class codes; verify official label definitions before mapping them to real-world suitability.

from fastapi import FastAPI, Request
from fastapi.responses import HTMLResponse
from fastapi.templating import Jinja2Templates
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
import pandas as pd
import joblib
from pathlib import Path
BASE_DIR=Path(__file__).resolve().parent
app=FastAPI(title='Soil Fertility Dashboard')
app.mount('/static',StaticFiles(directory=BASE_DIR/'static'),name='static')
templates=Jinja2Templates(directory=str(BASE_DIR/'templates'))
MODEL_FILE=BASE_DIR/'soil_fertility_model.pkl'
package=joblib.load(MODEL_FILE)
model=package['model']; features=package['features']
class SoilInput(BaseModel):
 N:float; P:float; K:float; ph:float; ec:float; oc:float; S:float; zn:float; fe:float; cu:float; Mn:float; B:float
@app.get('/', response_class=HTMLResponse)
def home(request: Request):
    # Compatible with current Starlette/Jinja2Templates versions.
    return templates.TemplateResponse(request=request, name='index.html')
@app.post('/predict')
def predict(data:SoilInput):
 v=data.model_dump(); row=pd.DataFrame([[v[f] for f in features]],columns=features)
 p=model.predict(row)[0]; probs=model.predict_proba(row)[0]
 out={'predicted_class':int(p),'confidence':round(float(max(probs))*100,2),'probabilities':{str(c):round(float(x)*100,2) for c,x in zip(model.classes_,probs)}}
 if int(p)==0:
  out['suitability']='Needs Improvement'; out['recommendation']='The predicted fertility class is Class 0. Review limiting soil properties, improve the soil where required, and retest before selecting a crop.'
 else:
  out['suitability']='Suitable for Cultivation'; out['recommendation']=f'The predicted fertility class is Class {int(p)}. The dashboard currently treats this class as suitable. Review individual soil properties before selecting a crop.'
 return out


@app.get('/analysis')
def analysis():
    """Return feature importance from the loaded trained model, if supported."""
    importance = getattr(model, 'feature_importances_', None)
    if importance is None:
        return {'available': False, 'message': 'Feature importance is not available for this saved model.'}
    ranked = sorted(
        [{'feature': str(name), 'importance': round(float(value) * 100, 4)}
         for name, value in zip(features, importance)],
        key=lambda item: item['importance'], reverse=True
    )
    return {'available': True, 'features': ranked}

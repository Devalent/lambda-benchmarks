import lightgbm as lgb
import pandas as pd
from sklearn.model_selection import train_test_split
import timeit
import time
import platform

model = lgb.Booster(model_file='model.mdl')

df = pd.read_csv('Breast_cancer_data.csv')

X = df[['mean_radius','mean_texture','mean_perimeter','mean_area','mean_smoothness']]
y = df['diagnosis']

X_train, X_test, y_train, y_test = train_test_split(X, y, test_size = 1, random_state = 0)

def runner():
    model.predict(X_test)

def handler(event, context):
  N = 10000
  stats = timeit.Timer(runner).timeit(number=N)
  return N / stats

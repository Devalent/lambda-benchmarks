import lightgbm as lgb
import numpy as np
import pandas as pd
from sklearn.model_selection import train_test_split
import platform

df = pd.read_csv('Breast_cancer_data.csv')

X = df[['mean_radius','mean_texture','mean_perimeter','mean_area','mean_smoothness']]
y = df['diagnosis']

X_train, X_test, y_train, y_test = train_test_split(X, y, test_size = 0.3, random_state = 0)

clf = lgb.LGBMClassifier()
clf.fit(X_train, y_train)

clf.booster_.save_model('model.mdl')

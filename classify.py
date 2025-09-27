
import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
import seaborn as sns
import re
import nltk

from nltk.corpus import stopwords
from nltk.stem import WordNetLemmatizer
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.model_selection import train_test_split
from sklearn.linear_model import LogisticRegression
from sklearn.naive_bayes import MultinomialNB
from sklearn.ensemble import RandomForestClassifier
from sklearn.svm import LinearSVC
from sklearn.metrics import classification_report, accuracy_score


print("Loading dataset...")
df = pd.read_csv("consumer_complaints.csv")

# Use only relevant columns
df = df[['product', 'consumer_complaint_narrative']].dropna()

# Map categories
category_map = {
    "Credit reporting, credit repair services, or other personal consumer reports": 0,
    "Debt collection": 1,
    "Consumer Loan": 2,
    "Mortgage": 3
}

df = df[df['product'].isin(category_map.keys())]
df['label'] = df['product'].map(category_map)

print("Class distribution:")
print(df['label'].value_counts())


nltk.download('stopwords')
nltk.download('wordnet')

stop_words = set(stopwords.words('english'))
lemmatizer = WordNetLemmatizer()

def preprocess(text: str) -> str:
    text = text.lower()
    text = re.sub(r'[^a-z\s]', '', text)
    tokens = text.split()
    tokens = [lemmatizer.lemmatize(w) for w in tokens if w not in stop_words]
    return " ".join(tokens)

print("Preprocessing text...")
df['clean_text'] = df['consumer_complaint_narrative'].apply(preprocess)


vectorizer = TfidfVectorizer(max_features=5000, ngram_range=(1,2))
X = vectorizer.fit_transform(df['clean_text'])
y = df['label']


X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.2, random_state=42, stratify=y
)


models = {
    "Logistic Regression": LogisticRegression(max_iter=200),
    "Naive Bayes": MultinomialNB(),
    "Random Forest": RandomForestClassifier(n_estimators=100),
    "Linear SVM": LinearSVC()
}

results = {}

for name, model in models.items():
    print(f"\nTraining {name}...")
    model.fit(X_train, y_train)
    y_pred = model.predict(X_test)
    acc = accuracy_score(y_test, y_pred)
    results[name] = acc
    print(f"{name} Accuracy: {acc:.4f}")
    print(classification_report(y_test, y_pred))


plt.figure(figsize=(8,5))
sns.barplot(x=list(results.keys()), y=list(results.values()))
plt.ylabel("Accuracy")
plt.title("Model Comparison")
plt.show()


print("\n--- Sample Predictions ---")
best_model = LogisticRegression(max_iter=200)
best_model.fit(X_train, y_train)

sample_texts = [
    "I am being harassed by debt collectors calling me multiple times a day.",
    "My credit report shows incorrect information that I never authorized.",
    "My mortgage provider increased my interest rate without notice."
]

sample_processed = [preprocess(t) for t in sample_texts]
sample_vectorized = vectorizer.transform(sample_processed)

preds = best_model.predict(sample_vectorized)

for t, p in zip(sample_texts, preds):
    print(f"Complaint: {t}\nPredicted Category: {p}\n")

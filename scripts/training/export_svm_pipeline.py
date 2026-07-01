import os
import numpy as np
from skl2onnx.common.data_types import StringTensorType
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.svm import LinearSVC
from sklearn.pipeline import Pipeline
from skl2onnx import to_onnx

# Required: pip install scikit-learn onnxruntime skl2onnx

# 1. Dummy training data (Replace with actual labeled Taglish dataset)
X_train = [
    "mabilis masyado ang lesson hindi makasabay",
    "the prof is always late and angry",
    "grading system is very confusing",
    "I feel left out during group works",
    "the topic is disconnected from our major",
    "my classmates are noisy",
    "instructions are not clear",
    "too much abstract concepts",
    "the process is very slow",
    "what we learned is different from exams",
    "cannot synthesize the design",
    "feedback takes too long",
    "formulas are hard to read",
    "everything is fine",
]

y_train = [
    "instructional cadence",
    "relational coldness",
    "evaluation unfairness",
    "perceived marginalization",
    "subject alienation",
    "peer distraction",
    "clarity deficit",
    "abstract logic gap",
    "procedural bottleneck",
    "conceptual misalignment",
    "design synthesis failure",
    "feedback latency",
    "notation struggle",
    "Uncategorized",
]

# 2. Build the pipeline
# TfidfVectorizer handles basic tokenization, lowercasing, etc.
# LinearSVC is a fast SVM classifier suitable for text.
pipeline = Pipeline([
    ('tfidf', TfidfVectorizer(stop_words='english', lowercase=True)),
    ('clf', LinearSVC(class_weight='balanced', dual='auto')),
])

print("Training SVM pipeline...")
pipeline.fit(X_train, y_train)

# 3. Export to ONNX
# Define initial type as StringTensorType for string input
initial_type = [('string_input', StringTensorType([None, 1]))]

print("Exporting to ONNX...")
onnx_model = to_onnx(
    pipeline,
    initial_types=initial_type,
    target_opset=18,
    options={'nocl': True, 'output_class_labels': True},
)

# 4. Save the model
output_path = os.path.abspath(os.path.join(os.path.dirname(__file__), '../../public/models/svm-pipeline.onnx'))
os.makedirs(os.path.dirname(output_path), exist_ok=True)

with open(output_path, 'wb') as f:
    f.write(onnx_model.SerializeToString())

print(f"Successfully exported SVM model to: {output_path}")
print("\nTo use this with the comparison framework, make sure the classes matched your taxonomy.")
import google.generativeai as genai
import os

genai.configure(api_key="AIzaSyAPAYoRzZlz5LOu5h6cskkzVKiW9CUMmUk")
try:
    for m in genai.list_models():
        if "generateContent" in m.supported_generation_methods:
            print(m.name)
except Exception as e:
    print("Error:", e)

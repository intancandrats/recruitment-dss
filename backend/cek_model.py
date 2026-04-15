import google.generativeai as genai

MY_KEY = "AIzaSyDODup6dHFfpceUaKnWTHOcNnN0mZiSCCM" 

genai.configure(api_key=MY_KEY)

try:
    print("Mengecek daftar model...")
    for m in genai.list_models():
        if 'generateContent' in m.supported_generation_methods:
            print(f"Model tersedia: {m.name}")
except Exception as e:
    print(f"Error tetap terjadi: {e}")
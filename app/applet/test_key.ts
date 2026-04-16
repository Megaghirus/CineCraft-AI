import { GoogleGenAI } from '@google/genai';
const ai = new GoogleGenAI({ apiKey: 'AIzaSyCWIBaqmrrQoAUcz32CrLaN-ABevaMf1sA' });
async function run() {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-pro',
      contents: 'hello',
    });
    console.log("SUCCESS:", response.text);
  } catch (e: any) {
    console.error("ERROR:", e.message, e.status);
  }
}
run();

import { VideoProvider } from '../types';

const ANTHRO_CONSTRAINT = "CRITICAL: All characters (even animals, aliens, or objects) MUST be highly anthropomorphic. They must stand on two legs, have human-like posture, wear human clothing, and exhibit human behavior, gestures, and facial expressions.";

const withRetry = async <T>(operation: () => Promise<T>, maxRetries = 5, baseDelay = 2000): Promise<T> => {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error: any) {
      const errorMessage = error?.message || '';
      
      if (attempt === maxRetries) throw error;
      
      // Check if it's a 503 or 429 (RESOURCE_EXHAUSTED) error
      const isTransient = error?.status === 503 || error?.status === 429 || errorMessage.includes('503') || errorMessage.includes('429') || errorMessage.includes('RESOURCE_EXHAUSTED');
      
      if (isTransient) {
        const delay = baseDelay * Math.pow(2, attempt - 1);
        console.warn(`API error (attempt ${attempt}/${maxRetries}). Retrying in ${delay}ms...`, error);
        await new Promise(resolve => setTimeout(resolve, delay));
      } else {
        throw error; // Don't retry non-transient errors
      }
    }
  }
  throw new Error('Max retries reached');
};

const generateContent = async (model: string, contents: string, config?: any) => {
  const response = await fetch("/api/gemini/generateContent", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ model, contents, config }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `API Error: ${response.status}`);
  }

  return response.json();
};

export const enhanceStory = async (story: string, lang: string, animationStyle: string = '', dialogueLanguage: string = '') => {
  const prompt = `
    Take the following rough story idea and expand it into a detailed, engaging, and well-structured narrative for a cartoon.
    Make it highly descriptive, focusing on character motivations, setting the scene, and a clear plot progression (beginning, middle, climax, end).
    ${animationStyle ? `The intended animation style is: ${animationStyle}. Keep this in mind for the atmosphere.` : ''}
    ${dialogueLanguage ? `CRITICAL: The spoken dialogue and cultural context within the story should be in ${dialogueLanguage}.` : ''}
    ${ANTHRO_CONSTRAINT}
    The output MUST be just the story text, written in the requested language.
    
    Language: ${lang}
    Rough Idea: ${story}
  `;

  const response = await withRetry(async () => {
    return await generateContent('gemini-2.5-pro', prompt);
  });

  return response.text || story;
};

export const generateActors = async (story: string, lang: string, animationStyle: string = '', dialogueLanguage: string = '') => {
  const prompt = `
    Based on the following story, identify and generate a list of the main characters/actors.
    For each actor, provide a name and a detailed description including their role in the story, appearance, and personality.
    ${animationStyle ? `The intended animation style is: ${animationStyle}. Describe their appearance to fit this style.` : ''}
    ${dialogueLanguage ? `The characters should have names and traits appropriate for a story spoken in ${dialogueLanguage}.` : ''}
    ${ANTHRO_CONSTRAINT}
    
    The output MUST be a valid JSON object with the structure:
    {
      "actors": [{ "name": "string", "description": "string" }]
    }
    
    Story: ${story}
    Language: ${lang}
  `;

  const response = await withRetry(async () => {
    return await generateContent('gemini-2.5-pro', prompt, {
      responseMimeType: "application/json",
    });
  });

  return JSON.parse(response.text || '{"actors": []}');
};

export const generateScenes = async (story: string, actors: any[], lang: string, animationStyle: string = '', dialogueLanguage: string = '') => {
  const prompt = `
    Based on the following story and actors, break the story down into a sequence of scenes.
    For each scene, provide:
    1. A description of the action.
    2. The dialogue.
    3. A highly detailed visual prompt for a video generation AI to create this specific scene.
    
    CRITICAL INSTRUCTIONS FOR DIALOGUE:
    - ALL spoken dialogue MUST be written strictly in ${dialogueLanguage || `the language corresponding to the code '${lang}'`}. Do not mix languages.

    CRITICAL INSTRUCTIONS FOR THE VIDEO PROMPT:
    - The prompt MUST be in English, regardless of the requested language for the story.
    - ${animationStyle ? `Animation Style: ${animationStyle}. Include this style description prominently in the prompt.` : 'Animation Style: High quality 2D cartoon animation, masterpiece.'}
    - ${ANTHRO_CONSTRAINT}
    - Keep camera movement minimal or static to prevent background morphing.
    - Describe characters' appearances very clearly and consistently based on the actors list.
    - Focus on simple, deliberate, and slow actions.
    - Describe lighting and atmosphere clearly.
    - CRITICAL: Video generation models DO NOT generate speech or audio. DO NOT include dialogue in the visual prompt. Instead, describe the character "talking animatedly", "moving their mouth", or their facial expressions.
    
    The output MUST be a valid JSON object with the structure:
    {
      "scenes": [{ "description": "string", "dialogue": "string", "prompt": "string" }]
    }
    
    Story: ${story}
    Actors: ${JSON.stringify(actors)}
    Language for description and dialogue: ${lang}
  `;

  const response = await withRetry(async () => {
    return await generateContent('gemini-2.5-pro', prompt, {
      responseMimeType: "application/json",
    });
  });

  return JSON.parse(response.text || '{"scenes": []}');
};

export const generateVideoPrompt = async (story: string, actors: any[], sceneDesc: string, lang: string, animationStyle: string = '') => {
  const prompt = `
    Based on the following story and actors, write a detailed visual prompt for a video generation AI to create a specific scene.
    The output should ONLY be the prompt text, nothing else. The prompt MUST be in English.
    
    CRITICAL INSTRUCTIONS FOR HIGH QUALITY AND CONSISTENCY:
    1. ${animationStyle ? `Animation Style: ${animationStyle}. Include this style description prominently in the prompt.` : 'Animation Style: High quality 2D cartoon animation, masterpiece.'}
    2. ${ANTHRO_CONSTRAINT}
    3. Keep the camera movement minimal or static to prevent background morphing.
    4. Describe the characters' appearances very clearly and consistently.
    5. Focus on simple, deliberate, and slow actions to avoid unnatural AI physics.
    6. Do not include complex interactions between multiple objects that might blend together.
    7. Describe the lighting and atmosphere clearly.
    8. If the scene involves dialogue, explicitly include the dialogue in quotes and specify the language (e.g., "saying in Romanian: 'Salut'"). This helps the video model generate matching lip movements and audio.
    
    Story: ${story}
    Actors: ${JSON.stringify(actors)}
    Scene Description: ${sceneDesc}
    Language: ${lang}
  `;

  const response = await withRetry(async () => {
    return await generateContent('gemini-2.5-pro', prompt);
  });

  return response.text;
};

export const getDirectorAdvice = async (sceneDesc: string, prompt: string, lang: string) => {
  const sysPrompt = `
    You are an expert AI Video Director. Review the following scene description and video prompt.
    Provide 3 short, actionable tips to improve the visual generation, avoid AI artifacts (like morphing), and make the scene look professional.
    Remind the user to ensure the prompt includes the exact dialogue and language if they want the characters to speak, so the AI can attempt lip-syncing.
    Output MUST be in the language corresponding to the code '${lang}'. Keep it concise, using bullet points.
    
    Scene: ${sceneDesc}
    Prompt: ${prompt}
  `;

  const response = await withRetry(async () => {
    return await generateContent('gemini-2.5-pro', sysPrompt);
  });

  return response.text;
};

const getVideoGenKey = () => {
  return localStorage.getItem('videogen_api_key') || 'lannetech_cf0bcb4970daf91c3baac9b39ba595b77eb4a8fc423d1cfce50ca7fd64791783';
};

export const generateVideo = async (prompt: string, provider: VideoProvider = 'gemini', onProgress?: (status: string) => void) => {
  if (provider === 'gemini') {
    let operation = await withRetry(async () => {
      const res = await fetch("/api/gemini/generateVideos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: 'veo-3.1-generate-preview',
          prompt: prompt,
          config: {
            numberOfVideos: 1,
            resolution: '1080p',
            aspectRatio: '16:9'
          }
        })
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    });

    while (!operation.done) {
      if (onProgress) onProgress('Generating video... this may take a few minutes.');
      await new Promise(resolve => setTimeout(resolve, 10000));
      operation = await withRetry(async () => {
        const res = await fetch("/api/gemini/getVideosOperation", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ operation })
        });
        if (!res.ok) throw new Error(await res.text());
        return res.json();
      });
    }

    const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
    if (!downloadLink) throw new Error('Failed to generate video');

    const response = await fetch(`/api/gemini/downloadVideo?uri=${encodeURIComponent(downloadLink)}`);

    if (!response.ok) throw new Error('Failed to download video');
    
    const blob = await response.blob();
    return URL.createObjectURL(blob);
  } else {
    const apiKey = getVideoGenKey();
    if (!apiKey) throw new Error(`VideoGen API Key is missing. Please add it in the settings.`);

    if (onProgress) onProgress(`Connecting to ${provider} via VideoGen API...`);
    
    try {
      const response = await fetch('https://videogenapi.com/api/v1/generate', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          prompt,
          model: provider,
          add_audio: true
        })
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`VideoGen API Error: ${response.status} - ${errText}`);
      }

      const data = await response.json();
      const taskId = data.generation_id || data.id || data.task_id;

      if (!taskId) throw new Error('No task ID returned from VideoGen API');

      let attempts = 0;
      const maxAttempts = 120; // 10 minutes max (120 * 5s)

      // Poll for completion
      while (attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 5000));
        attempts++;
        
        const statusRes = await fetch(`https://videogenapi.com/api/v1/status/${taskId}`, {
          headers: { 'Authorization': `Bearer ${apiKey}` }
        });

        if (!statusRes.ok) throw new Error('Failed to check video status');
        const statusData = await statusRes.json();

        if (statusData.status === 'completed' || statusData.status === 'succeeded') {
          return statusData.video_url || statusData.url || statusData.output;
        } else if (statusData.status === 'failed' || statusData.status === 'error') {
          throw new Error(statusData.error || statusData.message || 'Video generation failed');
        }
        
        if (onProgress) {
          const progressMsg = statusData.message ? ` - ${statusData.message}` : '';
          onProgress(`Generating with ${provider}... status: ${statusData.status || 'processing'}${progressMsg}`);
        }
      }
      
      throw new Error(`Video generation timed out after 10 minutes. Task ID: ${taskId}. You can check the status later.`);
    } catch (error: any) {
      console.error("VideoGen API Error:", error);
      throw new Error(`Failed to generate with ${provider}: ${error.message}. Ensure the VideoGen API endpoint is correct and active.`);
    }
  }
};

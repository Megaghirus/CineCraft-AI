import streamlit as st
import json
import time
import re
import requests

# ─── Page config ───────────────────────────────────────────────────────────────
st.set_page_config(
    page_title="CineCraft AI",
    page_icon="🎬",
    layout="wide",
    initial_sidebar_state="expanded",
)

# ─── Constants ─────────────────────────────────────────────────────────────────
TEXT_MODELS = {
    "Gemini 2.5 Flash — recomandat (💰)":      "gemini-2.5-flash",
    "Gemini 2.5 Pro — capabil (💰💰💰)":        "gemini-2.5-pro",
    "Gemini 3.1 Pro Preview (💰💰💰)":          "gemini-3.1-pro-preview",
    "Gemini 2.0 Flash Lite — buget (💰)":      "gemini-2.0-flash-lite",
}

VIDEO_PROVIDERS = {
    "── Google / Gemini ──":                    None,
    "  Veo 3.1 — premium (💰💰💰)":             "veo-3.1-generate-preview",
    "  Veo 2.0 — stabil (💰💰)":               "veo-2.0-generate-001",
    "── VideoGen Gateway ──":                   None,
    "  Kling 3":                               "kling-3",
    "  Sora 2":                                "sora-2",
    "  Seedance 2":                            "seedance-2",
}

PROVIDER_LABELS = {v: k.strip() for k, v in VIDEO_PROVIDERS.items() if v}

ANTHRO_CONSTRAINT = (
    "CRITICAL: All characters (even animals, aliens, or objects) MUST be highly anthropomorphic. "
    "They must stand on two legs, have human-like posture, wear human clothing, "
    "and exhibit human behavior, gestures, and facial expressions."
)

# ─── Session state init ────────────────────────────────────────────────────────
for key, default in {
    "story": "",
    "actors": [],
    "scenes": [],
    "animation_style": "",
    "dialogue_language": "English",
}.items():
    if key not in st.session_state:
        st.session_state[key] = default

# ─── Sidebar ───────────────────────────────────────────────────────────────────
with st.sidebar:
    st.title("🎬 CineCraft AI")
    st.markdown("---")

    st.subheader("🔑 API Keys")
    # Support Streamlit Cloud secrets or manual input
    gemini_key = st.text_input(
        "Google Gemini / Veo",
        type="password",
        value=st.secrets.get("GEMINI_API_KEY", "") if hasattr(st, "secrets") else "",
        help="Required for story/scene generation and Veo video",
    )
    videogen_key = st.text_input(
        "VideoGen Gateway",
        type="password",
        value=st.secrets.get("VIDEOGEN_API_KEY", "") if hasattr(st, "secrets") else "",
        help="Required for Kling 3, Sora 2, Seedance 2",
    )
    elevenlabs_key = st.text_input(
        "ElevenLabs TTS (opțional)",
        type="password",
        value=st.secrets.get("ELEVENLABS_API_KEY", "") if hasattr(st, "secrets") else "",
        help="For voice synthesis",
    )

    st.markdown("---")
    st.subheader("🤖 Text Model")
    text_model = TEXT_MODELS[st.selectbox("", list(TEXT_MODELS.keys()), label_visibility="collapsed")]

    st.markdown("---")
    st.subheader("🎨 Style")
    st.session_state.animation_style = st.text_input(
        "Animation Style",
        value=st.session_state.animation_style,
        placeholder="Disney 2D, Pixar 3D, Anime...",
    )
    st.session_state.dialogue_language = st.text_input(
        "Dialogue Language",
        value=st.session_state.dialogue_language,
        placeholder="English, Romanian, Spanish...",
    )

    st.markdown("---")
    col_a, col_b = st.columns(2)
    col_a.metric("Scenes", len(st.session_state.scenes))
    col_b.metric("Actors", len(st.session_state.actors))

    if st.button("🗑️ Clear All", use_container_width=True):
        for k in ["story", "actors", "scenes"]:
            st.session_state[k] = "" if k == "story" else []
        st.rerun()

    if gemini_key:
        st.success("✅ Gemini ready")
    else:
        st.warning("⚠️ Gemini key missing")
    if videogen_key:
        st.success("✅ VideoGen ready")

# ─── Gemini REST helper ────────────────────────────────────────────────────────
def gemini_call(prompt: str, json_mode: bool = False) -> str:
    if not gemini_key:
        raise ValueError("Gemini API key not configured — add it in the sidebar.")
    url = (
        f"https://generativelanguage.googleapis.com/v1beta/models/"
        f"{text_model}:generateContent?key={gemini_key}"
    )
    body: dict = {"contents": [{"parts": [{"text": prompt}]}]}
    if json_mode:
        body["generationConfig"] = {"responseMimeType": "application/json"}
    resp = requests.post(url, json=body, timeout=120)
    if not resp.ok:
        err = resp.json().get("error", {})
        raise ValueError(err.get("message", f"HTTP {resp.status_code}"))
    data = resp.json()
    return data["candidates"][0]["content"]["parts"][0]["text"]


def safe_json(text: str, fallback):
    if not text:
        return fallback
    try:
        return json.loads(text)
    except Exception:
        m = re.search(r"```(?:json)?\s*([\s\S]*?)```", text)
        if m:
            try:
                return json.loads(m.group(1))
            except Exception:
                pass
    return fallback


# ─── VideoGen helpers ──────────────────────────────────────────────────────────
def videogen_submit(prompt: str, model: str) -> str:
    if not videogen_key:
        raise ValueError("VideoGen API key not configured — add it in the sidebar.")
    resp = requests.post(
        "https://videogenapi.com/api/v1/generate",
        headers={"Authorization": f"Bearer {videogen_key}", "Content-Type": "application/json"},
        json={"prompt": prompt, "model": model, "aspect_ratio": "16:9", "duration": 5},
        timeout=30,
    )
    data = resp.json()
    if not resp.ok:
        raise ValueError(f"VideoGen: {data.get('error', data.get('message', resp.status_code))}")
    task_id = data.get("generation_id") or data.get("id") or data.get("task_id")
    if not task_id:
        raise ValueError(f"No task ID in response: {data}")
    return task_id


def videogen_poll(task_id: str, progress_fn) -> bytes:
    delay = 5
    for attempt in range(120):
        time.sleep(delay)
        delay = min(delay * 1.2, 15)
        resp = requests.get(
            f"https://videogenapi.com/api/v1/status/{task_id}",
            headers={"Authorization": f"Bearer {videogen_key}"},
            timeout=30,
        )
        if not resp.ok:
            raise ValueError(f"Status check failed: {resp.status_code}")
        data = resp.json()
        status = data.get("status", "")
        msg = data.get("message", "")
        progress_fn(f"⏳ {status}{' — ' + msg if msg else ''} (attempt {attempt + 1})")

        if status in ("completed", "done", "succeeded"):
            video_resp = requests.get(
                f"https://videogenapi.com/api/v1/video/{task_id}",
                headers={"Authorization": f"Bearer {videogen_key}"},
                timeout=120,
            )
            if not video_resp.ok:
                raise ValueError(f"Video download failed: {video_resp.status_code}")
            return video_resp.content
        elif status in ("failed", "error"):
            raise ValueError(f"VideoGen failed: {data.get('error', data.get('message', 'Unknown'))}")
    raise ValueError("Video generation timed out after ~20 minutes")


# ─── Veo (Gemini) video helper ─────────────────────────────────────────────────
def veo_generate(prompt: str, model: str, progress_fn) -> bytes:
    if not gemini_key:
        raise ValueError("Gemini API key not configured — add it in the sidebar.")
    try:
        from google import genai as google_genai
        from google.genai import types as genai_types

        client = google_genai.Client(api_key=gemini_key)
        progress_fn(f"⏳ Submitting to {model}...")
        operation = client.models.generate_videos(
            model=model,
            prompt=prompt,
            config=genai_types.GenerateVideoConfig(
                number_of_videos=1,
                duration_seconds=5,
                aspect_ratio="16:9",
                generate_audio=False,
            ),
        )
        while not operation.done:
            progress_fn("⏳ Generating Veo video... please wait (this can take 3-5 min)")
            time.sleep(10)
            operation = client.operations.get(operation)

        video_uri = operation.response.generated_videos[0].video.uri
        progress_fn("⏳ Downloading video...")
        video_resp = requests.get(
            video_uri,
            headers={"x-goog-api-key": gemini_key},
            timeout=120,
        )
        video_resp.raise_for_status()
        return video_resp.content

    except ImportError:
        raise ValueError(
            "Package 'google-genai' not installed. "
            "Run: pip install google-genai  (or add to requirements.txt)"
        )


# ─── Tabs ──────────────────────────────────────────────────────────────────────
tab_story, tab_actors, tab_scenes = st.tabs(["📖 Story", "🎭 Actors", "🎬 Scenes"])


# ══ Story Tab ══════════════════════════════════════════════════════════════════
with tab_story:
    st.header("📖 Story")

    story_val = st.text_area(
        "Story",
        value=st.session_state.story,
        height=220,
        placeholder="Write your story idea here...",
        label_visibility="collapsed",
    )
    st.session_state.story = story_val

    col1, col2 = st.columns([1, 4])
    with col1:
        if st.button("✨ Enhance with AI", disabled=not story_val.strip()):
            with st.spinner("Enhancing story with Gemini..."):
                try:
                    lang = st.session_state.dialogue_language
                    style = st.session_state.animation_style
                    prompt = f"""Take the following rough story idea and expand it into a detailed,
engaging narrative for a cartoon. Clear character motivations and plot progression.
{f'Animation style: {style}.' if style else ''}
{f'Spoken dialogue should be in {lang}.' if lang else ''}
{ANTHRO_CONSTRAINT}
Output MUST be just the story text.
Rough Idea: {story_val}"""
                    st.session_state.story = gemini_call(prompt)
                    st.rerun()
                except Exception as e:
                    st.error(f"❌ {e}")


# ══ Actors Tab ═════════════════════════════════════════════════════════════════
with tab_actors:
    st.header("🎭 Actors")

    col1, col2 = st.columns([1, 4])
    with col1:
        if st.button("🤖 Generate from Story", disabled=not st.session_state.story.strip()):
            with st.spinner("Generating actors..."):
                try:
                    style = st.session_state.animation_style
                    prompt = f"""Based on the following story, identify the main characters.
For each: name and detailed description (role, appearance, personality).
{f'Animation style: {style}.' if style else ''}
{ANTHRO_CONSTRAINT}
Output MUST be valid JSON: {{"actors": [{{"name": "string", "description": "string"}}]}}
Story: {st.session_state.story}"""
                    text = gemini_call(prompt, json_mode=True)
                    result = safe_json(text, {"actors": []})
                    st.session_state.actors = result.get("actors", [])
                    st.success(f"✅ Generated {len(st.session_state.actors)} actors")
                    st.rerun()
                except Exception as e:
                    st.error(f"❌ {e}")
    with col2:
        if st.button("➕ Add Manually"):
            st.session_state.actors.append({"name": "New Actor", "description": ""})
            st.rerun()

    for i, actor in enumerate(st.session_state.actors):
        with st.expander(f"🎭 {actor.get('name', f'Actor {i+1}')}", expanded=True):
            c1, c2, c3 = st.columns([2, 5, 1])
            name = c1.text_input("Name", value=actor.get("name", ""), key=f"aname_{i}")
            desc = c2.text_area("Description", value=actor.get("description", ""), key=f"adesc_{i}", height=70)
            st.session_state.actors[i] = {"name": name, "description": desc}
            if c3.button("🗑️", key=f"del_actor_{i}"):
                st.session_state.actors.pop(i)
                st.rerun()

    if not st.session_state.actors:
        st.info("No actors yet.")


# ══ Scenes Tab ═════════════════════════════════════════════════════════════════
with tab_scenes:
    st.header("🎬 Scenes")

    col1, col2 = st.columns([1, 4])
    with col1:
        if st.button("✨ Generate Scenes", disabled=not st.session_state.story.strip()):
            with st.spinner("Generating scenes with Gemini..."):
                try:
                    lang = st.session_state.dialogue_language or "English"
                    style = st.session_state.animation_style
                    prompt = f"""Based on the following story and actors, break the story into scenes.
For each scene:
1. description: visual action (no dialogue)
2. dialogue: spoken lines strictly in {lang}
3. prompt: detailed English visual prompt for a video AI

PROMPT RULES:
- Always in English
- {f'Animation Style: {style}.' if style else 'Animation Style: High quality 2D cartoon, masterpiece.'}
- {ANTHRO_CONSTRAINT}
- Keep camera movement minimal
- Do NOT include spoken dialogue in the visual prompt

Output MUST be valid JSON: {{"scenes": [{{"description": "string", "dialogue": "string", "prompt": "string"}}]}}
Story: {st.session_state.story}
Actors: {json.dumps(st.session_state.actors)}"""
                    text = gemini_call(prompt, json_mode=True)
                    result = safe_json(text, {"scenes": []})
                    new_scenes = result.get("scenes", [])
                    if not new_scenes:
                        st.error("❌ Gemini returned no scenes. Check your API key and spending limits.")
                    else:
                        for s in new_scenes:
                            s.setdefault("id", str(time.time_ns()))
                            s.setdefault("provider", "kling-3")
                            s.setdefault("video_bytes", None)
                        st.session_state.scenes.extend(new_scenes)
                        st.success(f"✅ Generated {len(new_scenes)} scenes")
                        st.rerun()
                except Exception as e:
                    st.error(f"❌ {e}")
    with col2:
        if st.button("➕ Add Scene"):
            st.session_state.scenes.append({
                "id": str(time.time_ns()),
                "description": "",
                "dialogue": "",
                "prompt": "",
                "provider": "kling-3",
                "video_bytes": None,
            })
            st.rerun()

    if not st.session_state.scenes:
        st.info("No scenes yet. Generate from story or add manually.")

    for i, scene in enumerate(st.session_state.scenes):
        with st.container(border=True):
            # ── Scene header ──
            hcol1, hcol2, hcol3 = st.columns([2, 3, 1])
            hcol1.markdown(f"**Scene {i + 1}**")

            # Provider selector (only real model values, no separator entries)
            real_providers = {k: v for k, v in VIDEO_PROVIDERS.items() if v is not None}
            current_prov = scene.get("provider", "kling-3")
            current_label = next((k for k, v in real_providers.items() if v == current_prov), list(real_providers.keys())[0])
            chosen_label = hcol2.selectbox(
                "Provider",
                options=list(real_providers.keys()),
                index=list(real_providers.keys()).index(current_label),
                key=f"prov_{i}",
                label_visibility="collapsed",
            )
            st.session_state.scenes[i]["provider"] = real_providers[chosen_label]

            if hcol3.button("🗑️", key=f"del_scene_{i}"):
                st.session_state.scenes.pop(i)
                st.rerun()

            # ── Scene fields ──
            lcol, rcol = st.columns(2)
            with lcol:
                st.session_state.scenes[i]["description"] = st.text_area(
                    "Description (visual)", value=scene.get("description", ""),
                    key=f"sdesc_{i}", height=80,
                )
                st.session_state.scenes[i]["dialogue"] = st.text_area(
                    "Dialogue", value=scene.get("dialogue", ""),
                    key=f"sdial_{i}", height=60,
                )
                st.session_state.scenes[i]["prompt"] = st.text_area(
                    "Video Prompt (EN)", value=scene.get("prompt", ""),
                    key=f"sprompt_{i}", height=80,
                )

            # ── Video panel ──
            with rcol:
                provider_val = st.session_state.scenes[i]["provider"]
                is_veo = provider_val.startswith("veo-")
                video_bytes = scene.get("video_bytes")

                if video_bytes:
                    st.video(video_bytes)
                    st.download_button(
                        "⬇️ Download MP4",
                        data=video_bytes,
                        file_name=f"scene_{i + 1}.mp4",
                        mime="video/mp4",
                        key=f"dl_{i}",
                    )

                can_generate = bool(scene.get("prompt", "").strip())
                if st.button(
                    "🎬 Generate Video",
                    key=f"gen_{i}",
                    disabled=not can_generate,
                    use_container_width=True,
                ):
                    if is_veo and not gemini_key:
                        st.error("❌ Gemini API key required for Veo models.")
                    elif not is_veo and not videogen_key:
                        st.error("❌ VideoGen API key required for this model.")
                    else:
                        status_ph = st.empty()
                        try:
                            if is_veo:
                                video_content = veo_generate(
                                    scene["prompt"], provider_val,
                                    lambda msg: status_ph.info(msg),
                                )
                            else:
                                task_id = videogen_submit(scene["prompt"], provider_val)
                                video_content = videogen_poll(
                                    task_id,
                                    lambda msg: status_ph.info(msg),
                                )
                            st.session_state.scenes[i]["video_bytes"] = video_content
                            status_ph.success("✅ Video generated!")
                            st.rerun()
                        except Exception as e:
                            status_ph.error(f"❌ {e}")

    # ── Export all scenes JSON ──
    if st.session_state.scenes:
        st.markdown("---")
        export_data = [
            {k: v for k, v in s.items() if k != "video_bytes"}
            for s in st.session_state.scenes
        ]
        st.download_button(
            "📥 Export Scenes JSON",
            data=json.dumps(export_data, indent=2, ensure_ascii=False),
            file_name="cinecraft_scenes.json",
            mime="application/json",
        )

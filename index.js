/**
 * SNS Reaction - SillyTavern Extension (v1.1)
 * 채팅 메시지마다 세계관 속 인물들의 SNS 반응을 별도 생성해서 보여주는 확장.
 * SillyTavern v1.18.x 기준. SillyTavern.getContext() 전역 API만 사용.
 */

'use strict';

const MODULE_NAME = 'sns_reaction';
const INJECT_KEY = 'SNS_REACTION';

const ctx = () => SillyTavern.getContext();

/* ------------------------------------------------------------------ */
/* 플랫폼 정의                                                          */
/* ------------------------------------------------------------------ */

const PLATFORMS = {
    twitter:   { label: 'Twitter',   icon: 'fa-brands fa-twitter' },
    instagram: { label: 'Instagram', icon: 'fa-brands fa-instagram' },
    facebook:  { label: 'Facebook',  icon: 'fa-brands fa-facebook' },
    kakao:     { label: 'KakaoTalk', icon: 'fa-solid fa-comment' },
    discord:   { label: 'Discord',   icon: 'fa-brands fa-discord' },
};

/* ------------------------------------------------------------------ */
/* 기본 지침 (영어)                                                     */
/* ------------------------------------------------------------------ */

const DEFAULT_DIRECTIVE = `### SYSTEM DIRECTIVE: STRICT GENERATION MODE
1. **NO STORY PROGRESSION**: Do not continue the roleplay or narrative. The story is completely paused. Your ONLY task is to generate social media content reacting to what has already happened.
2. **FORMAT COMPLIANCE**: Your entire output MUST be a single valid JSON object matching the schema provided below. No markdown code fences, no commentary, no explanations, absolutely no text before or after the JSON object.
3. **IN-UNIVERSE ONLY**: Every post must be written by a person who plausibly exists inside the story's world (friends, family, classmates, coworkers, bystanders, online strangers, fan accounts, etc.). Each poster only knows what they could realistically know from their own limited point of view. Do NOT give side characters omniscient knowledge of the scene.
4. **SETTING CONSISTENCY**: Poster names, handles, workplaces, and cultural details MUST fit the story's setting, era, and nationality. If the story is set in America, use American names; if it is a fantasy world, use fitting fantasy names and in-world platforms' flavor.
5. **TONE MATCHING**: The mood of the reactions should realistically reflect the situation. Horror leaking through mundane social media is encouraged when the story is dark - casual people reacting with confusion or worry to something they don't understand.
6. Invent realistic names, handles, and small personal details for posters. Reuse the same posters across a reply chain consistently.`;

const DEFAULT_INSTRUCTIONS = {
    twitter: `PLATFORM: Twitter (X) - public timeline
- Short, punchy posts. Fragmented sentences, lowercase, slang and abbreviations are natural.
- Mix of: hot takes, sarcastic quote-tweet style commentary, live-reaction threads, jokes/shitposts, and the occasional sincere concerned mutual.
- Posters can be: strangers who witnessed something, mutuals of the characters, anonymous gossip accounts, local news-style accounts, fan accounts if the character is known.
- Use realistic handles. Hashtags only when natural (0-2 max per post).
- Reply chains where strangers argue, joke, or ask "context?" are encouraged.
- "stats" should reflect realistic virality for the topic (e.g. "♥ 32" for a random post, "♥ 12.4K · 🔁 3,801" for something going viral).`,

    instagram: `PLATFORM: Instagram - curated photo feed
- Photo-first. Every post MUST include an "image" field: a vivid one-or-two sentence description of the photo.
- Captions are curated and aspirational: people show off food, outfits, trips, relationships, achievements. Emojis and a few hashtags are common.
- Posters are usually people connected to the characters (friends, acquaintances) or aesthetic accounts; strangers rarely appear.
- Comments ("replies") are friends hyping each other up, light teasing, nosy questions ("who took this? 👀").
- Even dark or disturbing events get filtered through a pretty, curated lens - that dissonance is encouraged when it fits the story (e.g. a beautiful photo where something is subtly wrong).
- "stats" example: "♥ 214 likes".`,

    facebook: `PLATFORM: Facebook - longer earnest posts
- Longer, more earnest or awkward posts. Typical posters: older relatives, professors, neighborhood/community groups, alumni pages, coworkers.
- Tone: overly formal OR awkwardly casual, overuse of ellipses..., unsolicited advice, chain-letter energy, "share if you agree".
- Community groups may share local news/rumors related to recent events: neighborhood watch warnings, missing person posts, "did anyone else hear/see...".
- Comments from aunts/uncles/acquaintances: concerned, preachy, tangential, or wildly off-topic. Someone always replies "Amen" or asks an unrelated question.
- "stats" example: "👍 45 · 댓글 12 · 공유 3".`,

    kakao: `PLATFORM: KakaoTalk - private group chat
- A private group chatroom (or 1:1 chat) between people who PERSONALLY know the user or characters: friends, family, classmates, coworkers.
- Provide a fitting "room" name (e.g. "대학 동기 단톡방", "가족방", "팀 프로젝트").
- Rapid short messages. Texting habits of the chat's language (for Korean: ㅋㅋㅋ, ㅠㅠ, ;;, ??, typos, missing punctuation, messages split across multiple bubbles).
- Members can only see what is typed or shared INTO the room - they cannot see the actual scene. They react to messages/photos with confusion, worry, jokes, or annoyance.
- If user impersonation is enabled, include messages sent by the user themselves ("is_user": true) - these render as the right-side yellow bubbles. The user's messages should reflect their current in-story state, even if incoherent or unsettling.
- Sharing an image into the room = a message with an "image" field describing the photo.`,

    discord: `PLATFORM: Discord - server channel
- A channel in a server relevant to the setting or characters (e.g. #general, #잡담, a hobby/game/fan server). Provide the channel name as "room" (with #).
- Internet-native tone: memes, emote references written as :skull: :sob: :fire:, lowercase, keyboard smashing (asdkjfh), copypasta energy, "LMAOO".
- Users have online handles; some know each other well, some are lurkers suddenly appearing. A mod may tell people to take it to another channel. Someone always derails the topic.
- Messages are short and rapid-fire like a live chat. Reply chains = people responding to each other.
- "stats" can show emoji reactions, e.g. "💀 14  😭 6".`,
};

/* ------------------------------------------------------------------ */
/* 출력 스키마                                                          */
/* ------------------------------------------------------------------ */

const OUTPUT_SCHEMA = `### OUTPUT JSON SCHEMA
{
  "room": "chatroom/channel/feed title (REQUIRED for kakao & discord, otherwise optional)",
  "posts": [
    {
      "author": "display name",
      "handle": "id/handle WITHOUT the @ (optional; omit for kakao)",
      "is_user": false,
      "content": "post/message text (may be multi-line with \\n)",
      "image": "photo description, only if this post attaches an image (optional)",
      "time": "e.g. 14:05 (optional)",
      "stats": "engagement stats string (optional)",
      "replies": [
        { "author": "...", "handle": "...", "is_user": false, "content": "...", "time": "...", "stats": "..." }
      ]
    }
  ]
}`;

const LENGTH_RULES = {
    short:  `LENGTH: Keep it brief. 2-4 top-level posts (for kakao/discord: 4-7 short messages). Minimal replies.`,
    normal: `LENGTH: Generate 3-8 top-level posts (for kakao/discord: 8-15 short messages instead; replies usually empty).`,
    long:   `LENGTH: Generate a LOT of content. 8-14 top-level posts with lively reply chains (for kakao/discord: 18-30 rapid messages). Vary the posters widely.`,
};

const LANGUAGE_LABELS = {
    ko: 'Korean (한국어)',
    en: 'English',
    ja: 'Japanese (日本語)',
    zh: 'Chinese (中文)',
};

/* ------------------------------------------------------------------ */
/* 설정                                                                */
/* ------------------------------------------------------------------ */

function defaultSettings() {
    return {
        enabled: true,
        theme: 'light',
        contextMessages: 5,
        provider: 'current',
        model: '',
        apiKeys: { openai: '', claude: '', makersuite: '', openrouter: '', custom: '' },
        customUrl: '',
        includeUser: true,
        language: 'auto',        // auto | ko | en | ja | zh | custom
        languageCustom: '',
        length: 'normal',        // short | normal | long | custom
        lengthCustom: '',
        useCharInfo: true,       // 캐릭터 설명/성격 반영
        useWorldInfo: true,      // 월드 인포 반영
        injectEnabled: true,     // 📌 고정 반응을 이후 롤플레잉에 주입
        temperature: 0.9,
        directive: DEFAULT_DIRECTIVE,
        instructions: structuredClone(DEFAULT_INSTRUCTIONS),
        presets: { twitter: {}, instagram: {}, facebook: {}, kakao: {}, discord: {} },
    };
}

function getSettings() {
    const es = ctx().extensionSettings;
    if (!es[MODULE_NAME]) es[MODULE_NAME] = defaultSettings();
    const s = es[MODULE_NAME];
    const d = defaultSettings();
    for (const k of Object.keys(d)) if (s[k] === undefined) s[k] = d[k];
    for (const p of Object.keys(PLATFORMS)) {
        if (!s.instructions[p]) s.instructions[p] = DEFAULT_INSTRUCTIONS[p];
        if (!s.presets[p]) s.presets[p] = {};
    }
    for (const k of Object.keys(d.apiKeys)) if (s.apiKeys[k] === undefined) s.apiKeys[k] = '';
    return s;
}

function saveSettings() {
    ctx().saveSettingsDebounced();
}

/* ------------------------------------------------------------------ */
/* 유틸                                                                */
/* ------------------------------------------------------------------ */

function escapeHtml(str) {
    return String(str ?? '')
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function nl2br(str) {
    return escapeHtml(str).replace(/\n/g, '<br>');
}

function stripHtml(str) {
    const div = document.createElement('div');
    div.innerHTML = String(str ?? '');
    return div.textContent || '';
}

/** 채팅 메시지에서 이미지 프롬프트/사고 과정 등 부수 태그 제거 후 순수 텍스트 추출 */
function sanitizeMes(str) {
    const div = document.createElement('div');
    div.innerHTML = String(str ?? '');
    div.querySelectorAll('autopic, uc, scene, apchar, thinking, think, details, style, script').forEach(el => el.remove());
    let t = div.textContent || '';
    t = t.replace(/```[\s\S]*?```/g, '');
    return t.trim().slice(0, 2500);
}

function nowTime() {
    const d = new Date();
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function toast(msg, type = 'info') {
    if (window.toastr) window.toastr[type](msg, 'SNS Reaction');
    else console.log(`[SNS Reaction] ${msg}`);
}

function nameHue(name) {
    let h = 0;
    for (const c of String(name || '?')) h = (h * 31 + c.codePointAt(0)) % 360;
    return h;
}

function resolveLanguage(s) {
    if (s.language === 'auto') return null;
    if (s.language === 'custom') return s.languageCustom.trim() || null;
    return LANGUAGE_LABELS[s.language] || null;
}

function languageRule(s) {
    const lang = resolveLanguage(s);
    return lang
        ? `LANGUAGE OVERRIDE: Write ALL post/message content in ${lang}, regardless of the language of the chat. Display names should fit the story's setting; handles may stay latin.`
        : `LANGUAGE: Write all post content in the same language as the recent chat messages (e.g. Korean chat -> Korean posts). Handles/usernames may be romanized.`;
}

function lengthRule(s) {
    if (s.length === 'custom' && s.lengthCustom.trim()) return `LENGTH: ${s.lengthCustom.trim()}`;
    return LENGTH_RULES[s.length] || LENGTH_RULES.normal;
}

function maxTokensForLength(s) {
    if (s.length === 'short') return 1800;
    if (s.length === 'long') return 6000;
    if (s.length === 'custom') return 5000;
    return 3000;
}

/* ------------------------------------------------------------------ */
/* LLM 호출                                                            */
/* ------------------------------------------------------------------ */

function extractResponseText(data) {
    if (typeof data === 'string') return data;
    if (!data) return '';
    if (data.choices?.[0]?.message?.content) return data.choices[0].message.content;
    if (data.choices?.[0]?.text) return data.choices[0].text;
    if (Array.isArray(data.content)) {
        const t = data.content.filter(b => b.type === 'text').map(b => b.text).join('\n');
        if (t) return t;
    }
    if (data.candidates?.[0]?.content?.parts) {
        const t = data.candidates[0].content.parts.map(p => p.text || '').join('');
        if (t) return t;
    }
    if (typeof data.content === 'string') return data.content;
    if (data.text) return data.text;
    if (data.message?.content) return data.message.content;
    return '';
}

/** "현재 연결" 모드: generateRaw (확장이 만든 프롬프트만 격리 전송, 롤플 프롬프트 미포함) */
async function callWithCurrentApi(systemPrompt, userPrompt) {
    const context = ctx();
    if (typeof context.generateRaw !== 'function') {
        throw new Error('이 버전에서는 generateRaw를 쓸 수 없습니다. 설정에서 프로바이더를 직접 호출로 바꿔주세요.');
    }
    try {
        const r = await context.generateRaw({
            prompt: userPrompt,
            systemPrompt: systemPrompt,
            instructOverride: false,
            quietToLoud: false,
        });
        if (typeof r === 'string' && r.trim()) return r;
    } catch (e) {
        console.warn('[SNS Reaction] generateRaw(객체 인자) 실패, 구형 시그니처로 재시도', e);
    }
    const r2 = await context.generateRaw(userPrompt, '', false, false, systemPrompt);
    if (typeof r2 === 'string' && r2.trim()) return r2;
    throw new Error('현재 연결로 응답을 받지 못했습니다.');
}

/** API 키가 입력된 경우: 브라우저에서 프로바이더로 직접 호출 */
async function callDirectBrowser(systemPrompt, userPrompt) {
    const s = getSettings();
    const key = (s.apiKeys[s.provider] || '').trim();
    const maxTokens = maxTokensForLength(s);
    const temp = Number(s.temperature) || 0.9;

    const chatCompletions = async (baseUrl) => {
        const headers = { 'Content-Type': 'application/json' };
        if (key) headers['Authorization'] = `Bearer ${key}`;
        const res = await fetch(`${baseUrl.replace(/\/+$/, '')}/chat/completions`, {
            method: 'POST',
            headers,
            body: JSON.stringify({
                model: s.model,
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userPrompt },
                ],
                max_tokens: maxTokens,
                temperature: temp,
                stream: false,
            }),
        });
        if (!res.ok) throw new Error(`API 오류 ${res.status}: ${(await res.text().catch(() => '')).slice(0, 300)}`);
        return extractResponseText(await res.json());
    };

    switch (s.provider) {
        case 'openai':
            return await chatCompletions('https://api.openai.com/v1');
        case 'openrouter':
            return await chatCompletions('https://openrouter.ai/api/v1');
        case 'custom': {
            if (!s.customUrl.trim()) throw new Error('Custom Base URL을 입력하세요. (예: http://127.0.0.1:1234/v1)');
            return await chatCompletions(s.customUrl.trim());
        }
        case 'claude': {
            const res = await fetch('https://api.anthropic.com/v1/messages', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': key,
                    'anthropic-version': '2023-06-01',
                    'anthropic-dangerous-direct-browser-access': 'true',
                },
                body: JSON.stringify({
                    model: s.model,
                    max_tokens: maxTokens,
                    temperature: temp,
                    system: systemPrompt,
                    messages: [{ role: 'user', content: userPrompt }],
                }),
            });
            if (!res.ok) throw new Error(`Claude API 오류 ${res.status}: ${(await res.text().catch(() => '')).slice(0, 300)}`);
            return extractResponseText(await res.json());
        }
        case 'makersuite': {
            const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(s.model)}:generateContent?key=${encodeURIComponent(key)}`;
            const res = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    systemInstruction: { parts: [{ text: systemPrompt }] },
                    contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
                    generationConfig: { maxOutputTokens: maxTokens, temperature: temp },
                }),
            });
            if (!res.ok) throw new Error(`Google API 오류 ${res.status}: ${(await res.text().catch(() => '')).slice(0, 300)}`);
            return extractResponseText(await res.json());
        }
        case 'vertexai':
            throw new Error('Vertex AI는 브라우저 직접 호출(키 입력)을 지원하지 않습니다. 키 칸을 비워 SillyTavern에 저장된 인증을 쓰거나, "현재 연결 사용"/Google AI Studio를 이용하세요.');
        default:
            throw new Error(`알 수 없는 프로바이더: ${s.provider}`);
    }
}

/** 키 미입력 시: SillyTavern 서버 경유 (API 연결 탭에 저장된 키 사용) */
async function callViaServer(systemPrompt, userPrompt) {
    const s = getSettings();
    const context = ctx();
    const headers = context.getRequestHeaders ? context.getRequestHeaders() : { 'Content-Type': 'application/json' };
    const body = {
        stream: false,
        messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
        ],
        model: s.model || undefined,
        chat_completion_source: s.provider,
        max_tokens: maxTokensForLength(s),
        temperature: Number(s.temperature) || 0.9,
    };
    const res = await fetch('/api/backends/chat-completions/generate', {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
    });
    if (!res.ok) {
        const errText = await res.text().catch(() => '');
        throw new Error(`API 오류 ${res.status}: ${errText.slice(0, 300)} (API 키를 확장 설정에 직접 입력하거나 SillyTavern API 연결 탭에 저장하세요)`);
    }
    const data = await res.json();
    const text = extractResponseText(data);
    if (!text) throw new Error('응답에서 텍스트를 추출하지 못했습니다. (콘솔 확인)');
    return text;
}

async function callLLM(systemPrompt, userPrompt) {
    const s = getSettings();
    if (s.provider === 'current') {
        return await callWithCurrentApi(systemPrompt, userPrompt);
    }
    const hasKey = !!(s.apiKeys[s.provider] || '').trim();
    const isLocalCustom = s.provider === 'custom' && !!s.customUrl.trim();
    if (hasKey || isLocalCustom) {
        return await callDirectBrowser(systemPrompt, userPrompt);
    }
    return await callViaServer(systemPrompt, userPrompt);
}

/* ------------------------------------------------------------------ */
/* 프롬프트 구성                                                         */
/* ------------------------------------------------------------------ */

function impersonationRule(allow) {
    const userName = ctx().name1 || 'User';
    return allow
        ? `USER IMPERSONATION: ENABLED. You MAY write posts/messages as ${userName} themselves (set "is_user": true on those). Their posts should reflect their current in-story mental/physical state, even if fragmented or disturbing.`
        : `USER IMPERSONATION: DISABLED. Do NOT write any post or message as ${userName}. Only other in-world people may post. Every "is_user" must be false.`;
}

async function getWorldInfoText(recent) {
    const context = ctx();
    if (typeof context.getWorldInfoPrompt !== 'function') return '';
    try {
        const lines = recent.map(m => m.mes);
        const res = await context.getWorldInfoPrompt(lines, 4096, true);
        let text = '';
        if (typeof res === 'string') text = res;
        else if (res) text = [res.worldInfoBefore, res.worldInfoString, res.worldInfoAfter].filter(Boolean).join('\n');
        return stripHtml(text).trim().slice(0, 2000);
    } catch (e) {
        console.warn('[SNS Reaction] 월드 인포 로드 실패', e);
        return '';
    }
}

async function buildPrompts(platform, mesId, includeUser) {
    const s = getSettings();
    const context = ctx();
    const sub = (t) => (context.substituteParams ? context.substituteParams(t) : t);

    const n = Math.max(1, Number(s.contextMessages) || 5);
    const upto = context.chat.slice(0, mesId + 1).filter(m => !m.is_system);
    const recent = upto.slice(-n);
    const chatLog = recent
        .map(m => `${m.name}: ${sanitizeMes(m.mes)}`)
        .join('\n\n');

    let charBlock = '';
    if (s.useCharInfo) {
        const char = context.characters?.[context.characterId];
        const desc = char?.description ? stripHtml(sub(char.description)).slice(0, 800) : '';
        const pers = char?.personality ? stripHtml(sub(char.personality)).slice(0, 400) : '';
        const scenario = char?.scenario ? stripHtml(sub(char.scenario)).slice(0, 400) : '';
        charBlock = [
            desc ? `Character description: ${desc}` : '',
            pers ? `Personality: ${pers}` : '',
            scenario ? `Scenario: ${scenario}` : '',
        ].filter(Boolean).join('\n');
    }

    const worldInfo = s.useWorldInfo ? await getWorldInfoText(recent) : '';

    const systemPrompt = [
        sub(s.directive),
        '',
        sub(s.instructions[platform] || DEFAULT_INSTRUCTIONS[platform]),
        '',
        impersonationRule(includeUser),
        languageRule(s),
        lengthRule(s),
        '',
        OUTPUT_SCHEMA,
    ].join('\n');

    const userPrompt = [
        '### STORY CONTEXT',
        `User (protagonist): ${context.name1 || 'User'}`,
        `Main character: ${context.name2 || 'Character'}`,
        charBlock,
        worldInfo ? `### WORLD INFO (setting/lore - names and culture MUST match this)\n${worldInfo}` : '',
        '',
        `### RECENT CHAT (most recent last, ${recent.length} messages)`,
        chatLog,
        '',
        `### TASK`,
        `Generate in-universe ${PLATFORMS[platform].label} reactions to the situation above, following every rule in the system directive.`,
        '',
        `FINAL REMINDER: The roleplay is PAUSED. Do NOT write narration, dialogue, or story continuation of any kind. Do NOT speak as the main character. Your entire response must be a single JSON object that starts with { and ends with }. Nothing else.`,
    ].filter(Boolean).join('\n');

    return { systemPrompt, userPrompt };
}

function parseModelJson(raw) {
    let text = String(raw ?? '').trim();
    text = text.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();
    const first = text.indexOf('{');
    const last = text.lastIndexOf('}');
    if (first === -1 || last === -1 || last <= first) return null;
    const slice = text.slice(first, last + 1);
    try {
        return JSON.parse(slice);
    } catch {
        try {
            return JSON.parse(slice.replace(/,\s*([}\]])/g, '$1'));
        } catch {
            return null;
        }
    }
}

/* ------------------------------------------------------------------ */
/* SNS 카드 렌더링                                                       */
/* ------------------------------------------------------------------ */

function avatarHtml(name, cls = '', useHue = true) {
    const chSrc = String(name || '?').trim();
    const ch = chSrc.charAt(0) || '?';
    const style = useHue
        ? ` style="background: linear-gradient(135deg, hsl(${nameHue(chSrc)} 42% 60%), hsl(${nameHue(chSrc)} 46% 44%))"`
        : '';
    return `<div class="snsr_avatar ${cls}"${style}>${escapeHtml(ch)}</div>`;
}

function imageCardHtml(desc) {
    if (!desc) return '';
    return `<div class="snsr_img"><i class="fa-regular fa-image"></i><div class="snsr_img_desc">${nl2br(desc)}</div></div>`;
}

function renderTwitter(data) {
    const posts = (data.posts || []).map(p => {
        const replies = (p.replies || []).map(r => `
            <div class="snsr_tw_reply">
                ${avatarHtml(r.author)}
                <div class="snsr_tw_body">
                    <div class="snsr_tw_head"><b>${escapeHtml(r.author)}</b>${r.handle ? `<span class="snsr_dim">@${escapeHtml(r.handle)}</span>` : ''}${r.time ? `<span class="snsr_dim">· ${escapeHtml(r.time)}</span>` : ''}</div>
                    <div class="snsr_tw_text">${nl2br(r.content)}</div>
                    ${r.stats ? `<div class="snsr_stats">${escapeHtml(r.stats)}</div>` : ''}
                </div>
            </div>`).join('');
        return `
        <div class="snsr_tw_post">
            ${avatarHtml(p.author)}
            <div class="snsr_tw_body">
                <div class="snsr_tw_head"><b>${escapeHtml(p.author)}</b>${p.handle ? `<span class="snsr_dim">@${escapeHtml(p.handle)}</span>` : ''}${p.time ? `<span class="snsr_dim">· ${escapeHtml(p.time)}</span>` : ''}</div>
                <div class="snsr_tw_text">${nl2br(p.content)}</div>
                ${imageCardHtml(p.image)}
                ${p.stats ? `<div class="snsr_stats">${escapeHtml(p.stats)}</div>` : ''}
                ${replies}
            </div>
        </div>`;
    }).join('');
    return `<div class="snsr_card snsr_twitter"><div class="snsr_card_head"><i class="fa-brands fa-twitter"></i> Twitter</div>${posts}</div>`;
}

function renderInstagram(data) {
    const posts = (data.posts || []).map(p => {
        const comments = (p.replies || []).map(r => `
            <div class="snsr_ig_comment"><b>${escapeHtml(r.author)}</b> ${nl2br(r.content)}</div>`).join('');
        return `
        <div class="snsr_ig_post">
            <div class="snsr_ig_head">${avatarHtml(p.author, 'snsr_ig_avatar', false)}<b>${escapeHtml(p.author)}</b>${p.handle ? `<span class="snsr_dim">@${escapeHtml(p.handle)}</span>` : ''}</div>
            ${imageCardHtml(p.image || '(사진)')}
            <div class="snsr_ig_icons"><i class="fa-regular fa-heart"></i><i class="fa-regular fa-comment"></i><i class="fa-regular fa-paper-plane"></i><i class="fa-regular fa-bookmark snsr_ig_save"></i></div>
            ${p.stats ? `<div class="snsr_stats snsr_ig_stats">${escapeHtml(p.stats)}</div>` : ''}
            <div class="snsr_ig_caption"><b>${escapeHtml(p.author)}</b> ${nl2br(p.content)}</div>
            ${comments}
            ${p.time ? `<div class="snsr_dim snsr_ig_time">${escapeHtml(p.time)}</div>` : ''}
        </div>`;
    }).join('');
    return `<div class="snsr_card snsr_instagram"><div class="snsr_card_head"><i class="fa-brands fa-instagram"></i> Instagram</div>${posts}</div>`;
}

function renderFacebook(data) {
    const posts = (data.posts || []).map(p => {
        const comments = (p.replies || []).map(r => `
            <div class="snsr_fb_comment">${avatarHtml(r.author)}<div class="snsr_fb_comment_bubble"><b>${escapeHtml(r.author)}</b><br>${nl2br(r.content)}</div></div>`).join('');
        return `
        <div class="snsr_fb_post">
            <div class="snsr_fb_head">${avatarHtml(p.author)}<div><b>${escapeHtml(p.author)}</b><div class="snsr_dim">${escapeHtml(p.time || '방금 전')} · 🌐</div></div></div>
            <div class="snsr_fb_text">${nl2br(p.content)}</div>
            ${imageCardHtml(p.image)}
            ${p.stats ? `<div class="snsr_stats snsr_fb_stats">${escapeHtml(p.stats)}</div>` : ''}
            ${comments}
        </div>`;
    }).join('');
    return `<div class="snsr_card snsr_facebook"><div class="snsr_card_head"><i class="fa-brands fa-facebook"></i> Facebook</div>${posts}</div>`;
}

function renderKakao(data) {
    const msgs = (data.posts || []).flatMap(p => [p, ...(p.replies || [])]).map(p => {
        const img = imageCardHtml(p.image);
        if (p.is_user) {
            return `
            <div class="snsr_kk_row snsr_kk_right">
                <span class="snsr_kk_time">${escapeHtml(p.time || '')}</span>
                <div class="snsr_kk_col">${img}${p.content ? `<div class="snsr_kk_bubble snsr_kk_mine">${nl2br(p.content)}</div>` : ''}</div>
            </div>`;
        }
        return `
        <div class="snsr_kk_row">
            ${avatarHtml(p.author, 'snsr_kk_avatar')}
            <div class="snsr_kk_col">
                <div class="snsr_kk_name">${escapeHtml(p.author)}</div>
                ${img}${p.content ? `<div class="snsr_kk_bubble">${nl2br(p.content)}</div>` : ''}
            </div>
            <span class="snsr_kk_time">${escapeHtml(p.time || '')}</span>
        </div>`;
    }).join('');
    return `<div class="snsr_card snsr_kakao"><div class="snsr_kk_room"><i class="fa-solid fa-comment"></i> ${escapeHtml(data.room || '단톡방')}</div>${msgs}</div>`;
}

function renderDiscord(data) {
    const msgs = (data.posts || []).flatMap(p => [p, ...(p.replies || [])]).map(p => `
        <div class="snsr_dc_msg">
            ${avatarHtml(p.author, 'snsr_dc_avatar')}
            <div class="snsr_dc_body">
                <div class="snsr_dc_head"><b style="color: hsl(${nameHue(p.author)} 60% 62%)">${escapeHtml(p.author)}</b><span class="snsr_dim">${escapeHtml(p.time || '')}</span></div>
                <div class="snsr_dc_text">${nl2br(p.content)}</div>
                ${imageCardHtml(p.image)}
                ${p.stats ? `<div class="snsr_dc_reacts">${escapeHtml(p.stats)}</div>` : ''}
            </div>
        </div>`).join('');
    return `<div class="snsr_card snsr_discord"><div class="snsr_dc_room"><i class="fa-solid fa-hashtag"></i> ${escapeHtml((data.room || 'general').replace(/^#\s*/, ''))}</div>${msgs}</div>`;
}

const RENDERERS = {
    twitter: renderTwitter,
    instagram: renderInstagram,
    facebook: renderFacebook,
    kakao: renderKakao,
    discord: renderDiscord,
};

function renderReaction(reaction, index) {
    const s = getSettings();
    const themeCls = s.theme === 'dark' ? 'snsr_dark' : 'snsr_light';
    let inner;
    if (reaction.data && RENDERERS[reaction.platform]) {
        inner = RENDERERS[reaction.platform](reaction.data);
    } else {
        inner = `<div class="snsr_card"><pre class="snsr_raw">${escapeHtml(reaction.raw || '(빈 응답)')}</pre></div>`;
    }
    const pinActive = reaction.inject ? 'snsr_pin_active' : '';
    return `
    <div class="snsr_reaction ${themeCls}" data-index="${index}">
        <div class="snsr_reaction_bar">
            <span><i class="${PLATFORMS[reaction.platform]?.icon || 'fa-solid fa-hashtag'}"></i> ${escapeHtml(PLATFORMS[reaction.platform]?.label || reaction.platform)} · ${escapeHtml(reaction.time || '')}</span>
            <div class="snsr_bar_actions">
                <div class="snsr_pin ${pinActive}" title="이후 롤플레잉에 반영 (📌 고정)"><i class="fa-solid fa-thumbtack"></i></div>
                <div class="snsr_translate" title="번역"><i class="fa-solid fa-language"></i></div>
                <div class="snsr_regen" title="다시 생성"><i class="fa-solid fa-rotate"></i></div>
                <div class="snsr_del" title="삭제"><i class="fa-solid fa-trash-can"></i></div>
            </div>
        </div>
        ${inner}
    </div>`;
}

/* ------------------------------------------------------------------ */
/* 메시지별 UI 부착                                                      */
/* ------------------------------------------------------------------ */

function getReactions(mesId) {
    const msg = ctx().chat[mesId];
    return msg?.extra?.sns_reactions || [];
}

function renderSavedReactions(mesEl) {
    const mesId = Number(mesEl.getAttribute('mesid'));
    const results = mesEl.querySelector('.snsr_results');
    if (!results) return;
    const reactions = getReactions(mesId);
    results.innerHTML = reactions.map((r, i) => renderReaction(r, i)).join('');
    const toggle = mesEl.querySelector('.snsr_toggle_label');
    if (toggle) toggle.textContent = `SNS 반응${reactions.length ? ` (${reactions.length})` : ''}`;
}

function attachToMessage(mesEl) {
    const s = getSettings();
    if (!mesEl || mesEl.classList.contains('snsr_done')) {
        if (mesEl) renderSavedReactions(mesEl);
        return;
    }
    const mesId = Number(mesEl.getAttribute('mesid'));
    if (Number.isNaN(mesId)) return;
    const msg = ctx().chat[mesId];
    if (!msg || msg.is_system) return;

    const block = mesEl.querySelector('.mes_block') || mesEl;
    const wrap = document.createElement('div');
    wrap.className = 'snsr_wrap';
    if (!s.enabled) wrap.style.display = 'none';

    const platformButtons = Object.entries(PLATFORMS).map(([key, p]) =>
        `<div class="snsr_gen menu_button" data-platform="${key}" title="${p.label} 반응 생성"><i class="${p.icon}"></i><span>${p.label}</span></div>`
    ).join('');

    wrap.innerHTML = `
        <div class="snsr_toggle">
            <i class="fa-solid fa-caret-right snsr_caret"></i>
            <i class="fa-solid fa-tower-broadcast"></i>
            <span class="snsr_toggle_label">SNS 반응</span>
        </div>
        <div class="snsr_panel" style="display:none">
            <div class="snsr_controls">
                ${platformButtons}
                <label class="checkbox_label snsr_user_check" title="세계관 인물이 {{user}}인 척 게시물을 올릴 수 있게 허용">
                    <input type="checkbox" class="snsr_include_user" ${s.includeUser ? 'checked' : ''}>
                    <span>{{user}} 사칭 포함</span>
                </label>
            </div>
            <div class="snsr_status" style="display:none"></div>
            <div class="snsr_results"></div>
        </div>`;

    block.appendChild(wrap);
    mesEl.classList.add('snsr_done');
    renderSavedReactions(mesEl);
}

function attachAll() {
    document.querySelectorAll('#chat .mes').forEach(attachToMessage);
}

function refreshVisibility() {
    const s = getSettings();
    document.querySelectorAll('.snsr_wrap').forEach(w => {
        w.style.display = s.enabled ? '' : 'none';
    });
}

/* ------------------------------------------------------------------ */
/* 스토리 주입 (📌 고정된 반응을 이후 롤플레잉 프롬프트에 삽입)              */
/* ------------------------------------------------------------------ */

function reactionToPlainText(r) {
    if (!r.data) return '';
    const label = PLATFORMS[r.platform]?.label || r.platform;
    const lines = [`[${label}${r.data.room ? ` - ${r.data.room}` : ''}]`];
    const walk = (p, indent = '') => {
        const who = p.is_user ? `${ctx().name1 || 'User'}` : (p.author || '?');
        const handle = p.handle ? ` (@${p.handle})` : '';
        const img = p.image ? ` [사진: ${p.image}]` : '';
        lines.push(`${indent}${who}${handle}: ${String(p.content || '').replace(/\n/g, ' ')}${img}`);
        (p.replies || []).forEach(rp => walk(rp, indent + '  └ '));
    };
    (r.data.posts || []).forEach(p => walk(p));
    return lines.join('\n').slice(0, 1500);
}

function updateInjection() {
    const context = ctx();
    if (typeof context.setExtensionPrompt !== 'function') return;
    const s = getSettings();
    let text = '';
    if (s.injectEnabled) {
        const pinned = [];
        (context.chat || []).forEach(m => {
            (m?.extra?.sns_reactions || []).forEach(r => {
                if (r.inject) {
                    const t = reactionToPlainText(r);
                    if (t) pinned.push(t);
                }
            });
        });
        const recentPinned = pinned.slice(-5);
        if (recentPinned.length) {
            text = '[In-universe social media activity that characters in the story may have seen or posted:]\n'
                + recentPinned.join('\n\n');
        }
    }
    try {
        // setExtensionPrompt(key, value, position(1=IN_CHAT), depth, scan, role)
        context.setExtensionPrompt(INJECT_KEY, text, 1, 1, false, 0);
    } catch (e) {
        console.warn('[SNS Reaction] 프롬프트 주입 실패', e);
    }
}

/* ------------------------------------------------------------------ */
/* 생성 / 번역 / 삭제                                                    */
/* ------------------------------------------------------------------ */

async function generateReaction(mesEl, platform, replaceIndex = -1, includeUserOverride = null) {
    const mesId = Number(mesEl.getAttribute('mesid'));
    const context = ctx();
    const msg = context.chat[mesId];
    if (!msg) return;

    const status = mesEl.querySelector('.snsr_status');
    const includeUser = includeUserOverride ?? (mesEl.querySelector('.snsr_include_user')?.checked ?? getSettings().includeUser);
    const buttons = mesEl.querySelectorAll('.snsr_gen');
    buttons.forEach(b => b.classList.add('disabled'));
    status.style.display = '';
    status.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> ${PLATFORMS[platform].label} 반응 생성 중...`;

    try {
        const { systemPrompt, userPrompt } = await buildPrompts(platform, mesId, includeUser);
        let raw = await callLLM(systemPrompt, userPrompt);
        let data = parseModelJson(raw);

        if (!data) {
            status.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> 형식 오류 감지 - 재시도 중...`;
            const retryPrompt = userPrompt
                + '\n\n### PREVIOUS ATTEMPT REJECTED'
                + '\nYour previous output was rejected because it was NOT a single valid JSON object (it contained narrative or invalid formatting).'
                + '\nThis is NOT a roleplay turn. Output ONLY the JSON object described in the schema. Start your response with { and end with }.';
            raw = await callLLM(systemPrompt, retryPrompt);
            data = parseModelJson(raw);
        }

        const entry = {
            platform,
            includeUser,
            inject: false,
            time: nowTime(),
            data,
            raw: data ? undefined : String(raw).slice(0, 4000),
        };

        msg.extra = msg.extra || {};
        msg.extra.sns_reactions = msg.extra.sns_reactions || [];
        if (replaceIndex >= 0 && replaceIndex < msg.extra.sns_reactions.length) {
            entry.inject = !!msg.extra.sns_reactions[replaceIndex].inject;
            msg.extra.sns_reactions[replaceIndex] = entry;
        } else {
            msg.extra.sns_reactions.push(entry);
        }
        await context.saveChat();
        renderSavedReactions(mesEl);
        updateInjection();
        if (!data) toast('재시도 후에도 JSON 파싱 실패 - 원문을 그대로 표시합니다. 🔄 버튼으로 다시 생성해 보세요.', 'warning');
    } catch (err) {
        console.error('[SNS Reaction]', err);
        toast(String(err.message || err), 'error');
    } finally {
        status.style.display = 'none';
        buttons.forEach(b => b.classList.remove('disabled'));
    }
}

async function translateReaction(mesEl, index) {
    const mesId = Number(mesEl.getAttribute('mesid'));
    const context = ctx();
    const msg = context.chat[mesId];
    const entry = msg?.extra?.sns_reactions?.[index];
    if (!entry) return;
    if (!entry.data) { toast('JSON 파싱에 성공한 반응만 번역할 수 있습니다.', 'warning'); return; }

    const s = getSettings();
    const target = resolveLanguage(s) || 'Korean (한국어)';

    const status = mesEl.querySelector('.snsr_status');
    status.style.display = '';
    status.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> ${escapeHtml(target)}(으)로 번역 중...`;

    const systemPrompt = 'You are a precise translator for social media content. Your entire output must be a single valid JSON object. No code fences, no commentary.';
    const userPrompt = [
        `Translate the human-readable text in the following JSON into ${target}.`,
        `- Translate: "content", "image", "room", and text inside "stats" (keep numbers/emoji).`,
        `- "author": render display names naturally in the target language if appropriate; "handle" stays latin.`,
        `- Keep the EXACT same JSON structure, keys, and order. Keep slang/texting tone natural in the target language.`,
        `- Output ONLY the JSON object.`,
        '',
        JSON.stringify(entry.data),
    ].join('\n');

    try {
        const raw = await callLLM(systemPrompt, userPrompt);
        const data = parseModelJson(raw);
        if (!data) throw new Error('번역 결과 JSON 파싱 실패');
        entry.data = data;
        entry.translated = target;
        await context.saveChat();
        renderSavedReactions(mesEl);
        updateInjection();
        toast('번역 완료', 'success');
    } catch (err) {
        console.error('[SNS Reaction]', err);
        toast(String(err.message || err), 'error');
    } finally {
        status.style.display = 'none';
    }
}

async function deleteReaction(mesEl, index) {
    const mesId = Number(mesEl.getAttribute('mesid'));
    const context = ctx();
    const msg = context.chat[mesId];
    if (!msg?.extra?.sns_reactions) return;
    msg.extra.sns_reactions.splice(index, 1);
    await context.saveChat();
    renderSavedReactions(mesEl);
    updateInjection();
}

async function togglePin(mesEl, index) {
    const mesId = Number(mesEl.getAttribute('mesid'));
    const context = ctx();
    const entry = context.chat[mesId]?.extra?.sns_reactions?.[index];
    if (!entry) return;
    entry.inject = !entry.inject;
    await context.saveChat();
    renderSavedReactions(mesEl);
    updateInjection();
    toast(entry.inject ? '이 반응이 이후 롤플레잉에 반영됩니다. 📌' : '이후 롤플레잉 반영이 해제되었습니다.');
}

/* ------------------------------------------------------------------ */
/* 설정 패널                                                            */
/* ------------------------------------------------------------------ */

let activePlatform = 'twitter';
let activePreset = '';

function settingsHtml() {
    const platformTabs = Object.entries(PLATFORMS).map(([key, p]) =>
        `<div class="snsr_tab menu_button" data-platform="${key}"><i class="${p.icon}"></i> ${p.label}</div>`
    ).join('');

    return `
    <div class="snsr_settings">
        <div class="inline-drawer">
            <div class="inline-drawer-toggle inline-drawer-header">
                <b>SNS 반응</b>
                <div class="inline-drawer-icon fa-solid fa-circle-chevron-down down"></div>
            </div>
            <div class="inline-drawer-content">
                <label class="checkbox_label">
                    <input id="snsr_enabled" type="checkbox">
                    <span>SNS 반응 활성화</span>
                </label>
                <hr>
                <div class="snsr_grid2">
                    <div>
                        <label for="snsr_theme"><small>테마 모드</small></label>
                        <select id="snsr_theme" class="text_pole">
                            <option value="light">라이트</option>
                            <option value="dark">다크</option>
                        </select>
                    </div>
                    <div>
                        <label for="snsr_context"><small>컨텍스트 메시지</small></label>
                        <input id="snsr_context" type="number" min="1" max="50" class="text_pole">
                    </div>
                    <div>
                        <label for="snsr_provider"><small>프로바이더</small></label>
                        <select id="snsr_provider" class="text_pole">
                            <option value="current">현재 연결 사용 (메인 API)</option>
                            <option value="openai">OpenAI</option>
                            <option value="claude">Claude (Anthropic)</option>
                            <option value="makersuite">Google AI Studio</option>
                            <option value="vertexai">Google Vertex AI</option>
                            <option value="openrouter">OpenRouter</option>
                            <option value="custom">Custom (OpenAI 호환)</option>
                        </select>
                    </div>
                    <div>
                        <label for="snsr_model"><small>모델</small></label>
                        <input id="snsr_model" type="text" class="text_pole" placeholder="예: gemini-3.1-pro-preview">
                    </div>
                </div>
                <div id="snsr_key_block" style="display:none">
                    <label for="snsr_api_key"><small>API 키 <span class="snsr_hint">(비우면 SillyTavern API 연결 탭에 저장된 키로 서버 경유 호출)</span></small></label>
                    <input id="snsr_api_key" type="password" class="text_pole" placeholder="sk-... / AIza...">
                    <div id="snsr_custom_url_block" style="display:none">
                        <label for="snsr_custom_url"><small>Custom Base URL</small></label>
                        <input id="snsr_custom_url" type="text" class="text_pole" placeholder="예: http://127.0.0.1:1234/v1">
                    </div>
                    <small id="snsr_vertex_note" class="snsr_hint" style="display:none">Vertex AI는 키 직접 입력이 지원되지 않습니다. SillyTavern API 연결 탭에 인증을 저장해 두면 서버 경유로 호출됩니다.</small>
                </div>
                <div class="snsr_grid2">
                    <div>
                        <label for="snsr_language"><small>출력 언어</small></label>
                        <select id="snsr_language" class="text_pole">
                            <option value="auto">자동 (채팅 언어 따라감)</option>
                            <option value="ko">한국어</option>
                            <option value="en">English</option>
                            <option value="ja">日本語</option>
                            <option value="zh">中文</option>
                            <option value="custom">커스텀...</option>
                        </select>
                        <input id="snsr_language_custom" type="text" class="text_pole" placeholder="예: French" style="display:none; margin-top:4px;">
                    </div>
                    <div>
                        <label for="snsr_length"><small>반응 길이</small></label>
                        <select id="snsr_length" class="text_pole">
                            <option value="short">짧게</option>
                            <option value="normal">보통</option>
                            <option value="long">길게</option>
                            <option value="custom">커스텀...</option>
                        </select>
                        <input id="snsr_length_custom" type="text" class="text_pole" placeholder="예: exactly 5 posts, each 2 sentences" style="display:none; margin-top:4px;">
                    </div>
                </div>
                <label class="checkbox_label" title="캐릭터 카드의 설명/성격/시나리오를 생성 컨텍스트에 포함">
                    <input id="snsr_use_char" type="checkbox">
                    <span>캐릭터 정보 반영</span>
                </label>
                <label class="checkbox_label" title="최근 대화로 발동되는 월드 인포(로어북)를 생성 컨텍스트에 포함 - 세계관에 맞는 이름/문화가 나오게 함">
                    <input id="snsr_use_wi" type="checkbox">
                    <span>월드 인포 반영</span>
                </label>
                <label class="checkbox_label" title="각 반응 카드의 📌 버튼으로 고정한 반응을 이후 롤플레잉 프롬프트에 삽입 (최근 5개까지)">
                    <input id="snsr_inject" type="checkbox">
                    <span>📌 고정한 반응을 이후 롤플레잉에 반영</span>
                </label>
                <label class="checkbox_label" title="메시지별 패널의 체크박스 기본값">
                    <input id="snsr_include_user_default" type="checkbox">
                    <span>{{user}} 사칭 기본 허용</span>
                </label>
                <hr>
                <h4>지시사항 프리셋 (플랫폼별)</h4>
                <div class="snsr_tabs">${platformTabs}</div>
                <select id="snsr_preset_select" class="text_pole">
                    <option value="">-- New Preset --</option>
                </select>
                <label for="snsr_preset_name"><small>프리셋 이름</small></label>
                <input id="snsr_preset_name" type="text" class="text_pole" placeholder="프리셋 이름">
                <label for="snsr_instructions"><small>사용자 지정 지시사항</small></label>
                <textarea id="snsr_instructions" class="text_pole textarea_compact" rows="8"></textarea>
                <div class="snsr_row_right"><small><a id="snsr_restore_default" href="javascript:void(0)">이 플랫폼 기본값 불러오기</a></small></div>
                <div class="snsr_btn_row">
                    <div id="snsr_save_current" class="menu_button"><i class="fa-solid fa-save"></i> 저장 (현재)</div>
                    <div id="snsr_save_all" class="menu_button"><i class="fa-solid fa-cloud-arrow-up"></i> 저장 (전체)</div>
                    <div id="snsr_delete_preset" class="menu_button" title="선택된 프리셋 삭제"><i class="fa-solid fa-trash-can"></i></div>
                </div>
                <hr>
                <div class="inline-drawer">
                    <div class="inline-drawer-toggle inline-drawer-header">
                        <b>공통 지침 (STRICT GENERATION MODE)</b>
                        <div class="inline-drawer-icon fa-solid fa-circle-chevron-down down"></div>
                    </div>
                    <div class="inline-drawer-content">
                        <textarea id="snsr_directive" class="text_pole textarea_compact" rows="8"></textarea>
                        <div class="snsr_row_right"><small><a id="snsr_restore_directive" href="javascript:void(0)">기본값 불러오기</a></small></div>
                    </div>
                </div>
            </div>
        </div>
    </div>`;
}

function refreshKeyBlock() {
    const s = getSettings();
    const block = document.getElementById('snsr_key_block');
    const keyInput = document.getElementById('snsr_api_key');
    const customBlock = document.getElementById('snsr_custom_url_block');
    const vertexNote = document.getElementById('snsr_vertex_note');
    if (!block) return;
    const p = s.provider;
    block.style.display = p === 'current' ? 'none' : '';
    customBlock.style.display = p === 'custom' ? '' : 'none';
    vertexNote.style.display = p === 'vertexai' ? '' : 'none';
    keyInput.style.display = p === 'vertexai' ? 'none' : '';
    keyInput.value = s.apiKeys[p] || '';
}

function refreshPresetUI() {
    const s = getSettings();
    document.querySelectorAll('.snsr_tab').forEach(t => {
        t.classList.toggle('snsr_tab_active', t.dataset.platform === activePlatform);
    });
    const select = document.getElementById('snsr_preset_select');
    const names = Object.keys(s.presets[activePlatform] || {});
    select.innerHTML = `<option value="">-- New Preset --</option>` +
        names.map(n => `<option value="${escapeHtml(n)}">${escapeHtml(n)}</option>`).join('');
    select.value = names.includes(activePreset) ? activePreset : '';
    if (select.value === '') activePreset = '';
    document.getElementById('snsr_preset_name').value = activePreset;
    document.getElementById('snsr_instructions').value =
        activePreset ? s.presets[activePlatform][activePreset] : (s.instructions[activePlatform] || '');
}

function bindSettings() {
    const s = getSettings();

    const enabled = document.getElementById('snsr_enabled');
    enabled.checked = s.enabled;
    enabled.addEventListener('change', () => { s.enabled = enabled.checked; saveSettings(); refreshVisibility(); });

    const theme = document.getElementById('snsr_theme');
    theme.value = s.theme;
    theme.addEventListener('change', () => {
        s.theme = theme.value; saveSettings();
        document.querySelectorAll('#chat .mes').forEach(renderSavedReactions);
    });

    const context = document.getElementById('snsr_context');
    context.value = s.contextMessages;
    context.addEventListener('change', () => { s.contextMessages = Math.max(1, Number(context.value) || 5); saveSettings(); });

    const provider = document.getElementById('snsr_provider');
    provider.value = s.provider;
    provider.addEventListener('change', () => { s.provider = provider.value; saveSettings(); refreshKeyBlock(); });

    const model = document.getElementById('snsr_model');
    model.value = s.model;
    model.addEventListener('input', () => { s.model = model.value.trim(); saveSettings(); });

    const apiKey = document.getElementById('snsr_api_key');
    apiKey.addEventListener('input', () => {
        if (s.provider !== 'current' && s.provider !== 'vertexai') {
            s.apiKeys[s.provider] = apiKey.value.trim();
            saveSettings();
        }
    });

    const customUrl = document.getElementById('snsr_custom_url');
    customUrl.value = s.customUrl;
    customUrl.addEventListener('input', () => { s.customUrl = customUrl.value.trim(); saveSettings(); });

    const language = document.getElementById('snsr_language');
    const languageCustom = document.getElementById('snsr_language_custom');
    language.value = s.language;
    languageCustom.value = s.languageCustom;
    languageCustom.style.display = s.language === 'custom' ? '' : 'none';
    language.addEventListener('change', () => {
        s.language = language.value; saveSettings();
        languageCustom.style.display = s.language === 'custom' ? '' : 'none';
    });
    languageCustom.addEventListener('input', () => { s.languageCustom = languageCustom.value; saveSettings(); });

    const length = document.getElementById('snsr_length');
    const lengthCustom = document.getElementById('snsr_length_custom');
    length.value = s.length;
    lengthCustom.value = s.lengthCustom;
    lengthCustom.style.display = s.length === 'custom' ? '' : 'none';
    length.addEventListener('change', () => {
        s.length = length.value; saveSettings();
        lengthCustom.style.display = s.length === 'custom' ? '' : 'none';
    });
    lengthCustom.addEventListener('input', () => { s.lengthCustom = lengthCustom.value; saveSettings(); });

    const useChar = document.getElementById('snsr_use_char');
    useChar.checked = s.useCharInfo;
    useChar.addEventListener('change', () => { s.useCharInfo = useChar.checked; saveSettings(); });

    const useWi = document.getElementById('snsr_use_wi');
    useWi.checked = s.useWorldInfo;
    useWi.addEventListener('change', () => { s.useWorldInfo = useWi.checked; saveSettings(); });

    const inject = document.getElementById('snsr_inject');
    inject.checked = s.injectEnabled;
    inject.addEventListener('change', () => { s.injectEnabled = inject.checked; saveSettings(); updateInjection(); });

    const includeUser = document.getElementById('snsr_include_user_default');
    includeUser.checked = s.includeUser;
    includeUser.addEventListener('change', () => { s.includeUser = includeUser.checked; saveSettings(); });

    const directive = document.getElementById('snsr_directive');
    directive.value = s.directive;
    directive.addEventListener('input', () => { s.directive = directive.value; saveSettings(); });
    document.getElementById('snsr_restore_directive').addEventListener('click', () => {
        s.directive = DEFAULT_DIRECTIVE; directive.value = DEFAULT_DIRECTIVE; saveSettings();
        toast('공통 지침을 기본값으로 되돌렸습니다.');
    });

    document.querySelectorAll('.snsr_tab').forEach(tab => {
        tab.addEventListener('click', () => {
            activePlatform = tab.dataset.platform;
            activePreset = '';
            refreshPresetUI();
        });
    });

    document.getElementById('snsr_preset_select').addEventListener('change', (e) => {
        activePreset = e.target.value;
        refreshPresetUI();
    });

    document.getElementById('snsr_instructions').addEventListener('input', (e) => {
        if (!activePreset) {
            s.instructions[activePlatform] = e.target.value;
            saveSettings();
        }
    });

    document.getElementById('snsr_restore_default').addEventListener('click', () => {
        s.instructions[activePlatform] = DEFAULT_INSTRUCTIONS[activePlatform];
        activePreset = '';
        saveSettings();
        refreshPresetUI();
        toast(`${PLATFORMS[activePlatform].label} 지시사항을 기본값으로 되돌렸습니다.`);
    });

    document.getElementById('snsr_save_current').addEventListener('click', () => {
        const name = document.getElementById('snsr_preset_name').value.trim();
        const text = document.getElementById('snsr_instructions').value;
        if (name) {
            s.presets[activePlatform][name] = text;
            activePreset = name;
        }
        s.instructions[activePlatform] = text;
        saveSettings();
        refreshPresetUI();
        toast(name
            ? `[${PLATFORMS[activePlatform].label}] 프리셋 "${name}" 저장 및 적용 완료`
            : `[${PLATFORMS[activePlatform].label}] 지시사항 적용 완료 (이름을 입력하면 프리셋으로 저장됩니다)`,
            'success');
    });

    document.getElementById('snsr_save_all').addEventListener('click', () => {
        const text = document.getElementById('snsr_instructions').value;
        s.instructions[activePlatform] = text;
        s.directive = directive.value;
        saveSettings();
        toast('전체 설정 저장 완료', 'success');
    });

    document.getElementById('snsr_delete_preset').addEventListener('click', () => {
        if (!activePreset) { toast('삭제할 프리셋을 먼저 선택하세요.', 'warning'); return; }
        delete s.presets[activePlatform][activePreset];
        activePreset = '';
        saveSettings();
        refreshPresetUI();
        toast('프리셋 삭제 완료', 'success');
    });

    refreshKeyBlock();
    refreshPresetUI();
}

/* ------------------------------------------------------------------ */
/* 이벤트 위임 (메시지 패널)                                              */
/* ------------------------------------------------------------------ */

function bindDelegatedEvents() {
    document.addEventListener('click', (e) => {
        const toggle = e.target.closest('.snsr_toggle');
        if (toggle) {
            const wrap = toggle.closest('.snsr_wrap');
            const panel = wrap.querySelector('.snsr_panel');
            const caret = wrap.querySelector('.snsr_caret');
            const open = panel.style.display === 'none';
            panel.style.display = open ? '' : 'none';
            caret.classList.toggle('fa-caret-down', open);
            caret.classList.toggle('fa-caret-right', !open);
            return;
        }
        const gen = e.target.closest('.snsr_gen');
        if (gen && !gen.classList.contains('disabled')) {
            generateReaction(gen.closest('.mes'), gen.dataset.platform);
            return;
        }
        const pin = e.target.closest('.snsr_pin');
        if (pin) {
            const mesEl = pin.closest('.mes');
            togglePin(mesEl, Number(pin.closest('.snsr_reaction').dataset.index));
            return;
        }
        const tr = e.target.closest('.snsr_translate');
        if (tr) {
            const mesEl = tr.closest('.mes');
            translateReaction(mesEl, Number(tr.closest('.snsr_reaction').dataset.index));
            return;
        }
        const regen = e.target.closest('.snsr_regen');
        if (regen) {
            const mesEl = regen.closest('.mes');
            const index = Number(regen.closest('.snsr_reaction').dataset.index);
            const old = getReactions(Number(mesEl.getAttribute('mesid')))[index];
            if (old) generateReaction(mesEl, old.platform, index, old.includeUser);
            return;
        }
        const del = e.target.closest('.snsr_del');
        if (del) {
            const mesEl = del.closest('.mes');
            deleteReaction(mesEl, Number(del.closest('.snsr_reaction').dataset.index));
        }
    });
}

/* ------------------------------------------------------------------ */
/* CSS 주입 (manifest css 로드 실패 환경 대비)                            */
/* ------------------------------------------------------------------ */

function injectCss() {
    try {
        const href = new URL('./style.css', import.meta.url).href;
        if (document.querySelector('link[data-snsr-css]')) return;
        const already = [...document.styleSheets].some(sh => sh.href === href);
        if (already) return;
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = href;
        link.dataset.snsrCss = '1';
        document.head.appendChild(link);
        console.log('[SNS Reaction] CSS 주입:', href);
    } catch (e) {
        console.warn('[SNS Reaction] CSS 주입 실패', e);
    }
}

/* ------------------------------------------------------------------ */
/* 초기화                                                               */
/* ------------------------------------------------------------------ */

jQuery(async () => {
    try {
        getSettings();
        injectCss();

        const target = document.querySelector('#extensions_settings2') || document.querySelector('#extensions_settings');
        if (target) {
            const holder = document.createElement('div');
            holder.innerHTML = settingsHtml();
            target.appendChild(holder);
            bindSettings();
        }

        bindDelegatedEvents();

        const context = ctx();
        const es = context.eventSource;
        const et = context.eventTypes || context.event_types;

        const onRendered = (mesId) => {
            const el = document.querySelector(`#chat .mes[mesid="${mesId}"]`);
            if (el) attachToMessage(el);
        };

        es.on(et.CHARACTER_MESSAGE_RENDERED, onRendered);
        es.on(et.USER_MESSAGE_RENDERED, onRendered);
        es.on(et.CHAT_CHANGED, () => setTimeout(() => { attachAll(); updateInjection(); }, 300));
        if (et.MESSAGE_SWIPED) es.on(et.MESSAGE_SWIPED, onRendered);
        if (et.MESSAGE_UPDATED) es.on(et.MESSAGE_UPDATED, onRendered);
        if (et.MORE_MESSAGES_LOADED) es.on(et.MORE_MESSAGES_LOADED, () => setTimeout(attachAll, 300));

        setTimeout(() => { attachAll(); updateInjection(); }, 500);
        console.log('[SNS Reaction] 확장 로드 완료 (v1.1)');
    } catch (err) {
        console.error('[SNS Reaction] 초기화 실패', err);
    }
});

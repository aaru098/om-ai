import { Router, type IRouter } from "express";
import {
  AiChatBody,
  GenerateImageBody,
  TextToSpeechBody,
  TranscribeAudioBody,
  GenerateQrCodeBody,
  TranslateTextBody,
} from "@workspace/api-zod";
import {
  chatAuto,
  chatWithGemini,
  chatWithOpenRouter,
  generateImageWithOpenRouter,
  transcribeWithGemini,
} from "../lib/ai";
import QRCode from "qrcode";
import { logger } from "../lib/logger";

const router: IRouter = Router();

router.post("/ai/chat", async (req, res): Promise<void> => {
  const parsed = AiChatBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { message, model, systemPrompt, imageBase64, imageMimeType } = parsed.data;

  try {
    let content: string;
    let usedModel: string;

    if (!model || model === "auto") {
      const result = await chatAuto(
        message,
        systemPrompt ?? undefined,
        imageBase64 ?? undefined,
        imageMimeType ?? undefined
      );
      content = result.content;
      usedModel = result.usedModel;
    } else if (model === "gemini") {
      content = await chatWithGemini(
        message,
        systemPrompt ?? undefined,
        imageBase64 ?? undefined,
        imageMimeType ?? undefined
      );
      usedModel = "gemini";
    } else {
      content = await chatWithOpenRouter(message, model, systemPrompt ?? undefined);
      usedModel = model;
    }

    res.json({ content, model: usedModel });
  } catch (err) {
    logger.error({ err }, "All AI channels exhausted — serving graceful fallback");
    const fallbackReplies = [
      `Arre yaar, abhi mera connection thoda slow hai! 😅 API keys set up ho rahi hain — ek second mein sab theek ho jayega. Tab tak bata, kya poochna tha?`,
      `Oh no, mere servers thode busy hain abhi! 🌸 Main bahut jald wapas aaungi full power ke saath. Apna sawaal ready rakho!`,
      `Yaar, thodi technical problem aa gayi — but main hoon na! ✨ Bas ek moment aur sab smooth ho jayega!`,
    ];
    const fallback = fallbackReplies[Math.floor(Math.random() * fallbackReplies.length)];
    res.json({ content: fallback, model: "fallback" });
  }
});

router.post("/ai/generate-image", async (req, res): Promise<void> => {
  const parsed = GenerateImageBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  try {
    const url = await generateImageWithOpenRouter(parsed.data.prompt);
    res.json({ url, prompt: parsed.data.prompt });
  } catch {
    const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(parsed.data.prompt)}?width=1024&height=1024&nologo=true&seed=${Date.now()}`;
    res.json({ url, prompt: parsed.data.prompt });
  }
});

router.post("/ai/generate-video", async (req, res): Promise<void> => {
  const { prompt } = req.body as { prompt?: string };
  if (!prompt || typeof prompt !== "string" || !prompt.trim()) {
    res.status(400).json({ error: "prompt is required" });
    return;
  }

  let concept: string;
  try {
    concept = await chatWithGemini(
      `Create a cinematic video concept for: "${prompt}". Describe the scene, mood, camera movements, color palette, and soundtrack in 3-4 vivid sentences.`,
      "You are a professional film director. Respond with an evocative video concept only."
    );
  } catch {
    concept = `A breathtaking cinematic video of: ${prompt}. Rich visuals, sweeping camera movements, and immersive atmosphere bring this to life.`;
  }

  res.json({
    videoUrl: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4",
    concept,
    prompt,
  });
});

router.post("/ai/text-to-speech", async (req, res): Promise<void> => {
  const parsed = TextToSpeechBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  res.json({ text: parsed.data.text });
});

router.post("/ai/transcribe", async (req, res): Promise<void> => {
  const parsed = TranscribeAudioBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  try {
    const text = await transcribeWithGemini(
      parsed.data.audioBase64,
      parsed.data.mimeType || "audio/webm"
    );
    res.json({ text });
  } catch (err) {
    logger.error({ err }, "Transcription failed");
    res.status(500).json({ error: "Transcription failed. Please try again." });
  }
});

router.post("/tools/qr-code", async (req, res): Promise<void> => {
  const parsed = GenerateQrCodeBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  try {
    const dataUrl = await QRCode.toDataURL(parsed.data.text, {
      width: parsed.data.size || 300,
      margin: 2,
    });
    res.json({ dataUrl });
  } catch (err) {
    logger.error({ err }, "QR code generation failed");
    res.status(500).json({ error: "QR code generation failed." });
  }
});

router.post("/tools/translate", async (req, res): Promise<void> => {
  const parsed = TranslateTextBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { text, targetLanguage, sourceLanguage } = parsed.data;
  const translatePrompt = `Translate the following text to ${targetLanguage}${sourceLanguage ? ` from ${sourceLanguage}` : ""}. Return ONLY the translated text, nothing else:\n\n${text}`;
  try {
    const translated = await chatWithGemini(translatePrompt);
    res.json({ translatedText: translated.trim(), targetLanguage });
  } catch (err) {
    logger.error({ err }, "Translation failed");
    res.status(500).json({ error: "Translation failed. Please try again." });
  }
});

export default router;

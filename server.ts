import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));

  // API Route for KIE.AI Proxy
  app.post("/api/kie-generate", async (req, res) => {
    try {
      const { apiKey, modelType, prompt, images } = req.body;

      if (!apiKey) {
        return res.status(400).json({ error: "API Key KIE AI diperlukan. Silakan masukkan di pengaturan API Key." });
      }

      // Endpoint mapping
      let endpoint = "";
      let isGeminiStreamFormat = false;

      if (modelType === "gemini-3-6-flash") {
        endpoint = "https://api.kie.ai/gemini/v1/models/gemini-3-6-flash:streamGenerateContent";
        isGeminiStreamFormat = true;
      } else if (modelType === "gemini-3-5-flash") {
        endpoint = "https://api.kie.ai/gemini/v1/models/gemini-3-5-flash:streamGenerateContent";
        isGeminiStreamFormat = true;
      } else if (modelType === "gemini-3-pro") {
        endpoint = "https://api.kie.ai/gemini-3-pro/v1/chat/completions";
        isGeminiStreamFormat = false;
      } else if (modelType === "gemini-3.1-pro") {
        endpoint = "https://api.kie.ai/gemini-3.1-pro/v1/chat/completions";
        isGeminiStreamFormat = false;
      } else {
        return res.status(400).json({ error: `Model KIE AI tidak dikenal: ${modelType}` });
      }

      let requestBody: any;
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey.trim()}`,
        "x-goog-api-key": apiKey.trim(),
      };

      if (isGeminiStreamFormat) {
        // Native Gemini Content Parts
        const parts: any[] = [{ text: prompt }];
        if (Array.isArray(images) && images.length > 0) {
          images.forEach((img: { base64: string; mimeType: string }) => {
            parts.push({
              inlineData: {
                mimeType: img.mimeType || "image/jpeg",
                data: img.base64,
              }
            });
          });
        }
        requestBody = {
          contents: [{ parts }]
        };
      } else {
        // OpenAI Chat Completions format
        const contentParts: any[] = [{ type: "text", text: prompt }];
        if (Array.isArray(images) && images.length > 0) {
          images.forEach((img: { base64: string; mimeType: string }) => {
            contentParts.push({
              type: "image_url",
              image_url: {
                url: `data:${img.mimeType || "image/jpeg"};base64,${img.base64}`
              }
            });
          });
        }

        const modelId = modelType === "gemini-3.1-pro" ? "gemini-3.1-pro" : "gemini-3-pro";
        requestBody = {
          model: modelId,
          messages: [
            {
              role: "user",
              content: contentParts
            }
          ]
        };
      }

      const response = await fetch(endpoint, {
        method: "POST",
        headers,
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const errText = await response.text();
        return res.status(response.status).json({
          error: `KIE AI (${modelType}) Error ${response.status}: ${errText}`
        });
      }

      const responseText = await response.text();

      // Parse result
      let generatedText = "";

      if (isGeminiStreamFormat) {
        // May be a streaming NDJSON, array of objects, or single object
        try {
          const parsedJson = JSON.parse(responseText);
          if (Array.isArray(parsedJson)) {
            for (const chunk of parsedJson) {
              const partText = chunk?.candidates?.[0]?.content?.parts?.[0]?.text || "";
              generatedText += partText;
            }
          } else if (parsedJson?.candidates?.[0]?.content?.parts?.[0]?.text) {
            generatedText = parsedJson.candidates[0].content.parts[0].text;
          } else {
            generatedText = JSON.stringify(parsedJson);
          }
        } catch {
          // Try line by line parse for SSE or NDJSON
          const lines = responseText.split("\n");
          for (const line of lines) {
            const cleanLine = line.replace(/^data:\s*/, "").trim();
            if (!cleanLine || cleanLine === "[DONE]") continue;
            try {
              const chunk = JSON.parse(cleanLine);
              const partText = chunk?.candidates?.[0]?.content?.parts?.[0]?.text || "";
              generatedText += partText;
            } catch {
              // ignore unparseable chunk
            }
          }
          if (!generatedText) {
            generatedText = responseText;
          }
        }
      } else {
        // OpenAI format
        try {
          const parsed = JSON.parse(responseText);
          if (parsed?.choices?.[0]?.message?.content) {
            generatedText = parsed.choices[0].message.content;
          } else {
            generatedText = responseText;
          }
        } catch {
          generatedText = responseText;
        }
      }

      return res.json({ text: generatedText.trim() });
    } catch (err: any) {
      console.error("KIE AI proxy error:", err);
      return res.status(500).json({ error: err.message || "Terjadi kesalahan pada proxy KIE AI" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();

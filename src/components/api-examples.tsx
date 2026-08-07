import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { HighlightedCode } from "@/components/highlighted-code";

/**
 * Language-tabbed "first request" examples for the Developer API.
 *
 * Every snippet is complete and runnable — the deployment's real base URL is
 * interpolated in, so the only thing a reader replaces is their API key.
 * Used on /documentation and the dashboard's /developers page.
 */

function makeExamples(base: string): { id: string; label: string; code: string }[] {
  const transcript = "We need Google login before launch. Sarah owns billing.";

  return [
    {
      id: "curl",
      label: "curl",
      code: `curl -X POST "${base}/extract" \\
  -H "Authorization: Bearer fgy_live_..." \\
  -H "Content-Type: application/json" \\
  -d '{
    "transcript": "${transcript}",
    "extractors": ["features", "action_items"]
  }'`,
    },
    {
      id: "python",
      label: "Python",
      code: `# pip install httpx
import httpx

resp = httpx.post(
    "${base}/extract",
    headers={"Authorization": "Bearer fgy_live_..."},
    json={
        "transcript": "${transcript}",
        "extractors": ["features", "action_items"],
    },
    timeout=120,
)
resp.raise_for_status()
data = resp.json()

for feature in data["features"]:
    print(f'[{feature["priority"]}] {feature["title"]}')
for item in data["action_items"]:
    print(f'TODO ({item["owner"]}): {item["task"]}')`,
    },
    {
      id: "javascript",
      label: "JavaScript",
      code: `// Node 18+ or the browser — fetch is built in
const res = await fetch("${base}/extract", {
  method: "POST",
  headers: {
    Authorization: \`Bearer \${process.env.FORGEFY_API_KEY}\`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    transcript: "${transcript}",
    extractors: ["features", "action_items"],
  }),
});
if (!res.ok) throw new Error(\`Forgefy error \${res.status}\`);

const { features, action_items, usage } = await res.json();
features.forEach((f) => console.log(\`[\${f.priority}] \${f.title}\`));
console.log(\`used \${usage.input_tokens + usage.output_tokens} tokens\`);`,
    },
    {
      id: "go",
      label: "Go",
      code: `package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
)

func main() {
	payload, _ := json.Marshal(map[string]any{
		"transcript": "${transcript}",
		"extractors": []string{"features", "action_items"},
	})

	req, _ := http.NewRequest("POST", "${base}/extract", bytes.NewReader(payload))
	req.Header.Set("Authorization", "Bearer "+os.Getenv("FORGEFY_API_KEY"))
	req.Header.Set("Content-Type", "application/json")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		panic(err)
	}
	defer resp.Body.Close()

	var out struct {
		Features []struct {
			Title    string \`json:"title"\`
			Priority string \`json:"priority"\`
		} \`json:"features"\`
	}
	json.NewDecoder(resp.Body).Decode(&out)

	for _, f := range out.Features {
		fmt.Printf("[%s] %s\\n", f.Priority, f.Title)
	}
}`,
    },
    {
      id: "php",
      label: "PHP",
      code: `<?php
$ch = curl_init("${base}/extract");
curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_POST => true,
    CURLOPT_HTTPHEADER => [
        "Authorization: Bearer " . getenv("FORGEFY_API_KEY"),
        "Content-Type: application/json",
    ],
    CURLOPT_POSTFIELDS => json_encode([
        "transcript" => "${transcript}",
        "extractors" => ["features", "action_items"],
    ]),
]);

$data = json_decode(curl_exec($ch), true);
curl_close($ch);

foreach ($data["features"] as $f) {
    echo "[{$f['priority']}] {$f['title']}" . PHP_EOL;
}`,
    },
    {
      id: "swift",
      label: "Swift",
      code: `// iOS / macOS — URLSession, no dependencies
// ${MOBILE_KEY_WARNING}
import Foundation

struct ExtractResponse: Decodable {
    struct Feature: Decodable { let title: String; let priority: String }
    let features: [Feature]
}

var request = URLRequest(url: URL(string: "${base}/extract")!)
request.httpMethod = "POST"
request.setValue("Bearer fgy_live_...", forHTTPHeaderField: "Authorization")
request.setValue("application/json", forHTTPHeaderField: "Content-Type")
request.httpBody = try JSONSerialization.data(withJSONObject: [
    "transcript": "${transcript}",
    "extractors": ["features", "action_items"],
])

let (data, response) = try await URLSession.shared.data(for: request)
guard (response as? HTTPURLResponse)?.statusCode == 200 else {
    throw URLError(.badServerResponse)
}

let result = try JSONDecoder().decode(ExtractResponse.self, from: data)
for feature in result.features {
    print("[\\(feature.priority)] \\(feature.title)")
}`,
    },
    {
      id: "kotlin",
      label: "Kotlin",
      code: `// Android — OkHttp: implementation("com.squareup.okhttp3:okhttp:4.12.0")
// ${MOBILE_KEY_WARNING}
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONArray
import org.json.JSONObject

val payload = JSONObject().apply {
    put("transcript", "${transcript}")
    put("extractors", JSONArray(listOf("features", "action_items")))
}

val request = Request.Builder()
    .url("${base}/extract")
    .header("Authorization", "Bearer \${BuildConfig.FORGEFY_API_KEY}")
    .post(payload.toString().toRequestBody("application/json".toMediaType()))
    .build()

OkHttpClient().newCall(request).execute().use { response ->
    check(response.isSuccessful) { "Forgefy error \${response.code}" }
    val data = JSONObject(response.body!!.string())
    val features = data.getJSONArray("features")
    for (i in 0 until features.length()) {
        val f = features.getJSONObject(i)
        println("[\${f.getString("priority")}] \${f.getString("title")}")
    }
}`,
    },
    {
      id: "dart",
      label: "Dart / Flutter",
      code: `// pubspec.yaml → dependencies: http: ^1.2.0
// ${MOBILE_KEY_WARNING}
import 'dart:convert';
import 'package:http/http.dart' as http;

final resp = await http.post(
  Uri.parse('${base}/extract'),
  headers: {
    'Authorization': 'Bearer fgy_live_...',
    'Content-Type': 'application/json',
  },
  body: jsonEncode({
    'transcript': '${transcript}',
    'extractors': ['features', 'action_items'],
  }),
);
if (resp.statusCode != 200) {
  throw Exception('Forgefy error \${resp.statusCode}');
}

final data = jsonDecode(resp.body) as Map<String, dynamic>;
for (final f in data['features'] as List) {
  print('[\${f['priority']}] \${f['title']}');
}`,
    },
  ];
}

const MOBILE_KEY_WARNING =
  "Prototype only: never ship a fgy_live_ key inside a public app binary — route production traffic through your own backend, which holds the key.";

const MOBILE_TAB_IDS = new Set(["swift", "kotlin", "dart"]);

export function ApiExamples({ base }: { base: string }) {
  const examples = makeExamples(base);
  const [activeId, setActiveId] = useState(examples[0].id);
  const [copied, setCopied] = useState(false);

  const active = examples.find((e) => e.id === activeId) ?? examples[0];

  async function copy() {
    try {
      await navigator.clipboard.writeText(active.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard unavailable — user can select the text */
    }
  }

  return (
    <div className="rounded-xl border border-border overflow-hidden">
      {/* language tabs */}
      <div className="flex items-center gap-1 px-2 pt-2 pb-0 bg-surface border-b border-border overflow-x-auto">
        {examples.map((e) => (
          <button
            key={e.id}
            onClick={() => {
              setActiveId(e.id);
              setCopied(false);
            }}
            className={[
              "px-3 py-1.5 rounded-t-lg text-[12px] font-medium transition-colors shrink-0",
              e.id === activeId
                ? "bg-card text-accent border border-border border-b-transparent -mb-px"
                : "text-text-muted hover:text-ink",
            ].join(" ")}
          >
            {e.label}
          </button>
        ))}
      </div>

      {/* code */}
      <div className="relative bg-card">
        <pre className="font-mono-ui text-[12px] leading-relaxed text-ink p-4 pr-12 overflow-x-auto max-h-[400px] overflow-y-auto">
          <HighlightedCode code={active.code} />
        </pre>
        <button
          onClick={copy}
          aria-label="Copy to clipboard"
          className="absolute top-2.5 right-2.5 flex items-center justify-center w-7 h-7 rounded-lg border border-border bg-card text-text-muted hover:text-accent hover:border-accent transition-colors"
        >
          {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
        </button>
      </div>

      {/* mobile apps ship their binaries to strangers — the key must not go along */}
      {MOBILE_TAB_IDS.has(active.id) && (
        <div className="px-4 py-2.5 border-t border-border bg-surface text-[12px] text-text-secondary">
          <strong className="text-ink">Shipping to an app store?</strong> Anyone can extract strings
          from your binary — keep the <code className="font-mono-ui">fgy_live_</code> key on your
          own server and have the app call that instead. Calling Forgefy directly from the device is
          fine for prototypes and internal tools.
        </div>
      )}
    </div>
  );
}

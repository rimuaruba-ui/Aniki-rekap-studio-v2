export const KIE_MODELS = [
  {
    id: 'gemini-3-6-flash' as const,
    name: 'Gemini 3.6 Flash',
    badge: 'Stream Native',
    desc: 'Model flagship mutakhir dari KIE.ai dengan kecepatan tinggi dan konsistensi alur cerita sangat baik.',
    endpoint: 'https://api.kie.ai/gemini/v1/models/gemini-3-6-flash:streamGenerateContent',
  },
  {
    id: 'gemini-3.1-pro' as const,
    name: 'Gemini 3.1 Pro',
    badge: 'OpenAI Chat',
    desc: 'Model Pro penalaran tinggi untuk komik kompleks dengan deskripsi adegan mendalam.',
    endpoint: 'https://api.kie.ai/gemini-3.1-pro/v1/chat/completions',
  },
  {
    id: 'gemini-3-5-flash' as const,
    name: 'Gemini 3.5 Flash',
    badge: 'Stream Native',
    desc: 'Model cepat dan efisien cocok untuk naskah komik panjang dengan banyak gambar.',
    endpoint: 'https://api.kie.ai/gemini/v1/models/gemini-3-5-flash:streamGenerateContent',
  },
  {
    id: 'gemini-3-pro' as const,
    name: 'Gemini 3 Pro',
    badge: 'OpenAI Chat',
    desc: 'Model Pro standar dengan kualitas penceritaan yang seimbang dan kaya.',
    endpoint: 'https://api.kie.ai/gemini-3-pro/v1/chat/completions',
  },
];

export const VOICES = [
  { name: 'Aoede (Perempuan - Elegan & Natural)', value: 'Aoede', gender: 'female' as const },
  { name: 'Kore (Laki-laki - Tegas & Mantap)', value: 'Kore', gender: 'male' as const },
  { name: 'Orus (Laki-laki - Berwibawa & Dalam)', value: 'Orus', gender: 'male' as const },
  { name: 'Puck (Laki-laki - Ceria & Dinamis)', value: 'Puck', gender: 'male' as const },
  { name: 'Fenrir (Laki-laki - Berat & Sinematik)', value: 'Fenrir', gender: 'male' as const },
  { name: 'Charon (Laki-laki - Misterius & Tenang)', value: 'Charon', gender: 'male' as const },
  { name: 'Zephyr (Perempuan - Tenang & Lembut)', value: 'Zephyr', gender: 'female' as const },
  { name: 'Leda (Perempuan - Muda & Hidup)', value: 'Leda', gender: 'female' as const },
  { name: 'Achird (Perempuan - Ramah & Hangat)', value: 'Achird', gender: 'female' as const },
];

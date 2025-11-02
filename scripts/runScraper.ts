// backend/scripts/runScraper.ts
import * as dotenv from "dotenv";
dotenv.config();

import * as Parser from "rss-parser";
import axios from "axios";
import * as cheerio from "cheerio";
import * as crypto from "crypto";
import { HttpsProxyAgent } from "https-proxy-agent";

import { connectDB, disconnectDB, mongoose } from "../src/lib/mongoose";
import { Source } from "../src/models/Source";
import { Article } from "../src/models/Article";
import { Category } from "../src/models/Category";
import { logger } from "../src/utils/logger";

// Content-based categorization function (same as in API)
function computeCategoryFromText(title: string, summary: string, content: string, language?: string): string {
  const normalize = (str: string) =>
    (str || '')
      .toLowerCase()
      .replace(/[\u200B-\u200D\uFEFF]/g, '') // zero-width chars
      .replace(/[\p{P}\p{S}]/gu, ' ')         // punctuation/symbols
      .replace(/\s+/g, ' ')                    // collapse whitespace
      .trim();

  const text = normalize(`${title} ${summary} ${content}`);
  
  // Language normalization mapping
  const langMap: Record<string, string> = {
    'te': 'telugu',
    'ta': 'tamil', 
    'hi': 'hindi',
    'bn': 'bengali',
    'gu': 'gujarati',
    'mr': 'marathi',
    'en': 'english'
  };
  const normalizedLang = langMap[language?.toLowerCase() || ''] || language?.toLowerCase() || 'english';
  
  // Expandable multilingual dictionary
  const dict: Record<string, string[]> = {
    politics: [
      // English
      'politics','political','election','elections','minister','government','parliament','assembly','mla','mp','party','pm','president','congress','bjp','tdp','ysr','trs','aap','cabinet','opposition','vote','voting','campaign',
      // Telugu
      'రాజకీయ','ఎన్నిక','ఎన్నికలు','మంత్రి','ప్రభుత్వ','అసెంబ్లీ','పార్టీ','ముఖ్యమంత్రి','అధ్యక్షుడు','ఎంపీ','ఎంఎల్ఏ','నేత','నాయకుడు','ప్రతిపక్షం','ఓటు','ఓటింగ్','క్యాబినెట్',
      // Tamil
      'ராஜகியம்','ராஜகிய','தேர்தல்','அரசு','மந்திரி','பாராளுமன்றம்','சட்டமன்றம்','கட்சி','பிரதமர்','எம்எல்ஏ','எம்பி','எதிர்க்கட்சிகள்','வாக்கு','வாக்குப்பதிவு',
      // Hindi
      'राजनीति','चुनाव','मंत्री','सरकार','संसद','विधानसभा','पार्टी','मुख्यमंत्री','राष्ट्रपति','सांसद','विधायक','नेता','विपक्ष','मतदान','अभियान',
      // Bengali
      'রাজনীতি','নির্বাচন','মন্ত্রী','সরকার','সংসদ','বিধানসভা','দল','মুখ্যমন্ত্রী','রাষ্ট্রপতি','সাংসদ','বিধায়ক','নেতা','বিরোধী','ভোট','প্রচার',
      // Gujarati
      'રાજકારણ','ચૂંટણી','મંત્રી','સરકાર','સંસદ','વિધાનસભા','પક્ષ','મુખ્યમંત્રી','રાષ્ટ્રપતિ','સાંસદ','વિધાયક','નેતા','વિરોધી','મતદાન','અભિયાન',
      // Marathi
      'राजकारण','निवडणूक','मंत्री','सरकार','संसद','विधानसभा','पक्ष','मुख्यमंत्री','राष्ट्रपती','खासदार','आमदार','नेता','विरोधी','मतदान','मोहीम'
    ],
    sports: [
      // English
      'sports','sport','cricket','football','soccer','tennis','badminton','hockey','ipl','match','player','tournament','score','goal','winner','loser','series','league','cup',
      // Telugu (expanded inflections)
      'క్రీడ','క్రీడలు','క్రీడల','క్రీడలలో','ఆట','ఆటలు','మ్యాచ్','మ్యాచ్‌లు','మ్యాచులు','ఫలితాలు','జట్టు','జట్లు','జట్టులో','ప్లేయర్','ప్లేయర్లు','ఆటగాడు','ఆటగాళ్లు','విజయం','ఓటమి','ర్యాంకింగ్','సిరీస్','లీగ్','కప్','క్రికెట్','ఫుట్బాల్','టెన్నిస్','బ్యాడ్మింటన్','హాకీ',
      // Tamil
      'விளையாட்டு','விளையாட்டுகள்','கிரிக்கெட்','கால்பந்து','டென்னிஸ்','பேட்மிண்டன்','ஹாக்கி','போட்டி','மேட்ச்','அணி','வீரர்','ஸ்கோர்','லீக்','கப்',
      // Hindi
      'खेल','क्रिकेट','फुटबॉल','टेनिस','बैडमिंटन','हॉकी','मैच','खिलाड़ी','टूर्नामेंट','स्कोर','गोल','विजेता','हारनेवाला','सीरीज','लीग','कप',
      // Bengali
      'খেলা','ক্রিকেট','ফুটবল','টেনিস','ব্যাডমিন্টন','হকি','ম্যাচ','খেলোয়াড়','টুর্নামেন্ট','স্কোর','গোল','বিজয়ী','পরাজিত','সিরিজ','লিগ','কাপ',
      // Gujarati
      'રમત','ક્રિકેટ','ફુટબોલ','ટેનિસ','બેડમિન્ટન','હોકી','મેચ','રમતવીર','ટુર્નામેન્ટ','સ્કોર','ગોલ','વિજેતા','હારનાર','સિરિઝ','લીગ','કપ',
      // Marathi
      'खेळ','क्रिकेट','फुटबॉल','टेनिस','बॅडमिंटन','हॉकी','सामना','खेळाडू','स्पर्धा','गोल','विजेता','हरलेला','मालिका','लीग','कप'
    ],
    entertainment: [
      // English
      'entertainment','movie','movies','film','cinema','actor','actress','director','trailer','song','review','bollywood','tollywood','kollywood','box office',
      // Telugu (expanded synonyms)
      'సినిమా','చిత్రం','చలనచిత్రం','నటుడు','నటి','హీరో','హీరోయిన్','దర్శకుడు','ట్రైలర్','పాట','సాంగ్','సమీక్ష','రివ్యూ','బాక్సాఫీస్','బాక్స్ ఆఫీస్','టాలీవుడ్','బాలీవుడ్','కోలీవుడ్','వెబ్ సిరీస్','సీరియల్',
      // Tamil
      'பொழுதுபோக்கு','திரைப்படம்','சினிமா','நடிகர்','நடிகை','இயக்குனர்','டிரைலர்','பாடல்','விமர்சனம்','பாக்ஸ் ஆபிஸ்','காலிவுட்','கொலிவுட்','தொலைக்காட்சி',
      // Hindi
      'मनोरंजन','फिल्म','सिनेमा','अभिनेता','अभिनेत्री','निर्देशक','ट्रेलर','गाना','समीक्षा','बॉलीवुड','टॉलीवुड','कोलीवुड','बॉक्स ऑफिस',
      // Bengali
      'বিনোদন','চলচ্চিত্র','সিনেমা','অভিনেতা','অভিনেত্রী','পরিচালক','ট্রেইলার','গান','সমালোচনা','বলিউড','টলিউড','কলিউড','বক্স অফিস',
      // Gujarati
      'મનોરંજન','ફિલ્મ','સિનેમા','અભિનેતા','અભિનેત્રી','દિગ્દર્શક','ટ્રેલર','ગીત','સમીક્ષા','બોલીવુડ','ટોલીવુડ','કોલીવુડ','બોક્સ ઓફિસ',
      // Marathi
      'मनोरंजन','चित्रपट','सिनेमा','अभिनेता','अभिनेत्री','दिग्दर्शक','ट्रेलर','गाणे','समीक्षा','बॉलिवूड','टॉलिवूड','कोलिवूड','बॉक्स ऑफिस'
    ],
    technology: [
      // English
      'technology','tech','gadget','smartphone','mobile','ai','artificial intelligence','software','internet','robot','startup','app','update','chip','semiconductor',
      // Telugu (expanded synonyms)
      'టెక్నాలజీ','సాంకేతికం','సాంకేతిక','గాడ్జెట్','మొబైల్','స్మార్ట్‌ఫోన్','కృత్రిమ మేధస్సు','ఎఐ','సాఫ్ట్‌వేర్','ఇంటర్నెట్','రోబోట్','స్టార్టప్','యాప్','అప్డేట్','చిప్',
      // Tamil
      'தொழில்நுட்பம்','டெக்','கேட்ஜெட்','ஸ்மார்ட்போன்','மொபைல்','கணினி','மென்பொருள்','இணையம்','ரோபோட்','ஸ்டார்ட்அப்','சிப்','புதுப்பிப்பு',
      // Hindi
      'तकनीक','गैजेट','स्मार्टफोन','मोबाइल','कृत्रिम बुद्धिमत्ता','सॉफ्टवेयर','इंटरनेट','रोबोट','स्टार्टअप','ऐप','अपडेट','चिप',
      // Bengali
      'প্রযুক্তি','গ্যাজেট','স্মার্টফোন','মোবাইল','কৃত্রিম বুদ্ধিমত্তা','সফটওয়্যার','ইন্টারনেট','রোবট','স্টার্টআপ','অ্যাপ','আপডেট','চিপ',
      // Gujarati
      'ટેકનોલોજી','ગેજેટ','સ્માર્ટફોન','મોબાઇલ','કૃત્રિમ બુદ્ધિ','સોફ્ટવેર','ઇન્ટરનેટ','રોબોટ','સ્ટાર્ટઅપ','એપ','અપડેટ','ચિપ',
      // Marathi
      'तंत्रज्ञान','गॅजेट','स्मार्टफोन','मोबाइल','कृत्रिम बुद्धिमत्ता','सॉफ्टवेअर','इंटरनेट','रोबोट','स्टार्टअप','अॅप','अपडेट','चिप'
    ],
    health: [
      // English
      'health','hospital','doctor','covid','vaccine','medical','fitness','disease','therapy','treatment','medicine',
      // Telugu (expanded synonyms)
      'ఆరోగ్యం','ఆరోగ్య','ఆసుపత్రి','హాస్పిటల్','డాక్టర్','వ్యాక్సిన్','టీకా','వైద్యం','వ్యాధి','జబ్బు','చికిత్స','ఔషధం','ఫిట్‌నెస్',
      // Tamil
      'ஆரோக்கியம்','மருத்துவமனை','டாக்டர்','தடுப்பூசி','மருத்துவம்','நோய்','சிகிச்சை','மருந்து',
      // Hindi
      'स्वास्थ्य','अस्पताल','डॉक्टर','कोविड','टीका','चिकित्सा','फिटनेस','बीमारी','उपचार','दवा',
      // Bengali
      'স্বাস্থ্য','হাসপাতাল','ডাক্তার','কোভিড','টিকা','চিকিৎসা','ফিটনেস','রোগ','চিকিৎসা','ঔষধ',
      // Gujarati
      'સ્વાસ્થ્ય','હોસ્પિટલ','ડૉક્ટર','કોવિડ','વેક્સિન','દવા','ફિટનેસ','રોગ','ઉપચાર','દવા',
      // Marathi
      'आरोग्य','दवाखाना','डॉक्टर','कोविड','लस','वैद्यकीय','फिटनेस','रोग','उपचार','औषध'
    ],
    business: [
      // English
      'business','market','stock','share','company','finance','banking','economy','revenue','profit','startup','funding',
      // Telugu (expanded inflections)
      'వ్యాపారం','వ్యాపార','వ్యాపారవేత్త','వ్యాపారవేత్తలు','మార్కెట్','మార్కెట్లలో','స్టాక్','షేర్','షేర్లు','కంపెనీ','ఫైనాన్స్','బ్యాంకింగ్','ఆర్థిక','ద్రవ్యోల్బణం','ఆదాయం','లాభం','నష్టం','నష్టాలు',
      // Tamil
      'வணிகம்','சந்தை','பங்கு','நிறுவனம்','நிதி','வங்கி','பொருளாதாரம்','வருவாய்','லாபம்','நஷ்டம்','நிதியுதவி',
      // Hindi
      'व्यापार','बाजार','शेयर','कंपनी','वित्त','बैंकिंग','अर्थव्यवस्था','राजस्व','लाभ','स्टार्टअप','निधि',
      // Bengali
      'ব্যবসা','বাজার','শেয়ার','কোম্পানি','অর্থ','ব্যাংকিং','অর্থনীতি','রাজস্ব','লাভ','স্টার্টআপ','তহবিল',
      // Gujarati
      'વ્યવસાય','બજાર','શેર','કંપની','ફાઇનાન્સ','બેંકિંગ','અર્થતંત્ર','રાજસ્વ','લાભ','સ્ટાર્ટઅપ','ફંડિંગ',
      // Marathi
      'व्यवसाय','बाजार','शेअर','कंपनी','वित्त','बँकिंग','अर्थव्यवस्था','राजस्व','नफा','स्टार्टअप','निधी'
    ],
    education: [
      // English
      'education','exam','results','student','school','college','university','admission','scholarship',
      // Telugu
      'విద్య','పరీక్ష','ఫలితాలు','విద్యార్థి','పాఠశాల','కళాశాల','విశ్వవిద్యాలయం','దాఖలాలు','వేతనం',
      // Tamil
      'கல்வி','தேர்வு','முடிவுகள்','மாணவர்','பள்ளி','கல்லூரி','பல்கலைக்கழகம்','சேர்க்கை','உதவித்தொகை',
      // Hindi
      'शिक्षा','परीक्षा','परिणाम','छात्र','स्कूल','कॉलेज','विश्वविद्यालय','प्रवेश','छात्रवृत्ति',
      // Bengali
      'শিক্ষা','পরীক্ষা','ফলাফল','ছাত্র','স্কুল','কলেজ','বিশ্ববিদ্যালয়','ভর্তি','বৃত্তি',
      // Gujarati
      'શિક્ષણ','પરીક્ષા','પરિણામ','વિદ્યાર્થી','શાળા','કોલેજ','યુનિવર્સિટી','પ્રવેશ','છાત્રવૃત્તિ',
      // Marathi
      'शिक्षण','परीक्षा','निकाल','विद्यार्थी','शाळा','कॉलेज','विश्वविद्यालय','प्रवेश','शिष्यवृत्ती'
    ],
    crime: [
      // English
      'crime','police','murder','theft','robbery','scam','fraud','arrest','assault','violence',
      // Telugu (expanded inflections)
      'క్రైమ్','నేరం','నేరాలు','పోలీసు','హత్య','హత్యలు','దొంగతనం','దొంగతనాలు','దొంగలు','దోపిడీ','మోసం','అరెస్ట్','అరెస్టు','కోర్టు','కోర్టులో','దాడి','హింస','నేరస్థుడు','నేరస్థులు',
      // Tamil
      'குற்றம்','காவல்துறை','கொலை','திருட்டு','கொள்ளை','மோசடி','கைது','தாக்குதல்','வன்முறை',
      // Hindi
      'अपराध','पुलिस','हत्या','चोरी','डकैती','घोटाला','धोखाधड़ी','गिरफ्तारी','हमला','हिंसा',
      // Bengali
      'অপরাধ','পুলিশ','খুন','চুরি','ডাকাতি','কেলেঙ্কারি','জালিয়াতি','গ্রেফতার','আক্রমণ','সহিংসতা',
      // Gujarati
      'અપરાધ','પોલીસ','હત્યા','ચોરી','ડકાઈ','ઘોટાલો','ધોકાધડી','ગિરફતારી','હુમલો','હિંસા',
      // Marathi
      'गुन्हा','पोलिस','खून','चोरी','दरोडा','घोटाळा','फसवणूक','अटक','हल्ला','हिंसा'
    ]
  };

  let best = 'general';
  let bestScore = 0;

  const partialMatch = (t: string, k: string) => {
    if (!k || k.length < 3) return false;
    if (t.includes(k)) return true;
    const stem = k.slice(0, Math.max(3, Math.floor(k.length * 0.7)));
    return stem.length >= 3 && t.includes(stem);
  };

  for (const [cat, keys] of Object.entries(dict)) {
    let score = 0;
    
    // Filter keywords by language before matching
    const langWords = keys.filter(word => {
      // Detect script range for language-specific filtering
      if (normalizedLang === 'telugu') return /[\u0C00-\u0C7F]/.test(word);
      if (normalizedLang === 'hindi') return /[\u0900-\u097F]/.test(word);
      if (normalizedLang === 'tamil') return /[\u0B80-\u0BFF]/.test(word);
      if (normalizedLang === 'bengali') return /[\u0980-\u09FF]/.test(word);
      if (normalizedLang === 'gujarati') return /[\u0A80-\u0AFF]/.test(word);
      if (normalizedLang === 'marathi') return /[\u0900-\u097F]/.test(word);
      if (normalizedLang === 'english') return /^[a-z]+$/i.test(word);
      // Fallback: if language not recognized, use all keywords
      return true;
    });
    
    for (const k of langWords) {
      if (partialMatch(text, k)) {
        // weight longer, more specific keywords slightly higher
        score += Math.max(1, Math.floor(k.length / 4));
      }
    }
    if (score > bestScore) {
      bestScore = score;
      best = cat;
    }
  }

  return bestScore > 0 ? best : 'general';
}

// Resolve optional proxy safely; ignore invalid placeholders
const RAW_PROXY = process.env.PROXY_URL || process.env.HTTPS_PROXY || process.env.HTTP_PROXY || "";
let proxyAgent: any = undefined;
if (RAW_PROXY && /^https?:\/\//i.test(RAW_PROXY)) {
  try {
    // Validate URL; HttpsProxyAgent will throw on invalid input
    // eslint-disable-next-line no-new
    new URL(RAW_PROXY);
    proxyAgent = new HttpsProxyAgent(RAW_PROXY);
  } catch {
    // If invalid, skip proxy to avoid runtime crash
    proxyAgent = undefined;
  }
}

const parser = new Parser.default({
  requestOptions: proxyAgent ? { agent: proxyAgent as any } : undefined
});

// --- Networking helpers ---
const USER_AGENTS = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15",
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:118.0) Gecko/20100101 Firefox/118.0"
];
function pickUA() { return USER_AGENTS[Math.floor(Math.random()*USER_AGENTS.length)]; }

function buildHeaders(targetUrl: string) {
  const isMyKhel = /mykhel\.com/.test(targetUrl);
  return {
    "User-Agent": pickUA(),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
    "Connection": "keep-alive",
    "Cache-Control": "no-cache",
    "Pragma": "no-cache",
    "DNT": "1",
    "Referer": isMyKhel ? "https://telugu.mykhel.com/" : "https://www.google.com/",
    "Origin": isMyKhel ? "https://telugu.mykhel.com" : undefined as any
  } as Record<string,string>;
}

async function fetchWithFallback(url: string) {
  // 1) Direct axios
  try {
    const res = await axios.get(url, {
      headers: buildHeaders(url),
      timeout: 30000,
      maxRedirects: 5,
      validateStatus: (s:number)=> s < 400,
      httpsAgent: proxyAgent,
      proxy: false
    });
    return res.data;
  } catch (err: any) {
    // 2) r.jina.ai cached reader
    try {
      const jinaUrl = `https://r.jina.ai/${encodeURIComponent(url)}`;
      const res = await axios.get(jinaUrl, {
        headers: { "User-Agent": pickUA(), "Accept": "application/rss+xml, application/xml, text/xml;q=0.9,*/*;q=0.8" },
        timeout: 30000,
        httpsAgent: proxyAgent,
        proxy: false
      });
      return res.data;
    } catch {}
    // 3) allorigins fallback (simple relay)
    const relayUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`;
    const res = await axios.get(relayUrl, {
      headers: { "User-Agent": pickUA() },
      timeout: 30000,
      httpsAgent: proxyAgent,
      proxy: false
    });
    return res.data;
  }
}

function truncate(str: string | undefined | null, n: number) {
  if (!str) return "";
  return str.length > n ? str.slice(0, n - 1) + "…" : str;
}

function generateHash(input: string) {
  return crypto.createHash("md5").update(input).digest("hex");
}


function normalizeCategoryName(name: string) {
  const lower = (name || '').toLowerCase().trim();
  const map: Record<string, string> = {
    // Telugu
    'సినిమా': 'entertainment',
    'వినోదం': 'entertainment',
    'క్రీడలు': 'sports',
    'వ్యాపారం': 'business',
    'ఆరోగ్యం': 'health',
    'సాంకేతికం': 'technology',
    'రాజకీయాలు': 'politics',
    'అపరాధం': 'crime',
    // Hindi
    'मनोरंजन': 'entertainment',
    'खेल': 'sports',
    'व्यापार': 'business',
    'स्वास्थ्य': 'health',
    'तकनीक': 'technology',
    'राजनीति': 'politics',
    'अपराध': 'crime',
    // Tamil
    'பொழுதுபோக்கு': 'entertainment',
    'சினிமா': 'entertainment',
    'விளையாட்டு': 'sports',
    'வணிகம்': 'business',
    'ஆரோக்கியம்': 'health',
    'தொழில்நுட்பம்': 'technology',
    'ராஜகியம்': 'politics',
    'குற்றம்': 'crime',
    // Bengali
    'বিনোদন': 'entertainment',
    'খেলা': 'sports',
    'ব্যবসা': 'business',
    'স্বাস্থ্য': 'health',
    'প্রযুক্তি': 'technology',
    'রাজনীতি': 'politics',
    'অপরাধ': 'crime',
    // Gujarati
    'મનોરંજન': 'entertainment',
    'રમત': 'sports',
    'વ્યવસાય': 'business',
    'સ્વાસ્થ્ય': 'health',
    'ટેકનોલોજી': 'technology',
    'રાજકારણ': 'politics',
    'અપરાધ': 'crime',
    // Marathi
    'खेळ': 'sports',
    'व्यवसाय': 'business',
    'आरोग्य': 'health',
    'तंत्रज्ञान': 'technology',
    'राजकारण': 'politics',
    'गुन्हा': 'crime'
  };
  return map[lower] || lower;
}

async function resolveCategoryId(raw: any, fallbackId: any): Promise<any> {
    if (!raw) return fallbackId;
  
    // Handle the specific object format from RSS feeds like { _: 'Sports', '$': {} }
    if (typeof raw === 'object' && raw !== null && typeof raw._ === 'string') {
      const categoryName = normalizeCategoryName(raw._);
      const byKey = await Category.findOne({ key: new RegExp(`^${categoryName}$`, 'i') });
      if (byKey) return byKey._id;
      const byLabel = await Category.findOne({ label: new RegExp(`^${categoryName}$`, 'i') });
      if (byLabel) return byLabel._id;
    }
    
    // Handle string names directly
    if (typeof raw === "string") {
      if (mongoose.Types.ObjectId.isValid(raw)) return raw;
      const normalized = normalizeCategoryName(raw);
      const byKey = await Category.findOne({ key: new RegExp(`^${normalized}$`, 'i') });
      if (byKey) return byKey._id;
      const byLabel = await Category.findOne({ label: new RegExp(`^${normalized}$`, 'i') });
      if (byLabel) return byLabel._id;
    }
  
    // Handle arrays by iterating through them
    if (Array.isArray(raw)) {
      for (const item of raw) {
        const result = await resolveCategoryId(item, null);
        if (result) return result; // Return the first match found
      }
    }
  
    // Handle mongoose documents or objects with an _id
    if (typeof raw === 'object' && raw !== null && raw._id && mongoose.Types.ObjectId.isValid(raw._id)) {
      return raw._id;
    }
  
    return fallbackId;
}
  

async function ensureFallbackCategory() {
  let fallback = await Category.findOne({ key: "uncategorized" });
  if (!fallback) {
    fallback = await Category.create({
      key: "uncategorized",
      label: "Uncategorized",
      icon: "newspaper",
      color: "#9CA3AF",
      order: 999,
      active: true,
    });
    logger.info("✅ Created fallback category: Uncategorized");
  }
  return fallback;
}

// Dynamic category creation based on content analysis
async function createDynamicCategory(detectedCategory: string, language: string) {
  if (!detectedCategory || detectedCategory === 'general' || detectedCategory === 'uncategorized') {
    return null;
  }

  // Check if category already exists
  let existingCategory = await Category.findOne({ 
    key: detectedCategory,
    $or: [{ language: language }, { language: { $exists: false } }]
  });
  
  if (existingCategory) {
    return existingCategory._id;
  }

  // Count articles with this detected category
  const articleCount = await Article.countDocuments({
    language: language,
    $or: [
      { 'categories': detectedCategory },
      { 'categoryDetected': detectedCategory }
    ]
  });

  // Only create if we have 10+ articles
  if (articleCount >= 10) {
    const categoryLabels: Record<string, string> = {
      'general': 'General', 'politics': 'Politics', 'sports': 'Sports', 'entertainment': 'Entertainment',
      'technology': 'Technology', 'health': 'Health', 'business': 'Business', 'education': 'Education',
      'crime': 'Crime', 'weather': 'Weather', 'science': 'Science', 'travel': 'Travel',
      'food': 'Food', 'fashion': 'Fashion', 'automobile': 'Automobile', 'realestate': 'Real Estate'
    };

    const categoryIcons: Record<string, string> = {
      'general': 'newspaper', 'politics': 'landmark', 'sports': 'trophy', 'entertainment': 'film',
      'technology': 'laptop', 'health': 'heart', 'business': 'briefcase', 'education': 'graduation-cap',
      'crime': 'shield', 'weather': 'cloud-sun', 'science': 'flask', 'travel': 'map',
      'food': 'utensils', 'fashion': 'shirt', 'automobile': 'car', 'realestate': 'home'
    };

    const categoryColors: Record<string, string> = {
      'general': '#9CA3AF', 'politics': '#EF4444', 'sports': '#10B981', 'entertainment': '#8B5CF6',
      'technology': '#3B82F6', 'health': '#F59E0B', 'business': '#06B6D4', 'education': '#84CC16',
      'crime': '#DC2626', 'weather': '#0EA5E9', 'science': '#7C3AED', 'travel': '#059669',
      'food': '#D97706', 'fashion': '#EC4899', 'automobile': '#6B7280', 'realestate': '#B45309'
    };

    const newCategory = await Category.create({
      key: detectedCategory,
      label: categoryLabels[detectedCategory] || detectedCategory.charAt(0).toUpperCase() + detectedCategory.slice(1),
      icon: categoryIcons[detectedCategory] || 'newspaper',
      color: categoryColors[detectedCategory] || '#9CA3AF',
      order: 100,
      active: true,
      language: language,
      isDynamic: true
    });

    logger.info(`✅ Created dynamic category: ${newCategory.label} (${articleCount} articles)`);
    return newCategory._id;
  }

  return null;
}

async function scrape() {
  await connectDB();

  const fallback = await ensureFallbackCategory();
  const sources = await Source.find({ active: true });

  // Optional: restrict scraping to specific RSS URLs (comma-separated)
  const ONLY_RSS_ENV = (process.env.ONLY_RSS || "").split(/[,\s]+/).filter(Boolean);
  const ONLY_RSS_SET = new Set(ONLY_RSS_ENV.map((u:string)=>u.trim()));

  logger.info(`🔹 Found ${sources.length} active sources`);
  let totalSaved = 0;

  for (const source of sources) {
    logger.info(`🔹 Scraping: ${source.name}`);

    for (const rssUrl of source.rssUrls) {
      if (ONLY_RSS_SET.size > 0 && !ONLY_RSS_SET.has(String(rssUrl).trim())) {
        continue;
      }
      try {
        // Try standard parser first; on error, fallback fetch+parse
        let feed: any = null;
        try {
          feed = await parser.parseURL(rssUrl);
        } catch (parseErr) {
          logger.warn(`⚠️  parseURL failed for ${source.name} (${rssUrl}): ${parseErr}. Trying fallback...`);
          try {
            const data = await fetchWithFallback(rssUrl);
            const parsed = await new Parser.default().parseString(data);
            if (parsed && Array.isArray(parsed.items) && parsed.items.length > 0) {
              feed = parsed;
              logger.info(`✅ Parsed RSS via fallback for ${source.name}`);
            }
          } catch (rssErr) {
            logger.warn(`⚠️  RSS fallback failed for ${source.name}: ${rssErr}`);
          }
        }

        // If parseURL succeeded but returned empty, also attempt fallback
        if (!feed || !Array.isArray(feed.items) || feed.items.length === 0) {
          try {
            const data = await fetchWithFallback(rssUrl);
            const parsed = await new Parser.default().parseString(data);
            if (parsed && Array.isArray(parsed.items) && parsed.items.length > 0) {
              feed = parsed;
              logger.info(`✅ Parsed RSS via fallback for ${source.name}`);
            }
          } catch (rssErr) {
            logger.warn(`⚠️  RSS fallback (empty->retry) failed for ${source.name}: ${rssErr}`);
          }
        }

        if (!feed || !Array.isArray(feed.items) || feed.items.length === 0) {
          logger.error(`Error scraping RSS for ${source.name}: No items after all attempts`);
          continue;
        }

        for (const item of feed.items) {
          try {
            let content = item.contentSnippet || "";
            let image: string | null = null;
            let altText: string | null = null;

            if (item.link) {
              try {
                const data = await fetchWithFallback(item.link);

                const $ = cheerio.load(data);
                
                const imageUrl = $('meta[property="og:image"]').attr("content") || $('meta[name="twitter:image"]').attr("content") || null;
                image = imageUrl || $("img").first().attr("src") || null;
                
                altText = $('meta[property="og:image:alt"]').attr("content") || item.title || "Article image";

                content = $("p").text().trim().slice(0, 5000);
              } catch (err) {
                logger.error(`Failed to fetch article body for ${item.link}: ${err}`);
              }
            }

            const hash = generateHash(
              item.link || item.title || JSON.stringify(item).slice(0, 200)
            );

            // Check for duplicates by hash OR canonicalUrl
            const exists = await Article.findOne({ 
              $or: [
                { hash },
                { canonicalUrl: item.link || "" }
              ]
            });
            if (exists) {
              continue; // Skip silently
            }

            
            let categoryId = await resolveCategoryId(item.categories, null);

            // If the article's own categories didn't match anything, try all source categories before fallback
            if (!categoryId && Array.isArray(source.categories) && source.categories.length > 0) {
              for (const srcCat of source.categories) {
                const res = await resolveCategoryId(srcCat, null);
                if (res) { categoryId = res; break; }
              }
            }
            // Final fallback
            if (!categoryId) {
              categoryId = fallback._id;
            }
            
            // Detect category from content and try to create dynamic category
            const detectedCategory = computeCategoryFromText(
              item.title || "Untitled", 
              item.contentSnippet || content || "No summary", 
              content || item.contentSnippet || item.title || "No content available", 
              source.lang || "en"
            );
            
            // Try to create dynamic category if detected category is not standard
            if (detectedCategory && detectedCategory !== 'general' && detectedCategory !== 'uncategorized') {
              const dynamicCategoryId = await createDynamicCategory(detectedCategory, source.lang || "en");
              if (dynamicCategoryId) {
                categoryId = dynamicCategoryId;
              }
            }
            
            const articleDoc = new Article({
              title: item.title || "Untitled",
              images: image ? [{ url: image, alt: altText || item.title || "Article image" }] : [],
              slug:
                (item.title || "untitled")
                  .toLowerCase()
                  .replace(/[^a-z0-9]+/g, "-")
                  .replace(/(^-|-$)/g, "") +
                "-" +
                Date.now(),
              summary: truncate(
                item.contentSnippet || content || item.title || "No summary",
                300
              ),
              content:
                content || item.contentSnippet || item.title || "No content available",
              category: categoryId,
              categories: source.categories || [],
              categoryDetected: detectedCategory,
              tags: [],
              author: item.creator || item.author || source.name || "Unknown",
              language: source.lang || "en",
              source: {
                name: source.name,
                url: source.url,
                sourceId: source._id
              },
              status: "scraped",
              publishedAt: item.isoDate ? new Date(item.isoDate) : new Date(),
              scrapedAt: new Date(),
              canonicalUrl: item.link || "",
              thumbnail: image,
              wordCount: (content || item.contentSnippet || item.title || "").split(/\s+/).length,
              readingTime: Math.ceil((content || item.contentSnippet || item.title || "").split(/\s+/).length / 200),
              
              seo: {
                metaDescription: truncate(
                  item.contentSnippet || content || item.title || "",
                  160
                ),
                keywords: [],
              },
              hash,
            });

            try {
              await articleDoc.save();
              totalSaved++;
              logger.info(`✅ Saved: ${truncate(articleDoc.title, 60)}`);
            } catch (saveErr: any) {
              // Handle duplicate key errors gracefully
              if (saveErr.code === 11000) {
                // Silently skip duplicates
                continue;
              }
              throw saveErr; // Re-throw other errors
            }
          } catch (innerErr) {
            logger.error(`Error saving article from ${rssUrl}: ${innerErr}`);
          }
        }
      } catch (err) {
        logger.error(`Error scraping RSS for ${source.name}: ${err}`);
      }
    }
  }

  logger.info(`✅ Scraping completed. Total articles saved: ${totalSaved}`);
  await disconnectDB();
}

scrape().catch((err) => {
  logger.error("Fatal error in scraper", err);
  disconnectDB();
});
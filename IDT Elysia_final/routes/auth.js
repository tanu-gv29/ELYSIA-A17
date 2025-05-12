const express = require('express');
const bcrypt = require('bcryptjs');
const router = express.Router();
const User = require('../models/User');
const Report = require('../models/Report');
const Sentiment = require('sentiment'); // ⬅️ Add at the top of your file
const sentiment = new Sentiment();

// Middleware
router.use((req, res, next) => {
  res.locals.user = req.session.user;
  next();
});

// Routes
router.get('/', (req, res) => res.render('index'));
router.get('/aboutus', (req, res) => res.render('Aboutus'));
router.get('/dashboard', (req, res) => {
  if (!req.session.user) return res.redirect('/login');
  res.render('Dashboard');
});

// Signup
router.get('/signup', (req, res) => res.render('Signup'));
router.post('/signup', async (req, res) => {
  const { fullName, email, password } = req.body;
  const existing = await User.findOne({ email });
  if (existing) return res.send('User already exists. Please login.');

  const hashed = await bcrypt.hash(password, 10);
  const user = new User({ fullName, email, password: hashed });
  await user.save();
  res.redirect('/login');
});

// Login
router.get('/login', (req, res) => res.render('Login'));
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email });
  if (!user || !(await bcrypt.compare(password, user.password))) {
    return res.send('Invalid credentials. Try again.');
  }

  req.session.user = {
    id: user._id,
    name: user.fullName,
    email: user.email,
    initial: user.fullName.charAt(0).toUpperCase()
  };

  res.redirect('/dashboard');
});

// Profile
router.get('/profile', (req, res) => {
  if (!req.session.user) return res.redirect('/login');
  res.render('Profile', { user: req.session.user });
});

// Talk and Chat Pages
router.get('/talk', (req, res) => {
  if (!req.session.user) return res.redirect('/login');
  res.render('Talk');
});
router.get('/chat', (req, res) => {
  if (!req.session.user) return res.redirect('/login');
  res.render('Chat');
});

// Save transcript
router.post('/report', async (req, res) => {
  const messages = req.body.messages || [];

  if (req.session.user) {
    const report = new Report({
      userId: req.session.user.id,
      messages
    });
    await report.save();
    req.session.lastReportId = report._id;
  }

  res.sendStatus(200);
});

// Generate report
router.get('/report', async (req, res) => {
  if (!req.session.user || !req.session.lastReportId) return res.redirect('/dashboard');

  const report = await Report.findById(req.session.lastReportId);
  if (!report) return res.redirect('/dashboard');

  const rawMessages = report.messages || [];

  // ✅ Normalize and extract text safely
  const normalizedMessages = rawMessages
    .map(m => typeof m === "string" ? m : m.text || "")
    .map(msg => msg.toLowerCase().replace(/[.,!?]/g, '').trim());

  const moodKeywords = {
  Stressed: ["stress", "stressed", "pressure", "overwhelmed", "tense", "burned out", "burnt out"],
  Anxious: ["anxiety", "anxious", "worried", "nervous", "panicked", "panic", "uneasy", "on edge"],
  Sad: ["sad", "upset", "down", "depressed", "low", "blue", "unhappy", "hopeless"],
  Angry: ["angry", "frustrated", "mad", "irritated", "furious", "pissed", "rage", "annoyed"],
  Confused: ["confused", "confusing", "unclear", "unsure", "lost", "don’t understand", "don't understand", "can’t figure out", "can't figure out"],
  Tired: ["tired", "exhausted", "fatigued", "sleepy", "drained", "worn out", "burned out"],
  Happy: ["happy", "excited", "joyful", "content", "cheerful", "delighted", "thrilled"],
  Lonely: ["lonely", "alone", "isolated", "left out", "disconnected", "abandoned"]
};

  // ✅ Scoring logic with console logs for debugging
  const moodScores = {};
  for (const msg of normalizedMessages) {
    for (const [mood, keywords] of Object.entries(moodKeywords)) {
      for (const keyword of keywords) {
        if (msg.includes(keyword)) {
          moodScores[mood] = (moodScores[mood] || 0) + 1;
          console.log(`Matched keyword "${keyword}" for mood "${mood}" in message: "${msg}"`);
        }
      }
    }
  }

  let detectedMood = "Neutral";
  if (Object.keys(moodScores).length > 0) {
    detectedMood = Object.entries(moodScores).sort((a, b) => b[1] - a[1])[0][0];
  }

  const takeaways = normalizedMessages.filter(msg =>
    ["i feel", "i am", "i’m", "ive been", "i've been"].some(p => msg.includes(p))
  ).slice(0, 3);

  const moodRecommendations = {
    Stressed: ["Try deep breathing", "Take breaks", "Write in a journal"],
    Anxious: ["Practice mindfulness", "Talk to a friend", "Do a relaxing activity"],
    Sad: ["Take a walk", "Listen to music", "Journal your thoughts"],
    Angry: ["Pause before reacting", "Do physical activity", "Try calming techniques"],
    Confused: ["Clarify your thoughts", "Seek advice", "Take a break and revisit"],
    Tired: ["Take a power nap", "Stay hydrated", "Stretch and move"],
    Happy: ["Celebrate your joy", "Share your moment", "Reflect on your happiness"],
    Lonely: ["Call someone", "Join a group activity", "Connect with others"],
    Neutral: ["Check in with yourself", "Be mindful", "Maintain balance"]
  };

  const quotes = [
    "Every step counts! Every conversation is a step towards a healthier mind.",
    "Talking helps heal. You did something amazing today.",
    "Healing starts with a single word — and you spoke it.",
    "You're stronger than you think.",
    "It’s okay to not be okay. Progress begins with honesty."
  ];

  const summary = {
    mood: detectedMood,
    takeaways,
    nextSteps: moodRecommendations[detectedMood] || [],
    quote: quotes[Math.floor(Math.random() * quotes.length)]
  };

  await Report.findByIdAndUpdate(req.session.lastReportId, {
    mood: summary.mood,
    takeaways: summary.takeaways,
    nextSteps: summary.nextSteps,
    quote: summary.quote
  });

  res.render('Report', { user: req.session.user, summary });
});

// View past reports
router.get('/past', async (req, res) => {
  if (!req.session.user) return res.redirect('/login');
  const reports = await Report.find({ userId: req.session.user.id }).sort({ createdAt: -1 });
  res.render('Past', { user: req.session.user, reports });
});

// Logout
router.get('/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/');
  });
});

module.exports = router;

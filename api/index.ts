import express from "express";
import cors from "cors";
import { v4 as uuidv4 } from "uuid";
import { initializeApp } from "firebase/app";
import { getFirestore, doc, setDoc, getDoc, deleteDoc, collection, query, where, getDocs, updateDoc } from "firebase/firestore";
import nodemailer from 'nodemailer';
import firebaseConfig from '../firebase-applet-config.json';

const app = express();

// Initialize Firebase
const firebaseApp = initializeApp(firebaseConfig);
const db = getFirestore(firebaseApp, firebaseConfig.firestoreDatabaseId);

// Setup Nodemailer Transporter
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: 'sloudsan@gmail.com',
    pass: process.env.GMAIL_APP_PASSWORD || ''
  }
});

// Pre-registered clients
const clients = [
  {
    clientId: "sansneat-client-id",
    clientSecret: "sansneat-secret",
    redirectUris: ["http://localhost:3000/auth/callback", "https://sansneat.run.app/auth/callback"],
    name: "Sansneat"
  },
  {
    clientId: "sansncar-client-id",
    clientSecret: "sansncar-secret",
    redirectUris: ["http://localhost:3000/auth/callback", "https://sansncar.run.app/auth/callback"],
    name: "Sansncar"
  },
  {
    clientId: "sanscounts-client-id",
    clientSecret: "sanscounts-secret",
    redirectUris: ["http://localhost:3000/auth/callback", "https://sanscounts.run.app/auth/callback"],
    name: "Sanscounts"
  },
  {
    clientId: "sansnsea-client-id",
    clientSecret: "sansnsea-secret",
    redirectUris: ["http://localhost:3000/auth/callback", "https://sansnsea.run.app/auth/callback"],
    name: "Sansnsea"
  },
  {
    clientId: "sansmap-client-id",
    clientSecret: "sansmap-secret",
    redirectUris: ["http://localhost:3000/auth/callback", "https://sansmap.run.app/auth/callback"],
    name: "Sansmap"
  }
];

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// OTP Endpoints
app.post("/api/auth/send-otp", async (req, res) => {
  const { phoneNumber } = req.body;
  if (!phoneNumber) return res.status(400).json({ error: "Phone number is required" });

  const code = "200824"; // Default for testing/demo
  const expiresAt = Date.now() + 5 * 60 * 1000;

  try {
    await setDoc(doc(db, "verification_codes", phoneNumber), {
      email: phoneNumber,
      code,
      type: "login_verify",
      status: "pending",
      createdAt: new Date().toISOString(),
      expiresAt: new Date(expiresAt).toISOString()
    });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Failed to send OTP" });
  }
});

app.post("/api/auth/verify-otp", async (req, res) => {
  const { phoneNumber, code } = req.body;
  try {
    const otpDoc = await getDoc(doc(db, "verification_codes", phoneNumber));
    if (!otpDoc.exists()) return res.status(400).json({ error: "Invalid OTP" });
    
    const data = otpDoc.data();
    if (data.code === code && new Date(data.expiresAt).getTime() > Date.now()) {
      await updateDoc(doc(db, "verification_codes", phoneNumber), { status: "used" });
      res.json({ success: true });
    } else {
      res.status(400).json({ error: "Invalid or expired OTP" });
    }
  } catch (error) {
    res.status(500).json({ error: "Verification failed" });
  }
});

app.post("/api/auth/send-otp-email", async (req, res) => {
  const { email, code } = req.body;
  if (!email || !code) return res.status(400).json({ error: "Missing fields" });

  if (!process.env.GMAIL_APP_PASSWORD) {
    return res.json({ success: true, simulated: true });
  }

  try {
    await transporter.sendMail({
      from: '"Sanscounts Security" <sloudsan@gmail.com>',
      to: email,
      subject: 'Your Sanscounts Verification Code',
      html: `<div style="font-family: sans-serif; padding: 20px;"><h1>${code}</h1></div>`
    });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Email failed" });
  }
});

app.get("/api/oauth/client", async (req, res) => {
  const { client_id } = req.query;
  let client = clients.find(c => c.clientId === client_id);
  
  if (!client && typeof client_id === 'string') {
    const q = query(collection(db, "developer_apps"), where("clientId", "==", client_id));
    const snapshot = await getDocs(q);
    if (!snapshot.empty) {
      const data = snapshot.docs[0].data();
      client = { clientId: data.clientId, clientSecret: data.clientSecret, redirectUris: [], name: data.appName || data.name };
    }
  }

  if (!client && typeof client_id === 'string' && client_id.includes('-client-id')) {
    const name = client_id.replace('-client-id', '');
    client = { clientId: client_id, clientSecret: 'secret', redirectUris: [], name: name.charAt(0).toUpperCase() + name.slice(1) };
  }

  if (!client) return res.status(404).json({ error: "invalid_client" });
  res.json({ name: client.name });
});

app.post("/api/oauth/authorize", async (req, res) => {
  const { client_id, redirect_uri, user_id, email, name } = req.body;
  const code = uuidv4();
  await setDoc(doc(db, "oauth_codes", code), {
    clientId: client_id,
    redirectUri: redirect_uri,
    userId: user_id,
    email,
    name,
    expiresAt: Date.now() + 10 * 60 * 1000
  });
  res.json({ code });
});

app.post("/oauth/token", async (req, res) => {
  const { grant_type, code, client_id, client_secret } = req.body;
  const authDoc = await getDoc(doc(db, "oauth_codes", code));
  const authData = authDoc.data();

  if (!authData || authData.clientId !== client_id || authData.expiresAt < Date.now()) {
    return res.status(400).json({ error: "invalid_grant" });
  }

  const accessToken = uuidv4();
  await setDoc(doc(db, "oauth_tokens", accessToken), {
    userId: authData.userId,
    email: authData.email,
    name: authData.name,
    clientId: client_id,
    expiresAt: Date.now() + 60 * 60 * 1000
  });
  await deleteDoc(doc(db, "oauth_codes", code));

  res.json({ access_token: accessToken, token_type: "Bearer", expires_in: 3600 });
});

app.get("/oauth/userinfo", async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: "unauthorized" });
  const token = authHeader.split(" ")[1];
  const tokenDoc = await getDoc(doc(db, "oauth_tokens", token));
  const data = tokenDoc.data();
  if (!data || data.expiresAt < Date.now()) return res.status(401).json({ error: "invalid_token" });
  res.json({ sub: data.userId, email: data.email, name: data.name });
});

export default app;

